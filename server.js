const express = require('express');
const tmi = require('tmi.js');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static('web'));

let participants = [];
let participantData = {};
let winnersHistory = [];
let isRunning = false;
let keyword = '';
let antiSpamEnabled = false;
let allowRepeatWin = false;

const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_BOT_USERNAME,
    password: process.env.TWITCH_OAUTH
  },
  channels: process.env.TWITCH_CHANNELS.split(',')
});

client.connect();

client.on('message', (channel, tags, message, self) => {
  if (self) return;
  if (!isRunning) return;

  const username = tags.username;
  const msg = message.toLowerCase().trim();

  if (msg === keyword.toLowerCase().trim()) {

    if (!participantData[username]) {
      participantData[username] = {
        spam: 0,
        active: true,
        wins: 0,
        messages: []
      };
      participants.unshift(username);
    }

    participantData[username].spam++;

    if (antiSpamEnabled && participantData[username].spam > 3) {
      participantData[username].active = false;
    }

    io.emit('participants', { participants, participantData });
  }

  if (participantData[username]) {
    participantData[username].messages.push(message);
    io.emit('winnerMessages', {
      user: username,
      message: message
    });
  }
});

app.post('/api/start', (req, res) => {
  keyword = req.body.keyword;
  antiSpamEnabled = req.body.antiSpam;
  allowRepeatWin = req.body.allowRepeat;
  isRunning = true;
  res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
  isRunning = false;
  res.json({ success: true });
});

app.post('/api/reset', (req, res) => {
  participants = [];
  participantData = {};
  res.json({ success: true });
});

app.get('/api/winner', (req, res) => {
  const activeUsers = participants.filter(u => participantData[u].active);

  if (activeUsers.length === 0) {
    return res.json({ winner: null });
  }

  const winner = activeUsers[Math.floor(Math.random() * activeUsers.length)];

  participantData[winner].wins++;
  participantData[winner].active = false;

  const winData = {
    user: winner,
    time: new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
  };

  winnersHistory.unshift(winData);

  client.say(process.env.TWITCH_CHANNELS.split(',')[0],
    `Поздравляю, @${winner}! Ты победил в розыгрыше!`
  );

  io.emit('winner', {
    winner,
    history: winnersHistory
  });

  res.json({ winner });
});

io.on('connection', socket => {
  socket.emit('participants', { participants, participantData });
});

server.listen(3000, () => {
  console.log('Server started');
});
