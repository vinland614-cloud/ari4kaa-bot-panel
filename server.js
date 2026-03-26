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

const client = new tmi.Client({
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH
  },
  channels: process.env.CHANNELS.split(',')
});

client.connect();

let giveawayActive = false;
let keyword = '';
let allowRepeat = false;
let multiWinners = false;
let winnersCount = 1;

let participants = [];
let participantData = {};
let winners = [];
let winStats = {};

/* CHAT */
client.on('message', (channel, tags, message, self) => {
  if (self || !giveawayActive) return;

  const user = tags.username;

  if (message.toLowerCase() === keyword.toLowerCase()) {
    if (!participants.includes(user)) {
      participants.push(user);
      participantData[user] = { active: true };
    }
  }

  io.emit('participants', { participants, participantData, winners, winStats });
});

/* API */
app.post('/api/start', (req, res) => {
  keyword = req.body.keyword;
  allowRepeat = req.body.allowRepeat;
  multiWinners = req.body.multiWinners;
  winnersCount = req.body.winnersCount || 1;

  giveawayActive = true;
  res.sendStatus(200);
});

app.post('/api/stop', (req, res) => {
  giveawayActive = false;
  res.sendStatus(200);
});

app.post('/api/reset', (req, res) => {
  participants = [];
  participantData = {};
  winners = [];
  res.sendStatus(200);
});

app.post('/api/toggle', (req, res) => {
  const user = req.body.user;
  if (participantData[user]) {
    participantData[user].active = !participantData[user].active;
  }
  res.sendStatus(200);
});

app.get('/api/winner', (req, res) => {
  let available = participants.filter(u => participantData[u].active);

  if (!allowRepeat) {
    available = available.filter(u => !winners.includes(u));
  }

  if (available.length === 0) {
    return res.json({ winner: null });
  }

  let selected = [];

  if (multiWinners) {
    for (let i = 0; i < winnersCount && available.length > 0; i++) {
      const w = available.splice(Math.floor(Math.random() * available.length), 1)[0];
      selected.push(w);
    }
  } else {
    selected.push(available[Math.floor(Math.random() * available.length)]);
  }

  selected.forEach(w => {
    winners.push(w);
    winStats[w] = (winStats[w] || 0) + 1;
    client.say(process.env.CHANNELS.split(',')[0], `Поздравляю @${w}! Ты победил в розыгрыше`);
  });

  res.json({ winner: selected });
});

server.listen(PORT, () => console.log('Server running'));
