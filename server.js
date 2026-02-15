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
const CHANNELS = (process.env.CHANNELS || 'otoru_').split(',').map(c => c.trim().toLowerCase());

// ====== СОСТОЯНИЕ ======
let giveawayActive = false;
let keyword = '!';
let participants = [];
let participantSet = new Set();
let spamCount = {};
let maxSpam = 3;
let chatLog = [];

// ====== TWITCH BOT ======
const client = new tmi.Client({
  options: { debug: true },
  connection: {
    reconnect: true,
    secure: true
  },
  identity: {
    username: BOT_USERNAME,
    password: OAUTH
  },
  channels: CHANNELS
});

// Подключение бота
async function startBot() {
  try {
    await client.connect();
    console.log('🤖 Бот подключен к каналам:', CHANNELS.join(', '));
  } catch (err) {
    console.error('❌ Ошибка подключения бота:', err);
    setTimeout(startBot, 10000);
  }
}

startBot();

// ====== ОБРАБОТКА ЧАТА ======
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const username = (tags.username || '').toLowerCase();
  const displayName = tags['display-name'] || username;
  const cleanChannel = channel.replace('#', '');

  console.log(`[${cleanChannel}] ${displayName}: ${message}`);

  // лог чата (для панели)
  const chatEntry = {
    user: displayName,
    message: message,
    channel: cleanChannel,
    time: new Date().toLocaleTimeString()
  };

  chatLog.push(chatEntry);
  if (chatLog.length > 100) chatLog.shift();

  io.emit('chat', chatEntry);

  // ====== РЕГИСТРАЦИЯ В РОЗЫГРЫШЕ ======
  if (giveawayActive && message.toLowerCase() === keyword.toLowerCase()) {
    if (!spamCount[username]) spamCount[username] = 0;
    spamCount[username]++;

    // защита от спама
    if (spamCount[username] > maxSpam) {
      if (participantSet.has(username)) {
        participantSet.delete(username);
        participants = participants.filter(u => u !== username);
        io.emit('participants', participants);
      }
      return;
    }

    // добавление участника
    if (!participantSet.has(username)) {
      participantSet.add(username);
      participants.push(username);
      io.emit('participants', participants);

      // сообщение в чат (опционально)
      client.say(channel, `🎟️ @${displayName} участвует в розыгрыше!`);
    }
  }

  // ====== КОМАНДЫ ======
  if (message.toLowerCase() === '!ping') {
    client.say(channel, `@${displayName} бот работает ✅`);
  }

  if (message.toLowerCase() === '!participants') {
    client.say(channel, `📊 Участников: ${participants.length}`);
  }
});

// ====== EXPRESS ======
app.use(express.json());
app.use(express.static('web'));

// ====== API: СТАРТ РОЗЫГРЫША ======
app.post('/api/start', (req, res) => {
  keyword = (req.body.keyword || '!').toLowerCase();
  maxSpam = req.body.maxSpam || 3;

  giveawayActive = true;
  participants = [];
  participantSet.clear();
  spamCount = {};

  console.log('🎉 Розыгрыш начат. Ключевое слово:', keyword);

  // сообщение в чат на всех каналах
  CHANNELS.forEach(ch => {
    client.say(ch, `🎉 РОЗЫГРЫШ НАЧАЛСЯ! Напишите ${keyword} в чат для участия!`);
  });

  io.emit('participants', participants);
  res.json({ success: true });
});

// ====== API: СТОП ======
app.post('/api/stop', (req, res) => {
  giveawayActive = false;

  CHANNELS.forEach(ch => {
    client.say(ch, `⛔ Розыгрыш остановлен.`);
  });

  console.log('⛔ Розыгрыш остановлен');
  res.json({ success: true });
});

// ====== API: ВЫБОР ПОБЕДИТЕЛЯ ======
app.post('/api/reroll', (req, res) => {
  if (participants.length === 0) {
    return res.json({ winner: null });
  }

  const winner = participants[Math.floor(Math.random() * participants.length)];

  CHANNELS.forEach(ch => {
    client.say(ch, `🎉 @${winner} ПОБЕДИЛ В РОЗЫГРЫШЕ!`);
  });

  console.log('🏆 Победитель:', winner);
  res.json({ winner });
});

// ====== API: ОЧИСТКА ======
app.post('/api/clear', (req, res) => {
  participants = [];
  participantSet.clear();
  spamCount = {};

  io.emit('participants', participants);
  console.log('🧹 Участники очищены');

  res.json({ success: true });
});

// ====== API: СТАТУС ======
app.get('/api/status', (req, res) => {
  res.json({
    giveawayActive,
    participants: participants.length,
    keyword,
    channels: CHANNELS
  });
});

// ====== ЗАПУСК СЕРВЕРА ======
server.listen(PORT, () => {
  console.log(`🌐 ARi4kaa Bot Panel запущена на порту ${PORT}`);
  console.log(`🤖 Бот: ${BOT_USERNAME}`);
  console.log(`📺 Каналы: ${CHANNELS.join(', ')}`);
});
