/**
 * 朋友局德州扑克 Web App - 本地静态 Demo
 * 说明：
 * - 代码尽量写得直白，方便新手阅读。
 * - 当前不接后端，只在浏览器内存中保存数据。
 */

const APP_STATE = {
  agreed: false,
  currentRoomId: 'A',
  currentRole: 'player',
  config: {
    initialChips: 200,
    smallBlind: 1,
    bigBlind: 2,
    actionTimeSeconds: 45,
  },
  // 预留角色概念
  roles: ['admin', 'host', 'player'],
  // 预留座位状态枚举
  seatStatuses: [
    '空位',
    '已入座',
    '本手参与中',
    '等待下一局',
    '暂时离开',
    '已弃牌',
    'All-in',
    '离桌',
  ],
  rooms: {
    A: createRoom('房间 A'),
    B: createRoom('房间 B'),
  },
  board: {
    flop: [],
    turn: null,
    river: null,
  },
 countdownTimer: null,
viewMode: 'debug',
viewerNickname: '',

hand: {
  inProgress: false,
  phase: 'idle',
  dealerSeatNo: null,
  smallBlindSeatNo: null,
  bigBlindSeatNo: null,
  actionSeatNo: null,
  pot: 0,
  currentBet: 0,
  minRaiseTo: 0,
  activeSeatNos: [],
  deck: [],
},

function createRoom(name) {
  return {
    id: name.endsWith('A') ? 'A' : 'B',
    name,
    roomCode: '', // 当前阶段预留字段
    seats: Array.from({ length: 12 }, (_, i) => createEmptySeat(i + 1)),
  };
}

function createEmptySeat(index) {
  return {
    seatNo: index,
    nickname: '',
    status: '空位',
    chips: 0,
    // 补码与清算相关字段（第一版先记录结构）
    ledger: {
      initialBuyIn: 0,
      systemTopUpTotal: 0,
      carryOutChips: 0,
      netWinLoss: 0,
    },
    cards: [],
  };
}

const el = {
  disclaimerOverlay: document.getElementById('disclaimerOverlay'),
  agreeBtn: document.getElementById('agreeBtn'),
  app: document.getElementById('app'),
  roomSelect: document.getElementById('roomSelect'),
  roomCode: document.getElementById('roomCode'),
  roleSelect: document.getElementById('roleSelect'),
  viewModeSelect: document.getElementById('viewModeSelect'),
  viewerSelect: document.getElementById('viewerSelect'),
  nicknameInput: document.getElementById('nicknameInput'),
  seatSelect: document.getElementById('seatSelect'),
  joinBtn: document.getElementById('joinBtn'),
  joinMessage: document.getElementById('joinMessage'),
  initialChipsInput: document.getElementById('initialChipsInput'),
  smallBlindInput: document.getElementById('smallBlindInput'),
  bigBlindInput: document.getElementById('bigBlindInput'),
  applyTableConfigBtn: document.getElementById('applyTableConfigBtn'),
  dealBtn: document.getElementById('dealBtn'),
  advancePhaseBtn: document.getElementById('advancePhaseBtn'),
  flopCards: document.getElementById('flopCards'),
  turnCard: document.getElementById('turnCard'),
  riverCard: document.getElementById('riverCard'),
  seatsContainer: document.getElementById('seatsContainer'),
  countdown: document.getElementById('countdown'),
  startCountdownBtn: document.getElementById('startCountdownBtn'),
};

init();

function init() {
  bindEvents();
  renderRoomOptions();
  renderSeatOptions();
  renderViewerOptions();
  renderSeats();
}

function bindEvents() {
  el.agreeBtn.addEventListener('click', () => {
    APP_STATE.agreed = true;
    el.disclaimerOverlay.classList.add('hidden');
    el.app.classList.remove('hidden');
  });

  el.roomSelect.addEventListener('change', (event) => {
    APP_STATE.currentRoomId = event.target.value;
    renderSeatOptions();
    renderViewerOptions();
    renderSeats();
  });

  el.roleSelect.addEventListener('change', (event) => {
    APP_STATE.currentRole = event.target.value;
  });

  el.viewModeSelect.addEventListener('change', (event) => {
    APP_STATE.viewMode = event.target.value;
    renderSeats();
  });

  el.viewerSelect.addEventListener('change', (event) => {
    APP_STATE.viewerNickname = event.target.value;
    renderSeats();
  });

  el.joinBtn.addEventListener('click', handleJoinSeat);

  el.applyTableConfigBtn.addEventListener('click', () => {
    APP_STATE.config.initialChips = Math.max(1, Number(el.initialChipsInput.value) || 200);
    APP_STATE.config.smallBlind = Math.max(1, Number(el.smallBlindInput.value) || 1);
    APP_STATE.config.bigBlind = Math.max(1, Number(el.bigBlindInput.value) || 2);
    el.joinMessage.textContent = `已更新牌桌设置：初始筹码 ${APP_STATE.config.initialChips}，小盲/大盲 ${APP_STATE.config.smallBlind}/${APP_STATE.config.bigBlind}`;
  });

  el.dealBtn.addEventListener('click', dealDemoHand);
  el.startCountdownBtn.addEventListener('click', startCountdownDemo);
}

function renderRoomOptions() {
  el.roomSelect.innerHTML = '';
  Object.keys(APP_STATE.rooms).forEach((roomId) => {
    const option = document.createElement('option');
    option.value = roomId;
    option.textContent = APP_STATE.rooms[roomId].name;
    el.roomSelect.appendChild(option);
  });
}

function renderSeatOptions() {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  const emptySeats = room.seats.filter((seat) => seat.status === '空位');

  el.seatSelect.innerHTML = '';
  emptySeats.forEach((seat) => {
    const option = document.createElement('option');
    option.value = String(seat.seatNo);
    option.textContent = `${seat.seatNo}号位`;
    el.seatSelect.appendChild(option);
  });
}

function renderViewerOptions() {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  const seatedNicknames = room.seats
    .filter((seat) => seat.nickname)
    .map((seat) => seat.nickname);

  el.viewerSelect.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '请选择查看者';
  el.viewerSelect.appendChild(emptyOption);

  seatedNicknames.forEach((nickname) => {
    const option = document.createElement('option');
    option.value = nickname;
    option.textContent = nickname;
    el.viewerSelect.appendChild(option);
  });

  if (APP_STATE.viewerNickname && seatedNicknames.includes(APP_STATE.viewerNickname)) {
    el.viewerSelect.value = APP_STATE.viewerNickname;
  } else {
    APP_STATE.viewerNickname = seatedNicknames[0] || '';
    el.viewerSelect.value = APP_STATE.viewerNickname;
  }
}

function handleJoinSeat() {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  const nickname = el.nicknameInput.value.trim();
  const seatNo = Number(el.seatSelect.value);

  if (nickname.length < 2 || nickname.length > 12) {
    el.joinMessage.textContent = '昵称长度需为 2~12 字符。';
    return;
  }

  const nameExists = room.seats.some((seat) => seat.nickname === nickname);
  if (nameExists) {
    el.joinMessage.textContent = '同一房间内昵称不可重复。';
    return;
  }

  const seat = room.seats.find((s) => s.seatNo === seatNo);
  if (!seat || seat.status !== '空位') {
    el.joinMessage.textContent = '请选择空座位。';
    return;
  }

  seat.nickname = nickname;
  seat.status = '已入座';
  seat.chips = APP_STATE.config.initialChips;
  seat.ledger.initialBuyIn = APP_STATE.config.initialChips;

  el.joinMessage.textContent = `${nickname} 已进入 ${room.name} 的 ${seat.seatNo}号位。`;
  el.nicknameInput.value = '';

  renderSeatOptions();
  renderViewerOptions();
  renderSeats();
}

function renderSeats() {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  el.seatsContainer.innerHTML = '';

  room.seats.forEach((seat) => {
    const seatDiv = document.createElement('article');
    seatDiv.className = 'seat';

    const statusClass = getStatusClass(seat.status);
    const cards = getSeatCardsForView(seat);

    seatDiv.innerHTML = `
      <div class="seat-head">
        <strong>${seat.seatNo}号位</strong>
        <span class="status ${statusClass}">${seat.status}</span>
      </div>
      <div>昵称：${seat.nickname || '（空）'}</div>
      <div>当前筹码：${seat.chips}</div>
      <div>手牌：${cards}</div>
      <div>总买入：${seat.ledger.initialBuyIn + seat.ledger.systemTopUpTotal}</div>
      <div>系统补码：${seat.ledger.systemTopUpTotal}</div>
      <div>带出筹码：${seat.ledger.carryOutChips}</div>
      <div>净输赢：${seat.ledger.netWinLoss}</div>
      <div class="seat-actions">
        <button onclick="setAway(${seat.seatNo})">暂时离开</button>
        <button onclick="returnSeat(${seat.seatNo})">返回</button>
        <button onclick="kickSeat(${seat.seatNo})">房主剔除</button>
      </div>
    `;

    el.seatsContainer.appendChild(seatDiv);
  });
}

function getStatusClass(status) {
  if (status === '空位') return 'status-empty';
  if (status === '暂时离开') return 'status-away';
  if (status === '已弃牌') return 'status-fold';
  return 'status-active';
}

function getSeatCardsForView(seat) {
  if (!seat.cards.length) {
    return '-- --';
  }

  if (APP_STATE.viewMode === 'debug') {
    return seat.cards.join(' ');
  }

  if (!APP_STATE.viewerNickname) {
    return '🂠 🂠';
  }

  return seat.nickname === APP_STATE.viewerNickname ? seat.cards.join(' ') : '🂠 🂠';
}

function dealDemoHand() {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  const seated = room.seats.filter((seat) => ['已入座', '等待下一局'].includes(seat.status));

  if (seated.length < 2) {
    el.joinMessage.textContent = '至少需要 2 名玩家入座，才能开始一手牌。';
    return;
  }

  startNewHand(room, seated);
  renderBoard();
  renderSeats();
  el.joinMessage.textContent = `新一手开始，当前阶段：${APP_STATE.hand.phase}`;
}

function startNewHand(room, seatedSeats) {
  resetHandRuntime();
  APP_STATE.hand.inProgress = true;
  APP_STATE.hand.phase = 'preflop';

  APP_STATE.hand.deck = createShuffledDeck();
  APP_STATE.hand.activeSeatNos = seatedSeats.map((s) => s.seatNo);

  // v0.2 最小骨架：先用固定规则确定按钮位（后续再做轮转）
  APP_STATE.hand.dealerSeatNo = Math.min(...APP_STATE.hand.activeSeatNos);
  APP_STATE.hand.smallBlindSeatNo = getNextActiveSeatNo(APP_STATE.hand.dealerSeatNo);
  APP_STATE.hand.bigBlindSeatNo = getNextActiveSeatNo(APP_STATE.hand.smallBlindSeatNo);
  APP_STATE.hand.actionSeatNo = getNextActiveSeatNo(APP_STATE.hand.bigBlindSeatNo);

  postBlinds(room);
  dealHoleCards(room);
  initBoardAsHidden();
}

function resetHandRuntime() {
  APP_STATE.hand.inProgress = false;
  APP_STATE.hand.phase = 'idle';
  APP_STATE.hand.dealerSeatNo = null;
  APP_STATE.hand.smallBlindSeatNo = null;
  APP_STATE.hand.bigBlindSeatNo = null;
  APP_STATE.hand.actionSeatNo = null;
  APP_STATE.hand.pot = 0;
  APP_STATE.hand.currentBet = 0;
  APP_STATE.hand.minRaiseTo = 0;
  APP_STATE.hand.activeSeatNos = [];
  APP_STATE.hand.deck = [];
}

function getNextActiveSeatNo(fromSeatNo) {
  const actives = [...APP_STATE.hand.activeSeatNos].sort((a, b) => a - b);
  if (!actives.length) return null;
  const next = actives.find((no) => no > fromSeatNo);
  return next ?? actives[0];
}

function postBlinds(room) {
  const sbSeat = room.seats[APP_STATE.hand.smallBlindSeatNo - 1];
  const bbSeat = room.seats[APP_STATE.hand.bigBlindSeatNo - 1];
  const sb = Math.min(APP_STATE.config.smallBlind, sbSeat.chips);
  const bb = Math.min(APP_STATE.config.bigBlind, bbSeat.chips);

  sbSeat.chips -= sb;
  bbSeat.chips -= bb;

  APP_STATE.hand.pot = sb + bb;
  APP_STATE.hand.currentBet = bb;
  APP_STATE.hand.minRaiseTo = bb * 2;
}

function dealHoleCards(room) {
  APP_STATE.hand.activeSeatNos.forEach((seatNo) => {
    const seat = room.seats[seatNo - 1];
    seat.cards = [APP_STATE.hand.deck.pop(), APP_STATE.hand.deck.pop()];
    seat.status = '本手参与中';
  });
}

function initBoardAsHidden() {
  APP_STATE.board.flop = [];
  APP_STATE.board.turn = null;
  APP_STATE.board.river = null;
}

function advancePhase() {
  if (!APP_STATE.hand.inProgress) return;

  if (APP_STATE.hand.phase === 'preflop') {
    APP_STATE.hand.phase = 'flop';
    APP_STATE.board.flop = [
      APP_STATE.hand.deck.pop(),
      APP_STATE.hand.deck.pop(),
      APP_STATE.hand.deck.pop(),
    ];
  } else if (APP_STATE.hand.phase === 'flop') {
    APP_STATE.hand.phase = 'turn';
    APP_STATE.board.turn = APP_STATE.hand.deck.pop();
  } else if (APP_STATE.hand.phase === 'turn') {
    APP_STATE.hand.phase = 'river';
    APP_STATE.board.river = APP_STATE.hand.deck.pop();
  } else if (APP_STATE.hand.phase === 'river') {
    APP_STATE.hand.phase = 'showdown';
  } else if (APP_STATE.hand.phase === 'showdown') {
    APP_STATE.hand.phase = 'idle';
    APP_STATE.hand.inProgress = false;
  }

  renderBoard();
  renderSeats();
  el.joinMessage.textContent = `阶段推进：${APP_STATE.hand.phase}`;
}

function createShuffledDeck() {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];

  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push(`${rank}${suit}`);
    });
  });

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function renderBoard() {
  renderCards(el.flopCards, APP_STATE.board.flop);
  renderCards(el.turnCard, APP_STATE.board.turn ? [APP_STATE.board.turn] : []);
  renderCards(el.riverCard, APP_STATE.board.river ? [APP_STATE.board.river] : []);
}

function renderCards(container, cards) {
  container.innerHTML = '';
  if (!cards.length) {
    container.innerHTML = '<span class="card-item">--</span>';
    return;
  }

  cards.forEach((card) => {
    const item = document.createElement('span');
    item.className = 'card-item';
    item.textContent = card;
    container.appendChild(item);
  });
}

function startCountdownDemo() {
  if (APP_STATE.countdownTimer) {
    clearInterval(APP_STATE.countdownTimer);
  }

  let secondsLeft = APP_STATE.config.actionTimeSeconds;
  el.countdown.textContent = String(secondsLeft);
  el.countdown.classList.remove('warning');

  APP_STATE.countdownTimer = setInterval(() => {
    secondsLeft -= 1;
    el.countdown.textContent = String(Math.max(0, secondsLeft));

    if (secondsLeft <= 10) {
      el.countdown.classList.add('warning');
    }

    if (secondsLeft <= 0) {
      clearInterval(APP_STATE.countdownTimer);
      APP_STATE.countdownTimer = null;
      // 当前阶段先只做提示，不接完整下注逻辑
      el.joinMessage.textContent = '倒计时结束：后续版本将根据可否过牌自动过牌或自动弃牌，并将玩家设为暂时离开。';
    }
  }, 1000);
}

// 以下函数通过 window 暴露，供座位卡片中的按钮调用。
window.setAway = function setAway(seatNo) {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  const seat = room.seats.find((s) => s.seatNo === seatNo);
  if (!seat || seat.status === '空位') return;

  if (seat.status === '本手参与中') {
    seat.status = '已弃牌';
  } else {
    seat.status = '暂时离开';
  }

  renderSeats();
};

window.returnSeat = function returnSeat(seatNo) {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  const seat = room.seats.find((s) => s.seatNo === seatNo);
  if (!seat || seat.status === '空位') return;

  // 当前手牌是否进行中：只要有人“本手参与中”，则视为当前牌局进行中
  const handInProgress = room.seats.some((s) => s.status === '本手参与中');
  seat.status = handInProgress ? '等待下一局' : '已入座';

  renderSeats();
};

window.kickSeat = function kickSeat(seatNo) {
  const room = APP_STATE.rooms[APP_STATE.currentRoomId];
  const seat = room.seats.find((s) => s.seatNo === seatNo);
  if (!seat || seat.status === '空位') return;

  const shouldKick = window.confirm(`确认剔除 ${seat.nickname || seat.seatNo + '号位'} 吗？`);
  if (!shouldKick) return;

  // 清算：净输赢 = 带出筹码 - 总买入
  seat.ledger.carryOutChips = seat.chips;
  const totalBuyIn = seat.ledger.initialBuyIn + seat.ledger.systemTopUpTotal;
  seat.ledger.netWinLoss = seat.ledger.carryOutChips - totalBuyIn;

  room.seats[seatNo - 1] = createEmptySeat(seatNo);
  renderSeatOptions();
  renderViewerOptions();
  renderSeats();
};
