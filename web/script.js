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

  const ul = document.getElementById('winnerHistory');
  ul.innerHTML = '';
  data.history.forEach(d => {
    const li = document.createElement('li');
    li.innerText = d;
    ul.appendChild(li);
  });
});

socket.on('winnerTimer', t => {
  document.getElementById('timer').innerText = t;
});

socket.on('winnerMessage', data => {
  document.getElementById('winnerMsg').innerText = data.message;
});

function start() {
  fetch('/api/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      keyword: document.getElementById('keyword').value,
      maxSpam: document.getElementById('maxSpam').value,
      antiSpam: document.getElementById('antiSpam').checked
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