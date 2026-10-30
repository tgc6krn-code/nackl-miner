// NACKL Miner — app logic
// Rewritten to run against the official, unminified Bee Engine SDK 6.0.0
// (gosh-sh/bee-engine). All game/UI/mining-loop behavior below preserves
// everything fixed over the previous iterations of this app:
//   - JSON-safe parsing of the start() callback event
//   - a single in-flight Miner-creation promise (no racing parallel on())
//   - automatic retry+backoff for miner creation, wallet confirmation,
//     and round starts on transient network/queue errors
//   - adaptive pause between rounds depending on whether the previous
//     session actually got confirmed
//   - console.error capture into the on-screen log
//   - a persisted local queue of taps, drained at a human-like pace
// Fixes in this revision:
//   - the Stop button now calls miner.stop() (official API): the running session
//     ends immediately and its taps are submitted, instead of waiting out the
//     remaining ~5.5 minutes. Then the normal root/proof collection runs and
//     mining finishes (no next session).
//   - a build marker (APP_VERSION) is printed on the first log line, so it is
//     obvious which app.js the WebView actually runs (it may be cached)
// Earlier fixes kept:
//   - a submit_session_proof event WITH an error no longer counts as a
//     success (separate proofOk flag), so hourly stats and the pause
//     before the next session are correct
//   - sessions with zero taps sent are not recorded in the hourly stats
//     (the worker submits nothing for an empty tap tree, so it is not a
//     network failure) and do not wait 60s for a proof that cannot come
//   - the next session starts right after the previous one ends instead of
//     waiting up to 60s for its proof, so the cycle stays ~one 330 s reward
//     epoch; each session's outcome is collected in the background (up to
//     120 s) and a long pause is applied only after a confirmed failure
//   - if can_start() stays false the miner is rebuilt once before stopping
//   - no dead time between sessions: after a session ends the next one
//     starts as soon as the root outcome is known (~4 s); a failed root
//     rebuilds the miner right away and skips the useless proof wait;
//     failed reads are retried within seconds; no fixed pause after a
//     failed session (it never changed the outcome)

// The SDK is loaded dynamically: first the patched build in ./sdk/ (built by the GitHub Action
// "Build patched Bee SDK": session root/proof are re-sent on queue-full / timeouts), and if it
// is not there, the stock ./bee_sdk.js with the WASM from the npm CDN (old behaviour).
let init;
let Miner;
let gen_mining_keys;
let ensure_mining_keys_propagated;
let get_miner_address_by_wallet_name;
let patchedSdk = false;

async function loadSdk() {
  try {
    const mod = await import('./sdk/bee_sdk.js');
    if (typeof mod.Miner?.prototype?.set_submit_deadline !== 'function') {
      throw new Error('в sdk/bee_sdk.js нет set_submit_deadline');
    }
    return { mod, wasm: new URL('./sdk/bee_sdk_bg.wasm', import.meta.url).href, patched: true };
  } catch (e) {
    log('Пропатченный SDK (./sdk/) не загружен: ' + ((e && e.message) || e) + ' — использую стоковый.');
    const mod = await import('./bee_sdk.js');
    return {
      mod,
      wasm: 'https://cdn.jsdelivr.net/npm/@teamgosh/bee-sdk@6.0.0/bee_sdk_bg.wasm',
      patched: false,
    };
  }
}

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const APP_VERSION = '2026-10-29-patched-sdk-v3-100rounds';

const APP_ID = '0x0000000000000000000000000000000000000000000000000000000000000033';
// A/B switch for the endpoint form. The SDK's own README passes bare hosts
// (e.g. "https://shellnet.ackinacki.org"); this app has always passed the
// explicit "/graphql" URL. Set USE_BARE_ENDPOINT to true to test the README form.
const USE_BARE_ENDPOINT = false;
const GRAPHQL_URL = 'https://mainnet.ackinacki.org/graphql';
const ENDPOINTS = [USE_BARE_ENDPOINT ? 'https://mainnet.ackinacki.org' : GRAPHQL_URL];
const CLIENT_CONFIG = { network: { endpoints: ENDPOINTS } };

const WALLET_SESSION_KEY = 'nackl_miner_session_v1';
const PENDING_TAPS_KEY = 'nackl_pending_taps_v1';
// Key pairs handed to AN Wallet whose registration may still land on-chain later.
// Without this, a transaction that lands after the page was closed would leave
// an on-chain key whose secret we no longer hold (every message -> ERR_NOT_OWNER).
const PENDING_KEYS_KEY = 'nackl_pending_keys_v1';
const MAX_PENDING_KEYS = 5;

const SESSION_DURATION_MS = 330_000; // 5.5 minutes (same as Popit Music)
const MAX_TAPS_PER_ROUND = 70;
const MAX_ROUNDS = 100;

// After an accepted root, wait for that session's proof (up to this long) before starting
// the next session on the same miner. When roots are rejected nothing is waited for.
const PROOF_WAIT_FOR_NEXT_MS = 60_000;
const BASE_TAP_INTERVAL_MS = 4_000;
const PROOF_GRACE_MS = 120_000; // how long to wait (in the background) for a session's proof
const CAN_START_WAIT_MS = 120_000; // how long can_start() may stay false before rebuilding (a pending proof must not be cancelled)
// The tap backlog has NO size limit: taps played faster than they can be sent (up to
// MAX_TAPS_PER_ROUND per session) are banked and drained over the following sessions.
// Shown in the UI as the capacity of one full run.
const RUN_TAP_CAPACITY = MAX_TAPS_PER_ROUND * MAX_ROUNDS;
const MAX_ROUND_RETRIES = 60; // transient network errors before giving up on a round
// After a session ends, how long to wait for the root outcome. The SDK's own network timeout is
// ~30 s ("fetch operation timeout" arrived 30.7-31.3 s after the end in the logs), so waiting only
// 20 s meant the next session started on a miner that was flagged corrupted 10 s later.
const ROOT_WAIT_MS = 35_000;
const FINALIZATION_WAIT_MS = 15_000; // max wait for in-flight submissions before freeing a miner

// Patched SDK only: how often a refused root/proof is re-sent (1-10 s), and for how long after the
// session ends the SDK may keep re-sending (root, then proof ~45-60 s later).
const SUBMIT_RETRY_MS = 3_000;
const SUBMIT_DEADLINE_AFTER_END_MS = 150_000;

const MINESWEEPER_SIZE = 8;
const MINESWEEPER_MINE_COUNT = 10;

const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();

// ---------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------

const ui = {
  walletDot: document.getElementById('wallet-dot'),
  walletStatus: document.getElementById('wallet-status'),
  miningDot: document.getElementById('mining-dot'),
  miningStatus: document.getElementById('mining-status'),
  balance: document.getElementById('balance'),
  walletNameInput: document.getElementById('wallet-name-input'),
  btnConnect: document.getElementById('btn-connect'),
  deepLink: document.getElementById('deep-link'),
  btnConfirmed: document.getElementById('btn-confirmed'),
  btnMine: document.getElementById('btn-mine'),
  btnStop: document.getElementById('btn-stop'),
  btnStatus: document.getElementById('btn-status'),
  btnForget: document.getElementById('btn-forget'),
  log: document.getElementById('log'),
  minesweeper: document.getElementById('minesweeper'),
  msGrid: document.getElementById('ms-grid'),
  msMines: document.getElementById('ms-mines'),
  tapCount: document.getElementById('tap-count'),
  cellCount: document.getElementById('cell-count'),
  btnRestart: document.getElementById('btn-restart'),
  connectCard: document.getElementById('connect-card'),
};

// ---------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------

function log(message) {
  const time = new Date().toLocaleTimeString();
  ui.log.innerHTML = `[${time}] ${message}<br>` + ui.log.innerHTML;
  console.log(message);
}

// Mirror whatever the WASM module (or anything else) writes to
// console.error into the visible log, so nothing silent gets lost.
(function captureConsoleErrors() {
  const original = console.error;
  console.error = (...args) => {
    try {
      const text = args
        .map((a) => {
          try {
            if (typeof a === 'string') return a;
            if (a instanceof Error) return a.message || String(a);
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');
      if (text && text !== '{}') log(`[console.error] ${text}`);
    } catch {
      // never let the logger itself throw
    }
    original.apply(console, args);
  };
})();

// The contract rejected the message itself (compute phase, exit code 402 =
// ERR_NOT_OWNER): the key we sign with is not the owner key stored on-chain
// for this app. A bare includes('402') would also fire on "402" inside hashes
// of unrelated errors, so only the exit_code field (or the name) counts.
function isNotOwnerError(text) {
  return /NOT_OWNER/i.test(text) || /exit_code\D{0,16}402(?!\d)/i.test(text);
}

function hintIfNotOwner(message) {
  if (!message) return;
  const text = String(message);
  if (!isNotOwnerError(text)) return;
  state.notOwnerStreak = (state.notOwnerStreak || 0) + 1;
  if (state.notOwnerStreak < 3) {
    log(
      `⚠️ Контракт отклонил сообщение: ERR_NOT_OWNER (402), подряд: ${state.notOwnerStreak}/3. ` +
        'Если это повторится, ключ в блокчейне не совпадает с сохранённым.'
    );
    return;
  }
  // stop burning taps on a key that the contract keeps rejecting
  state.autoContinueRounds = false;
  log(
    '🛑 ERR_NOT_OWNER (402) три раза: контракт принимает сообщения, но отклоняет нашу подпись — ' +
      'ключ в блокчейне не совпадает с сохранённым. Майнинг остановлен. Нажми «Забыть кошелёк и ' +
      'переподключить заново» и подтверди ключ в AN Wallet (приложение ждёт его до 15 минут).'
  );
}

// The start() callback may deliver either a JSON string or an already
// parsed object, depending on the build. Handle both safely.
function parseMinerEvent(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      log('Не удалось распарсить событие майнера: ' + e.message);
      return null;
    }
  }
  return raw;
}

// A network/queue error we should transparently retry, rather than
// surface as a hard failure.
function isTransientNetworkError(message) {
  return /message queue is full|failed to fetch|timeout/i.test(message || '');
}

// The SDK wraps node errors in very long debug strings; keep the log readable.
function shortError(message) {
  const text = String(message || '');
  // Gateway (Block Manager) could not hand the message to the Block Producer: keep the whole
  // reason, the interesting part is at the end of the long wrapper string.
  const redir = text.search(/redirection to the Block Producer/i);
  if (redir >= 0) return 'BM→BP: ' + text.slice(redir, redir + 450);
  if (/QUEUE_OVERFLOW|message queue is full/i.test(text)) {
    const stage = /Cancel stale session data/i.test(text) ? ' (при очистке зависшей сессии)' : '';
    return 'QUEUE_OVERFLOW (621): очередь сообщений ноды переполнена' + stage;
  }
  if (/failed to fetch/i.test(text)) {
    const code = /code:\s*(\d+)/i.exec(text);
    return (
      'Failed to fetch' +
      (code ? ` (код ${code[1]})` : '') +
      ': запрос к GraphQL-эндпоинту не дошёл (сеть / VPN / эндпоинт недоступен)'
    );
  }
  return text.length > 220 ? text.slice(0, 220) + '…' : text;
}

// One-shot reachability check of the GraphQL endpoint, to tell a network
// problem apart from a node-side error when the SDK reports "Failed to fetch".
async function probeEndpoint() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const t0 = Date.now();
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{__typename}' }),
      signal: controller.signal,
    });
    log(`Проверка эндпоинта: HTTP ${res.status} за ${Date.now() - t0} мс.`);
  } catch (e) {
    log(
      'Проверка эндпоинта: запрос не дошёл (' +
        (e.name === 'AbortError' ? 'таймаут 10 с' : e.message || e) +
        ') — проблема сети/VPN/CORS или эндпоинт недоступен.'
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------

const state = {
  wasmReady: false,
  connected: false,
  mining: false,
  minerAddress: null,
  miningPublic: null,
  miningSecret: null,
  miner: null,
  tapCount: 0,
  networkTapsSent: 0,
  pendingWalletName: null,
  pendingKeys: null,
  currentRound: 0,
  tapsThisRound: 0,
  autoContinueRounds: false,
  minerNeedsRecreate: false,
  pendingTaps: [],
  lastTapNetworkTime: 0,
  nextTapGapMs: BASE_TAP_INTERVAL_MS,
  tapCutoffTime: 0,
  roundTimeout: null,
  rnRetries: 0,
  consecutiveRoundErrors: 0,
  notOwnerStreak: 0,
  keyOk: null,
  keyWarned: false,
  endpointProbed: false,
  nextRoundTimer: null,
  failedTaps: 0,
  lastSessionOk: null,
  fullRounds: 0,
  tapCap: MAX_TAPS_PER_ROUND,
  pendingFinalizations: 0,
  endSessionNow: null, // set while a session is computing: ends it right now (Stop button)
};

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

async function boot() {
  try {
    log('Загрузка Bee Engine SDK…');
    // Loaded straight from the public npm CDN — no need to host this
    // 9MB binary in this repo at all.
    const sdk = await loadSdk();
    ({
      default: init,
      Miner,
      gen_mining_keys,
      ensure_mining_keys_propagated,
      get_miner_address_by_wallet_name,
    } = sdk.mod);
    patchedSdk = sdk.patched;
    await init({ module_or_path: sdk.wasm });
    state.wasmReady = true;
    log(
      'SDK готов (' +
        (patchedSdk ? 'патч: повторная отправка root/proof' : 'стоковый, без повторной отправки') +
        ').'
    );
    state.pendingTaps = loadPendingTaps();
    if (state.pendingTaps.length > 0) {
      log(
        `В очереди с прошлого раза: ${state.pendingTaps.length} неотправленных тапов — ` +
          'досошлём в ближайших сессиях.'
      );
    }
    restoreWalletSession();
    setTimeout(async () => {
      const ok = state.connected ? await checkKeyOnChain() : false;
      if (ok !== true && loadPendingKeys().length > 0) await adoptPendingKeys();
    }, 1500);
    // the wallet's transaction may land minutes later: keep looking while the page is open
    setInterval(() => {
      if (!state.mining && state.keyOk !== true && loadPendingKeys().length > 0) adoptPendingKeys();
    }, 45_000);
    setInterval(tick, 1000);
  } catch (e) {
    log('Ошибка загрузки SDK: ' + e.message);
  }
}

// ---------------------------------------------------------------------
// Wallet session persistence
// ---------------------------------------------------------------------

function restoreWalletSession() {
  try {
    const raw = localStorage.getItem(WALLET_SESSION_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.minerAddress = saved.minerAddress;
    state.miningPublic = saved.miningPublic;
    state.miningSecret = saved.miningSecret;
    state.connected = true;
    ui.walletDot.className = 'dot on';
    ui.walletStatus.textContent = 'Подключен (сохранённая сессия)';
    ui.btnMine.disabled = false;
    ui.btnStatus.disabled = false;
    ui.connectCard.style.display = 'none';
    log('Восстановлена предыдущая сессия кошелька.');
  } catch (e) {
    log('Не удалось восстановить сессию: ' + e.message);
  }
}

function loadPendingKeys() {
  try {
    const raw = localStorage.getItem(PENDING_KEYS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function rememberPendingKeys(walletName, keys) {
  try {
    const list = loadPendingKeys().filter((p) => p.public !== keys.public);
    list.push({ walletName, public: keys.public, secret: keys.secret, at: Date.now() });
    localStorage.setItem(PENDING_KEYS_KEY, JSON.stringify(list.slice(-MAX_PENDING_KEYS)));
  } catch {
    // not fatal: the normal confirm flow still works while the page stays open
  }
}

function clearPendingKeys() {
  try {
    localStorage.removeItem(PENDING_KEYS_KEY);
  } catch {
    // ignore
  }
}

function showConnectedUi(statusText) {
  ui.walletDot.className = 'dot on';
  ui.walletStatus.textContent = statusText;
  ui.deepLink.style.display = 'none';
  ui.btnConfirmed.style.display = 'none';
  ui.btnMine.disabled = false;
  ui.btnStatus.disabled = false;
  ui.connectCard.style.display = 'none';
}

// If a pending pair's public key is now the owner key on-chain (the wallet's
// transaction finally went through), adopt that pair as the active session.
let adoptingKeys = false;
async function adoptPendingKeys() {
  if (adoptingKeys || state.mining) return false;
  const list = loadPendingKeys();
  if (list.length === 0) return false;
  adoptingKeys = true;
  try {
    for (const p of list.slice().reverse()) {
      try {
        const address =
          state.minerAddress ||
          (await get_miner_address_by_wallet_name({
            client_config: CLIENT_CONFIG,
            wallet_name: p.walletName,
          }));
        await ensure_mining_keys_propagated({
          client_config: CLIENT_CONFIG,
          miner_address: address,
          app_id: APP_ID,
          expected_owner_public: p.public,
          max_attempts: 1,
          interval_ms: 1000,
        });
        state.miner?.free?.();
        state.miner = null;
        state.minerAddress = address;
        state.miningPublic = p.public;
        state.miningSecret = p.secret;
        state.connected = true;
        state.keyOk = true;
        state.keyWarned = false;
        state.notOwnerStreak = 0;
        saveWalletSession();
        clearPendingKeys();
        showConnectedUi('Подключен (ключ появился в блокчейне)');
        log('✅ Ключ из ожидавшей пары появился в блокчейне — кошелёк подключён, можно майнить.');
        return true;
      } catch {
        // this pair is not on-chain (yet); try the next one
      }
    }
    return false;
  } finally {
    adoptingKeys = false;
  }
}

function saveWalletSession() {
  localStorage.setItem(
    WALLET_SESSION_KEY,
    JSON.stringify({
      minerAddress: state.minerAddress,
      miningPublic: state.miningPublic,
      miningSecret: state.miningSecret,
    })
  );
}

// ---------------------------------------------------------------------
// Pending-tap queue persistence + draining
// ---------------------------------------------------------------------

function loadPendingTaps() {
  try {
    const raw = localStorage.getItem(PENDING_TAPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingTaps() {
  try {
    localStorage.setItem(PENDING_TAPS_KEY, JSON.stringify(state.pendingTaps || []));
  } catch {
    // storage full / unavailable — not fatal, taps just won't survive a reload
  }
}

function queueTap(x, y) {
  state.pendingTaps = state.pendingTaps || [];
  state.pendingTaps.push([x, y]);
  savePendingTaps();
  drainTapQueue();
}

// One-second heartbeat: drains the tap queue and notices when the app was
// frozen (screen off / app in background), which can break a running session
// (another WebView miner logs the same "timers stalled" condition).
let lastTickAt = Date.now();
function tick() {
  const now = Date.now();
  const gap = now - lastTickAt;
  lastTickAt = now;
  if (gap > 5000) {
    log(
      `⚠️ Приложение было заморожено на ~${Math.round(gap / 1000)} с (экран выключен или приложение в фоне).` +
        (state.mining ? ' Идущая сессия могла пострадать.' : '')
    );
  }
  drainTapQueue();
}

// Keep the screen on while mining (best effort: not every WebView allows it).
let wakeLock = null;
let wakeLockWarned = false;
async function acquireWakeLock() {
  try {
    const api = globalThis.navigator && globalThis.navigator.wakeLock;
    if (!api || wakeLock) {
      if (!api && !wakeLockWarned) {
        wakeLockWarned = true;
        log('Удержание экрана включённым в этом окне недоступно — не блокируй телефон во время майнинга.');
      }
      return;
    }
    wakeLock = await api.request('screen');
    wakeLock.addEventListener?.('release', () => {
      wakeLock = null;
    });
    log('Экран не будет гаснуть, пока идёт майнинг.');
  } catch (e) {
    if (!wakeLockWarned) {
      wakeLockWarned = true;
      log('Не удалось удержать экран включённым (' + ((e && e.message) || e) + ') — не блокируй телефон.');
    }
  }
}
function releaseWakeLock() {
  try {
    wakeLock?.release?.();
  } catch {
    // ignore
  }
  wakeLock = null;
}
document.addEventListener?.('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (keyWaitWake) keyWaitWake(); // back from the wallet: check the key right now
  if (state.autoContinueRounds) acquireWakeLock();
});

function drainTapQueue() {
  if (
    !state.mining ||
    !state.miner ||
    !state.pendingTaps ||
    state.pendingTaps.length === 0 ||
    state.tapsThisRound >= state.tapCap ||
    (state.tapCutoffTime && Date.now() >= state.tapCutoffTime)
  ) {
    return;
  }

  const now = Date.now();
  const gap = state.nextTapGapMs || BASE_TAP_INTERVAL_MS;
  if (now - (state.lastTapNetworkTime || 0) < gap) return;

  const [x, y] = state.pendingTaps.shift();
  savePendingTaps();
  try {
    state.miner.add_tap(x, y);
    state.lastTapNetworkTime = now;
    // jitter the gap a bit so taps don't look perfectly mechanical
    state.nextTapGapMs = Math.round(BASE_TAP_INTERVAL_MS * (0.9 + Math.random() * 0.2));
    state.tapsThisRound += 1;
    state.networkTapsSent = (state.networkTapsSent || 0) + 1;
    ui.tapCount.textContent =
      `${state.networkTapsSent} / ${RUN_TAP_CAPACITY} (раунд ${state.currentRound}: ` +
      `${state.tapsThisRound}/${state.tapCap}, в очереди: ${state.pendingTaps.length})`;
  } catch (e) {
    state.pendingTaps.unshift([x, y]);
    savePendingTaps();
    log('Ошибка отправки тапа из очереди: ' + e.message);
  }
}

// ---------------------------------------------------------------------
// Hourly success/fail tally (UTC hour-of-day), for spotting patterns
// in when submit_session_root actually gets through the queue.
// ---------------------------------------------------------------------

const HOURLY_STATS_KEY = 'nackl_hourly_stats_v1';

function loadHourlyStats() {
  try {
    const raw = localStorage.getItem(HOURLY_STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordRoundOutcome(ok) {
  try {
    const stats = loadHourlyStats();
    const hour = new Date().getUTCHours();
    const key = String(hour);
    if (!stats[key]) stats[key] = { ok: 0, fail: 0 };
    stats[key][ok ? 'ok' : 'fail'] += 1;
    localStorage.setItem(HOURLY_STATS_KEY, JSON.stringify(stats));
  } catch {
    // stats are a nice-to-have, never worth breaking the mining loop over
  }
}

function hourlyStatsSummary() {
  const stats = loadHourlyStats();
  const hours = Object.keys(stats)
    .map(Number)
    .sort((a, b) => a - b);
  if (hours.length === 0) return 'пока нет данных.';
  return hours
    .map((h) => {
      const { ok, fail } = stats[h];
      const total = ok + fail;
      const pct = total ? Math.round((ok / total) * 100) : 0;
      return `${String(h).padStart(2, '0')}:00 UTC — ${ok}/${total} (${pct}%)`;
    })
    .join('; ');
}

// ---------------------------------------------------------------------
// Wallet connect / confirm / forget
// ---------------------------------------------------------------------

async function connectWallet() {
  if (!state.wasmReady) {
    log('SDK ещё не готов, подожди секунду и попробуй снова.');
    return;
  }
  const walletName = ui.walletNameInput.value.trim();
  if (!walletName) {
    log('Введи имя своего AN Wallet (точно как в самом кошельке).');
    return;
  }
  try {
    ui.btnConnect.disabled = true;
    ui.walletDot.className = 'dot pending';
    ui.walletStatus.textContent = 'Генерация ключей…';
    const keys = await gen_mining_keys(APP_ID);
    log('Mining-ключи сгенерированы.');
    state.pendingWalletName = walletName;
    state.pendingKeys = keys;
    rememberPendingKeys(walletName, keys);
    ui.deepLink.href = keys.deep_link;
    ui.deepLink.style.display = 'block';
    ui.btnConfirmed.style.display = 'block';
    ui.walletStatus.textContent = 'Открой AN Wallet и подтверди';
    log('Открой AN Wallet по кнопке ниже, подтверди регистрацию, ЗАТЕМ нажми «Я подтвердил».');
  } catch (e) {
    ui.walletDot.className = 'dot off';
    ui.walletStatus.textContent = 'Ошибка';
    log('Ошибка генерации ключей: ' + e.message);
    ui.btnConnect.disabled = false;
  }
}

// The wallet's confirmation is itself a transaction to the shared dApp, so
// under queue congestion the key can take minutes to land (another miner app
// waited 120 x 2 s and still timed out). Check one attempt at a time and keep
// the user informed instead of giving up after 30 s.
const KEY_WAIT_MS = 15 * 60_000; // wall-clock limit, not a count of checks
const KEY_CHECK_INTERVAL_MS = 2000;
let keyWaitWake = null; // lets a visibilitychange cut the pause short

// The wait is measured in real time on purpose: while the user is in the
// wallet approving the key, this app is in the background and its timers are
// throttled or frozen (another WebView miner logged a 508 s freeze in the
// middle of its 120-check loop, so the loop ran out of checks right after the
// user came back). On return we also check immediately.
async function waitForKeyOnChain(minerAddress, keys) {
  const startedAt = Date.now();
  let lastReportAt = startedAt;
  let lastError = '';
  let checks = 0;
  while (Date.now() - startedAt < KEY_WAIT_MS) {
    checks += 1;
    try {
      await ensure_mining_keys_propagated({
        client_config: CLIENT_CONFIG,
        miner_address: minerAddress,
        app_id: APP_ID,
        expected_owner_public: keys.public,
        max_attempts: 1,
        interval_ms: 1000,
      });
      return;
    } catch (e) {
      lastError = (e && e.message) || String(e);
    }
    const now = Date.now();
    if (now - lastReportAt >= 20_000) {
      lastReportAt = now;
      const sec = Math.round((now - startedAt) / 1000);
      ui.walletStatus.textContent = `Жду ключ в блокчейне… ${sec}с`;
      log(`Жду, пока ключ из AN Wallet появится в блокчейне… ${sec} с (проверок: ${checks}).`);
    }
    await new Promise((resolve) => {
      keyWaitWake = resolve;
      setTimeout(resolve, KEY_CHECK_INTERVAL_MS);
    });
    keyWaitWake = null;
  }
  throw new Error(
    `Ключ не появился в блокчейне за ${Math.round((Date.now() - startedAt) / 1000)} с: ${lastError}`
  );
}

// Read-only check that the key we hold is the one registered on-chain for this
// app. It is a GraphQL read, so it works even while the message queue is full.
async function checkKeyOnChain() {
  if (!state.minerAddress || !state.miningPublic) return null;
  let negatives = 0;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await ensure_mining_keys_propagated({
        client_config: CLIENT_CONFIG,
        miner_address: state.minerAddress,
        app_id: APP_ID,
        expected_owner_public: state.miningPublic,
        max_attempts: 1,
        interval_ms: 1000,
      });
      state.keyOk = true;
      log('✅ Ключ майнинга подтверждён в блокчейне: сохранённый ключ совпадает с зарегистрированным.');
      return true;
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (!/fetch|timeout|queue is full/i.test(msg)) negatives += 1;
      if (negatives >= 2) {
        if (loadPendingKeys().length > 0 && (await adoptPendingKeys())) return true;
        state.keyOk = false;
        log(
          '🛑 Сохранённого ключа майнинга НЕТ среди зарегистрированных в блокчейне для этого приложения ' +
            `(${shortError(msg)}). Скорее всего, ключ был удалён или заменён. Сообщения с ним контракт ` +
            'отклонит (ERR_NOT_OWNER). Нажми «Забыть кошелёк и переподключить заново».'
        );
        return false;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  log('Не удалось проверить ключ в блокчейне (сеть недоступна) — продолжаю без проверки.');
  return null;
}

async function confirmWallet() {
  if (!state.pendingKeys && !(state.minerAddress && state.miningPublic && state.miningSecret)) {
    log('Сначала нажми «Подключить AN Wallet».');
    return;
  }
  try {
    ui.btnConfirmed.disabled = true;
    ui.walletStatus.textContent = 'Проверка авторизации…';

    let minerAddress = state.minerAddress;
    const keys = state.pendingKeys || { public: state.miningPublic, secret: state.miningSecret };

    if (minerAddress) {
      log('Авторизация уже подтверждена ранее.');
    } else {
      const walletName = state.pendingWalletName;
      minerAddress = await get_miner_address_by_wallet_name({
        client_config: CLIENT_CONFIG,
        wallet_name: walletName,
      });
      log('Адрес Miner-контракта получен.');
      await waitForKeyOnChain(minerAddress, keys);
      log('Авторизация подтверждена в блокчейне.');
      state.minerAddress = minerAddress;
      state.miningPublic = keys.public;
      state.miningSecret = keys.secret;
    }

    // Connecting only needs the key to be on-chain. The Miner is created lazily
    // when mining starts; creating it here sent a "cancel stale session" message
    // into the crowded queue, and a QUEUE_OVERFLOW there made a perfectly good
    // connection look failed (and could overwrite a successful adoption).
    state.connected = true;
    state.keyOk = true;
    state.keyWarned = false;
    saveWalletSession();
    clearPendingKeys();
    state.rnRetries = 0;
    showConnectedUi('Подключен');
    log('Кошелёк успешно подключен! Miner будет создан при старте майнинга.');
  } catch (e) {
    if (state.connected && state.keyOk === true) {
      // the key was adopted (or confirmed) in the meantime: do not show an error
      showConnectedUi('Подключен');
      return;
    }
    ui.walletDot.className = 'dot off';
    ui.walletStatus.textContent = 'Ошибка подключения';
    const message = e.message || String(e);

    if (isTransientNetworkError(message) && (state.rnRetries = (state.rnRetries || 0) + 1) <= 6) {
      const delay = Math.min(5000 * state.rnRetries, 30_000);
      log(
        `Ошибка авторизации (сеть): ${message} — попробую сам через ` +
          `${Math.round(delay / 1000)}с (попытка ${state.rnRetries}/6).`
      );
      ui.walletStatus.textContent = `Сеть нестабильна, повтор через ${Math.round(delay / 1000)}с…`;
      setTimeout(() => confirmWallet(), delay);
    } else {
      log('Ошибка авторизации: ' + message);
      if (state.minerAddress) {
        log(
          'Авторизация уже была подтверждена ранее — просто нажми «Я подтвердил» ещё раз, ' +
            'повторять шаги в AN Wallet не нужно.'
        );
      } else {
        log(
          'Ключ не дошёл до блокчейна за отведённое время: либо подтверждение в AN Wallet не нажато, ' +
            'либо сеть перегружена (транзакция кошелька идёт в ту же очередь). ' +
            'Проверь, что подтвердил в кошельке, и нажми «Я подтвердил» ещё раз — позже, если сеть занята.'
        );
      }
    }
  } finally {
    ui.btnConfirmed.disabled = false;
    ui.btnConnect.disabled = false;
  }
}

function forgetWallet() {
  if (state.mining) {
    log('Сначала останови майнинг, потом переподключай кошелёк.');
    return;
  }
  // a retry may be waiting on a timer: stop it before the keys disappear
  state.autoContinueRounds = false;
  cancelScheduledRound();
  localStorage.removeItem(WALLET_SESSION_KEY);
  state.miner?.free();
  state.miner = null;
  state.connected = false;
  state.minerAddress = null;
  state.miningPublic = null;
  state.miningSecret = null;
  state.pendingKeys = null;
  state.pendingWalletName = null;

  ui.walletDot.className = 'dot off';
  ui.walletStatus.textContent = 'Не подключен';
  ui.btnMine.disabled = true;
  ui.btnStatus.disabled = true;
  ui.deepLink.style.display = 'none';
  ui.btnConfirmed.style.display = 'none';
  ui.btnConnect.disabled = false;
  ui.connectCard.style.display = 'block';
  log('Сохранённая сессия кошелька забыта. Введи имя AN Wallet и подключись заново — это создаст новую пару ключей.');
}


// ---------------------------------------------------------------------
// On-chain reconciliation. A "QUEUE_OVERFLOW" reply to submit_session_root does
// not always mean the message was lost: other open-source Bee Engine miners
// measured taps landing on chain after a refused submission (the account's
// tap_sum rose by exactly the session's taps). tap_sum is read over GraphQL,
// so it is not subject to the external-message queue.
// ---------------------------------------------------------------------

async function readTapSum() {
  try {
    const m = state.miner;
    if (!m) return null;
    const d = await m.get_miner_data();
    const v = Number(d && d.tap_sum);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// Polls tap_sum for up to maxMs; true if it rose above the pre-session value.
async function confirmLandedByTapSum(before, sessionNo, maxMs) {
  if (before === null) {
    log(`Сессия ${sessionNo}: tap_sum до сессии прочитать не удалось — сверка с цепочкой пропущена.`);
    return false;
  }
  const deadline = Date.now() + maxMs;
  let last = null;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const v = await readTapSum();
    if (v === null) continue;
    last = v;
    if (v > before) {
      log(`🔎 Сессия ${sessionNo}: tap_sum на цепочке вырос ${before} → ${v} (+${v - before}) — тапы ДОШЛИ.`);
      return true;
    }
  }
  log(
    `🔎 Сессия ${sessionNo}: tap_sum на цепочке не изменился за ${Math.round(maxMs / 1000)} с ` +
      `(до: ${before}, после: ${last === null ? 'не прочитан' : last}).`
  );
  return false;
}

// ---------------------------------------------------------------------
// Miner instance management (single in-flight creation, with backoff)
// ---------------------------------------------------------------------

let minerCreationInFlight = null;

async function getOrCreateMiner() {
  if (state.miner) return state.miner;
  if (minerCreationInFlight) return minerCreationInFlight;

  minerCreationInFlight = (async () => {
    // Every attempt here can make the SDK internally send a cancel_session
    // message (if the contract still has a stale pending session). When the
    // queue is full that message is simply rejected, which costs the queue
    // nothing, and the logs show acceptance is random and rare (one miner
    // creation went through after ~20 attempts over 45 minutes), so retries
    // are frequent: a few seconds after a failed read ("Failed to fetch"
    // sent nothing and usually clears on the next try), 8-16 s after a
    // queue-full rejection; runRound() adds its own 30-60 s backoff on top.
    const fetchBackoff = [2_000, 4_000, 8_000];
    const queueBackoff = [5_000, 8_000, 10_000];
    for (let attempt = 1; ; attempt++) {
      try {
        state.miner = await Miner.new(
          ENDPOINTS,
          APP_ID,
          state.minerAddress,
          state.miningPublic,
          state.miningSecret
        );
        if (patchedSdk) state.miner.set_submit_retry_ms(SUBMIT_RETRY_MS);
        return state.miner;
      } catch (e) {
        const msg = (e && e.message) || String(e);
        const isFetch = /failed to fetch|timeout/i.test(msg);
        const maxAttempts = (isFetch ? fetchBackoff : queueBackoff).length + 1;
        if (isTransientNetworkError(msg) && attempt < maxAttempts) {
          const delay = (isFetch ? fetchBackoff : queueBackoff)[attempt - 1];
          log(
            `Создание майнера: ${shortError(msg)} (попытка ${attempt}/${maxAttempts}). ` +
              `Повтор через ${delay / 1000} сек…`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw e;
      }
    }
  })();

  try {
    return await minerCreationInFlight;
  } finally {
    minerCreationInFlight = null;
  }
}

// ---------------------------------------------------------------------
// Mining loop
// ---------------------------------------------------------------------

async function startMining() {
  if (!state.connected) return;
  if (state.keyOk !== true) {
    ui.btnMine.disabled = true;
    const ok = await checkKeyOnChain();
    ui.btnMine.disabled = false;
    if (ok === false && !state.keyWarned) {
      state.keyWarned = true;
      ui.miningStatus.textContent = 'Ключ не подтверждён';
      log('Чтобы всё равно запустить майнинг, нажми «Начать майнинг» ещё раз.');
      return;
    }
  }
  state.notOwnerStreak = 0;
  state.autoContinueRounds = true;
  acquireWakeLock();
  state.currentRound = 0;
  state.fullRounds = 0;
  state.lastSessionOk = null;
  state.tapCount = 0;
  ui.cellCount.textContent = '0';
  ui.tapCount.textContent = `0 / ${RUN_TAP_CAPACITY}`;
  ui.btnMine.disabled = true;
  ui.btnStop.disabled = false;
  ui.minesweeper.classList.add('active');
  newField();
  await runRound();
}

// Wait (up to maxMs) for the root/proof submission of earlier sessions to
// finish. Sessions now start without waiting for the previous proof, so this
// is only used before freeing a miner instance.
// The next round is always scheduled through here, so that it can be
// cancelled (Stop / Forget wallet) and never fires with stale credentials.
function scheduleRound(delay) {
  if (state.nextRoundTimer) clearTimeout(state.nextRoundTimer);
  state.nextRoundTimer = setTimeout(() => {
    state.nextRoundTimer = null;
    runRound();
  }, delay);
}

function cancelScheduledRound() {
  if (state.nextRoundTimer) {
    clearTimeout(state.nextRoundTimer);
    state.nextRoundTimer = null;
  }
}

async function waitForFinalizations(maxMs) {
  const deadline = Date.now() + maxMs;
  while (state.pendingFinalizations > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// can_start() is false while the previous session is still winding down, so
// give it a short window before concluding that the seeds have run out.
async function waitUntilCanStart(miner) {
  const deadline = Date.now() + CAN_START_WAIT_MS;
  while (!miner.can_start()) {
    if (!state.autoContinueRounds || Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return true;
}

async function runRound() {
  if (!state.autoContinueRounds || state.fullRounds >= MAX_ROUNDS) {
    finishMining();
    return;
  }
  if (!state.minerAddress || !state.miningPublic || !state.miningSecret) {
    log('Нет подключённого кошелька — майнинг остановлен.');
    finishMining();
    return;
  }

  try {
    if (state.minerNeedsRecreate) {
      // The previous session's root/proof may still be in flight: let it
      // finish before freeing the instance that is sending it.
      await waitForFinalizations(FINALIZATION_WAIT_MS);
      state.miner?.free();
      state.miner = null;
      state.minerNeedsRecreate = false;
    }

    let miner = await getOrCreateMiner();
    if (!(await waitUntilCanStart(miner))) {
      if (!state.autoContinueRounds) {
        finishMining();
        return;
      }
      // Still no seed: rebuild the instance once from live contract state
      // before giving up.
      log('can_start() остаётся false — пересоздаю майнер один раз по живому состоянию контракта.');
      await waitForFinalizations(FINALIZATION_WAIT_MS);
      state.miner?.free();
      state.miner = null;
      miner = await getOrCreateMiner();
      if (!miner.can_start()) {
        log('Майнинг сейчас недоступен (нет активных seed). Останавливаюсь.');
        finishMining();
        return;
      }
    }

    // Never start an empty session: with an empty tap tree nothing is
    // submitted, and a start may still use up a seed. Wait for a tap.
    if (state.pendingTaps.length === 0) {
      ui.miningStatus.textContent = 'Жду тапов…';
      log('Очередь тапов пуста — жду первый тап, чтобы начать сессию.');
      while (state.autoContinueRounds && state.pendingTaps.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!state.autoContinueRounds) {
        finishMining();
        return;
      }
    }

    const sessionMs = SESSION_DURATION_MS;
    const tapCap = MAX_TAPS_PER_ROUND; // 70
    state.tapCap = tapCap;
    state.currentRound += 1;
    state.fullRounds += 1;
    const sessionNo = state.currentRound;
    state.tapsThisRound = 0;
    state.lastTapNetworkTime = 0;
    state.consecutiveRoundErrors = 0;
    state.mining = true;
    ui.miningDot.className = 'dot on';
    ui.miningStatus.textContent = `Сессия ${state.fullRounds}/${MAX_ROUNDS} (${Math.round(sessionMs / 1000)} с)`;
    ui.btnStatus.disabled = true;
    log(
      `▶ Сессия ${sessionNo} (${state.fullRounds}/${MAX_ROUNDS}) начата — ${Math.round(sessionMs / 1000)} с, ` +
        `до ${tapCap} тапов, не чаще раза в ~${BASE_TAP_INTERVAL_MS / 1000}с.`
    );

    let proofConfirmed = false; // submit_session_proof event arrived
    let proofOk = false; // ...and arrived without an error
    let rootOk = true;
    let rootSeen = false; // submit_session_root event arrived (ok or error)
    let sessionEndedAt = 0;
    let resolveProofWait;
    const proofWait = new Promise((resolve) => {
      resolveProofWait = resolve;
    });
    let resolveRootWait;
    const rootWait = new Promise((resolve) => {
      resolveRootWait = resolve;
    });

    // Ground truth for this session: the account's on-chain tap_sum before it starts.
    let tapSumBefore = null;
    readTapSum().then((v) => {
      tapSumBefore = v;
    });

    if (patchedSdk) miner.set_submit_deadline(Date.now() + sessionMs + SUBMIT_DEADLINE_AFTER_END_MS);

    miner.start(sessionMs, (raw) => {
      const event = parseMinerEvent(raw);
      if (!event || !event.action) return;

      if (event.action === 'tap_computed') {
        const error = event.data && event.data.error;
        if (error) {
          state.failedTaps = (state.failedTaps || 0) + 1;
          log(`❌ Тап отклонён локально! error=${error}`);
        }
        return;
      }

      if (event.action === 'submit_retry') {
        const d = event.data || {};
        if (d.attempt === 1 || d.attempt % 5 === 0) {
          log(
            `↻ Сессия ${sessionNo}: ${d.stage} отклонён, повторная отправка #${d.attempt} ` +
              `через ${Math.round((d.retry_in_ms || 0) / 1000)} с (${shortError(d.message)})`
          );
        }
        return;
      }

      if (event.action === 'root_already_stored' || event.action === 'proof_already_executed') {
        const d = event.data || {};
        log(`ℹ️ Сессия ${sessionNo}: ${event.action} (попытка ${d.attempt}) — предыдущая отправка дошла.`);
        return;
      }

      if (event.action === 'submit_session_root') {
        rootSeen = true;
        if (event.error) {
          rootOk = false;
          state.minerNeedsRecreate = true;
          // a failed root means no proof will ever follow
          resolveProofWait();
        }
        if (event.error) {
          hintIfNotOwner(`${event.error} ${event.data ? JSON.stringify(event.data) : ''}`);
        }
        log(
          `Сессия ${sessionNo}: root отправлен` +
            (event.error
              ? ` с ошибкой: ${event.error}` +
                (event.data ? ` | data: ${JSON.stringify(event.data)}` : '')
              : '') +
            '.' +
            (sessionEndedAt
              ? ` Ответ через ${((Date.now() - sessionEndedAt) / 1000).toFixed(1)} с после конца сессии.`
              : '')
        );
        resolveRootWait();
        return;
      }

      if (event.action === 'submit_session_proof') {
        proofConfirmed = true;
        if (event.error) {
          state.minerNeedsRecreate = true;
          log(
            `🛑 Сессия ${sessionNo}: proof НЕ подтверждён (${event.error}` +
              `${event.data ? ' | ' + JSON.stringify(event.data).slice(0, 500) : ''}` +
              `${sessionEndedAt ? `; через ${((Date.now() - sessionEndedAt) / 1000).toFixed(0)} с после конца` : ''}). ` +
              'Тапы сессии, вероятно, потеряны.'
          );
          hintIfNotOwner(String(event.error));
        } else {
          proofOk = true;
          state.notOwnerStreak = 0;
          log(
            `✅ Сессия ${sessionNo}: proof подтверждён` +
              `${sessionEndedAt ? ` через ${((Date.now() - sessionEndedAt) / 1000).toFixed(0)} с после конца` : ''}` +
              ' — сессия принята сетью!'
          );
        }
        resolveProofWait();
        return;
      }

      if (event.action === 'status_updated' && event.data && event.data.miner_state_corrupted) {
        state.minerNeedsRecreate = true;
        log('⚠️ Состояние воркера повреждено — пересоздам майнер перед следующей сессией.');
      }
    });

    state.tapCutoffTime = Date.now() + sessionMs - 15_000;
    if (state.roundTimeout) clearTimeout(state.roundTimeout);

    // Runs when the session's time is up OR when Stop calls miner.stop() early.
    const onSessionEnd = async () => {
      state.endSessionNow = null;
      try {
        state.mining = false;
        sessionEndedAt = Date.now();
        const tapsSent = state.tapsThisRound;
        log(`${tapsSent} тапов реально отправлено в сеть.`);
        ui.btnStatus.disabled = false;

        // No pause between sessions: dead time between epochs is lost reward.
        const quickDelay = Math.floor(Math.random() * 2000);

        // An empty tap tree makes the worker submit nothing, so no root or
        // proof can arrive: nothing to wait for, nothing to record.
        if (tapsSent === 0) {
          log(
            `Сессия ${sessionNo} завершена без тапов — root/proof не ожидаются, ` +
              'в статистику не записываю.'
          );
          scheduleRound(quickDelay);
          return;
        }

        log(`Сессия ${sessionNo} завершена (${tapsSent}/${tapCap} тапов). Жду ответ на root…`);

        // Collect the proof outcome in the background.
        state.pendingFinalizations += 1;
        (async () => {
          try {
            const grace = new Promise((resolve) => setTimeout(resolve, PROOF_GRACE_MS));
            await Promise.race([proofWait, grace]);
            if (!proofConfirmed && rootOk) {
              log(`⏱️ Сессия ${sessionNo}: submit_session_proof не пришёл за ${PROOF_GRACE_MS / 1000} сек.`);
            }
            const reported = proofOk && rootOk;
            // Reported failure: check the chain. Reported success: a short check to confirm the count.
            const landed = await confirmLandedByTapSum(tapSumBefore, sessionNo, reported ? 20_000 : 90_000);
            if (!reported && landed) {
              log(`Сессия ${sessionNo}: сеть вернула ошибку, но по tap_sum тапы на цепочке — считаю принятой.`);
            }
            const ok = reported || landed;
            recordRoundOutcome(ok);
            state.lastSessionOk = ok;
          } finally {
            state.pendingFinalizations -= 1;
          }
        })();

        // The root outcome arrives a few seconds after the end. Wait for it
        // (briefly) so the next session never starts on an instance that is
        // about to be flagged corrupted. After a failed root nothing else is
        // worth waiting for: the miner is rebuilt right away.
        await Promise.race([rootWait, new Promise((resolve) => setTimeout(resolve, ROOT_WAIT_MS))]);
        if (!rootSeen) {
          log(`⏱️ Сессия ${sessionNo}: ответ на root не пришёл за ${ROOT_WAIT_MS / 1000} сек — иду дальше.`);
          scheduleRound(quickDelay);
        } else if (rootOk) {
          if (!proofConfirmed) {
            ui.miningStatus.textContent = 'Жду proof…';
            log(`Жду proof сессии ${sessionNo} (до ${PROOF_WAIT_FOR_NEXT_MS / 1000} с), затем следующая сессия.`);
            await Promise.race([proofWait, new Promise((resolve) => setTimeout(resolve, PROOF_WAIT_FOR_NEXT_MS))]);
          }
          scheduleRound(quickDelay);
        } else {
          // root rejected: the miner is rebuilt at the start of the next round; no pause
          scheduleRound(quickDelay);
        }
      } catch (e) {
        log('Ошибка при завершении сессии: ' + e.message);
        hintIfNotOwner(e.message);
        finishMining();
      }
    };

    // Stop button hook: end this session right now (see requestStop)
    state.endSessionNow = () => {
      if (state.roundTimeout) clearTimeout(state.roundTimeout);
      state.roundTimeout = null;
      return onSessionEnd();
    };
    state.roundTimeout = setTimeout(onSessionEnd, sessionMs);
  } catch (e) {
    const message = e.message || String(e);
    if (
      isTransientNetworkError(message) &&
      (state.consecutiveRoundErrors = (state.consecutiveRoundErrors || 0) + 1) <= MAX_ROUND_RETRIES
    ) {
      // A failed read sent nothing, so retry it within seconds. A rejected
      // message (queue full) retries every 8-15 s: acceptance is random, so more attempts help.
      const queueFull = /message queue is full/i.test(message);
      const n = state.consecutiveRoundErrors;
      const delay = queueFull
        ? 8_000 + Math.floor(Math.random() * 7_000)
        : Math.min(3_000 * 2 ** (n - 1), 15_000) + Math.floor(Math.random() * 2_000);
      log(
        `Ошибка запуска раунда (сеть): ${shortError(message)} — попробую снова через ` +
          `${Math.round(delay / 1000)}с (попытка ${state.consecutiveRoundErrors}/${MAX_ROUND_RETRIES}).`
      );
      hintIfNotOwner(message);
      if (/failed to fetch/i.test(message) && !state.endpointProbed) {
        state.endpointProbed = true;
        await probeEndpoint();
      }
      ui.btnStatus.disabled = false;
      scheduleRound(delay);
    } else {
      log('Ошибка запуска раунда: ' + message);
      hintIfNotOwner(message);
      finishMining();
    }
  }
}

function finishMining() {
  state.autoContinueRounds = false;
  state.endSessionNow = null;
  releaseWakeLock();
  state.mining = false;
  cancelScheduledRound();
  if (state.roundTimeout) {
    clearTimeout(state.roundTimeout);
    state.roundTimeout = null;
  }
  ui.miningDot.className = 'dot off';
  ui.miningStatus.textContent = state.fullRounds >= MAX_ROUNDS ? 'Все раунды пройдены' : 'Остановлен';
  ui.btnMine.disabled = false;
  ui.btnStop.disabled = true;
  ui.btnStatus.disabled = false;
  log(`Майнинг завершён. Полных сессий: ${state.fullRounds}/${MAX_ROUNDS}, всего запусков: ${state.currentRound}.`);
}

async function requestStop() {
  state.autoContinueRounds = false;
  ui.btnStop.disabled = true;

  // Between sessions with a round already scheduled: nothing is running, finish now.
  if (state.nextRoundTimer) {
    cancelScheduledRound();
    log('Остановка: следующая сессия отменена.');
    finishMining();
    return;
  }

  // A session is computing right now: stop it through the official API. The worker
  // finalizes its trees and submits root to the contract immediately; then the normal
  // end-of-session path collects root/proof, and runRound() (autoContinueRounds=false)
  // calls finishMining() instead of starting another session.
  if (state.mining && state.miner && state.endSessionNow) {
    log('Остановка: вызываю miner.stop() — накопленные тапы уйдут в контракт сразу.');
    try {
      state.miner.stop();
    } catch (e) {
      log('miner.stop(): ' + ((e && e.message) || e));
    }
    await state.endSessionNow();
    return;
  }

  // Anywhere else (waiting for a root/proof, retrying a start, waiting for a tap):
  // the loop sees autoContinueRounds=false at its next step and finishes by itself.
  log('Остановка запрошена — новая сессия не начнётся.');
}

async function checkStatus() {
  try {
    ui.btnStatus.disabled = true;
    const miner = await getOrCreateMiner();
    const data = await miner.get_miner_data();
    log(
      `Статус майнера: tap_sum=${data.tap_sum}, tap_sum_5m=${data.tap_sum_5m}, ` +
        `epoch_start=${data.epoch_start}, epoch_5m_start=${data.epoch_5m_start}`
    );
    log(`Статистика по часам (UTC): ${hourlyStatsSummary()}`);
    await checkKeyOnChain();
  } catch (e) {
    log('Ошибка проверки статуса: ' + e.message);
  } finally {
    ui.btnStatus.disabled = false;
  }
}

// ---------------------------------------------------------------------
// Minesweeper (the UI used to generate (x, y) tap coordinates)
// ---------------------------------------------------------------------

let grid = [];
let fieldOver = false;
let needsMinePlacement = true;

function newField() {
  fieldOver = false;
  needsMinePlacement = true;
  grid = Array.from({ length: MINESWEEPER_SIZE }, () =>
    Array.from({ length: MINESWEEPER_SIZE }, () => ({ mine: false, open: false, flag: false, count: 0 }))
  );
  ui.msMines.textContent = MINESWEEPER_MINE_COUNT;
  renderGrid();
}

function plantMines(safeRow, safeCol) {
  let placed = 0;
  while (placed < MINESWEEPER_MINE_COUNT) {
    const r = Math.floor(Math.random() * MINESWEEPER_SIZE);
    const c = Math.floor(Math.random() * MINESWEEPER_SIZE);
    const tooCloseToFirstClick = Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;
    if (!grid[r][c].mine && !tooCloseToFirstClick) {
      grid[r][c].mine = true;
      placed++;
    }
  }
  for (let r = 0; r < MINESWEEPER_SIZE; r++) {
    for (let c = 0; c < MINESWEEPER_SIZE; c++) {
      if (!grid[r][c].mine) {
        grid[r][c].count = neighborsOf(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
      }
    }
  }
}

function neighborsOf(row, col) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < MINESWEEPER_SIZE && c >= 0 && c < MINESWEEPER_SIZE) result.push([r, c]);
    }
  }
  return result;
}

function openCell(row, col) {
  if (fieldOver || !state.autoContinueRounds) return;
  const cell = grid[row][col];
  if (cell.open || cell.flag) return;

  if (needsMinePlacement) {
    plantMines(row, col);
    needsMinePlacement = false;
  }

  recordTap(row, col);
  cell.open = true;

  if (cell.mine) {
    fieldOver = true;
    revealAllMines();
    renderGrid();
    log('💥 Подрыв! Жми «Новое поле», чтобы продолжить майнить.');
    return;
  }

  if (cell.count === 0) {
    for (const [nr, nc] of neighborsOf(row, col)) {
      if (!grid[nr][nc].open && !grid[nr][nc].flag) openCell(nr, nc);
    }
  }

  renderGrid();
  checkFieldComplete();
}

function recordTap(row, col) {
  if (!state.autoContinueRounds) return;
  state.tapCount += 1;
  ui.cellCount.textContent = state.tapCount;
  tg?.HapticFeedback?.impactOccurred?.('light');
  queueTap(row, col);
}

function toggleFlag(row, col, event) {
  event.preventDefault();
  if (fieldOver || !state.autoContinueRounds) return;
  const cell = grid[row][col];
  if (cell.open) return;
  cell.flag = !cell.flag;
  const minesLeft = MINESWEEPER_MINE_COUNT - grid.flat().filter((c) => c.flag).length;
  ui.msMines.textContent = minesLeft;
  renderGrid();
}

function revealAllMines() {
  for (let r = 0; r < MINESWEEPER_SIZE; r++) {
    for (let c = 0; c < MINESWEEPER_SIZE; c++) {
      if (grid[r][c].mine) grid[r][c].open = true;
    }
  }
}

function checkFieldComplete() {
  if (grid.flat().every((c) => c.mine || c.open)) {
    fieldOver = true;
    log('🎉 Поле пройдено! Жми «Новое поле».');
  }
}

function renderGrid() {
  ui.msGrid.innerHTML = '';
  for (let r = 0; r < MINESWEEPER_SIZE; r++) {
    for (let c = 0; c < MINESWEEPER_SIZE; c++) {
      const cell = grid[r][c];
      const el = document.createElement('div');
      el.className = 'ms-cell';
      if (cell.open) {
        el.classList.add('open');
        if (cell.mine) {
          el.classList.add('mine');
          el.textContent = '💣';
        } else if (cell.count > 0) {
          el.textContent = cell.count;
        }
      } else if (cell.flag) {
        el.classList.add('flag');
        el.textContent = '🚩';
      }
      el.addEventListener('click', () => openCell(r, c));
      el.addEventListener('contextmenu', (e) => toggleFlag(r, c, e));
      ui.msGrid.appendChild(el);
    }
  }
}

// ---------------------------------------------------------------------
// Wire up buttons and boot
// ---------------------------------------------------------------------

ui.btnConnect.addEventListener('click', connectWallet);
ui.btnConfirmed.addEventListener('click', confirmWallet);
ui.btnMine.addEventListener('click', startMining);
ui.btnStop.addEventListener('click', requestStop);
ui.btnStatus.addEventListener('click', checkStatus);
ui.btnForget.addEventListener('click', forgetWallet);
ui.btnRestart.addEventListener('click', () => {
  if (state.autoContinueRounds) {
    newField();
    log('Новое поле создано.');
  }
});

log(
  'Приложение загружено. Инициализация SDK… [сборка: ' +
    APP_VERSION +
    ', bee-sdk 6.0.0, запуск ' +
    new Date().toISOString() +
    ']'
);
boot();
