// ============================================================
// NACKL Miner — Telegram Mini App
// Каркас интеграции с Bee Engine SDK (@tvmsdk/core)
//
// ВАЖНО: часть вызовов ниже помечена TODO — это места, где нужно
// подставить точные имена методов из актуальной документации:
// https://dev.ackinacki.com/bee-engine/bee-engine-sdk-integration-documentation
// SDK меняется, поэтому сверь сигнатуры функций перед продакшн-запуском.
// ============================================================

// --- Telegram Web App init ---
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// --- DOM ---
const els = {
  walletDot: document.getElementById('wallet-dot'),
  walletStatus: document.getElementById('wallet-status'),
  miningDot: document.getElementById('mining-dot'),
  miningStatus: document.getElementById('mining-status'),
  balance: document.getElementById('balance'),
  btnConnect: document.getElementById('btn-connect'),
  btnMine: document.getElementById('btn-mine'),
  btnStop: document.getElementById('btn-stop'),
  btnClaim: document.getElementById('btn-claim'),
  log: document.getElementById('log'),
  minesweeper: document.getElementById('minesweeper'),
  msGrid: document.getElementById('ms-grid'),
  msMines: document.getElementById('ms-mines'),
  tapCount: document.getElementById('tap-count'),
  btnRestart: document.getElementById('btn-restart'),
};

function log(msg) {
  const time = new Date().toLocaleTimeString();
  els.log.innerHTML = `[${time}] ${msg}<br>` + els.log.innerHTML;
  console.log(msg);
}

// --- Состояние приложения ---
const state = {
  connected: false,
  mining: false,
  walletAddress: null,
  minerContract: null,
  tapCount: 0,
};

// ============================================================
// БЛОК 1: Подключение AN Wallet
// ============================================================
async function connectWallet() {
  try {
    log('Инициализация подключения кошелька…');
    els.btnConnect.disabled = true;

    // TODO: заменить на реальный вызов из @tvmsdk/core.
    // По документации Bee Engine SDK поток такой:
    //  1. Приложение генерирует QR-код / deep link для AN Wallet
    //  2. Пользователь сканирует его в приложении AN Wallet
    //  3. AN Wallet НЕ возвращает прямой ответ — сессию нужно
    //     подтверждать первым тапом, подписанным mining-ключом
    //
    // Пример ожидаемого использования (сверить с актуальным SDK):
    //
    // import { TvmClient } from '@tvmsdk/core';
    // const client = new TvmClient({ network: { endpoints: [...] } });
    // const authRequest = await client.wallet.createAuthRequest();
    // showQrCode(authRequest.qrPayload);
    // const session = await client.wallet.waitForConfirmation(authRequest.id);

    // --- ЗАГЛУШКА для тестирования UI без реального SDK ---
    await delay(1200);
    state.connected = true;
    state.walletAddress = 'DEMO_WALLET_ADDRESS';

    els.walletDot.className = 'dot on';
    els.walletStatus.textContent = 'Подключен';
    els.btnMine.disabled = false;
    els.btnClaim.disabled = false;
    log('Кошелёк подключен (демо-режим — заменить на реальный SDK-вызов)');
  } catch (err) {
    log('Ошибка подключения: ' + err.message);
  } finally {
    els.btnConnect.disabled = false;
  }
}

// ============================================================
// БЛОК 2: Регистрация mining keys в Miner-контракте
// ============================================================
async function registerMiningKeys() {
  // TODO: генерация ключей и регистрация в Miner-контракте пользователя.
  // Согласно докам: "The mining keys are written to their Miner contract."
  // Ключи должны генерироваться и подписываться на стороне клиента,
  // приватный ключ НИКОГДА не должен покидать устройство пользователя
  // и не должен передаваться на твой сервер.
  log('Регистрация mining keys (заглушка)');
  await delay(500);
  state.minerContract = 'DEMO_MINER_CONTRACT';
}

// ============================================================
// БЛОК 3: Управление майнингом (bee_engine_miner)
// ============================================================
async function startMining() {
  if (!state.connected) return;

  try {
    els.btnMine.disabled = true;
    log('Проверка возможности старта майнинга…');

    // TODO: bee_engine_miner.canStart() — проверка перед стартом
    // TODO: bee_engine_miner.start(durationSeconds) — запуск на N секунд

    await delay(500);
    state.mining = true;
    state.tapCount = 0;
    els.tapCount.textContent = '0';
    els.miningDot.className = 'dot on';
    els.miningStatus.textContent = 'Активен';
    els.btnStop.disabled = false;
    els.minesweeper.classList.add('active');
    newGame();
    log('Майнинг запущен — открывай клетки в Сапёре');
  } catch (err) {
    log('Ошибка запуска майнинга: ' + err.message);
    els.btnMine.disabled = false;
  }
}

// Реальное touch/click-событие пользователя = валидный тап.
// Это то, что уходит в Merkle Tree через bee_engine_miner.addTap().
function handleTap() {
  if (!state.mining) return;

  state.tapCount += 1;
  els.tapCount.textContent = state.tapCount;

  // Лёгкая haptic-отдача в Telegram, если доступна
  tg?.HapticFeedback?.impactOccurred?.('light');

  // TODO: bee_engine_miner.addTap({ ...payload из тач-события... })
  // Каждый N-й тап можно логировать, чтобы не спамить лог на каждый клик
  if (state.tapCount % 10 === 0) {
    log(`${state.tapCount} тапов зафиксировано (демо)`);
  }
}

async function stopMining() {
  try {
    els.btnStop.disabled = true;
    log('Остановка майнинга…');

    // TODO: bee_engine_miner.stop() — принудительная остановка

    state.mining = false;
    els.miningDot.className = 'dot off';
    els.miningStatus.textContent = 'Остановлен';
    els.btnMine.disabled = false;
    log(`Майнинг остановлен. Всего тапов за сессию: ${state.tapCount}`);
  } catch (err) {
    log('Ошибка остановки: ' + err.message);
  } finally {
    els.btnStop.disabled = false;
  }
}

// ============================================================
// БЛОК 4: Сбор наград
// ============================================================
async function claimRewards() {
  try {
    els.btnClaim.disabled = true;
    log('Запрос доступных наград…');

    // TODO: bee_engine_miner.claim() — сбор доступных наград

    await delay(800);
    const demoAmount = (Math.random() * 5).toFixed(4);
    els.balance.textContent = demoAmount + ' NACKL';
    log(`Награды собраны: ${demoAmount} NACKL (демо-значение)`);
  } catch (err) {
    log('Ошибка сбора наград: ' + err.message);
  } finally {
    els.btnClaim.disabled = false;
  }
}

// ============================================================
// БЛОК 5: Мини-игра «Сапёр» — источник реальных тап-событий
// ============================================================
const MS_SIZE = 8;
const MS_MINES = 10;
let msBoard = [];      // {mine, open, flag, count}
let msGameOver = false;
let msFirstClick = true;

function newGame() {
  msGameOver = false;
  msFirstClick = true;
  msBoard = Array.from({ length: MS_SIZE }, () =>
    Array.from({ length: MS_SIZE }, () => ({ mine: false, open: false, flag: false, count: 0 }))
  );
  els.msMines.textContent = MS_MINES;
  renderBoard();
}

function placeMines(excludeRow, excludeCol) {
  let placed = 0;
  while (placed < MS_MINES) {
    const r = Math.floor(Math.random() * MS_SIZE);
    const c = Math.floor(Math.random() * MS_SIZE);
    const isExcluded = Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1;
    if (msBoard[r][c].mine || isExcluded) continue;
    msBoard[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < MS_SIZE; r++) {
    for (let c = 0; c < MS_SIZE; c++) {
      if (msBoard[r][c].mine) continue;
      msBoard[r][c].count = neighbors(r, c).filter(([nr, nc]) => msBoard[nr][nc].mine).length;
    }
  }
}

function neighbors(r, c) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < MS_SIZE && nc >= 0 && nc < MS_SIZE) result.push([nr, nc]);
    }
  }
  return result;
}

function openCell(r, c) {
  if (msGameOver || !state.mining) return;
  const cell = msBoard[r][c];
  if (cell.open || cell.flag) return;

  if (msFirstClick) {
    placeMines(r, c);
    msFirstClick = false;
  }

  // Каждое открытие клетки — осознанное действие пользователя.
  // Засчитываем его как тап для Bee Engine.
  handleTap();

  cell.open = true;

  if (cell.mine) {
    msGameOver = true;
    revealAllMines();
    renderBoard();
    log('💥 Подрыв! Жми «Новое поле», чтобы продолжить майнить');
    return;
  }

  if (cell.count === 0) {
    // Флуд-заливка пустых клеток вокруг — каждая тоже реальное открытие
    for (const [nr, nc] of neighbors(r, c)) {
      if (!msBoard[nr][nc].open && !msBoard[nr][nc].flag) openCell(nr, nc);
    }
  }

  renderBoard();
  checkWin();
}

function toggleFlag(r, c, event) {
  event.preventDefault();
  if (msGameOver || !state.mining) return;
  const cell = msBoard[r][c];
  if (cell.open) return;
  cell.flag = !cell.flag;
  const remaining = MS_MINES - msBoard.flat().filter((c) => c.flag).length;
  els.msMines.textContent = remaining;
  renderBoard();
}

function revealAllMines() {
  for (let r = 0; r < MS_SIZE; r++) {
    for (let c = 0; c < MS_SIZE; c++) {
      if (msBoard[r][c].mine) msBoard[r][c].open = true;
    }
  }
}

function checkWin() {
  const allSafeOpen = msBoard.flat().every((cell) => cell.mine || cell.open);
  if (allSafeOpen) {
    msGameOver = true;
    log('🎉 Поле пройдено! Жми «Новое поле», чтобы продолжить майнить');
  }
}

function renderBoard() {
  els.msGrid.innerHTML = '';
  for (let r = 0; r < MS_SIZE; r++) {
    for (let c = 0; c < MS_SIZE; c++) {
      const cell = msBoard[r][c];
      const div = document.createElement('div');
      div.className = 'ms-cell';
      if (cell.open) {
        div.classList.add('open');
        if (cell.mine) {
          div.classList.add('mine');
          div.textContent = '💣';
        } else if (cell.count > 0) {
          div.textContent = cell.count;
        }
      } else if (cell.flag) {
        div.classList.add('flag');
        div.textContent = '🚩';
      }
      div.addEventListener('click', () => openCell(r, c));
      // Долгое нажатие / правый клик — флаг
      div.addEventListener('contextmenu', (e) => toggleFlag(r, c, e));
      els.msGrid.appendChild(div);
    }
  }
}

// --- Утилита ---
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Привязка событий ---
els.btnConnect.addEventListener('click', async () => {
  await connectWallet();
  if (state.connected) await registerMiningKeys();
});
els.btnMine.addEventListener('click', startMining);
els.btnStop.addEventListener('click', stopMining);
els.btnClaim.addEventListener('click', claimRewards);
els.btnRestart.addEventListener('click', () => {
  if (!state.mining) return;
  newGame();
  log('Новое поле создано');
});

log('Приложение загружено. Подключи кошелёк, чтобы начать.');
