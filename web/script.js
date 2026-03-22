const socket = io();

socket.on('participants', list => {
  const ul = document.getElementById('participants');
  ul.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    li.innerText = u;
    ul.appendChild(li);
  });
});

socket.on('chat', data => {
  const chat = document.getElementById('chat');
  chat.innerHTML += `<div><b>${data.user}:</b> ${data.message}</div>`;
  chat.scrollTop = chat.scrollHeight;
});

socket.on('winner', data => {
  document.getElementById('winnerModal').style.display = 'block';
  document.getElementById('winnerName').innerText = data.name;

  const historyDiv = document.getElementById('winnerHistory');
  historyDiv.innerHTML = '';
  data.history.forEach(h => {
    historyDiv.innerHTML += `<div>${h}</div>`;
  });
});

socket.on('winnerMessages', msgs => {
  const div = document.getElementById('winnerMessages');
  div.innerHTML = '';
  msgs.forEach(m => {
    div.innerHTML += `<div>${m}</div>`;
  });
});

socket.on('timer', t => {
  let m = Math.floor(t / 60);
  let s = t % 60;
  if (m < 10) m = '0' + m;
  if (s < 10) s = '0' + s;
  document.getElementById('timer').innerText = `${m}:${s}`;
});

socket.on('timerStopped', () => {
  document.getElementById('timer').style.color = 'lime';
});

function start() {
  fetch('/api/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      keyword: document.getElementById('keyword').value,
      maxSpam: document.getElementById('maxSpam').value,
      antiSpam: document.getElementById('antiSpam').checked,
      allowRepeat: document.getElementById('allowRepeat').checked
    })
  });
}

function stop() {
  fetch('/api/stop', { method: 'POST' });
}

function winner() {
  fetch('/api/winner', { method: 'POST' });
}

function reroll() {
  fetch('/api/reroll', { method: 'POST' });
}

function clearUsers() {
  fetch('/api/clear', { method: 'POST' });
}

function closeModal() {
  document.getElementById('winnerModal').style.display = 'none';
}
