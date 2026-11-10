// NACKL Miner (Telegram Mini App) - v22.1 "keep-clearing" (2026-11-10)
//
// v22.1 = v22 + ONE fix of the start path (registry section 38, F70). Log of the failed v22 start: Miner.new()
// itself sends the cancel of a stale commit left by an earlier session ("Cancel stale session data"), it failed
// with QUEUE_OVERFLOW (621), isTransientNetworkError() did not know QUEUE_OVERFLOW, so getOrCreateMiner() threw
// at once and the mining loop gave up after 5 errors (~5 min): mining never started. Now QUEUE_OVERFLOW is a
// transient error: Miner.new() is retried (backoff 5/10/20/30 s) until a cancel gets through or Stop is pressed
// (run 1 of v20 left the same loop by itself after 62 min). Also: the status line says what is going on, the
// retry line shows elapsed minutes, and the first raw error text is logged once (shortError hides it).
//
// v22 "hourly" (2026-11-09)
//
// v22 = v21 behaviour, UNCHANGED. Only measurement is added (registry section 36, F66, F67):
//   * HOURLY OUTCOME TABLE (F67): every session outcome from the SDK events (started, root delivered / not,
//     proof delivered / not, accepted, rejected, preflight_failed, complexity_unknown, stale commit dead),
//     counted by the UTC hour the session was LAUNCHED in, kept across runs (localStorage 'nackl_fates_v1').
//     Printed at the end of a run and by "Проверить статус майнера". The old "Результаты: принято X из Y"
//     line counted only SDK verdicts (accepted/rejected), so it showed 100% after 39 sessions; it is kept
//     but relabelled as "вердикты SDK".
//   * commit_data probe (F66): get_session_state() is read once at run start and once at run end, and the
//     commit_data field is logged (empty / not empty, length). A stored commit from an earlier session is what
//     starts the stale-commit loop (F61); this shows it before the first session instead of after the loop.
//
// v21 measurement kept as is: outcome counter per run, account-read counter, every cancel attempt logged,
// network type, "root доставлен: N" in the sent-taps field.
//
// Not changed (do not touch without a registry entry): session 130 s, 70 taps, 1.714 s, MIN_CYCLE_MS 330 s,
// SUBMIT_POLICY, no premine, get_reward after 700 s, tap_sum read frequency, Miner recreation after 15 min.
//
// v20 base: one Miner, NewGoblin SDK delivers root/proof (one signed message resent with backoff,
// 240 s lifetime), the app only decides WHEN to start a session and feeds it taps.
//   * NO PREMINE (F53). ALLOW_PREMINE = false keeps the old path one flag away.
//   * discard_premine() on Stop / reset / recreate.
//   * "Зачтено сессий" from the chain's tap_sum (baseline at run start, a drop = epoch reset).
//   * set_epoch_deadline is NOT called (late acceptance is real, registry F28-F29, F59).

let init;
let Miner;
let gen_mining_keys;
let ensure_mining_keys_propagated;
let get_miner_address_by_wallet_name;
let sdkKind = 'stock'; // 'newgoblin' (set_submit_policy + premine) | 'old-patched' | 'stock'

async function loadSdk() {
  try {
    const mod = await import('./sdk/bee_sdk.js');
    const proto = mod.Miner?.prototype || {};
    const kind =
      typeof proto.set_submit_policy === 'function' && typeof proto.premine === 'function'
        ? 'newgoblin'
        : 'old-patched';
    return { mod, wasm: new URL('./sdk/bee_sdk_bg.wasm', import.meta.url).href, kind };
  } catch (e) {
    log('SDK из ./sdk/ не загружен: ' + ((e && e.message) || e) + ' — использую стоковый.');
    const mod = await import('./bee_sdk.js');
    return {
      mod,
      wasm: 'https://cdn.jsdelivr.net/npm/@teamgosh/bee-sdk@6.0.0/bee_sdk_bg.wasm',
      kind: 'stock',
    };
  }
}

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const APP_VERSION = '2026-11-10-v22.1-keep-clearing';

const APP_ID = '0x0000000000000000000000000000000000000000000000000000000000000033';

// Wallet / key calls keep the endpoint form that has always worked here.
const GRAPHQL_URL = 'https://mainnet.ackinacki.org/graphql';
const CLIENT_CONFIG = { network: { endpoints: [GRAPHQL_URL] } };
// The miner gets bare hosts, as in the official example and in both reference miners: the patched SDK
// sends to <endpoint>/v2/messages itself, and uses the second endpoint as a failover.
const MINER_ENDPOINTS_ALL = ['https://mainnet.ackinacki.org', 'https://mainnet-cf.ackinacki.org'];
let minerEndpoints = MINER_ENDPOINTS_ALL.slice();

const WALLET_SESSION_KEY = 'nackl_miner_session_v1';
const PENDING_TAPS_KEY = 'nackl_pending_taps_v1';
const PENDING_KEYS_KEY = 'nackl_pending_keys_v1';
const MAX_PENDING_KEYS = 5;
const RESULTS_KEY = 'nackl_results_v3';
// v22: hourly table of ALL session outcomes (not only SDK verdicts)
const FATES_KEY = 'nackl_fates_v1';

// Reference parameters (goblingames config: burstMs 130000, tapsPerEpoch 70; Nackl-Digger: a tap every
// 1.714 s, "70 taps over about 2 minutes count per epoch of ~5.5 min").
const SESSION_DURATION_MS = 130_000;
const MAX_TAPS_PER_ROUND = 70;
const TAP_INTERVAL_MS = 1_714;
const MAX_ROUNDS = 100_000;
// One 70-tap session per reward epoch (~5.5 min) is all the contract counts: do not start sooner.
const MIN_CYCLE_MS = 330_000;
// SDK delivery policy: root deadline, proof deadline, resend backoff min/max (ms). The SDK defaults.
const SUBMIT_POLICY = [210_000, 240_000, 1_000, 30_000];
// Premine is OFF: it only works when the previous session gets accepted, which is the exception.
const ALLOW_PREMINE = false;
// Rebuild the Miner only when it has been not startable for this long.
const BUSY_RECREATE_MS = 15 * 60_000;
// An accepted session that no later accepted session has paid out gets a get_reward after this.
const REWARD_CLAIM_AFTER_MS = 700_000;
const CREATE_BACKOFF_MS = [5_000, 10_000, 20_000, 30_000];
// tap_sum (credited sessions) is re-read this often while a run is tracked, and for this long after Stop
// (a late acceptance can still land).
const TAP_STATS_REFRESH_MS = 60_000;
const TAP_STATS_AFTER_STOP_MS = 45 * 60_000;

const MINESWEEPER_SIZE = 8;
const MINESWEEPER_MINE_COUNT = 10;

const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();

// Closing the mini app while a session computes or a root/proof is still being sent is the main
// suspect for the stale on-chain session that makes the next start take 20-78 min (registry hypothesis
// H). Ask Telegram to confirm before closing in that case.
let closingConfirmationOn = false;
function updateClosingConfirmation() {
  try {
    const busy = state.autoContinueRounds || minerIsBusy();
    if (busy && !closingConfirmationOn) {
      tg?.enableClosingConfirmation?.();
      closingConfirmationOn = true;
    } else if (!busy && closingConfirmationOn) {
      tg?.disableClosingConfirmation?.();
      closingConfirmationOn = false;
    }
  } catch {
    // best effort
  }
}

// ---------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------

const ui = {
  walletDot: document.getElementById('wallet-dot'),
  walletStatus: document.getElementById('wallet-status'),
  miningDot: document.getElementById('mining-dot'),
  miningStatus: document.getElementById('mining-status'),
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

// "Зачтено сессий" line: created here so index.html does not need to change. It sits right above the log.
const creditedEl = (() => {
  const el = document.createElement('div');
  el.id = 'credited-line';
  el.style.cssText = 'margin:8px 0;font-size:14px;font-weight:600;line-height:1.35;';
  el.textContent = 'Зачтено сессий: — (запусти майнинг)';
  try {
    ui.log.parentNode.insertBefore(el, ui.log);
  } catch {
    // purely cosmetic
  }
  return el;
})();

// ---------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------

const LOG_MAX_LINES = 3000;
const logLines = [];
function log(message) {
  const time = new Date().toLocaleTimeString();
  logLines.unshift(`[${time}] ${message}<br>`);
  if (logLines.length > LOG_MAX_LINES) logLines.length = LOG_MAX_LINES;
  ui.log.innerHTML = logLines.join('');
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
  // Besides queue-full / fetch failures: the gateway could not hand the message to the Block
  // Producer ("redirection to the Block Producer has failed ... client error (Connect)",
  // INTERNAL_ERROR), a saturated GraphQL pool, and DUPLICATE_MESSAGE (the node already has this
  // exact message, e.g. the stale-session cancel went through earlier). These ended mining at 17/100 and 3/100.
  return /message queue is full|QUEUE_OVERFLOW|failed to fetch|timeout|redirection to the Block Producer|client error \(Connect\)|INTERNAL_ERROR|pool timed out|DUPLICATE_MESSAGE/i.test(
    message || ''
  );
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
  pendingTaps: [],
  lastTapNetworkTime: 0,
  nextTapGapMs: TAP_INTERVAL_MS,
  notOwnerStreak: 0,
  keyOk: null,
  keyWarned: false,
  endpointProbed: false,
  failedTaps: 0,
  fullRounds: 0,
  tapCap: MAX_TAPS_PER_ROUND,
  computing: false, // the CURRENT session's worker is mining right now (taps are accepted)
  sessionDone: null, // resolves the wait in launchSession()
  lastLaunchAt: 0,
  lastAcceptedAt: 0,
  lastRewardAt: 0,
  // credited-sessions tracking for the current run (from the chain's tap_sum)
  tapBase: null, // tap_sum at run start (null = not read yet)
  tapLast: 0, // last tap_sum seen
  tapCredited: 0, // taps credited since the baseline (reset-aware)
  acceptedEvents: 0, // session_accepted events seen in this run
  stoppedAt: 0,
  // v21 measurement (does not influence behaviour)
  fates: {}, // outcome counters per run, from SDK events
  reads: { ok: 0, fail: 0 }, // get_miner_data reads done by the app, per run
  rootDelivered: 0, // submit_session_root events without error, per run
  // v22 measurement (does not influence behaviour)
  startStateLogged: false, // commit_data probe at run start done for this run
};

function minerIsBusy() {
  try {
    return !!state.miner && !state.miner.can_start();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Measurement helpers (read-only: they never change what the app does)
// ---------------------------------------------------------------------

// v22: countFate(key, hour) also adds the outcome to the hourly table, in the hour the session was launched.
function countFate(key, hour) {
  state.fates[key] = (state.fates[key] || 0) + 1;
  if (hour !== undefined) bumpHour(hour, key);
}

const FATE_LABELS = [
  ['session_accepted', 'принята'],
  ['session_rejected', 'отклонена'],
  ['root_ok', 'root доставлен'],
  ['root_fail', 'root не доставлен'],
  ['proof_ok', 'proof доставлен'],
  ['proof_fail', 'proof не доставлен'],
  ['preflight_failed', 'preflight_failed'],
  ['complexity_unknown', 'complexity_unknown'],
  ['stale_commit_cancelled_ok', 'stale cancel принят'],
  ['stale_commit_cancelled_fail', 'stale cancel не принят'],
  ['stale_commit_uncancellable', 'stale_commit_uncancellable'],
];

function fatesSummary() {
  const parts = [];
  for (const [key, label] of FATE_LABELS) {
    if (state.fates[key]) parts.push(`${label}: ${state.fates[key]}`);
  }
  return parts.length ? parts.join('; ') : 'пока нет событий';
}

function readsSummary() {
  const total = state.reads.ok + state.reads.fail;
  if (!total) return 'чтений аккаунта: 0';
  return (
    `чтений аккаунта (get_miner_data): ${total}, неудачных ${state.reads.fail} ` +
    `(${Math.round((state.reads.fail / total) * 100)}%)`
  );
}

function networkInfo() {
  try {
    const c = globalThis.navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    if (!c) return 'тип сети: WebView не сообщает (navigator.connection нет)';
    const parts = [];
    if (c.type) parts.push('type=' + c.type);
    if (c.effectiveType) parts.push('effectiveType=' + c.effectiveType);
    if (Number.isFinite(c.rtt)) parts.push('rtt=' + c.rtt + ' мс');
    if (Number.isFinite(c.downlink)) parts.push('downlink=' + c.downlink + ' Мбит/с');
    if (c.saveData) parts.push('saveData');
    return 'тип сети: ' + (parts.join(', ') || 'нет данных');
  } catch {
    return 'тип сети: ошибка чтения';
  }
}

function renderTapCount() {
  ui.tapCount.textContent =
    `${state.networkTapsSent || 0} (сессия ${state.currentRound}: ` +
    `${state.tapsThisRound}/${state.tapCap}, в очереди: ${(state.pendingTaps || []).length})` +
    ` · root доставлен: ${state.rootDelivered}`;
}

// ---------------------------------------------------------------------
// v22: hourly table of all session outcomes (F67). Key = UTC hour the session was launched in.
// Keys of each hour: started + the same outcome keys as the per-run counter (countFate).
// ---------------------------------------------------------------------

function loadFates() {
  try {
    const raw = localStorage.getItem(FATES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.byHour ? parsed : { byHour: {} };
  } catch {
    return { byHour: {} };
  }
}

function bumpHour(hour, key) {
  try {
    const f = loadFates();
    const h = String(Number.isFinite(hour) ? hour : new Date().getUTCHours());
    if (!f.byHour[h]) f.byHour[h] = {};
    f.byHour[h][key] = (f.byHour[h][key] || 0) + 1;
    localStorage.setItem(FATES_KEY, JSON.stringify(f));
  } catch {
    // a tally is never worth breaking mining for
  }
}

function hourlyLines() {
  const f = loadFates();
  return Object.keys(f.byHour)
    .map(Number)
    .sort((a, b) => a - b)
    .map((h) => {
      const v = f.byHour[h] || {};
      const n = (k) => v[k] || 0;
      const rootAll = n('root_ok') + n('root_fail');
      const proofAll = n('proof_ok') + n('proof_fail');
      return (
        `${String(h).padStart(2, '0')}:00 UTC — запущено ${n('started')} · ` +
        `root ${n('root_ok')}/${rootAll} · proof ${n('proof_ok')}/${proofAll} · ` +
        `принято ${n('session_accepted')} · отклонено ${n('session_rejected')} · ` +
        `preflight ${n('preflight_failed')} · complexity ${n('complexity_unknown')} · ` +
        `stale ${n('stale_commit_uncancellable')}`
      );
    });
}

// the log shows the newest line on top: print the hours in reverse, then the header
function logHourly() {
  const lines = hourlyLines();
  if (!lines.length) {
    log('Исходы по часам запуска (UTC): пока нет данных.');
    return;
  }
  for (let i = lines.length - 1; i >= 0; i--) log(lines[i]);
  log('Исходы по часам запуска, все прогоны (root x/y = доставлен / были попытки):');
}

// ---------------------------------------------------------------------
// v22: commit_data probe. A commit left on the contract by an earlier session is what makes the next start
// go into the cancel loop (F61); reading it before the first session shows it before the loop, not after.
// A read only (get_session_state), never awaited by the loop.
// ---------------------------------------------------------------------

async function logContractState(tag) {
  if (!state.miner || typeof state.miner.get_session_state !== 'function') return;
  try {
    let st = await state.miner.get_session_state();
    if (typeof st === 'string') {
      try {
        st = JSON.parse(st);
      } catch {
        // keep the string
      }
    }
    const cd = st && st.commit_data;
    const text =
      cd === undefined || cd === null
        ? 'поля нет'
        : `${JSON.stringify(String(cd)).slice(0, 34)} (длина ${String(cd).length})`;
    log(`Контракт (${tag}): commit_data = ${text}.`);
  } catch (e) {
    log(`Контракт (${tag}): чтение не удалось — ${shortError((e && e.message) || e)}`);
  }
}

// ---------------------------------------------------------------------
// Credited sessions (from the chain's own tap_sum, not from "taps sent")
// ---------------------------------------------------------------------

function creditedSessions() {
  return Math.floor(state.tapCredited / MAX_TAPS_PER_ROUND);
}

function renderCredited() {
  if (state.tapBase === null) {
    creditedEl.textContent = state.mining
      ? 'Зачтено сессий: считаю базу tap_sum…'
      : 'Зачтено сессий: — (запусти майнинг)';
    return;
  }
  creditedEl.textContent =
    `Зачтено сессий: ${creditedSessions()} из ${state.currentRound} запущено · ` +
    `Δtap_sum ${state.tapCredited} (tap_sum ${state.tapLast}) · принято по событиям SDK: ${state.acceptedEvents}`;
}

function applyTapSum(cur) {
  if (!Number.isFinite(cur)) return;
  if (state.tapBase === null) {
    state.tapBase = cur;
    state.tapLast = cur;
    state.tapCredited = 0;
    renderCredited();
    return;
  }
  let delta;
  if (cur < state.tapLast) {
    // the counter resets with the epoch (about 08:10-08:25 UTC, registry F12): what is there now was
    // earned after the reset
    delta = cur;
    log(`tap_sum стал ниже прежнего (${state.tapLast} → ${cur}): сброс эпохи, ${cur} считаю заработанным после сброса.`);
  } else {
    delta = cur - state.tapLast;
  }
  state.tapLast = cur;
  if (delta > 0) {
    state.tapCredited += delta;
    log(`✅ Зачтено по tap_sum: +${delta}. За прогон: ${creditedSessions()} сессий (Δtap_sum ${state.tapCredited}).`);
  }
  renderCredited();
}

let tapRefreshing = false;
async function refreshTapSum(withLog) {
  if (tapRefreshing || !state.miner) return false;
  tapRefreshing = true;
  try {
    const data = await state.miner.get_miner_data();
    state.reads.ok += 1;
    const first = state.tapBase === null;
    applyTapSum(Number(data.tap_sum));
    if (first) log(`База прогона: tap_sum=${data.tap_sum}, tap_sum_5m=${data.tap_sum_5m}.`);
    return true;
  } catch (e) {
    state.reads.fail += 1;
    if (withLog) log('Чтение tap_sum: ' + shortError((e && e.message) || e));
    return false;
  } finally {
    tapRefreshing = false;
  }
}

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
    sdkKind = sdk.kind;
    await init({ module_or_path: sdk.wasm });
    state.wasmReady = true;
    log(
      'SDK готов (' +
        (sdkKind === 'newgoblin'
          ? 'NewGoblin: доставка с повтором того же сообщения' + (ALLOW_PREMINE ? ', premine' : ', без premine')
          : sdkKind === 'old-patched'
            ? 'СТАРЫЙ патч — запусти сборку SDK (workflow), без неё v22 работает вполсилы'
            : 'стоковый') +
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
    setInterval(drainTapQueue, 250);
    // credited sessions: re-read tap_sum while a run is tracked (and for a while after Stop)
    setInterval(() => {
      if (state.tapBase === null || !state.miner) return;
      if (!state.mining && Date.now() - state.stoppedAt > TAP_STATS_AFTER_STOP_MS) return;
      refreshTapSum(false);
    }, TAP_STATS_REFRESH_MS);
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

// One-second heartbeat: notices when the app was frozen (screen off / app in background).
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
  updateClosingConfirmation();
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

// Called every 250 ms. Taps go to the SDK only while the current session's worker is mining.
function drainTapQueue() {
  if (
    !state.mining ||
    !state.miner ||
    !state.computing ||
    !state.pendingTaps ||
    state.pendingTaps.length === 0 ||
    state.tapsThisRound >= state.tapCap
  ) {
    return;
  }
  const now = Date.now();
  if (now - (state.lastTapNetworkTime || 0) < (state.nextTapGapMs || TAP_INTERVAL_MS)) return;

  const [x, y] = state.pendingTaps.shift();
  savePendingTaps();
  try {
    state.miner.add_tap(x, y);
    state.lastTapNetworkTime = now;
    state.nextTapGapMs = Math.round(TAP_INTERVAL_MS * (0.97 + Math.random() * 0.06));
    state.tapsThisRound += 1;
    state.networkTapsSent = (state.networkTapsSent || 0) + 1;
    renderTapCount();
  } catch (e) {
    state.pendingTaps.unshift([x, y]);
    savePendingTaps();
    state.lastTapNetworkTime = now; // do not hammer: try again after one gap
    log('Ошибка отправки тапа: ' + ((e && e.message) || e));
  }
}

// ---------------------------------------------------------------------
// Results tally (UTC hour), from the chain's own session_accepted / session_rejected events.
// Counts SDK verdicts ONLY: a root or proof that never got delivered gives no verdict and is not in here
// (F67). The all-outcomes table is the hourly table above (FATES_KEY).
// ---------------------------------------------------------------------

function loadResults() {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    return raw ? JSON.parse(raw) : { byHour: {}, ok: 0, fail: 0 };
  } catch {
    return { byHour: {}, ok: 0, fail: 0 };
  }
}

function recordResult(ok) {
  try {
    const r = loadResults();
    const h = String(new Date().getUTCHours());
    if (!r.byHour[h]) r.byHour[h] = { ok: 0, fail: 0 };
    r.byHour[h][ok ? 'ok' : 'fail'] += 1;
    r[ok ? 'ok' : 'fail'] += 1;
    localStorage.setItem(RESULTS_KEY, JSON.stringify(r));
  } catch {
    // a tally is never worth breaking mining for
  }
}

function resultsSummary() {
  const r = loadResults();
  const total = r.ok + r.fail;
  const hours = Object.keys(r.byHour)
    .map(Number)
    .sort((a, b) => a - b)
    .map((h) => {
      const v = r.byHour[h];
      return `${String(h).padStart(2, '0')}:00 UTC ${v.ok}/${v.ok + v.fail}`;
    })
    .join('; ');
  return (
    `вердикты SDK (только принята/отклонена, недоставленные root и proof сюда не входят): ` +
    `принято ${r.ok} из ${total}${total ? ` (${Math.round((r.ok / total) * 100)}%)` : ''}` +
    (hours ? ` — ${hours}` : '')
  );
}

function secs(ms) {
  return Math.round(ms / 1000);
}

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
  localStorage.removeItem(WALLET_SESSION_KEY);
  discardPremine(state.miner);
  state.miner?.free();
  state.miner = null;
  state.connected = false;
  state.minerAddress = null;
  state.miningPublic = null;
  state.miningSecret = null;
  state.pendingKeys = null;
  state.pendingWalletName = null;
  state.tapBase = null;
  renderCredited();

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

// ends a queued/mining/held premine worker quietly (nothing is sent); false when there is none
function discardPremine(miner) {
  try {
    if (miner && typeof miner.discard_premine === 'function' && miner.discard_premine()) {
      log('Premine снят (discard_premine).');
    }
  } catch (e) {
    log('discard_premine: ' + ((e && e.message) || e));
  }
}

// ---------------------------------------------------------------------
// Miner instance (single creation in flight, retried with backoff)
// ---------------------------------------------------------------------

let minerCreationInFlight = null;

async function getOrCreateMiner() {
  if (state.miner) return state.miner;
  if (minerCreationInFlight) return minerCreationInFlight;

  minerCreationInFlight = (async () => {
    const createdFrom = Date.now();
    for (let attempt = 1; state.autoContinueRounds || !state.mining; attempt++) {
      try {
        const miner = await Miner.new(
          minerEndpoints,
          APP_ID,
          state.minerAddress,
          state.miningPublic,
          state.miningSecret
        );
        if (typeof miner.set_submit_policy === 'function') {
          try {
            miner.set_submit_policy(...SUBMIT_POLICY);
          } catch (e) {
            log('set_submit_policy: ' + ((e && e.message) || e));
          }
        }
        state.miner = miner;
        return miner;
      } catch (e) {
        const msg = (e && e.message) || String(e);
        hintIfNotOwner(msg);
        if (!isTransientNetworkError(msg)) throw e;
        const delay = CREATE_BACKOFF_MS[Math.min(attempt - 1, CREATE_BACKOFF_MS.length - 1)];
        const mins = Math.round(((Date.now() - createdFrom) / 60_000) * 10) / 10;
        if (attempt === 1) log('Создание майнера, текст ошибки целиком (первые 300 знаков): ' + String(msg).slice(0, 300));
        if (/Cancel stale session data/i.test(msg)) ui.miningStatus.textContent = 'Очищаю зависшую сессию…';
        log(`Создание майнера: ${shortError(msg)} (попытка ${attempt}, ${mins} мин). Повтор через ${secs(delay)} с…`);
        if (/failed to fetch/i.test(msg) && !state.endpointProbed) {
          state.endpointProbed = true;
          await probeEndpoint();
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (!state.autoContinueRounds) throw new Error('остановлено во время создания майнера');
      }
    }
    throw new Error('остановлено во время создания майнера');
  })();

  try {
    return await minerCreationInFlight;
  } finally {
    minerCreationInFlight = null;
  }
}

// ---------------------------------------------------------------------
// Mining loop. The SDK delivers root and proof (same signed message, resent with backoff, until it is
// accepted, seen on chain or its 240 s life ends). The app only decides WHEN to start a session and
// feeds it taps. A session starts only when the previous one is through (can_start), no premine.
// ---------------------------------------------------------------------

let loopRunning = false;

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
  if (loopRunning) return;
  state.notOwnerStreak = 0;
  state.autoContinueRounds = true;
  state.mining = true;
  acquireWakeLock();
  updateClosingConfirmation();
  state.currentRound = 0;
  state.fullRounds = 0;
  state.tapCount = 0;
  state.lastLaunchAt = 0;
  // a new run: new credited-sessions baseline
  state.tapBase = null;
  state.tapLast = 0;
  state.tapCredited = 0;
  state.acceptedEvents = 0;
  // a new run: new measurement counters
  state.fates = {};
  state.reads = { ok: 0, fail: 0 };
  state.rootDelivered = 0;
  state.startStateLogged = false;
  renderCredited();
  ui.cellCount.textContent = '0';
  ui.tapCount.textContent = '0';
  ui.btnMine.disabled = true;
  ui.btnStop.disabled = false;
  ui.minesweeper.classList.add('active');
  ui.miningDot.className = 'dot on';
  newField();
  log(`Старт. Сессия ${secs(SESSION_DURATION_MS)} с, до ${MAX_TAPS_PER_ROUND} тапов раз в ${TAP_INTERVAL_MS / 1000} с, не чаще одной за ${secs(MIN_CYCLE_MS)} с, следующая только после завершения предыдущей.`);
  log(networkInfo());
  miningLoop();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 'start' | 'premine' (only if ALLOW_PREMINE) | 'recreate' | null (stopped)
async function waitForSlot(miner) {
  const t0 = Date.now();
  let logged = false;
  while (state.autoContinueRounds) {
    let canStart = false;
    let canPremine = false;
    try {
      canStart = miner.can_start();
      canPremine =
        ALLOW_PREMINE && !canStart && typeof miner.can_premine === 'function' && miner.can_premine();
    } catch (e) {
      log('can_start: ' + ((e && e.message) || e));
      return 'recreate';
    }
    if (canStart) return 'start';
    if (canPremine) return 'premine';
    if (!logged && Date.now() - t0 > 20_000) {
      logged = true;
      ui.miningStatus.textContent = 'Жду завершения предыдущей сессии…';
      log('Предыдущая сессия ещё отправляется — жду, следующая стартует после неё (SDK повторяет отправку сам).');
    }
    if (Date.now() - t0 > BUSY_RECREATE_MS) {
      log(`Майнер не готов ${secs(BUSY_RECREATE_MS)} с — пересоздаю.`);
      return 'recreate';
    }
    await sleep(1000);
  }
  return null;
}

async function waitForCadence() {
  while (state.autoContinueRounds) {
    const left = state.lastLaunchAt + MIN_CYCLE_MS - Date.now();
    if (left <= 0) return;
    ui.miningStatus.textContent = `Следующая сессия через ${secs(left)} с`;
    await sleep(Math.min(1000, left));
  }
}

async function waitForTaps() {
  if (state.pendingTaps.length > 0) return;
  ui.miningStatus.textContent = 'Жду тапов…';
  log('Очередь тапов пуста — жду первый тап, чтобы начать сессию.');
  while (state.autoContinueRounds && state.pendingTaps.length === 0) await sleep(1000);
}

async function maybeClaimReward(miner) {
  if (typeof miner.get_reward !== 'function') return;
  if (!state.lastAcceptedAt || state.lastRewardAt >= state.lastAcceptedAt) return;
  if (Date.now() - state.lastAcceptedAt < REWARD_CLAIM_AFTER_MS) return;
  state.lastRewardAt = Date.now();
  try {
    log('💰 Принятая сессия не выплачена следующей — отправляю get_reward.');
    await miner.get_reward();
  } catch (e) {
    log('get_reward: ' + shortError((e && e.message) || e));
  }
}

async function miningLoop() {
  if (loopRunning) return;
  loopRunning = true;
  let errorStreak = 0;
  try {
    while (state.autoContinueRounds && state.fullRounds < MAX_ROUNDS) {
      try {
        const miner = await getOrCreateMiner();
        // baseline for "credited sessions": tap_sum before the first session of this run
        for (let i = 0; i < 3 && state.autoContinueRounds && state.tapBase === null; i++) {
          if (await refreshTapSum(true)) break;
          await sleep(3000);
        }
        // v22: commit_data probe, once per run, before the first session (read only, not awaited)
        if (!state.startStateLogged) {
          state.startStateLogged = true;
          logContractState('старт прогона');
        }
        await waitForCadence();
        if (!state.autoContinueRounds) break;
        const slot = await waitForSlot(miner);
        if (!slot) break;
        if (slot === 'recreate') {
          state.miner = null;
          discardPremine(miner);
          try {
            miner.free();
          } catch {
            // already gone
          }
          continue;
        }
        if (slot === 'start') await maybeClaimReward(miner);
        await waitForTaps();
        if (!state.autoContinueRounds) break;
        refreshTapSum(false); // not awaited: a read must never delay a start
        await launchSession(miner, slot);
        errorStreak = 0;
      } catch (e) {
        const msg = (e && e.message) || String(e);
        if (!state.autoContinueRounds) break;
        errorStreak += 1;
        hintIfNotOwner(msg);
        if (errorStreak >= 5 && !isTransientNetworkError(msg)) {
          log('Ошибка майнинга, остановка: ' + shortError(msg));
          break;
        }
        const delay = Math.min(5_000 * errorStreak, 30_000);
        log(`Ошибка цикла: ${shortError(msg)} — повтор через ${secs(delay)} с (подряд: ${errorStreak}).`);
        await sleep(delay);
      }
    }
  } finally {
    loopRunning = false;
    finishMining();
  }
}

async function launchSession(miner, slot) {
  state.currentRound += 1;
  state.fullRounds += 1;
  const no = state.currentRound;
  state.tapsThisRound = 0;
  state.lastTapNetworkTime = 0;
  state.nextTapGapMs = TAP_INTERVAL_MS;
  state.computing = false;
  state.lastLaunchAt = Date.now();
  // v22: the hour (UTC) this session is launched in; all its outcomes go to this hour of the hourly table
  const launchHour = new Date().getUTCHours();
  bumpHour(launchHour, 'started');
  ui.miningStatus.textContent = `Сессия ${no}: запуск…`;
  renderCredited();
  log(`▶ Сессия ${no} (${slot === 'premine' ? 'premine: майнится, пока уходит предыдущая' : 'старт'}).`);

  const done = new Promise((resolve) => {
    state.sessionDone = resolve;
  });
  const guard = setTimeout(() => {
    if (state.sessionDone) {
      log(`⚠️ Сессия ${no}: нет завершения майнинга за ${secs(SESSION_DURATION_MS + 120_000)} с — иду дальше.`);
      state.sessionDone();
    }
  }, SESSION_DURATION_MS + 120_000);

  const callback = (raw) => handleMinerEvent(no, raw, launchHour);
  if (slot === 'premine') {
    miner.premine(SESSION_DURATION_MS, callback);
    try {
      miner.release_submit(); // safe early: the SDK submits only after the previous session is through
    } catch (e) {
      log('release_submit: ' + ((e && e.message) || e));
    }
  } else {
    miner.start(SESSION_DURATION_MS, callback);
  }
  try {
    await done;
  } finally {
    clearTimeout(guard);
    state.sessionDone = null;
    state.computing = false;
  }
  log(`Сессия ${no}: майнинг окончен, отправлено ${state.tapsThisRound} тапов. SDK отправляет её сам.`);
}

function endSessionWait() {
  if (state.sessionDone) state.sessionDone();
}

function handleMinerEvent(no, raw, launchHour) {
  const ev = parseMinerEvent(raw);
  if (!ev || !ev.action) return;
  const a = ev.action;
  const d = ev.data || {};
  const current = no === state.currentRound;

  // measurement: outcome counters per run + hourly table (no effect on behaviour)
  try {
    if (a === 'session_accepted' || a === 'session_rejected') countFate(a, launchHour);
    else if (a === 'preflight_failed' || a === 'complexity_unknown' || a === 'stale_commit_uncancellable')
      countFate(a, launchHour);
    else if (a === 'stale_commit_cancelled')
      countFate(d.ok ? 'stale_commit_cancelled_ok' : 'stale_commit_cancelled_fail', launchHour);
    else if (a === 'submit_session_root') {
      countFate(ev.error ? 'root_fail' : 'root_ok', launchHour);
      if (!ev.error) {
        state.rootDelivered += 1;
        renderTapCount();
      }
    } else if (a === 'submit_session_proof') countFate(ev.error ? 'proof_fail' : 'proof_ok', launchHour);
  } catch {
    // a counter is never worth breaking mining for
  }

  if (a === 'tap_computed') {
    if (d.error) {
      state.failedTaps = (state.failedTaps || 0) + 1;
      log(`❌ Тап отклонён локально: ${d.error}`);
    }
    return;
  }

  if (a === 'status_updated') {
    const status = d.status;
    if (current) {
      if (status === 'computing') {
        state.computing = true;
        ui.miningStatus.textContent = `Сессия ${no}: майнинг`;
      } else if (status) {
        state.computing = false;
        if (status === 'submitting' || status === 'held' || status === 'finished' || status === 'removed') {
          ui.miningStatus.textContent = `Сессия ${no}: ${status}`;
          endSessionWait();
        }
      }
    }
    if (status && status !== 'computing') log(`Сессия ${no}: статус ${status}.`);
    return;
  }

  if (a === 'send_attempt') {
    const n = d.attempt || 0;
    // every cancel attempt is logged (v20 logged only 1, 4, 8, ...), other kinds as before
    const isCancel = /cancel/i.test(String(d.kind || ''));
    if (d.outcome !== 'ambiguous' || n === 1 || n % 4 === 0 || isCancel) {
      log(
        `↻ Сессия ${no}: ${d.kind} попытка ${n} — ${d.outcome}` +
          (d.node_code ? ` (${d.node_code})` : '') +
          (d.error ? `: ${shortError(d.error)}` : '')
      );
    }
    return;
  }

  if (a === 'session_accepted' || a === 'session_rejected') {
    const ok = a === 'session_accepted';
    recordResult(ok);
    if (ok) {
      state.lastAcceptedAt = Date.now();
      state.acceptedEvents += 1;
      renderCredited();
      refreshTapSum(false); // the chain's tap_sum is the real confirmation
    }
    log(
      ok
        ? `✅ Сессия ${no}: ПРИНЯТА сетью. ${resultsSummary()}`
        : `⛔ Сессия ${no}: отклонена${ev.error ? ': ' + shortError(ev.error) : ''}. ${resultsSummary()}`
    );
    return;
  }

  if (a === 'submit_session_root' || a === 'submit_session_proof') {
    const stage = a === 'submit_session_root' ? 'root' : 'proof';
    if (ev.error) {
      hintIfNotOwner(`${ev.error} ${JSON.stringify(d)}`);
      log(`Сессия ${no}: ${stage} не доставлен: ${shortError(ev.error)}`);
    } else {
      log(`📨 Сессия ${no}: ${stage} доставлен.`);
    }
    return;
  }

  // everything else the patched SDK reports (premine_*, preflight_failed, stale_commit_*, ...): one short line
  const short = JSON.stringify(d).slice(0, 220);
  if (ev.error) {
    log(`Сессия ${no}: ${a} — ошибка: ${shortError(ev.error)} ${short}`);
  } else {
    log(`Сессия ${no}: ${a} ${short === '{}' ? '' : short}`);
  }
}

function finishMining() {
  state.autoContinueRounds = false;
  state.mining = false;
  state.computing = false;
  state.stoppedAt = Date.now();
  releaseWakeLock();
  ui.miningDot.className = 'dot off';
  ui.miningStatus.textContent = 'Остановлен';
  ui.btnMine.disabled = false;
  ui.btnStop.disabled = true;
  log(`Майнинг остановлен. Сессий запущено: ${state.currentRound}. ${resultsSummary()}`);
  if (state.tapBase !== null) {
    log(
      `Итог прогона: зачтено ${creditedSessions()} сессий из ${state.currentRound} запущено ` +
        `(Δtap_sum ${state.tapCredited}). Поздний приём возможен: строка «Зачтено сессий» обновляется, пока приложение открыто.`
    );
  }
  log(`Исходы за прогон: ${fatesSummary()}.`);
  log(`${readsSummary()}. ${networkInfo()}.`);
  logHourly();
  renderCredited();
  refreshTapSum(false);
  logContractState('конец прогона'); // v22: is a commit left on the contract (read only, not awaited)
  if (minerIsBusy()) {
    log('⏳ Последняя сессия ещё отправляется — не закрывай приложение, пока не придёт итог.');
  }
  updateClosingConfirmation();
}

async function requestStop() {
  state.autoContinueRounds = false;
  ui.btnStop.disabled = true;
  discardPremine(state.miner);
  if (state.computing && state.miner) {
    log('Остановка: вызываю miner.stop() — накопленные тапы уйдут в контракт сразу.');
    try {
      state.miner.stop();
    } catch (e) {
      log('miner.stop(): ' + ((e && e.message) || e));
    }
    endSessionWait();
    return;
  }
  log('Остановка запрошена — новая сессия не начнётся.');
  endSessionWait();
}

async function checkStatus() {
  try {
    ui.btnStatus.disabled = true;
    const miner = await getOrCreateMiner();
    let data;
    try {
      data = await miner.get_miner_data();
      state.reads.ok += 1;
    } catch (e) {
      state.reads.fail += 1;
      throw e;
    }
    log(
      `Статус майнера: tap_sum=${data.tap_sum}, tap_sum_5m=${data.tap_sum_5m}, ` +
        `epoch_start=${data.epoch_start}, epoch_5m_start=${data.epoch_5m_start}`
    );
    if (state.tapBase !== null) applyTapSum(Number(data.tap_sum));
    log(`Результаты: ${resultsSummary()}`);
    log(creditedEl.textContent);
    log(`Исходы за прогон: ${fatesSummary()}.`);
    log(`${readsSummary()}. ${networkInfo()}.`);
    logHourly();
    if (typeof miner.get_session_state === 'function') {
      try {
        const st = await miner.get_session_state();
        log('Состояние контракта: ' + JSON.stringify(st).slice(0, 400));
      } catch (e) {
        log('get_session_state: ' + ((e && e.message) || e));
      }
    }
    await checkKeyOnChain();
  } catch (e) {
    log('Ошибка проверки статуса: ' + ((e && e.message) || e));
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
