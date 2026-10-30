// ---------- Clock (time of day, for the host screen) ----------
(function(){
  const el = document.getElementById('clock');
  const tick = () => { el.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false }); };
  tick(); setInterval(tick, 10000);
})();

const CROWN = '<svg class="icon" aria-hidden="true"><use href="#i-crown"/></svg>';

// ---------- The podium ----------
// Each category deals its top three places face-down; the admin turns them over from the Results panel,
// 3rd first. (Only hidden here: vote counts are still public in the database.)
const prevShown = {}; // category id -> best place showing at the last render, so a newly turned card flips

function podium(cat, i, state, shown){
  const placed = withPlaces(withCounts(buildContestants(cat.kind, state), cat.id, state.votes));
  const places = placesOf(placed);
  const before = prevShown[cat.id];
  prevShown[cat.id] = shown;
  let body = '<div class="empty">No votes in this category.</div>';
  if(places.length){
    body = '<ol class="rows podium">' + places.map(p => {
      if(!placeShown(p, shown))
        return `<li class="row down"><span class="rank">${PLACE_NAMES[p]}</span><span class="back"><span class="sr">Not revealed yet</span></span></li>`;
      const fresh = before !== undefined && !placeShown(p, before); // turned over since the last render
      return placed.filter(c => c.place === p).map(c => `<li class="row place-${p}${c.photo ? ' hasphoto' : ''}${fresh ? ' just' : ''}">
        <span class="rank">${PLACE_NAMES[p]}</span>${c.photo ? `<img class="avatar" src="${escapeHtml(c.photo)}" alt="">` : ''}
        <span class="who"><b>${escapeHtml(c.label)}</b><span>${escapeHtml(c.sub)}</span>${p === 1 ? `<span class="sticker">${CROWN}WINNER</span>` : ''}</span>
        <span class="n">${c.votes}</span>
      </li>`).join('');
    }).join('') + '</ol>';
  }
  return `<h2>${suitPip(i)}${escapeHtml(cat.name)}</h2>${body}`;
}

// ---------- Best Host award ----------
// A full-screen award the admin pops up with the Show Best Host button. Drop the photo in the repo
// root as best-host.jpg; without it the award shows the crown instead.
const BEST_HOST = { title: 'Best Host', name: 'Rachel Taylor', photo: 'best-host.jpg' };
let awardClosed = false; // closed on this phone; stays closed until the admin shows it again

function awardEl(){
  let el = document.getElementById('award');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'award'; el.className = 'award'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${BEST_HOST.title}: ${BEST_HOST.name}`);
  el.innerHTML = `<button type="button" class="lb-x award-x" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>
    <div class="award-card">
      <div class="award-kicker">Special award</div>
      <h2 class="award-title">${CROWN}${escapeHtml(BEST_HOST.title)}</h2>
      <div class="award-frame"><img src="${escapeHtml(BEST_HOST.photo)}" alt="${escapeHtml(BEST_HOST.name)}"></div>
      <div class="award-name">${escapeHtml(BEST_HOST.name)}</div>
    </div>`;
  el.querySelector('img').addEventListener('error', () => el.classList.add('no-photo'));
  el.querySelector('.award-x').addEventListener('click', () => { el.hidden = true; awardClosed = true; });
  document.body.appendChild(el);
  return el;
}
function syncAward(app){
  const el = awardEl(); // built up front so the photo has loaded by the time it shows
  if(!app.award_shown){ awardClosed = false; el.hidden = true; return; }
  if(!awardClosed) el.hidden = false;
}

// ---------- Big screen before the reveal ----------
// Until the first card is turned, the projector shows counts that don't give the standings away.
const isDisplay = document.body.classList.contains('display');
function intermission(catsEl, state, app){
  let el = catsEl.querySelector('.intermission');
  if(!el){
    catsEl.innerHTML = `<section class="intermission">
      <div class="tally">
        <div><span class="n" id="tGuests">0</span><span class="l">Checked in</span></div>
        <div><span class="n" id="tVotes">0</span><span class="l">Votes cast</span></div>
        <div class="status" id="tStatus"></div>
      </div>
    </section>`;
    el = catsEl.querySelector('.intermission');
  }
  document.getElementById('tGuests').textContent = state.entries.length;
  document.getElementById('tVotes').textContent = state.votes.length;
  document.getElementById('tStatus').textContent = app.voting_open ? 'Voting is open' : 'Voting closed — results coming up';
  document.getElementById('tStatus').classList.toggle('closed', !app.voting_open);
}

async function loadResults(){
  let state, app;
  try{ [state, app] = await Promise.all([loadAll(), getAppState()]); }catch(e){
    if(!document.querySelector('.suit')) document.getElementById('cats').innerHTML = '<div class="empty">Could not load results. Retrying…</div>';
    return;
  }
  const catsEl = document.getElementById('cats');
  syncAward(app);
  const revealed = app.revealed || {};
  const started = state.categories.some(cat => revealed[cat.id] > 0);
  document.querySelector('.masthead h1 .word').textContent = started ? 'Results' : 'Contest';
  if(!started){
    if(isDisplay) intermission(catsEl, state, app);
    else catsEl.innerHTML = '<div class="empty reveal">Results will be revealed soon…</div>';
    state.categories.forEach(cat => { prevShown[cat.id] = 0; }); // so the first card turned flips
    return;
  }
  catsEl.innerHTML = state.categories.length ? '' : '<div class="empty">No categories are set up yet.</div>';
  state.categories.forEach((cat, i) => {
    const sec = document.createElement('section');
    sec.className = 'suit';
    sec.innerHTML = podium(cat, i, state, revealed[cat.id] || 0);
    catsEl.appendChild(sec);
  });
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
