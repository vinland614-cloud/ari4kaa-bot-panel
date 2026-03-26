const socket = io();

let timerInterval = null;
let seconds = 0;
let currentWinner = null;
let currentWinnerMessages = [];
let winnerHistory = {};

const keywordInput = () => document.getElementById('keyword');
const antiSpamInput = () => document.getElementById('antiSpam');
const allowRepeatInput = () => document.getElementById('allowRepeat');
const multiWinnersInput = () => document.getElementById('multiWinners');
const winnersCountInput = () => document.getElementById('winnersCount');

const startBtn = () => document.getElementById('startBtn');
const stopBtn = () => document.getElementById('stopBtn');

const winnerModal = () => document.getElementById('winnerModal');
const winnerName = () => document.getElementById('winnerName');
const winnerWins = () => document.getElementById('winnerWins');
const timerEl = () => document.getElementById('timer');
const winnerMessagesEl = () => document.getElementById('winnerMessages');
const winnerHistoryEl = () => document.getElementById('winnerHistory');
const chatEl = () => document.getElementById('chat');
const participantsListEl = () => document.getElementById('participantsList');

function saveHistory(user) {
  const key = 'history_' + user;
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  history.unshift(new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }));
  localStorage.setItem(key, JSON.stringify(history));
}

function loadHistory(user) {
  const key = 'history_' + user;
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  winnerHistory[user] = history;

  winnerHistoryEl().innerHTML = '';
  history.forEach(item => {
    const div = document.createElement('div');
    div.textContent = item;
    winnerHistoryEl().appendChild(div);
  });
}

function startTimer() {
  clearInterval(timerInterval);
  seconds = 0;
  timerEl().textContent = '0';
  timerEl().style.color = 'white';
  timerEl().classList.add('timerBlink');

  timerInterval = setInterval(() => {
    seconds += 1;
    timerEl().textContent = String(seconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerEl().classList.remove('timerBlink');
  timerEl().style.color = 'lightgreen';
}

function start() {
  fetch('/api/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: keywordInput().value,
      antiSpam: antiSpamInput().checked,
      allowRepeat: allowRepeatInput().checked,
      multiWinners: multiWinnersInput().checked,
      winnersCount: Number(winnersCountInput().value || 1)
    })
  });

  startBtn().classList.add('active');
  stopBtn().classList.remove('active');
}

function stop() {
  fetch('/api/stop', { method: 'POST' });

  stopBtn().classList.add('active');
  startBtn().classList.remove('active');
}

function clearList() {
  fetch('/api/reset', { method: 'POST' }).then(() => {
    participantsListEl().innerHTML = '';
    winnerMessagesEl().innerHTML = '';
    winnerHistoryEl().innerHTML = '';
    winnerName().textContent = '';
    winnerWins().textContent = '';
    chatEl().innerHTML = '';
    currentWinner = null;
    clearInterval(timerInterval);
    timerEl().textContent = '0';
    timerEl().style.color = 'white';
    timerEl().classList.remove('timerBlink');
    keywordInput().value = '';
    startBtn().classList.remove('active');
    stopBtn().classList.remove('active');
  });
}

function toggleUser(user) {
  fetch('/api/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user })
  });
}

function renderParticipants(data) {
  participantsListEl().innerHTML = '';

  data.participants.forEach(user => {
    const li = document.createElement('li');
    li.className = 'participantItem';

    if (data.participantData[user] && !data.participantData[user].active) {
      li.classList.add('inactive');
    }

    if (data.winners && data.winners.includes(user)) {
      li.classList.add('winner');
    }

    const left = document.createElement('div');
    left.className = 'participantLeft';

    const icon = document.createElement('span');
    icon.textContent = data.winners && data.winners.includes(user) ? '🏆' : '👤';

    const wins = data.participantData[user]?.wins || 0;
    const name = document.createElement('span');
    name.textContent = `${user} (${wins})`;

    left.appendChild(icon);
    left.appendChild(name);

    const right = document.createElement('div');
    right.className = 'participantRight';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!data.participantData[user]?.active;
    checkbox.onchange = () => toggleUser(user);

    right.appendChild(checkbox);

    li.appendChild(left);
    li.appendChild(right);
    participantsListEl().appendChild(li);
  });
}

function openWinnerModal(primaryWinner, winCount) {
  currentWinner = primaryWinner;
  currentWinnerMessages = [];
  winnerModal().style.display = 'block';
  winnerName().textContent = primaryWinner || '';
  winnerWins().textContent = `Побед: ${winCount || 0}`;
  winnerMessagesEl().innerHTML = '';
  loadHistory(primaryWinner);
  startTimer();
}

function winner() {
  fetch('/api/winner')
    .then(res => res.json())
    .then(data => {
      if (!data || !data.winner) return;
      saveHistory(data.primaryWinner || data.winner);
    });
}

function reroll() {
  winner();
}

function closeModal() {
  winnerModal().style.display = 'none';
}

socket.on('participants', data => {
  renderParticipants(data);
});

socket.on('chatMessage', data => {
  const div = document.createElement('div');
  div.textContent = `${data.user}: ${data.message}`;
  chatEl().appendChild(div);
  chatEl().scrollTop = chatEl().scrollHeight;
});

socket.on('winnerSelected', data => {
  openWinnerModal(data.primaryWinner, data.winCounts?.[data.primaryWinner] || 0);
});

socket.on('winnerMessagesReset', () => {
  currentWinnerMessages = [];
  winnerMessagesEl().innerHTML = '';
});

socket.on('winnerMessages', messages => {
  currentWinnerMessages = messages;
  winnerMessagesEl().innerHTML = '';

  messages.forEach(msg => {
    const div = document.createElement('div');
    div.textContent = msg;
    winnerMessagesEl().appendChild(div);
  });
});

socket.on('winnerTimerStart', () => {
  startTimer();
});

socket.on('winnerTimerStop', () => {
  stopTimer();
});
