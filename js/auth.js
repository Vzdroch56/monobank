let selectedBankerAvatar = '🐱';
let selectedPlayerAvatar = '🐱';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderAvatars();

  const session = getSession();
  if (session) redirectToGame(session);

  ['roomPin', 'joinPin', 'joinCode'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
  });
});

function showScreen(name) {
  document.getElementById('screenStart').style.display = name === 'start' ? 'block' : 'none';
  document.getElementById('screenCreate').style.display = name === 'create' ? 'block' : 'none';
  document.getElementById('screenJoin').style.display = name === 'join' ? 'block' : 'none';
}

function renderAvatars() {
  const createBox = document.getElementById('bankerAvatars');
  const joinBox = document.getElementById('playerAvatars');
  if (!createBox || !joinBox) return;

  // Очищаем полностью (исправление бага с дублированием)
  createBox.innerHTML = '';
  joinBox.innerHTML = '';

  AVATARS.forEach(emoji => {
    const b = document.createElement('div');
    b.className = 'avatar-option' + (emoji === selectedBankerAvatar ? ' selected' : '');
    b.textContent = emoji;
    b.onclick = () => { selectedBankerAvatar = emoji; renderAvatars(); };
    createBox.appendChild(b);

    const p = document.createElement('div');
    p.className = 'avatar-option' + (emoji === selectedPlayerAvatar ? ' selected' : '');
    p.textContent = emoji;
    p.onclick = () => { selectedPlayerAvatar = emoji; renderAvatars(); };
    joinBox.appendChild(p);
  });
}

async function createRoom() {
  const name = document.getElementById('bankerName').value.trim();
  const pin = document.getElementById('roomPin').value.trim();

  if (!name) return showToast('Введи имя');
  if (pin.length !== 4) return showToast('PIN должен быть 4 цифры');

  try {
    const { data, error } = await db.rpc('create_room', {
      p_pin: pin,
      p_banker_name: name,
      p_banker_avatar: selectedBankerAvatar
      // Убрали p_start_balance, база сама поставит 1500!
    });

    if (error) throw error;

    const session = { room_id: data.room_id, player_id: data.banker_id, is_banker: true, name: name, avatar: selectedBankerAvatar };
    saveSession(session);
    showToast(`Комната создана! Код: ${data.code}`);
    setTimeout(() => redirectToGame(session), 1500);
  } catch (err) { showToast('Ошибка: ' + (err.message || 'Не удалось создать')); }
}

async function joinRoom() {
  const code = document.getElementById('joinCode').value.trim();
  const pin = document.getElementById('joinPin').value.trim();
  const name = document.getElementById('playerName').value.trim();

  if (code.length !== 6) return showToast('Код должен быть 6 цифр');
  if (pin.length !== 4) return showToast('PIN должен быть 4 цифры');
  if (!name) return showToast('Введи имя');

  try {
    const { data, error } = await db.rpc('join_room', {
      p_code: code, p_pin: pin, p_name: name, p_avatar: selectedPlayerAvatar
      // Тоже убрали p_start_balance
    });

    if (error) throw error;

    const session = { room_id: data.room_id, player_id: data.player_id, is_banker: false, name: name, avatar: selectedPlayerAvatar };
    saveSession(session);
    redirectToGame(session);
  } catch (err) { showToast(err.message || err.details || 'Не удалось войти'); }
}

function redirectToGame(session) {
  if (session.is_banker) window.location.href = 'banker.html';
  else window.location.href = 'player.html';
}