// Список эмодзи-аватарок
const AVATARS = ['🐱','🐶','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐵','🦄','🐷','🐔','🐧','🦉','🐢'];

// Тема
function initTheme() {
  const saved = localStorage.getItem('monobank_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('monobank_theme', next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

// Формат денег
function fmtMoney(n) {
  return Number(n).toLocaleString('ru-RU');
}

// Тост
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// Сохранение сессии
function saveSession(data) {
  localStorage.setItem('monobank_session', JSON.stringify(data));
}
function getSession() {
  try { return JSON.parse(localStorage.getItem('monobank_session')); }
  catch { return null; }
}
function clearSession() {
  localStorage.removeItem('monobank_session');
}

// Экранирование HTML (чтобы имена не ломали верстку)
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function playCoinSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime); 
  osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function showPushNotification(title, comment) {
  const push = document.createElement('div');
  push.className = 'push-notification';
  push.innerHTML = `
    <div class="push-icon">💰</div>
    <div class="push-content">
      <div class="push-title">${esc(title)}</div>
      ${comment ? `<div class="push-comment">${esc(comment)}</div>` : ''}
    </div>
  `;
  document.body.appendChild(push);
  setTimeout(() => {
    push.style.opacity = '0';
    push.style.transition = 'opacity 0.3s';
    setTimeout(() => push.remove(), 300);
  }, 3000); // Показываем 3 секунды
}

function showTransferToast(amount, comment) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
      <span>💰</span> <span>+${fmtMoney(amount)} ₽</span>
    </div>
    ${comment ? `<div class="toast-sub">${esc(comment)}</div>` : ''}
  `;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000); // Показываем 3 секунды
}