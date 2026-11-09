let session = null;
let myProfile = null;
let bankProfile = null;
let allPlayers = [];
let allTxs = [];
let adjustTargetId = null;
let selectedPlayerForTransfer = null;
let isFirstLoad = true;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  session = getSession();
  if (!session || !session.is_banker) { window.location.href = 'index.html'; return; }
  await loadRoomState();
  subscribeRealtime();
});

async function loadRoomState() {
  const { data, error } = await db.rpc('get_room_state', { p_room_id: session.room_id });
  if (error) { showToast('Ошибка загрузки'); return; }

  allPlayers = data.players;
  allTxs = data.transactions;
  myProfile = allPlayers.find(p => p.id === session.player_id);
  bankProfile = allPlayers.find(p => p.is_bank_account);

  if (!myProfile) { clearSession(); window.location.href = 'index.html'; return; }

  document.getElementById('myAvatar').textContent = myProfile.avatar;
  document.getElementById('myBalance').textContent = fmtMoney(myProfile.balance);

  if (isFirstLoad) {
    const { data: roomData } = await db.from('rooms').select('code, pin').eq('id', session.room_id).single();
    if (roomData) {
      document.getElementById('roomCode').textContent = roomData.code;
      document.getElementById('settingsRoomCode').textContent = roomData.code;
      document.getElementById('modalRoomCode').textContent = roomData.code;
      document.getElementById('modalRoomPin').textContent = roomData.pin;
    }
  }

  renderPlayersList();
  renderAllHistory();
  populateTransferTargets();
  isFirstLoad = false;
}

function switchTab(tab) {
  document.getElementById('tabHistoryContent').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('tabPlayersContent').style.display = tab === 'players' ? 'block' : 'none';
  document.getElementById('tabSettingsContent').style.display = tab === 'settings' ? 'block' : 'none';

  document.getElementById('navHistory').classList.toggle('active', tab === 'history');
  document.getElementById('navPlayers').classList.toggle('active', tab === 'players');
  document.getElementById('navSettings').classList.toggle('active', tab === 'settings');
}

function showRoomInfo() { document.getElementById('roomInfoModal').style.display = 'flex'; }

function renderPlayersList() {
  const list = document.getElementById('playersList');
  list.innerHTML = allPlayers.map(p => {
    const isMe = p.id === session.player_id;
    const isBank = p.is_bank_account;
    
    let adjustBtn = '';
    if (!isBank) {
      adjustBtn = `<button class="btn secondary" style="width:auto; padding:8px 12px; margin:0; font-size:13px;" onclick="openAdjustModal('${p.id}', '${esc(p.name)}')">⚖️</button>`;
    }

    let transferBtn = '';
    if (!isMe) {
      transferBtn = `<button class="btn secondary" style="width:auto; padding:8px 12px; margin:0 0 0 8px; font-size:13px;" onclick="quickTransfer('${p.id}')">💸</button>`;
    }

    return `
      <div class="player-row">
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${esc(p.name)}${isMe ? ' <span style="color:var(--accent); font-size:12px;">(ты)</span>' : ''}</div>
          <div class="player-balance">${isBank ? 'Банк: ' + fmtMoney(p.balance) + ' ₽' : fmtMoney(p.balance) + ' ₽'}</div>
        </div>
        <div style="display:flex;">${adjustBtn}${transferBtn}</div>
      </div>
    `;
  }).join('');
}

function quickTransfer(targetId) {
  selectedPlayerForTransfer = targetId;
  openTransferModal();
}

function renderAllHistory() {
  const list = document.getElementById('allHistoryList');
  if (!allTxs || allTxs.length === 0) { list.innerHTML = '<div class="empty">Пока нет операций</div>'; return; }

  list.innerHTML = allTxs.map(tx => {
    const fromP = tx.from_player ? allPlayers.find(p => p.id === tx.from_player) : null;
    const toP = tx.to_player ? allPlayers.find(p => p.id === tx.to_player) : null;

    let title = '';
    if (!fromP && toP) title = `Банк → ${toP.name}`;
    else if (fromP && !toP) title = `${fromP.name} → Банк`;
    else if (fromP && toP) title = `${fromP.name} → ${toP.name}`;
    else title = 'Операция';

    const commentHtml = tx.comment ? `<div class="tx-comment">${esc(tx.comment)}</div>` : '';
    return `
      <div class="tx-row">
        <div class="tx-icon">💸</div>
        <div class="tx-info"><div class="tx-title">${esc(title)}</div>${commentHtml}</div>
        <div class="tx-amount" style="color:var(--accent);">${fmtMoney(tx.amount)} ₽</div>
      </div>`;
  }).join('');
}

function openAdjustModal(playerId, playerName) {
  adjustTargetId = playerId;
  document.getElementById('adjustTitle').textContent = `Корректировка: ${playerName}`;
  document.getElementById('adjustAmount').value = '';
  document.getElementById('adjustComment').value = '';
  document.getElementById('adjustModal').style.display = 'flex';
}

function closeAdjustModal() { document.getElementById('adjustModal').style.display = 'none'; adjustTargetId = null; }
function setAdjustComment(text) { document.getElementById('adjustComment').value = text; }

async function submitAdjust() {
  const amount = parseFloat(document.getElementById('adjustAmount').value);
  const comment = document.getElementById('adjustComment').value.trim();
  if (!amount || amount === 0) return showToast('Введи сумму');

  try {
    const { error } = await db.rpc('banker_adjust', {
      p_banker_id: session.player_id, p_target_id: adjustTargetId,
      p_amount: amount, p_comment: comment || 'Корректировка'
    });
    if (error) throw error;
    showToast('Готово'); closeAdjustModal();
  } catch (err) { showToast(err.message || 'Ошибка'); }
}

function populateTransferTargets() {
  const select = document.getElementById('transferTarget');
  select.innerHTML = '';
  allPlayers.forEach(p => {
    if (p.id === session.player_id) return;
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.is_bank_account ? `🏦 Банк` : `${p.avatar} ${p.name}`;
    select.appendChild(opt);
  });
}

function openTransferModal() {
  document.getElementById('transferModal').style.display = 'flex';
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferComment').value = '';
  populateTransferTargets();
  
  if (selectedPlayerForTransfer) {
    document.getElementById('transferTarget').value = selectedPlayerForTransfer;
    selectedPlayerForTransfer = null;
  }
}

function closeTransferModal() { document.getElementById('transferModal').style.display = 'none'; }
function setTransferComment(text) { document.getElementById('transferComment').value = text; }

async function submitTransfer() {
  const toId = document.getElementById('transferTarget').value;
  const amount = parseFloat(document.getElementById('transferAmount').value);
  const comment = document.getElementById('transferComment').value.trim();

  if (!toId) return showToast('Выбери получателя');
  if (!amount || amount <= 0) return showToast('Сумма > 0');
  if (amount > myProfile.balance) return showToast('Недостаточно средств');

  try {
    const { error } = await db.rpc('transfer_money', {
      p_from: session.player_id, p_to: toId, p_amount: amount,
      p_comment: comment || 'Перевод'
    });
    if (error) throw error;
    showToast('Перевод выполнен'); closeTransferModal();
  } catch (err) { showToast(err.message || 'Ошибка'); }
}

function subscribeRealtime() {
  db.channel('banker_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${session.room_id}` }, () => loadRoomState())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `room_id=eq.${session.room_id}` }, (payload) => {
        const tx = payload.new;
        if (tx.to_player === session.player_id && tx.from_player !== session.player_id) {
          playCoinSound(); 
          showTransferToast(tx.amount, tx.comment);
        }
        loadRoomState();
    }).subscribe();
}

function logout() { clearSession(); window.location.href = 'index.html'; }
