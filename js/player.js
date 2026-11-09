let session = null;
let myProfile = null;
let allPlayers = [];
let allTxs = [];
let selectedPlayerForTransfer = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  session = getSession();
  
  if (!session || session.is_banker) { window.location.href = 'index.html'; return; }

  document.getElementById('myAvatar').textContent = session.avatar;
  document.getElementById('sessionPlayerId').textContent = session.player_id.slice(0, 8) + '...';
  
  await loadRoomState();
  subscribeRealtime();
});

async function loadRoomState() {
  const { data, error } = await db.rpc('get_room_state', { p_room_id: session.room_id });
  if (error) { showToast('Ошибка загрузки'); return; }

  allPlayers = data.players;
  allTxs = data.transactions;
  myProfile = allPlayers.find(p => p.id === session.player_id);

  if (!myProfile) { clearSession(); window.location.href = 'index.html'; return; }

  document.getElementById('myBalance').textContent = fmtMoney(myProfile.balance);
  renderHistory();
  renderPlayersList();
  populateTransferTargets();
}

function switchTab(tab) {
  document.getElementById('tabHistoryContent').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('tabPlayersContent').style.display = tab === 'players' ? 'block' : 'none';
  document.getElementById('tabSettingsContent').style.display = tab === 'settings' ? 'block' : 'none';

  document.getElementById('navHistory').classList.toggle('active', tab === 'history');
  document.getElementById('navPlayers').classList.toggle('active', tab === 'players');
  document.getElementById('navSettings').classList.toggle('active', tab === 'settings');
}

// --- Рендер Игроков ---
function renderPlayersList() {
  const list = document.getElementById('playersList');
  list.innerHTML = allPlayers.map(p => {
    if (p.id === session.player_id) return ''; // Себя не показываем в списке игроков
    return `
      <div class="player-row">
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${esc(p.name)}</div>
          <!-- Строка с балансом удалена -->
        </div>
        <button class="btn secondary" style="width:auto; padding:8px 12px; margin:0; font-size:13px;" 
          onclick="quickTransfer('${p.id}')">💸</button>
      </div>
    `;
  }).join('');
}

function quickTransfer(targetId) {
  selectedPlayerForTransfer = targetId;
  openTransferModal();
}

// --- Рендер Истории ---
function renderHistory() {
  const list = document.getElementById('historyList');
  
  if (!allTxs || allTxs.length === 0) { list.innerHTML = '<div class="empty">Пока нет операций</div>'; return; }

  // Фильтруем: показываем ВСЁ, что связано с банком ИЛИ личные переводы
  const visibleTxs = allTxs.filter(tx => {
    const isBankRelated = tx.from_player === null || tx.to_player === null;
    const isMyTx = tx.from_player === session.player_id || tx.to_player === session.player_id;
    return isBankRelated || isMyTx;
  });

  list.innerHTML = visibleTxs.map(tx => {
    const isIncoming = tx.to_player === session.player_id;
    const isOutgoing = tx.from_player === session.player_id;
    
    let title = '', icon = '', amountClass = '', sign = '';

    if (tx.from_player === null && isIncoming) {
      title = 'Пополнение от Банка'; icon = '🏦'; amountClass = 'in'; sign = '+';
    } else if (isOutgoing && tx.to_player === null) {
      title = 'Перевод в Банк'; icon = '🏦'; amountClass = 'out'; sign = '-';
    } else if (isIncoming) {
      const fromP = allPlayers.find(p => p.id === tx.from_player);
      title = fromP ? `От ${fromP.name}` : 'Перевод';
      icon = '↙️'; amountClass = 'in'; sign = '+';
    } else if (isOutgoing) {
      const toP = allPlayers.find(p => p.id === tx.to_player);
      if (toP && toP.is_bank_account) { title = 'В Банк'; icon = '🏦'; }
      else { title = toP ? `Для ${toP.name}` : 'Перевод'; icon = '↗️'; }
      amountClass = 'out'; sign = '-';
    } else {
      // Чужая операция с банком (например, банкир выдал зарплату Васе)
      const fromP = tx.from_player ? allPlayers.find(p => p.id === tx.from_player) : null;
      const toP = tx.to_player ? allPlayers.find(p => p.id === tx.to_player) : null;
      title = fromP ? `Банк → ${fromP.name}` : `Банк → ${toP.name}`; // Логика для чужих
      if (!fromP) title = `Банк → ${toP.name}`;
      if (!toP) title = `${fromP.name} → Банк`;
      icon = '🏦'; amountClass = 'out'; sign = '';
    }

    const commentHtml = tx.comment ? `<div class="tx-comment">${esc(tx.comment)}</div>` : '';

    return `
      <div class="tx-row">
        <div class="tx-icon ${amountClass}">${icon}</div>
        <div class="tx-info">
          <div class="tx-title">${esc(title)}</div>
          ${commentHtml}
        </div>
        <div class="tx-amount ${amountClass}">${sign}${fmtMoney(tx.amount)} ₽</div>
      </div>
    `;
  }).join('');
}

function populateTransferTargets() {
  const select = document.getElementById('transferTarget');
  select.innerHTML = '';
  allPlayers.forEach(p => {
    if (p.id === session.player_id) return;
    const opt = document.createElement('option');
    opt.value = p.id;
    if (p.is_bank_account) opt.textContent = `🏦 Банк`;
    else opt.textContent = `${p.avatar} ${p.name}`;
    select.appendChild(opt);
  });
}

function subscribeRealtime() {
  db.channel('room_changes')
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
function setComment(text) { document.getElementById('transferComment').value = text; }

async function submitTransfer() {
  const toId = document.getElementById('transferTarget').value;
  const amount = parseFloat(document.getElementById('transferAmount').value);
  const comment = document.getElementById('transferComment').value.trim();

  if (!toId) return showToast('Выбери получателя');
  if (!amount || amount <= 0) return showToast('Введи сумму больше 0');
  if (amount > myProfile.balance) return showToast('Недостаточно средств');

  try {
    const { error } = await db.rpc('transfer_money', {
      p_from: session.player_id, p_to: toId, p_amount: amount, p_comment: comment
    });
    if (error) throw error;
    showToast('Перевод выполнен'); closeTransferModal();
  } catch (err) { showToast(err.message || 'Ошибка перевода'); }
}

function logout() { clearSession(); window.location.href = 'index.html'; }
