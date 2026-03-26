const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const tmi = require('tmi.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('web'));

const PORT = process.env.PORT || 3000;
const CHANNELS = (process.env.CHANNELS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const client = new tmi.Client({
  options: { debug: false },
  connection: { reconnect: true, secure: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH
  },
  channels: CHANNELS
});

client.connect().catch(err => {
  console.error('Twitch connect error:', err);
});

/* STATE */
let giveawayActive = false;
let keyword = '';
let antiSpam = false;
let allowRepeat = false;
let multiWinners = false;
let winnersCount = 2;

let participants = [];
let participantData = {};
let winners = [];
let currentWinner = null;
let currentWinnerMessages = [];
let currentWinnerTimerActive = false;

function emitParticipants() {
  io.emit('participants', {
    participants,
    participantData,
    winners
  });
}

function ensureUser(user) {
  if (!participantData[user]) {
    participantData[user] = {
      active: true,
      keywordCount: 0,
      wins: 0
    };
  }
}

function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

function resetWinnerState() {
  currentWinner = null;
  currentWinnerMessages = [];
  currentWinnerTimerActive = false;
  io.emit('winnerMessagesReset');
  io.emit('winnerTimerReset');
}

function pickWinners() {
  let available = participants.filter(u => participantData[u] && participantData[u].active);

  if (!allowRepeat) {
    available = available.filter(u => !winners.includes(u));
  }

  if (available.length === 0) return [];

  if (!multiWinners) {
    const one = available[Math.floor(Math.random() * available.length)];
    return [one];
  }

  const count = Math.max(1, Number(winnersCount) || 1);
  const selected = [];
  const pool = [...available];

  while (pool.length > 0 && selected.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool[index]);
    pool.splice(index, 1);
  }

  return selected;
}

/* TWITCH CHAT */
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const user = normalizeText(tags.username);
  const text = String(message || '').trim();
  const normalizedMessage = normalizeText(message);
  const normalizedKeyword = normalizeText(keyword);

  if (!user) return;

  io.emit('chatMessage', {
    user,
    message: text,
    channel: channel.replace('#', '')
  });

  if (giveawayActive && normalizedKeyword && normalizedMessage === normalizedKeyword) {
    ensureUser(user);

    /* С первого сообщения добавляем в список */
    if (!participants.includes(user)) {
      participants.push(user);
    }

    /* Считаем только сообщения с кодовым словом */
    participantData[user].keywordCount += 1;

    /* Антиспам: 1-3 допустимо, 4-е сообщение выключает */
    if (antiSpam) {
      if (participantData[user].keywordCount >= 4) {
        participantData[user].active = false;
      } else {
        participantData[user].active = true;
      }
    } else {
      /* если антиспам выключен, не трогаем active автоматически */
      if (participantData[user].active === undefined) {
        participantData[user].active = true;
      }
    }

    emitParticipants();
  }

  if (currentWinner && user === currentWinner) {
    currentWinnerMessages.unshift(text);
    io.emit('winnerMessages', currentWinnerMessages);

    if (currentWinnerTimerActive) {
      currentWinnerTimerActive = false;
      io.emit('winnerTimerStop');
    }
  }
});

/* API */
app.post('/api/start', (req, res) => {
  keyword = String(req.body.keyword || '').trim();
  antiSpam = !!req.body.antiSpam;
  allowRepeat = !!req.body.allowRepeat;
  multiWinners = !!req.body.multiWinners;
  winnersCount = req.body.winnersCount || 2;

  giveawayActive = true;
  res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
  giveawayActive = false;
  res.json({ success: true });
});

app.post('/api/reset', (req, res) => {
  giveawayActive = false;
  keyword = '';
  participants = [];
  participantData = {};
  winners = [];
  resetWinnerState();
  emitParticipants();
  res.json({ success: true });
});

app.post('/api/toggle', (req, res) => {
  const user = normalizeText(req.body.user);
  if (participantData[user]) {
    participantData[user].active = !participantData[user].active;
    emitParticipants();
  }
  res.json({ success: true });
});

app.get('/api/winner', (req, res) => {
  const selected = pickWinners();

  if (selected.length === 0) {
    return res.json({ winner: null, winners: [] });
  }

  selected.forEach(user => {
    winners.push(user);
    ensureUser(user);
    participantData[user].wins += 1;

    if (CHANNELS[0]) {
      client.say(CHANNELS[0], `Поздравляю, @${user}! Ты победил в розыгрыше!`);
    }
  });

  currentWinner = selected[0];
  currentWinnerMessages = [];
  currentWinnerTimerActive = true;

  emitParticipants();

  io.emit('winnerSelected', {
    winners: selected,
    primaryWinner: selected[0],
    winCounts: selected.reduce((acc, user) => {
      acc[user] = participantData[user]?.wins || 0;
      return acc;
    }, {})
  });

  io.emit('winnerMessagesReset');
  io.emit('winnerTimerStart');

  return res.json({
    winner: selected[0],
    winners: selected,
    primaryWinner: selected[0]
  });
});

server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
