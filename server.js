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

/* TWITCH */
const client = new tmi.Client({
  options: { debug: false },
  connection: { reconnect: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH
  },
  channels: process.env.CHANNELS.split(',')
});

client.connect();

/* GIVEAWAY */
let giveawayActive = false;
let keyword = '';
let antiSpam = false;
let allowRepeat = false;

let participants = [];
let participantData = {};
let winners = [];

/* TWITCH CHAT */
client.on('message', (channel, tags, message, self) => {
  if (self) return;
  if (!giveawayActive) return;

  const user = tags.username;

  if (message.toLowerCase() === keyword.toLowerCase()) {
    if (!participants.includes(user)) {
      participants.push(user);
      participantData[user] = {
        messages: [],
        active: true
      };
    }
  }

  if (participants.includes(user)) {
    participantData[user].messages.push(message);

    io.emit('winnerMessages', {
      user,
      message
    });
  }

  io.emit('participants', {
    participants,
    participantData
  });
});

/* API */
app.post('/api/start', (req, res) => {
  keyword = req.body.keyword;
  antiSpam = req.body.antiSpam;
  allowRepeat = req.body.allowRepeat;

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
  res.sendStatus(200);
});

/* Включить/выключить участника */
app.post('/api/toggle', (req, res) => {
  const user = req.body.user;
  if (participantData[user]) {
    participantData[user].active = !participantData[user].active;
  }
  res.sendStatus(200);
});

/* Победитель */
app.get('/api/winner', (req, res) => {
  let available = participants.filter(u => participantData[u].active);

  if (!allowRepeat) {
    available = available.filter(u => !winners.includes(u));
  }

  if (available.length === 0) {
    return res.json({ winner: null });
  }

  const winner = available[Math.floor(Math.random() * available.length)];
  winners.push(winner);

  client.say(process.env.CHANNELS.split(',')[0], `Поздравляю @${winner}! Ты победил в розыгрыше`);

  res.json({ winner });
});

server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
