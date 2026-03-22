require('dotenv').config();
const express = require('express');
const http = require('http');
const tmi = require('tmi.js');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ====== НАСТРОЙКИ ======
const PORT = process.env.PORT || 3000;
const BOT_USERNAME = process.env.TWITCH_USERNAME;
const OAUTH = process.env.TWITCH_OAUTH;
const CHANNELS = (process.env.CHANNELS || 'otoru_').split(',');

// ====== СОСТОЯНИЕ РОЗЫГРЫША ======
let giveawayActive = false;
let keyword = '!';
let participants = [];
let participantSet = new Set();
let spamCount = {};
let maxSpam = 3;
let antiSpamEnabled = true;

// ====== ПОБЕДИТЕЛЬ ======
let currentWinner = null;
let winnerTimer = null;
let winnerTimeLeft = 60;
let winnerMessage = null;
let winnerHistory = {};

// ====== TWITCH BOT ======
const client = new tmi.Client({
  identity: {
    username: BOT_USERNAME,
    password: OAUTH
  },
  channels: CHANNELS
});

client.connect().then(() => {
  console.log('🤖 Бот подключен к каналам:', CHANNELS.join(', '));
});

// ====== ЧАТ ======
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const username = tags.username.toLowerCase();
  const displayName = tags['display-name'];

  // отправка чата на сайт
  io.emit('chat', {
    user: displayName,
    message: message,
    channel: channel
  });

  // регистрация участников
  if (giveawayActive && message.toLowerCase() === keyword.toLowerCase()) {

    if (antiSpamEnabled) {
      if (!spamCount[username]) spamCount[username] = 0;
      spamCount[username]++;

      if (spamCount[username] > maxSpam) {
        participantSet.delete(username);
        participants = participants.filter(u => u !== username);
        io.emit('participants', participants);
        return;
      }
    }

    if (!participantSet.has(username)) {
      participantSet.add(username);
      participants.unshift(username);
      io.emit('participants', participants);
    }
  }

  // сообщение от победителя
  if (currentWinner && username === currentWinner) {
    winnerMessage = message;

    if (winnerTimer) {
      clearInterval(winnerTimer);
    }

    io.emit('winnerMessage', {
      user: username,
      message: message
    });
  }

  // тест
  if (message === '!ping') {
    client.say(channel, `@${displayName} бот работает ✅`);
  }
});

// ====== API ======
app.use(express.json());
app.use(express.static('web'));

// старт
app.post('/api/start', (req, res) => {
  keyword = req.body.keyword || '!';
  maxSpam = req.body.maxSpam || 3;
  antiSpamEnabled = req.body.antiSpam;
  giveawayActive = true;
  participants = [];
  participantSet.clear();
  spamCount = {};
  res.json({ success: true });
});

// стоп
app.post('/api/stop', (req, res) => {
  giveawayActive = false;
  res.json({ success: true });
});

// выбрать победителя
app.post('/api/winner', (req, res) => {
  if (participants.length === 0) {
    return res.json({ winner: null });
  }

  const winner = participants[Math.floor(Math.random() * participants.length)];

  currentWinner = winner;
  winnerTimeLeft = 60;
  winnerMessage = null;

  if (!winnerHistory[winner]) {
    winnerHistory[winner] = [];
  }

  winnerHistory[winner].push(new Date().toLocaleString());

  if (winnerTimer) clearInterval(winnerTimer);

  winnerTimer = setInterval(() => {
    winnerTimeLeft--;
    io.emit('winnerTimer', winnerTimeLeft);

    if (winnerTimeLeft <= 0) {
      clearInterval(winnerTimer);
    }
  }, 1000);

  CHANNELS.forEach(ch => {
    client.say(ch, `Поздравляю, @${winner}! Ты победил в розыгрыше!`);
  });

  io.emit('winner', {
    name: winner,
    history: winnerHistory[winner]
  });

  res.json({ winner });
});

// рерол
app.post('/api/reroll', (req, res) => {
  participants = participants.filter(u => u !== currentWinner);
  res.json({ success: true });
});

// очистка
app.post('/api/clear', (req, res) => {
  participants = [];
  participantSet.clear();
  spamCount = {};
  io.emit('participants', participants);
  res.json({ success: true });
});

// ====== ЗАПУСК ======
server.listen(PORT, () => {
  console.log(`🌐 Панель запущена на порту ${PORT}`);
});