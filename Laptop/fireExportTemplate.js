function getFireHD8HTML(eventCode, picklistTeams) {
    const teamsJSON = JSON.stringify(picklistTeams);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>${eventCode.toUpperCase()} — Picklist</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">

<style>
  :root {
    --yellow: #FFD600;
    --yellow-dim: #b39700;
    --green: #00E676;
    --green-bg: #00251a;
    --red: #FF1744;
    --red-bg: #3a0000;
    --bg: #0a0a0a;
    --surface: #141414;
    --surface2: #1e1e1e;
    --border: #2a2a2a;
    --text: #f0f0f0;
    --muted: #666;
    --radius: 14px;
    --transition: 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: 'Barlow', sans-serif;
    overflow-x: hidden;
    overscroll-behavior: none;
  }

  /* ── HEADER ── */
  header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 10px 14px 8px;
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .event-badge {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 1.25rem;
    letter-spacing: 0.08em;
    color: var(--yellow);
    text-transform: uppercase;
  }

  .count-badge {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 12px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--muted);
    transition: color var(--transition), border-color var(--transition);
  }

  .count-badge span {
    color: var(--yellow);
    font-weight: 800;
  }

  /* ── SEARCH ── */
  .search-wrap {
    position: relative;
  }

  .search-wrap svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.4;
    pointer-events: none;
  }

  #search {
    width: 100%;
    padding: 11px 12px 11px 40px;
    font-size: 1rem;
    font-family: 'Barlow', sans-serif;
    border-radius: 10px;
    border: 1px solid var(--border);
    outline: none;
    background: var(--surface);
    color: white;
    transition: border-color var(--transition);
  }

  #search:focus {
    border-color: var(--yellow);
  }

  #search::placeholder { color: var(--muted); }

  /* ── TABS ── */
  .tabs {
    display: flex;
    gap: 6px;
    padding: 10px 14px 0;
  }

  .tab {
    flex: 1;
    padding: 9px 0;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.05em;
    text-align: center;
    cursor: pointer;
    transition: all var(--transition);
    user-select: none;
  }

  .tab.active {
    background: var(--yellow);
    color: #000;
    border-color: var(--yellow);
  }

  /* ── LIST ── */
  #list {
    padding: 10px 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ── CARD ── */
  .card {
    position: relative;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    overflow: hidden;
    touch-action: pan-y;
    user-select: none;
    transition: border-color var(--transition), background var(--transition);
    will-change: transform;
  }

  /* rank number */
  .rank {
    width: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 1.1rem;
    color: var(--muted);
    padding: 18px 0;
    border-right: 1px solid var(--border);
    transition: color var(--transition);
  }

  .card.selected .rank {
    color: var(--green);
  }

  /* drag handle */
  .drag-handle {
    width: 36px;
    min-width: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px 0;
    cursor: grab;
    opacity: 0.3;
    transition: opacity var(--transition);
  }

  .drag-handle:active { cursor: grabbing; }
  .card:hover .drag-handle { opacity: 0.7; }

  /* team info */
  .info {
    flex: 1;
    padding: 14px 10px;
    min-width: 0;
  }

  .team-num {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.9rem;
    font-weight: 800;
    color: var(--yellow);
    line-height: 1;
    letter-spacing: 0.01em;
  }

  .team-name {
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 500;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* epa */
  .epa-wrap {
    padding: 14px 14px 14px 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .epa-label {
    font-size: 0.65rem;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--muted);
    text-transform: uppercase;
  }

  .epa-val {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 1.6rem;
    color: var(--text);
    line-height: 1;
  }

  /* selected state */
  .card.selected {
    border-color: var(--green);
    background: var(--green-bg);
  }

  .card.selected .team-num { color: var(--green); }
  .card.selected .epa-val { color: var(--green); }

  /* swipe delete indicator */
  .delete-bg {
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 90px;
    background: var(--red-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0 var(--radius) var(--radius) 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .delete-bg svg { opacity: 0.9; }

  /* swipe select indicator */
  .select-bg {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 90px;
    background: var(--green-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius) 0 0 var(--radius);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
  }

  /* drag-over state */
  .card.drag-over {
    border-color: var(--yellow);
    border-style: dashed;
  }

  .card.dragging {
    opacity: 0.4;
  }

  /* ── EMPTY STATE ── */
  .empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--muted);
    font-family: 'Barlow Condensed', sans-serif;
  }

  .empty-icon { font-size: 3rem; margin-bottom: 12px; }
  .empty-text { font-size: 1.2rem; font-weight: 600; letter-spacing: 0.05em; }

  /* ── TOAST ── */
  #toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 40px;
    padding: 10px 20px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.05em;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transform: translateY(16px) scale(0.95);
    transition: opacity 0.2s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
  }

  .toast.show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .toast.toast-green { border-color: var(--green); color: var(--green); }
  .toast.toast-red   { border-color: var(--red);   color: var(--red);   }
  .toast.toast-blue  { border-color: #40c4ff;       color: #40c4ff;      }

  /* ── RIPPLE ── */
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,214,0,0.18);
    transform: scale(0);
    animation: ripple-anim 0.5s linear;
    pointer-events: none;
  }
  @keyframes ripple-anim {
    to { transform: scale(4); opacity: 0; }
  }

  /* ── SLIDE IN/OUT ── */
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-24px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes slideOut {
    from { opacity: 1; transform: translateX(0) scaleY(1); max-height: 100px; }
    to   { opacity: 0; transform: translateX(40px) scaleY(0.6); max-height: 0; }
  }

  .card.entering { animation: slideIn 0.25s cubic-bezier(0.34,1.3,0.64,1) forwards; }

  /* ── SELECTED SECTION DIVIDER ── */
  .section-header {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 6px 4px 2px;
  }

  .section-header.green { color: var(--green); }
</style>
</head>
<body>

<header>
  <div class="header-top">
    <div class="event-badge">⚡ ${eventCode.toUpperCase()}</div>
    <div class="count-badge" id="countBadge"><span id="countNum">0</span> selected</div>
  </div>
  <div class="search-wrap">
    <svg width="16" height="16" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input id="search" type="search" placeholder="Search team # or name…" autocomplete="off" autocorrect="off">
  </div>
</header>

<div class="tabs">
  <div class="tab active" data-tab="all">All Teams</div>
  <div class="tab" data-tab="selected">✓ Selected</div>
  <div class="tab" data-tab="remaining">Remaining</div>
</div>

<div id="list"></div>

<div id="toast-container"></div>

<script>
const RAW = ${teamsJSON};

// ── state ──
let teams = RAW.map((t, i) => ({ ...t, rank: i + 1, selected: false }));
let currentTab = 'all';
let searchQ = '';
let dragSrcId = null;

// ── toast ──
function toast(msg, type = 'blue', icon = '') {
  const el = document.createElement('div');
  el.className = \`toast toast-\${type}\`;
  el.innerHTML = icon ? \`<span>\${icon}</span>\${msg}\` : msg;
  document.getElementById('toast-container').appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 2200);
}

// ── vibrate ──
function vibe(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── ripple ──
function ripple(card, x, y) {
  const r = document.createElement('div');
  r.className = 'ripple';
  const rect = card.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.2;
  r.style.cssText = \`width:\${size}px;height:\${size}px;left:\${x - rect.left - size/2}px;top:\${y - rect.top - size/2}px\`;
  card.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── render ──
function render() {
  const list = document.getElementById('list');
  const selected = teams.filter(t => t.selected);
  const remaining = teams.filter(t => !t.selected);
  document.getElementById('countNum').textContent = selected.length;

  let visible = [];
  if (currentTab === 'all')       visible = teams;
  else if (currentTab === 'selected')  visible = selected;
  else if (currentTab === 'remaining') visible = remaining;

  if (searchQ) {
    visible = visible.filter(t =>
      String(t.number).includes(searchQ) ||
      (t.name || '').toLowerCase().includes(searchQ)
    );
  }

  list.innerHTML = '';

  if (visible.length === 0) {
    list.innerHTML = \`<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No teams found</div></div>\`;
    return;
  }

  // Show section headers in "all" tab
  if (currentTab === 'all' && !searchQ) {
    const selIds = new Set(selected.map(t => t.id));
    let shownSelectedHeader = false;
    let shownRemainingHeader = false;

    visible.forEach((t, i) => {
      if (t.selected && !shownSelectedHeader) {
        const h = document.createElement('div');
        h.className = 'section-header green';
        h.textContent = '✓ Selected';
        list.appendChild(h);
        shownSelectedHeader = true;
      }
      if (!t.selected && !shownRemainingHeader) {
        const h = document.createElement('div');
        h.className = 'section-header';
        h.textContent = 'Remaining';
        list.appendChild(h);
        shownRemainingHeader = true;
      }
      list.appendChild(makeCard(t, i));
    });
  } else {
    visible.forEach((t, i) => list.appendChild(makeCard(t, i)));
  }
}

// ── make card ──
function makeCard(t, idx) {
  const card = document.createElement('div');
  card.className = 'card entering' + (t.selected ? ' selected' : '');
  card.dataset.id = t.id;
  card.style.animationDelay = Math.min(idx * 30, 300) + 'ms';

  card.innerHTML = \`
    <div class="select-bg">
      <svg width="28" height="28" fill="none" stroke="#00E676" stroke-width="2.5" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="rank">\${idx + 1}</div>
    <div class="drag-handle" draggable="false">
      <svg width="16" height="20" fill="#fff" viewBox="0 0 16 20">
        <circle cx="5" cy="4" r="2"/><circle cx="11" cy="4" r="2"/>
        <circle cx="5" cy="10" r="2"/><circle cx="11" cy="10" r="2"/>
        <circle cx="5" cy="16" r="2"/><circle cx="11" cy="16" r="2"/>
      </svg>
    </div>
    <div class="info">
      <div class="team-num">\${t.number}</div>
      <div class="team-name">\${t.name || '—'}</div>
    </div>
    <div class="epa-wrap">
      <div class="epa-label">EPA</div>
      <div class="epa-val">\${typeof t.epa === 'number' ? t.epa.toFixed(1) : '—'}</div>
    </div>
    <div class="delete-bg">
      <svg width="24" height="24" fill="none" stroke="#FF1744" stroke-width="2.5" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
    </div>
  \`;

  attachSwipe(card, t);
  attachDrag(card, t);

  return card;
}

// ── swipe ──
function attachSwipe(card, team) {
  let startX = 0, startY = 0, moved = false;

  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // ignore mostly vertical scrolls
    if (!moved && Math.abs(dy) > Math.abs(dx)) return;
    moved = true;

    card.style.transform = \`translateX(\${dx}px)\`;
    card.style.transition = 'none';

    const deleteBg = card.querySelector('.delete-bg');
    const selectBg = card.querySelector('.select-bg');

    if (dx < -30) {
      deleteBg.style.opacity = Math.min(Math.abs(dx) / 90, 1);
      selectBg.style.opacity = 0;
      card.style.background = \`rgba(58,0,0,\${Math.min(Math.abs(dx)/200, 0.8)})\`;
    } else if (dx > 30) {
      selectBg.style.opacity = Math.min(dx / 90, 1);
      deleteBg.style.opacity = 0;
      card.style.background = \`rgba(0,37,26,\${Math.min(dx/200, 0.8)})\`;
    } else {
      deleteBg.style.opacity = 0;
      selectBg.style.opacity = 0;
      card.style.background = '';
    }
  }, { passive: true });

  card.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    card.style.transition = '';
    card.querySelector('.delete-bg').style.opacity = 0;
    card.querySelector('.select-bg').style.opacity = 0;
    card.style.background = '';

    if (!moved && Math.abs(dx) < 10) {
      // tap = toggle select
      ripple(card, e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      toggleSelect(team, card);
      return;
    }

    if (dx < -100) {
      // swipe left = remove
      card.style.transform = 'translateX(-110%)';
      card.style.opacity = '0';
      vibe([40, 20, 80]);
      setTimeout(() => {
        teams = teams.filter(t => t.id !== team.id);
        toast(\`#\${team.number} removed\`, 'red', '🗑');
        render();
      }, 220);
    } else if (dx > 100) {
      // swipe right = select/deselect
      vibe([30]);
      toggleSelect(team, card);
    } else {
      card.style.transform = '';
    }
  });
}

function toggleSelect(team, card) {
  team.selected = !team.selected;

  if (team.selected) {
    // Move selected to front of teams array (top of list)
    teams = [team, ...teams.filter(t => t.id !== team.id)];
    vibe([20, 10, 30]);
    toast(\`#\${team.number} selected ✓\`, 'green');
  } else {
    vibe([10]);
    toast(\`#\${team.number} deselected\`, 'blue');
  }
  render();
}

// ── drag to reorder (touch) ──
function attachDrag(card, team) {
  const handle = card.querySelector('.drag-handle');
  let dragY = 0, startIdx = 0;
  let ghost = null, placeholder = null;

  handle.addEventListener('touchstart', e => {
    e.stopPropagation();
    const touch = e.touches[0];
    dragY = touch.clientY;
    startIdx = teams.findIndex(t => t.id === team.id);

    // create ghost
    ghost = card.cloneNode(true);
    ghost.style.cssText = \`
      position:fixed; left:\${card.getBoundingClientRect().left}px;
      top:\${card.getBoundingClientRect().top}px;
      width:\${card.offsetWidth}px; z-index:200;
      opacity:0.9; pointer-events:none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      border-color: var(--yellow);
      transition: none;
    \`;
    document.body.appendChild(ghost);
    card.classList.add('dragging');
    vibe([15]);
  }, { passive: true });

  handle.addEventListener('touchmove', e => {
    if (!ghost) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dy = touch.clientY - dragY;
    ghost.style.top = (card.getBoundingClientRect().top + dy) + 'px';

    // find card under touch
    ghost.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    ghost.style.display = '';

    const targetCard = el ? el.closest('.card') : null;
    if (targetCard && targetCard !== card) {
      const targetId = targetCard.dataset.id;
      const targetTeam = teams.find(t => String(t.id) === targetId);
      if (targetTeam) {
        const tIdx = teams.findIndex(t => t.id === targetTeam.id);
        const sIdx = teams.findIndex(t => t.id === team.id);
        if (tIdx !== sIdx) {
          teams.splice(sIdx, 1);
          teams.splice(tIdx, 0, team);
          render();
          // re-grab the card after re-render
          const newCard = document.querySelector(\`[data-id="\${team.id}"]\`);
          if (newCard) newCard.classList.add('dragging');
        }
      }
    }
  }, { passive: false });

  handle.addEventListener('touchend', () => {
    if (ghost) { ghost.remove(); ghost = null; }
    card.classList.remove('dragging');
    vibe([10]);
    render();
  });
}

// ── search ──
document.getElementById('search').addEventListener('input', e => {
  searchQ = e.target.value.toLowerCase().trim();
  render();
});

// ── tabs ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentTab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('search').value = '';
    searchQ = '';
    render();
  });
});

// ── initial render ──
render();
toast('Picklist loaded — tap or swipe to interact', 'blue', '⚡');
</script>
</body>
</html>`;
}