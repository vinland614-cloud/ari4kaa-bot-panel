const express = require('express');
const tmi = require('tmi.js');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static('web'));

const PORT = process.env.PORT || 3000;

const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH
  },
  channels: process.env.CHANNELS.split(',')
});

client.connect();

let participants = [];
let participantData = {};
let giveawayActive = false;
let keyword = '';
let antiSpam = false;
let allowRepeat = false;
let currentWinner = null;

app.get('/api/reset', (req, res) => {
  participants = [];
  participantData = {};
  io.emit('participants', { participants, participantData });
  res.sendStatus(200);
});

app.post('/api/start', (req, res) => {
  giveawayActive = true;
  keyword = req.body.keyword.toLowerCase();
  antiSpam = req.body.antiSpam;
  allowRepeat = req.body.allowRepeat;
  res.sendStatus(200);
});

app.post('/api/stop', (req, res) => {
  giveawayActive = false;
  res.sendStatus(200);
});

app.get('/api/winner', (req, res) => {
  const activeUsers = participants.filter(u => participantData[u].active);

  if (activeUsers.length === 0) {
    return res.json({ winner: null });
  }

  const winner = activeUsers[Math.floor(Math.random() * activeUsers.length)];
  currentWinner = winner;

  if (!allowRepeat) {
    participantData[winner].active = false;
  }

  io.emit('participants', { participants, participantData });

  res.json({ winner });
});

client.on('message', (channel, tags, message, self) => {
  if (self) return;
  if (!giveawayActive) return;

  const username = tags.username;
  const msg = message.toLowerCase();

  if (!participantData[username]) {
    participantData[username] = {
      messages: 0,
      active: true
    };
  }

  if (msg.includes(keyword)) {
    participantData[username].messages++;

    if (antiSpam && participantData[username].messages > 3) {
      participantData[username].active = false;
    }

    if (!participants.includes(username)) {
      participants.push(username);
    }

    io.emit('participants', { participants, participantData });
  }

  io.emit('winnerMessages', {
    user: username,
    message: message
  });
});

server.listen(PORT, () => {
  console.log('Server started on port ' + PORT);
});
