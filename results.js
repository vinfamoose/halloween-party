// ---------- VCR clock (time of day, for the host screen) ----------
(function(){
  const el = document.getElementById('clock');
  const tick = () => { el.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false }); };
  tick(); setInterval(tick, 10000);
})();

// Only the projector page (body.display) uses the big layout, so it shows fewer rows per panel.
const wide = { get matches(){ return document.body.classList.contains('display') && matchMedia('(min-width:1000px)').matches; } };
const CROWN = '<svg class="icon" aria-hidden="true"><use href="#i-crown"/></svg>';
const prevWidth = {};   // key -> last rendered bar width, so bars grow from where they were
const prevVotes = {};   // key -> last rendered vote count, so a new vote flashes its row

function rowsHtml(panelKey, contestants, limit){
  const sorted = [...contestants].sort((a,b) => b.votes - a.votes || a.label.localeCompare(b.label));
  const max = Math.max(1, sorted[0].votes);
  const shown = sorted.slice(0, limit);
  const html = shown.map((c, i) => {
    const key = panelKey + ':' + c.id;
    const lead = c.votes > 0 && c.votes === sorted[0].votes;
    const pct = Math.round((c.votes / max) * 100);
    const from = prevWidth[key] ?? 0;
    const bump = prevVotes[key] !== undefined && c.votes > prevVotes[key];
    prevVotes[key] = c.votes;
    return `<li class="row${lead ? ' lead' : ''}${bump ? ' bump' : ''}${c.photo ? ' hasphoto' : ''}" data-key="${escapeHtml(key)}">
      <span class="rank">${i+1}</span>${c.photo ? `<img class="avatar" src="${escapeHtml(c.photo)}" alt="">` : ''}
      <span class="who"><b>${escapeHtml(c.label)}</b><span>${escapeHtml(c.sub)}</span>${lead ? `<span class="sticker">${CROWN}LEADING</span>` : ''}</span>
      <span class="n">${c.votes}</span>
      <span class="track"><span class="fill" style="transform:scaleX(${from / 100})" data-w="${pct}"></span></span>
    </li>`;
  }).join('');
  const more = sorted.length - shown.length;
  return { html, more };
}

function panel(panelKey, title, icon, contestants, limit){
  let body;
  if(contestants.length === 0){
    body = '<div class="empty">No entries yet.</div>';
  }else{
    const { html, more } = rowsHtml(panelKey, contestants, limit);
    body = `<ol class="rows">${html}</ol>` + (more > 0 ? `<p class="more">+${more} MORE</p>` : '');
  }
  return `<h2><svg class="icon" aria-hidden="true"><use href="#${icon}"/></svg>${escapeHtml(title)}</h2>${body}`;
}

// ---------- Best Host award ----------
// 30 seconds after the admin reveals the results, a full-screen award takes over. Drop the photo in the repo
// root as best-host.jpg; without it the award shows the crown instead.
const BEST_HOST = { title: 'Best Host', name: 'Rachel Taylor', photo: 'best-host.jpg' };
const AWARD_DELAY = 30000;
let awardFor = null;   // results_revealed_at the award is scheduled/shown for
let awardTimer = null;
let sawHidden = false; // this page watched the results go from hidden to shown

function awardEl(){
  let el = document.getElementById('award');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'award'; el.className = 'award'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${BEST_HOST.title}: ${BEST_HOST.name}`);
  el.innerHTML = `<button type="button" class="lb-x award-x" aria-label="Close">✕</button>
    <div class="award-card">
      <div class="award-kicker">SPECIAL AWARD</div>
      <h2 class="award-title">${CROWN}${escapeHtml(BEST_HOST.title)}</h2>
      <div class="award-frame"><img src="${escapeHtml(BEST_HOST.photo)}" alt="${escapeHtml(BEST_HOST.name)}"></div>
      <div class="award-name">${escapeHtml(BEST_HOST.name)}</div>
    </div>`;
  el.querySelector('img').addEventListener('error', () => el.classList.add('no-photo'));
  el.querySelector('.award-x').addEventListener('click', () => { el.hidden = true; });
  document.body.appendChild(el);
  return el;
}
function hideAward(){
  clearTimeout(awardTimer); awardTimer = null; awardFor = null;
  const el = document.getElementById('award'); if(el) el.hidden = true;
}
function syncAward(app){
  if(!app.results_visible || !app.results_revealed_at){ sawHidden = sawHidden || !app.results_visible; hideAward(); return; }
  if(awardFor === app.results_revealed_at) return; // already scheduled or shown for this reveal
  awardFor = app.results_revealed_at;
  // Watched the reveal live: count 30s from now. Otherwise (page opened or reloaded later) go by the reveal
  // time, capped at 30s in case this device's clock is off.
  const wait = sawHidden ? AWARD_DELAY
    : Math.min(AWARD_DELAY, Math.max(0, Date.parse(app.results_revealed_at) + AWARD_DELAY - Date.now()));
  awardEl(); // build now so the photo is loaded by the time it shows
  clearTimeout(awardTimer);
  awardTimer = setTimeout(() => { awardEl().hidden = false; }, wait);
}

async function loadResults(){
  let state, app;
  try{ [state, app] = await Promise.all([loadAll(), getAppState()]); }catch(e){
    if(!document.querySelector('.reel')) document.getElementById('cats').innerHTML = '<div class="empty">Could not load results. Retrying…</div>';
    return;
  }
  const catsEl = document.getElementById('cats');
  syncAward(app);
  // The admin can hide results until the reveal. (Only hidden here: vote counts are still public in the database.)
  if(!app.results_visible){
    catsEl.innerHTML = '<div class="empty reveal">Results will be revealed soon…</div>';
    [prevWidth, prevVotes].forEach(m => Object.keys(m).forEach(k => delete m[k])); // bars grow from zero at the reveal
    return;
  }
  catsEl.innerHTML = state.categories.length ? '' : '<div class="empty">No categories are set up yet.</div>';
  state.categories.forEach(cat => {
    const sec = document.createElement('section');
    sec.className = 'reel';
    sec.innerHTML = panel('cat' + cat.id, cat.name, 'i-tape', withCounts(buildContestants(cat.kind, state), cat.id, state.votes), wide.matches ? 3 : 4);
    catsEl.appendChild(sec);
  });
  // second frame: let bars animate from their previous width to the new one
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.row').forEach(row => {
      const f = row.querySelector('.fill');
      f.style.transform = `scaleX(${f.dataset.w / 100})`;
      prevWidth[row.dataset.key] = +f.dataset.w;
    });
  }));
}

let timer;
function scheduleLoad(){ clearTimeout(timer); timer = setTimeout(loadResults, 400); }
loadResults();
setInterval(loadResults, 20000); // safety net if the realtime socket drops on a long night
sb.channel('costume-contest-results')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, scheduleLoad)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, scheduleLoad)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, scheduleLoad)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'contestant_photos' }, scheduleLoad)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, scheduleLoad)
  .subscribe();
