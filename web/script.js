const socket = io();

let timerInterval;
let seconds = 0;
let currentWinner = null;

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

function stop() {
  fetch('/api/stop', { method: 'POST' });

  document.getElementById('stopBtn').classList.add('active');
  document.getElementById('startBtn').classList.remove('active');
}

function winner() {
  fetch('/api/winner')
  .then(res => res.json())
  .then(data => {
    if (!data.winner) return;

    currentWinner = data.winner;

    document.getElementById('winnerModal').style.display = 'block';
    document.getElementById('winnerName').innerText = data.winner;

    seconds = 0;
    document.getElementById('timer').innerText = seconds;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      seconds++;
      document.getElementById('timer').innerText = seconds;
    }, 1000);

    document.getElementById('winnerMessages').innerHTML = '';
  });
}

function reroll() {
  winner();
}

function closeModal() {
  document.getElementById('winnerModal').style.display = 'none';
}

function clearList() {
  fetch('/api/reset', { method: 'POST' });
}

/* Галочки участников */
function toggleUser(user) {
  fetch('/api/toggle', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ user })
  });
}

socket.on('participants', data => {
  const list = document.getElementById('participantsList');
  list.innerHTML = '';

  data.participants.forEach(user => {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = data.participantData[user].active;
    checkbox.onchange = () => toggleUser(user);

    li.appendChild(checkbox);
    li.appendChild(document.createTextNode(' ' + user));

    if (!data.participantData[user].active) {
      li.style.color = 'gray';
    }

    list.appendChild(li);
  });
});

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

    clearInterval(timerInterval);
    document.getElementById('timer').style.color = 'lightgreen';
  }
});
