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
      document.getElementById('modalRoom
