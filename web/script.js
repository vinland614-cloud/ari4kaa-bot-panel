const socket = io();

let winners = [];

function start(){
 fetch('/api/start',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   keyword:keyword.value,
   allowRepeat:allowRepeat.checked,
   multiWinners:multiWinners.checked,
   winnersCount:winnersCount.value
  })
 });
}

function stop(){
 fetch('/api/stop',{method:'POST'});
}

function winner(){
 fetch('/api/winner')
 .then(r=>r.json())
 .then(data=>{
  winners = data.winner;

  winnerName.innerText = winners.join(', ');
  winnerModal.style.display='block';
 });
}

function reroll(){ winner(); }
function closeModal(){ winnerModal.style.display='none'; }

function clearList(){
 fetch('/api/reset',{method:'POST'});
}

function toggleUser(user){
 fetch('/api/toggle',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({user})
 });
}

socket.on('participants', data=>{
 const list = participantsList;
 list.innerHTML='';

 data.participants.forEach(user=>{
  const li = document.createElement('li');
  li.className='participantItem';

  if(data.winners.includes(user)){
    li.classList.add('winner');
  }

  const left = document.createElement('span');
  left.innerText = data.winners.includes(user) ? '🏆 '+user : '👤 '+user;

  const right = document.createElement('input');
  right.type='checkbox';
  right.checked = data.participantData[user].active;
  right.onchange = ()=>toggleUser(user);

  li.appendChild(left);
  li.appendChild(right);
  list.appendChild(li);
 });
});
