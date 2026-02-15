require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
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

// ====== TWITCH BOT ======
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: BOT_USERNAME,
    password: OAUTH
  },
  channels: CHANNELS
});

client.connect().then(() => {
  console.log('🤖 Бот подключен к каналам:', CHANNELS.join(', '));
}).catch(err => {
  console.error('❌ Ошибка подключения бота:', err);
});

// ====== ОБРАБОТКА ЧАТА ======
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const username = tags.username?.toLowerCase() || 'unknown';
  const displayName = tags['display-name'] || username;

  // отправка чата на сайт (панель)
  io.emit('chat', {
    user: displayName,
    message: message,
    channel: channel
  });

  // регистрация в розыгрыше по ключевому слову
  if (giveawayActive && message.toLowerCase() === keyword.toLowerCase()) {
    if (!spamCount[username]) spamCount[username] = 0;
    spamCount[username]++;

    // защита от спама
    if (spamCount[username] > maxSpam) {
      participantSet.delete(username);
      participants = participants.filter(u => u !== username);
      io.emit('participants', participants);
      return;
    }

    // добавление участника
    if (!participantSet.has(username)) {
      participantSet.add(username);
      participants.push(username);
      io.emit('participants', participants);
    }
  }

  // тест команда
  if (message === '!ping') {
    client.say(channel, `@${displayName} бот работает ✅`);
  }
});

// ====== MIDDLEWARE ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ВАЖНО: подключение папки web (твоя панель)
app.use(express.static(path.join(__dirname, 'web')));

// ====== API ДЛЯ ПАНЕЛИ ======

// старт розыгрыша
app.post('/api/start', (req, res) => {
  keyword = req.body.keyword || '!';
  maxSpam = parseInt(req.body.maxSpam) || 3;
  giveawayActive = true;
  participants = [];
  participantSet.clear();
  spamCount = {};

  console.log('🎁 Розыгрыш запущен. Ключевое слово:', keyword);
  res.json({ success: true });
});

// стоп розыгрыша
app.post('/api/stop', (req, res) => {
  giveawayActive = false;
  console.log('⛔ Розыгрыш остановлен');
  res.json({ success: true });
});

// выбор победителя (реролл)
app.post('/api/reroll', (req, res) => {
  if (participants.length === 0) {
    return res.json({ winner: null });
  }

  const winner = participants[Math.floor(Math.random() * participants.length)];

  CHANNELS.forEach(ch => {
    client.say(ch, `🎉 @${winner} ВЫИГРАЛ РОЗЫГРЫШ!`);
  });

  res.json({ winner });
});

// очистка участников
app.post('/api/clear', (req, res) => {
  participants = [];
  participantSet.clear();
  spamCount = {};
  io.emit('participants', participants);
  console.log('🧹 Список участников очищен');
  res.json({ success: true });
});

// проверка статуса
app.get('/api/status', (req, res) => {
  res.json({
    giveawayActive,
    participantsCount: participants.length,
    keyword,
    maxSpam
  });
});

// ====== ЗАПУСК СЕРВЕРА ======
server.listen(PORT, () => {
  console.log(`🌐 ARi4kaa Bot Panel запущена на порту ${PORT}`);
});
