require('dotenv').config();
const express = require('express');
const http = require('http');
const tmi = require('tmi.js');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const BOT_USERNAME = process.env.TWITCH_USERNAME;
const OAUTH = process.env.TWITCH_OAUTH;
const CHANNELS = (process.env.CHANNELS || 'otoru_').split(',');

// ===== СОСТОЯНИЕ =====
let isRunning = false;
let participants = [];
let participantSet = new Set();
let winners = [];
let currentWinner = null;
let winnerMessages = [];

let keyword = '!';
let maxSpam = 3;
let antiSpamEnabled = false;
let allowRepeatWinner = false;

let spamCount = {};

let timer = 0;
let timerInterval = null;
let timerStopped = false;

let winnerHistory = {};

// ===== TWITCH =====
const client = new tmi.Client({
  identity: {
    username: BOT_USERNAME,
    password: OAUTH
  },
  channels: CHANNELS
});

client.connect();

// ===== ЧАТ =====
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const username = tags.username.toLowerCase();
  const displayName = tags['display-name'];

  io.emit('chat', {
    user: displayName,
    message: message
  });

  // ===== УЧАСТНИКИ =====
  if (isRunning && message.toLowerCase() === keyword.toLowerCase()) {

    if (antiSpamEnabled) {
      if (!spamCount[username]) spamCount[username] = 0;
      spamCount[username]++;

      if (spamCount[username] > maxSpam) {
        return;
      }
    }

    if (!participantSet.has(username)) {
      participantSet.add(username);
      participants.unshift(username);
      io.emit('participants', participants);
    }
  }

  // ===== СООБЩЕНИЯ ПОБЕДИТЕЛЯ =====
  if (currentWinner && username === currentWinner) {
    winnerMessages.unshift(message);
    io.emit('winnerMessages', winnerMessages);

    if (!timerStopped) {
      timerStopped = true;
      clearInterval(timerInterval);
      io.emit('timerStopped');
    }
  }
});

// ===== API =====
app.use(express.json());
app.use(express.static('web'));

// СТАРТ
app.post('/api/start', (req, res) => {
  isRunning = true;
  keyword = req.body.keyword;
  maxSpam = req.body.maxSpam;
  antiSpamEnabled = req.body.antiSpam;
  allowRepeatWinner = req.body.allowRepeat;
  res.json({ success: true });
});

// СТОП
app.post('/api/stop', (req, res) => {
  isRunning = false;
  res.json({ success: true });
});

// ВЫБРАТЬ ПОБЕДИТЕЛЯ
app.post('/api/winner', (req, res) => {
  pickWinner();
  res.json({ success: true });
});

// РЕРОЛ
app.post('/api/reroll', (req, res) => {
  pickWinner();
  res.json({ success: true });
});

// ОЧИСТИТЬ
app.post('/api/clear', (req, res) => {
  participants = [];
  participantSet.clear();
  winners = [];
  io.emit('participants', participants);
  res.json({ success: true });
});

// ===== ВЫБОР ПОБЕДИТЕЛЯ =====
function pickWinner() {

  let eligible;

  if (allowRepeatWinner) {
    eligible = participants;
  } else {
    eligible = participants.filter(p => !winners.includes(p));
  }

  if (eligible.length === 0) return;

  const winner = eligible[Math.floor(Math.random() * eligible.length)];
  currentWinner = winner;
  winners.push(winner);

  // история
  if (!winnerHistory[winner]) winnerHistory[winner] = [];
  winnerHistory[winner].push(new Date().toLocaleString());

  // чат победителя
  winnerMessages = [];

  // таймер
  timer = 0;
  timerStopped = false;
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timer++;
    io.emit('timer', timer);
  }, 1000);

  // сообщение в чат
  CHANNELS.forEach(ch => {
    client.say(ch, `Поздравляю, @${winner}! Ты победил в розыгрыше!`);
  });

  io.emit('winner', {
    name: winner,
    history: winnerHistory[winner]
  });

  io.emit('winnerMessages', winnerMessages);
}

// ===== ЗАПУСК =====
server.listen(PORT, () => {
  console.log('Server started');
});
