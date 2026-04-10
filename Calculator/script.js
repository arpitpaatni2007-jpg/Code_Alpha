/**
 * CALC//OS — Terminal Calculator
 * script.js
 *
 * Modules:
 *  1. State management
 *  2. Calculation engine
 *  3. Display rendering
 *  4. History
 *  5. Button / keyboard input
 *  6. Animations & sound
 *  7. Theme toggle
 *  8. Particle background
 *  9. Init
 */

/* ============================================================
   1. STATE MANAGEMENT
   ============================================================ */
const state = {
  currentInput:   '',       // what the user is typing
  previousInput:  '',       // stored operand
  operator:       null,     // pending operator (÷ × − +)
  justEvaluated:  false,    // did we just press "="?
  hasError:       false,
};

/* Reset all state */
function resetState() {
  state.currentInput  = '';
  state.previousInput = '';
  state.operator      = null;
  state.justEvaluated = false;
  state.hasError      = false;
}

/* ============================================================
   2. CALCULATION ENGINE
   ============================================================ */

/**
 * Perform arithmetic on two numeric strings.
 * Returns the result as a string or throws on invalid input.
 */
function calculate(a, op, b) {
  const numA = parseFloat(a);
  const numB = parseFloat(b);

  if (isNaN(numA) || isNaN(numB)) throw new Error('Invalid operands');

  let result;
  switch (op) {
    case '+': result = numA + numB; break;
    case '−': result = numA - numB; break;
    case '×': result = numA * numB; break;
    case '÷':
      if (numB === 0) throw new Error('DIV/0 ERROR');
      result = numA / numB;
      break;
    default: throw new Error('Unknown operator');
  }

  // Avoid floating-point noise (e.g. 0.1 + 0.2 = 0.30000000004)
  return parseFloat(result.toPrecision(12)).toString();
}

/**
 * Format a result string for display.
 * - Limits very long decimals
 * - Uses exponential notation for huge/tiny numbers
 */
function formatResult(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  if (Math.abs(num) >= 1e15 || (Math.abs(num) < 1e-7 && num !== 0)) {
    return num.toExponential(6);
  }

  // Show up to 10 decimal places, strip trailing zeros
  let formatted = parseFloat(num.toFixed(10)).toString();
  return formatted;
}

/* ============================================================
   3. DISPLAY RENDERING
   ============================================================ */
const elResult     = document.getElementById('result');
const elExpression = document.getElementById('expression');
const elStatus     = document.getElementById('statusText');
const elMode       = document.getElementById('modeIndicator');

/** Update the main result display */
function renderResult(value, animate = false) {
  elResult.textContent = value;
  elResult.classList.toggle('error', state.hasError);

  if (animate) {
    elResult.classList.remove('animate-result');
    void elResult.offsetWidth; // reflow
    elResult.classList.add('animate-result');
  }

  // Auto-scroll to end
  elResult.scrollLeft = elResult.scrollWidth;
}

/** Update the expression (top line) */
function renderExpression(expr) {
  elExpression.textContent = expr;
  elExpression.scrollLeft  = elExpression.scrollWidth;
}

/** Update status bar text */
function setStatus(text, mode) {
  elStatus.textContent = text;
  if (mode) elMode.textContent = mode;
}

/** Highlight the active operator button */
function highlightOperator(op) {
  document.querySelectorAll('.btn-op').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === op);
  });
}

/* Build the expression string shown above the result */
function buildExpressionString() {
  if (state.operator && state.previousInput !== '') {
    const prev = formatResult(state.previousInput);
    if (state.currentInput !== '') {
      return `${prev} ${state.operator} ${state.currentInput}`;
    }
    return `${prev} ${state.operator}`;
  }
  return '';
}

/* ============================================================
   4. HISTORY
   ============================================================ */
const MAX_HISTORY = 50;
let history = [];

function loadHistory() {
  try {
    history = JSON.parse(localStorage.getItem('calc_history') || '[]');
  } catch { history = []; }
  renderHistory();
}

function saveHistory() {
  localStorage.setItem('calc_history', JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function addHistory(expression, result) {
  history.unshift({ expression, result, ts: Date.now() });
  if (history.length > MAX_HISTORY) history.pop();
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (history.length === 0) {
    list.innerHTML = '<li class="history-empty">No calculations yet</li>';
    return;
  }

  list.innerHTML = history.slice(0, 30).map((item, i) => `
    <li class="history-item" data-index="${i}" title="Click to reuse result" role="button" tabindex="0">
      <span class="history-expr">${escapeHtml(item.expression)}</span>
      <span class="history-ans">${escapeHtml(item.result)}</span>
    </li>
  `).join('');

  // Click to restore result
  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = history[parseInt(el.dataset.index)];
      if (!item) return;
      resetState();
      state.currentInput  = item.result;
      state.justEvaluated = true;
      renderResult(formatResult(item.result));
      renderExpression(item.expression + ' =');
      setStatus('RESTORED');
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') el.click();
    });
  });
}

function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
  showToast('// HISTORY PURGED');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ============================================================
   5. INPUT HANDLERS
   ============================================================ */

/** Handle a digit (0–9) or decimal point */
function handleDigit(value) {
  if (state.hasError) handleClear();

  // After "=" start fresh but keep result if typing new number
  if (state.justEvaluated) {
    if (value === '.') {
      state.currentInput  = '0.';
      state.justEvaluated = false;
      highlightOperator(null);
    } else {
      state.currentInput  = value;
      state.justEvaluated = false;
      highlightOperator(null);
    }
    renderResult(state.currentInput);
    renderExpression('');
    return;
  }

  // Decimal point
  if (value === '.') {
    if (state.currentInput.includes('.')) return; // already has one
    state.currentInput = state.currentInput === '' ? '0.' : state.currentInput + '.';
    renderResult(state.currentInput);
    renderExpression(buildExpressionString());
    return;
  }

  // Limit display length
  if (state.currentInput.replace('-', '').replace('.', '').length >= 15) return;

  state.currentInput += value;
  renderResult(state.currentInput || '0');
  renderExpression(buildExpressionString());
  setStatus('INPUT');
}

/** Handle an operator (+, −, ×, ÷) */
function handleOperator(op) {
  if (state.hasError) return;

  // If we have a pending operation and new input, evaluate first (chaining)
  if (state.operator && state.currentInput !== '' && !state.justEvaluated) {
    try {
      const result = calculate(state.previousInput, state.operator, state.currentInput);
      state.previousInput = result;
      state.currentInput  = '';
      renderResult(formatResult(result));
    } catch (err) {
      handleError(err.message);
      return;
    }
  } else if (state.currentInput !== '') {
    state.previousInput = state.currentInput;
    state.currentInput  = '';
  } else if (state.previousInput === '') {
    // Nothing entered yet — treat current display value as operand
    state.previousInput = elResult.textContent;
  }

  state.operator      = op;
  state.justEvaluated = false;
  highlightOperator(op);
  renderExpression(buildExpressionString());
  setStatus('OP', 'STD');
}

/** Handle equals */
function handleEquals() {
  if (state.hasError) return;
  if (!state.operator)         return;
  if (state.currentInput === '') return;
  if (state.previousInput === '') return;

  const expr = `${formatResult(state.previousInput)} ${state.operator} ${state.currentInput}`;

  try {
    const result = calculate(state.previousInput, state.operator, state.currentInput);
    const formatted = formatResult(result);

    renderResult(formatted, true);
    renderExpression(`${expr} =`);
    setStatus('RESULT');

    addHistory(expr, formatted);

    state.previousInput  = result;
    state.currentInput   = '';
    state.justEvaluated  = true;
    highlightOperator(null);
  } catch (err) {
    handleError(err.message);
  }
}

/** Handle Clear (C) */
function handleClear() {
  resetState();
  renderResult('0');
  renderExpression('');
  highlightOperator(null);
  setStatus('READY');
}

/** Handle Delete (⌫) */
function handleDelete() {
  if (state.hasError) { handleClear(); return; }
  if (state.justEvaluated) { handleClear(); return; }

  state.currentInput = state.currentInput.slice(0, -1);
  renderResult(state.currentInput || '0');
  renderExpression(buildExpressionString());
}

/** Handle +/− sign toggle */
function handleSign() {
  if (state.hasError) return;

  const target = state.currentInput || elResult.textContent;
  if (!target || target === '0') return;

  const toggled = (parseFloat(target) * -1).toString();
  state.currentInput = toggled;
  renderResult(toggled);
  renderExpression(buildExpressionString());
}

/** Handle percentage */
function handlePercent() {
  if (state.hasError) return;

  const target = state.currentInput || elResult.textContent;
  if (!target || target === '0') return;

  const result = (parseFloat(target) / 100).toString();
  state.currentInput = result;
  renderResult(formatResult(result));
  renderExpression(buildExpressionString());
}

/** Handle errors */
function handleError(message) {
  state.hasError = true;
  renderResult(message, true);
  renderExpression('');
  setStatus('ERROR');
  highlightOperator(null);
}

/* ============================================================
   6. BUTTON INTERACTIONS
   ============================================================ */

/** Route a button click to the correct handler */
function dispatchAction(action, value) {
  switch (action) {
    case 'digit':    handleDigit(value);    break;
    case 'decimal':  handleDigit('.');      break;
    case 'operator': handleOperator(value); break;
    case 'equals':   handleEquals();        break;
    case 'clear':    handleClear();         break;
    case 'delete':   handleDelete();        break;
    case 'sign':     handleSign();          break;
    case 'percent':  handlePercent();       break;
  }
}

/** Attach click listeners to all .btn elements */
function attachButtonListeners() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const { action, value } = btn.dataset;
      dispatchAction(action, value);
      triggerRipple(btn, e);
      playClick();
    });
  });
}

/** Keyboard input support */
function attachKeyboardListeners() {
  const keyMap = {
    '0': ['digit', '0'],
    '1': ['digit', '1'],
    '2': ['digit', '2'],
    '3': ['digit', '3'],
    '4': ['digit', '4'],
    '5': ['digit', '5'],
    '6': ['digit', '6'],
    '7': ['digit', '7'],
    '8': ['digit', '8'],
    '9': ['digit', '9'],
    '.': ['decimal', '.'],
    ',': ['decimal', '.'],
    '+': ['operator', '+'],
    '-': ['operator', '−'],
    '*': ['operator', '×'],
    '/': ['operator', '÷'],
    'Enter':     ['equals',  ''],
    '=':         ['equals',  ''],
    'Backspace': ['delete',  ''],
    'Escape':    ['clear',   ''],
    'c':         ['clear',   ''],
    'C':         ['clear',   ''],
    '%':         ['percent', ''],
  };

  document.addEventListener('keydown', (e) => {
    const mapped = keyMap[e.key];
    if (!mapped) return;

    e.preventDefault();
    const [action, value] = mapped;
    dispatchAction(action, value);

    // Briefly highlight corresponding button
    const selector = value
      ? `.btn[data-action="${action}"][data-value="${value}"]`
      : `.btn[data-action="${action}"]`;
    const btn = document.querySelector(selector);
    if (btn) {
      btn.classList.add('ripple');
      setTimeout(() => btn.classList.remove('ripple'), 400);
    }

    playClick();
  });
}

/* ============================================================
   7. ANIMATIONS & SOUND
   ============================================================ */

/** CSS ripple on click */
function triggerRipple(btn, event) {
  btn.classList.remove('ripple');
  void btn.offsetWidth;
  btn.classList.add('ripple');
  setTimeout(() => btn.classList.remove('ripple'), 400);
}

/** Web Audio API click sound */
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { audioCtx = null; }
  }
  return audioCtx;
}

function playClick() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type      = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch { /* silently ignore audio errors */ }
}

/** Toast notification */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ============================================================
   8. COPY RESULT
   ============================================================ */
function attachCopyListener() {
  const btn = document.getElementById('copyBtn');
  btn.addEventListener('click', () => {
    const value = elResult.textContent;
    if (!value || value === '0') return;

    navigator.clipboard.writeText(value).then(() => {
      btn.classList.add('copied');
      showToast('// RESULT COPIED');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    }).catch(() => {
      showToast('// COPY FAILED');
    });
  });
}

/* ============================================================
   9. THEME TOGGLE
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('calc_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeBtn').querySelector('.theme-icon').textContent =
    theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('calc_theme', theme);
}

function attachThemeListener() {
  document.getElementById('themeBtn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

/* ============================================================
   10. HISTORY PANEL TOGGLE
   ============================================================ */
function attachHistoryToggle() {
  const btn   = document.getElementById('historyBtn');
  const panel = document.getElementById('historyPanel');

  btn.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
}

/* ============================================================
   11. PARTICLE BACKGROUND
   ============================================================ */
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx    = canvas.getContext('2d');

  let particles = [];
  let W, H, animId;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x:    Math.random() * W,
      y:    Math.random() * H,
      vx:   (Math.random() - 0.5) * 0.3,
      vy:   (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    };
  }

  function init() {
    particles = Array.from({ length: 80 }, createParticle);
  }

  function getColor() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return isDark ? '0, 212, 255' : '0, 100, 200';
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const color = getColor();

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, ${p.alpha})`;
      ctx.fill();
    });

    // Draw connection lines between close particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${color}, ${0.08 * (1 - dist / 100)})`;
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); init(); });
  resize();
  init();
  draw();
}

/* ============================================================
   12. INITIALISE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadHistory();
  attachButtonListeners();
  attachKeyboardListeners();
  attachCopyListener();
  attachThemeListener();
  attachHistoryToggle();
  initParticles();

  // Greet the user
  setStatus('READY', 'STD');
  renderResult('0');
});
