const socket = io();

let timerInterval;
let seconds = 0;
let currentWinner = null;

window.onload = () => {
  fetch('/api/reset');
};

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
}

function stop() {
  fetch('/api/stop', { method: 'POST' });
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
  fetch('/api/reset');
}

socket.on('participants', data => {
  const list = document.getElementById('participantsList');
  list.innerHTML = '';

  data.participants.forEach(user => {
    const li = document.createElement('li');
    li.innerText = user;

    if (!data.participantData[user].active) {
      li.style.color = 'gray';
    }

    list.appendChild(li);
  });
});

socket.on('winnerMessages', data => {
  if (data.user === currentWinner) {
    const div = document.getElementById('winnerMessages');
    const msg = document.createElement('div');
    msg.innerText = data.message;
    div.prepend(msg);

    clearInterval(timerInterval);
    document.getElementById('timer').style.color = 'green';
  }
});
