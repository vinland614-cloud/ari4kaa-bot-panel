const socket = io();

let timerInterval;
let seconds = 0;
let currentWinner = null;

window.onload = () => {
fetch('/api/reset');
document.getElementById('keyword').value = '';
};

/* СТАРТ */
function start() {
fetch('/api/start', {
method: 'POST',
headers: {'Content-Type':'application/json'},
body: JSON.stringify({
keyword: document.getElementById('keyword').value,
antiSpam: document.getElementById('antiSpam').checked,
allowRepeat: document.getElementById('allowRepeat').checked
})
});

document.getElementById('startBtn').classList.add('active');
document.getElementById('stopBtn').classList.remove('active');
}

/* СТОП */
function stop() {
fetch('/api/stop', { method: 'POST' });

document.getElementById('stopBtn').classList.add('active');
document.getElementById('startBtn').classList.remove('active');
}

/* ВЫБОР ПОБЕДИТЕЛЯ */
function winner() {
fetch('/api/winner')
.then(res => res.json())
.then(data => {
if (!data.winner) return;

```
currentWinner = data.winner;

document.getElementById('winnerModal').style.display = 'block';
document.getElementById('winnerName').innerText = data.winner;

seconds = 0;
document.getElementById('timer').innerText = seconds;
document.getElementById('timer').style.color = 'white';

clearInterval(timerInterval);
timerInterval = setInterval(() => {
  seconds++;
  document.getElementById('timer').innerText = seconds;
}, 1000);

document.getElementById('winnerMessages').innerHTML = '';

saveHistory(data.winner);
loadHistory(data.winner);
```

});
}

/* РЕРОЛ */
function reroll() {
winner();
}

/* ЗАКРЫТЬ */
function closeModal() {
document.getElementById('winnerModal').style.display = 'none';
}

/* ОЧИСТИТЬ */
function clearList() {
fetch('/api/reset');
}

/* СПИСОК УЧАСТНИКОВ */
socket.on('participants', data => {
const list = document.getElementById('participantsList');
list.innerHTML = '';

data.participants.forEach(user => {
const li = document.createElement('li');
li.innerText = user;

```
if (!data.participantData[user].active) {
  li.style.color = 'gray';
}

list.appendChild(li);
```

});
});

/* ЧАТ + СООБЩЕНИЯ ПОБЕДИТЕЛЯ */
socket.on('winnerMessages', data => {
const chat = document.getElementById('chat');
const div = document.createElement('div');
div.innerText = data.user + ': ' + data.message;
chat.appendChild(div);
chat.scrollTop = chat.scrollHeight;

if (data.user === currentWinner) {
const msg = document.createElement('div');
msg.innerText = data.message;
document.getElementById('winnerMessages').prepend(msg);

```
clearInterval(timerInterval);
document.getElementById('timer').style.color = 'lightgreen';
```

}
});

/* ИСТОРИЯ */
function saveHistory(user) {
let history = JSON.parse(localStorage.getItem('history_' + user)) || [];
history.unshift(new Date().toLocaleString('ru-RU'));
localStorage.setItem('history_' + user, JSON.stringify(history));
}

function loadHistory(user) {
let history = JSON.parse(localStorage.getItem('history_' + user)) || [];
const div = document.getElementById('winnerHistory');
div.innerHTML = '';

history.forEach(date => {
const d = document.createElement('div');
d.innerText = date;
div.appendChild(d);
});
}
