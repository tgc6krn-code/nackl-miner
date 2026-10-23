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

import init, {
  Miner,
  gen_mining_keys,
  ensure_mining_keys_propagated,
  get_miner_address_by_wallet_name,
} from './bee_sdk.js';

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const APP_ID = '0x0000000000000000000000000000000000000000000000000000000000000033';
const ENDPOINTS = ['https://mainnet.ackinacki.org/graphql'];
const CLIENT_CONFIG = { network: { endpoints: ENDPOINTS } };

const WALLET_SESSION_KEY = 'nackl_miner_session_v1';
const PENDING_TAPS_KEY = 'nackl_pending_taps_v1';

const SESSION_DURATION_MS = 330_000; // 5.5 minutes
const MAX_TAPS_PER_ROUND = 70;
const MAX_ROUNDS = 20;
const BASE_TAP_INTERVAL_MS = 4_000;
const PROOF_GRACE_MS = 120_000; // how long to wait (in the background) for a session's proof
const CAN_START_WAIT_MS = 30_000; // how long can_start() may stay false before rebuilding
// The tap backlog may hold a whole run's worth of taps (70 x 20 = 1400, the
// same 1400 shown in the UI), so fast play is banked and drained at the
// human-like pace over the following sessions. Only growth beyond that is cut.
const MAX_PENDING_TAPS = MAX_TAPS_PER_ROUND * MAX_ROUNDS;
const MAX_ROUND_RETRIES = 20; // transient network errors before giving up on a round
const ROOT_WAIT_MS = 20_000; // after a session ends, how long to wait for the root outcome
const FINALIZATION_WAIT_MS = 15_000; // max wait for in-flight submissions before freeing a miner

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

function hintIfNotOwner(message) {
  if (!message) return;
  const text = String(message);
  // Match the contract error itself. A bare includes('402') also fires on
  // "402" inside hashes/numbers of unrelated errors (e.g. QUEUE_OVERFLOW).
  if (!/NOT_OWNER/i.test(text) && !/\b(?:exit_code|code)\D{0,6}402\b/i.test(text)) return;
  state.notOwnerStreak = (state.notOwnerStreak || 0) + 1;
  if (state.notOwnerStreak < 3) {
    log(
      `⚠️ Возможно ERR_NOT_OWNER (402), подряд: ${state.notOwnerStreak}/3. ` +
        'Пока ничего не делай — одна такая ошибка ещё не значит, что ключи рассинхронизировались.'
    );
    return;
  }
  log(
    '⚠️ ERR_NOT_OWNER (402) три раза подряд — ключи, похоже, рассинхронизировались с блокчейном. ' +
      'Нажми «Забыть кошелёк и переподключить заново».'
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
    const res = await fetch(ENDPOINTS[0], {
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
  endpointProbed: false,
  nextRoundTimer: null,
  failedTaps: 0,
  lastSessionOk: null,
  pendingFinalizations: 0,
};

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

async function boot() {
  try {
    log('Загрузка Bee Engine SDK…');
    // Loaded straight from the public npm CDN — no need to host this
    // 9MB binary in this repo at all.
    await init({
      module_or_path: 'https://cdn.jsdelivr.net/npm/@teamgosh/bee-sdk@6.0.0/bee_sdk_bg.wasm',
    });
    state.wasmReady = true;
    log('SDK готов.');
    state.pendingTaps = loadPendingTaps();
    if (state.pendingTaps.length > MAX_PENDING_TAPS) {
      const dropped = state.pendingTaps.length - MAX_PENDING_TAPS;
      state.pendingTaps = state.pendingTaps.slice(-MAX_PENDING_TAPS);
      savePendingTaps();
      log(`Очередь тапов превышала лимит ${MAX_PENDING_TAPS}: отброшено ${dropped} лишних.`);
    }
    if (state.pendingTaps.length > 0) {
      log(
        `В очереди с прошлого раза: ${state.pendingTaps.length} неотправленных тапов — ` +
          'досошлём в ближайших сессиях.'
      );
    }
    restoreWalletSession();
    setInterval(drainTapQueue, 1000);
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
  if (state.pendingTaps.length > MAX_PENDING_TAPS) {
    state.pendingTaps.splice(0, state.pendingTaps.length - MAX_PENDING_TAPS);
  }
  savePendingTaps();
  drainTapQueue();
}

function drainTapQueue() {
  if (
    !state.mining ||
    !state.miner ||
    !state.pendingTaps ||
    state.pendingTaps.length === 0 ||
    state.tapsThisRound >= MAX_TAPS_PER_ROUND ||
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
      `${state.networkTapsSent} / 1400 (раунд ${state.currentRound}: ` +
      `${state.tapsThisRound}/${MAX_TAPS_PER_ROUND}, в очереди: ${state.pendingTaps.length})`;
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
      log('Авторизация уже подтверждена ранее — пробую создать Miner заново.');
    } else {
      const walletName = state.pendingWalletName;
      minerAddress = await get_miner_address_by_wallet_name({
        client_config: CLIENT_CONFIG,
        wallet_name: walletName,
      });
      log('Адрес Miner-контракта получен.');
      await ensure_mining_keys_propagated({
        client_config: CLIENT_CONFIG,
        miner_address: minerAddress,
        app_id: APP_ID,
        expected_owner_public: keys.public,
        max_attempts: 30,
        interval_ms: 1000,
      });
      log('Авторизация подтверждена в блокчейне.');
      state.minerAddress = minerAddress;
      state.miningPublic = keys.public;
      state.miningSecret = keys.secret;
    }

    const miner = await Miner.new(ENDPOINTS, APP_ID, minerAddress, keys.public, keys.secret);
    log('Miner-инстанс создан.');
    state.miner = miner;
    state.connected = true;
    saveWalletSession();
    state.rnRetries = 0;

    ui.walletDot.className = 'dot on';
    ui.walletStatus.textContent = 'Подключен';
    ui.deepLink.style.display = 'none';
    ui.btnConfirmed.style.display = 'none';
    ui.btnMine.disabled = false;
    ui.btnStatus.disabled = false;
    ui.connectCard.style.display = 'none';
    log('Кошелёк успешно подключен!');
  } catch (e) {
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
          'Если ошибка про "not active" — вероятно, подтверждение в AN Wallet ещё не дошло ' +
            'до сети. Подожди 10-15 сек и нажми «Я подтвердил» ещё раз.'
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
// Miner instance management (single in-flight creation, with backoff)
// ---------------------------------------------------------------------

let minerCreationInFlight = null;

async function getOrCreateMiner() {
  if (state.miner) return state.miner;
  if (minerCreationInFlight) return minerCreationInFlight;

  minerCreationInFlight = (async () => {
    // Every attempt here can make the SDK internally re-send a
    // cancel_session message (if the contract still has a stale
    // pending session) — that's the same low-priority queue we're
    // fighting QUEUE_OVERFLOW on, so a queue-full rejection keeps the
    // old gentle behaviour (one 30 s retry; the round-level backoff in
    // runRound() carries the rest). A failed READ ("Failed to fetch")
    // sent nothing and usually clears on the next try, so it is retried
    // within seconds instead of costing half a minute.
    const fetchBackoff = [3_000, 6_000, 12_000];
    for (let attempt = 1; ; attempt++) {
      try {
        state.miner = await Miner.new(
          ENDPOINTS,
          APP_ID,
          state.minerAddress,
          state.miningPublic,
          state.miningSecret
        );
        return state.miner;
      } catch (e) {
        const msg = (e && e.message) || String(e);
        const isFetch = /failed to fetch|timeout/i.test(msg);
        const maxAttempts = isFetch ? fetchBackoff.length + 1 : 2;
        if (isTransientNetworkError(msg) && attempt < maxAttempts) {
          const delay = isFetch ? fetchBackoff[attempt - 1] : 30_000;
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
  state.autoContinueRounds = true;
  state.currentRound = 0;
  state.lastSessionOk = null;
  state.tapCount = 0;
  ui.cellCount.textContent = '0';
  ui.tapCount.textContent = '0 / 1400';
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
  if (!state.autoContinueRounds || state.currentRound >= MAX_ROUNDS) {
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

    state.currentRound += 1;
    const sessionNo = state.currentRound;
    state.tapsThisRound = 0;
    state.lastTapNetworkTime = 0;
    state.consecutiveRoundErrors = 0;
    state.mining = true;
    ui.miningDot.className = 'dot on';
    ui.miningStatus.textContent = `Сессия ${sessionNo}/${MAX_ROUNDS} (5.5 мин)`;
    ui.btnStatus.disabled = true;
    log(
      `▶ Сессия ${sessionNo}/${MAX_ROUNDS} начата — тапай не чаще раза в ` +
        `~${BASE_TAP_INTERVAL_MS / 1000}с, максимум ${MAX_TAPS_PER_ROUND} тапов за 5.5 мин.`
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

    miner.start(SESSION_DURATION_MS, (raw) => {
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

      if (event.action === 'submit_session_root') {
        rootSeen = true;
        if (event.error) {
          rootOk = false;
          state.minerNeedsRecreate = true;
          // a failed root means no proof will ever follow
          resolveProofWait();
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
            `🛑 Сессия ${sessionNo}: proof НЕ подтверждён (${event.error}). ` +
              'Тапы сессии, вероятно, потеряны.'
          );
          hintIfNotOwner(String(event.error));
        } else {
          proofOk = true;
          state.notOwnerStreak = 0;
          log(`✅ Сессия ${sessionNo}: proof подтверждён — сессия принята сетью!`);
        }
        resolveProofWait();
        return;
      }

      if (event.action === 'status_updated' && event.data && event.data.miner_state_corrupted) {
        state.minerNeedsRecreate = true;
        log('⚠️ Состояние воркера повреждено — пересоздам майнер перед следующей сессией.');
      }
    });

    state.tapCutoffTime = Date.now() + SESSION_DURATION_MS - 15_000;
    if (state.roundTimeout) clearTimeout(state.roundTimeout);

    state.roundTimeout = setTimeout(async () => {
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

        log(`Сессия ${sessionNo} завершена (${tapsSent}/${MAX_TAPS_PER_ROUND} тапов). Жду ответ на root…`);

        // Collect the proof outcome in the background.
        state.pendingFinalizations += 1;
        (async () => {
          try {
            const grace = new Promise((resolve) => setTimeout(resolve, PROOF_GRACE_MS));
            await Promise.race([proofWait, grace]);
            if (!proofConfirmed && rootOk) {
              log(`⏱️ Сессия ${sessionNo}: submit_session_proof не пришёл за ${PROOF_GRACE_MS / 1000} сек.`);
            }
            const ok = proofOk && rootOk;
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
        }
        scheduleRound(quickDelay);
      } catch (e) {
        log('Ошибка при завершении сессии: ' + e.message);
        hintIfNotOwner(e.message);
        finishMining();
      }
    }, SESSION_DURATION_MS);
  } catch (e) {
    const message = e.message || String(e);
    if (
      isTransientNetworkError(message) &&
      (state.consecutiveRoundErrors = (state.consecutiveRoundErrors || 0) + 1) <= MAX_ROUND_RETRIES
    ) {
      // A failed read sent nothing, so retry it within seconds. A rejected
      // message (queue full) keeps the gentler growing pause, capped at 2 min.
      const queueFull = /message queue is full/i.test(message);
      const n = state.consecutiveRoundErrors;
      const delay = queueFull
        ? Math.min(60_000 * n, 120_000) + Math.floor(Math.random() * 15_000)
        : Math.min(5_000 * 2 ** (n - 1), 60_000) + Math.floor(Math.random() * 3_000);
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
  state.mining = false;
  cancelScheduledRound();
  if (state.roundTimeout) {
    clearTimeout(state.roundTimeout);
    state.roundTimeout = null;
  }
  ui.miningDot.className = 'dot off';
  ui.miningStatus.textContent = state.currentRound >= MAX_ROUNDS ? 'Все раунды пройдены' : 'Остановлен';
  ui.btnMine.disabled = false;
  ui.btnStop.disabled = true;
  ui.btnStatus.disabled = false;
  log(`Майнинг завершён. Раундов пройдено: ${state.currentRound}/${MAX_ROUNDS}.`);
}

async function requestStop() {
  state.autoContinueRounds = false;
  ui.btnStop.disabled = true;
  log('Остановка запрошена — текущий раунд доиграет до конца, новый не начнётся.');
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
  if (fieldOver || !state.mining) return;
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
  if (!state.mining) return;
  state.tapCount += 1;
  ui.cellCount.textContent = state.tapCount;
  tg?.HapticFeedback?.impactOccurred?.('light');
  queueTap(row, col);
}

function toggleFlag(row, col, event) {
  event.preventDefault();
  if (fieldOver || !state.mining) return;
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
  if (state.mining) {
    newField();
    log('Новое поле создано.');
  }
});

log('Приложение загружено. Инициализация SDK… [сборка: bee-sdk 6.0.0, ' + new Date().toISOString() + ']');
boot();
