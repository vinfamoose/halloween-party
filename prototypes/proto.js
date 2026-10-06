// Shared logic for the "Gothic Royalty" theme prototypes.
// Runs on sample data held in sessionStorage: nothing is read from or written to Supabase.
// Each prototype page sets window.THEME before loading this file.
(function(){
const T = Object.assign({
  voteLabel:'Vote', votedLabel:'Voted', ownLabel:'You',
  tabExtra:() => '', entryExtra:() => '', votedIcon:'i-check',
  qr:{ dark:'#000000', light:'#ffffff' }
}, window.THEME || {});

const qs = new URLSearchParams(location.search);
const KEY = 'gothic-royalty-proto:' + location.pathname;
if(qs.has('still')){
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{animation:none !important;transition:none !important;}.scrawl path{stroke-dashoffset:0 !important;}';
  document.head.appendChild(s);
}

// ---------- Sample data ----------
function samplePhoto(tone){
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 380'><rect width='300' height='380' fill='${tone}'/><circle cx='150' cy='138' r='58' fill='#0b0b0d'/><path d='M40 380c0-92 48-150 110-150s110 58 110 150z' fill='#0b0b0d'/><path d='M104 86l14 22 16-30 16 30 16-30 16 30 14-22-6 44h-80z' fill='#0b0b0d'/><text x='150' y='362' text-anchor='middle' font-family='Arial,sans-serif' font-size='17' font-weight='700' letter-spacing='3' fill='${tone}'>SAMPLE PHOTO</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function freshState(){
  return {
    categories:[
      { id:'c1', name:'Individual Male', kind:'individual_male' },
      { id:'c2', name:'Individual Female', kind:'individual_female' },
      { id:'c3', name:'Best Duo', kind:'duo' },
      { id:'c4', name:'Best Group', kind:'group' }
    ],
    teams:[
      { id:'t1', display_name:'The Addams Regents' },
      { id:'t2', display_name:'Ravens of the Tower' },
      { id:'t3', display_name:'Court of Bats' },
      { id:'t4', display_name:'Three Weird Sisters' }
    ],
    entries:[
      { id:'e1', name:'Dex', costume:'Vampire Prince', gender:'male', team_id:null, photo:'#8f8a99' },
      { id:'e2', name:'Tom', costume:'The Crow King', gender:'male', team_id:null },
      { id:'e3', name:'Big Mike', costume:'Plague Doctor Duke', gender:'male', team_id:null },
      { id:'e4', name:'Sam', costume:'Deposed Tsar', gender:'male', team_id:null },
      { id:'e5', name:'Priya', costume:'Queen of the Damned', gender:'female', team_id:null, photo:'#a39aa8' },
      { id:'e6', name:'Jo', costume:'Marie Antoinette, After', gender:'female', team_id:null },
      { id:'e7', name:'Niamh', costume:'Banshee Countess', gender:'female', team_id:null },
      { id:'e8', name:'Ana', costume:'Gomez & Morticia', gender:'female', team_id:'t1' },
      { id:'e9', name:'Luis', costume:'Gomez & Morticia', gender:'male', team_id:'t1' },
      { id:'e10', name:'Kit', costume:'Tower ravens in mourning', gender:'female', team_id:'t2' },
      { id:'e11', name:'Mo', costume:'Tower ravens in mourning', gender:'male', team_id:'t2' },
      { id:'e12', name:'Zed', costume:'Bat courtiers', gender:'male', team_id:'t3' },
      { id:'e13', name:'Ivy', costume:'Bat courtiers', gender:'female', team_id:'t3' },
      { id:'e14', name:'Rae', costume:'Bat courtiers', gender:'female', team_id:'t3' },
      { id:'e15', name:'Bea', costume:'Macbeth\'s witches', gender:'female', team_id:'t4' },
      { id:'e16', name:'Flo', costume:'Macbeth\'s witches', gender:'female', team_id:'t4' },
      { id:'e17', name:'Wren', costume:'Macbeth\'s witches', gender:'female', team_id:'t4' }
    ],
    reg:null, myVotes:{}, seq:100
  };
}
let state;
function load(){
  try{ state = JSON.parse(sessionStorage.getItem(KEY)); }catch(e){ state = null; }
  if(!state) state = freshState();
}
function save(){ try{ sessionStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
load();
if(qs.has('seed')){
  state = freshState();
  state.entries.push({ id:'e99', name:'Morgan', costume:'Widow Queen', gender:'female', team_id:null });
  state.reg = { entryId:'e99', teamId:null, name:'Morgan', costume:'Widow Queen' };
  state.myVotes = { c1:'e1' };
}

function normalize(s){ return s.trim().toLowerCase().replace(/\s+/g,' '); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function isOwnContestant(c){
  const r = state.reg;
  if(!r) return false;
  return (c.type === 'entry' && c.id === r.entryId) || (c.type === 'team' && r.teamId && c.id === r.teamId);
}
function buildContestants(kind){
  const { entries, teams } = state;
  const teamContestants = teams.map(t => {
    const members = entries.filter(e => e.team_id === t.id);
    const size = members.length;
    return { type:'team', id:t.id, label:t.display_name, sub: members.map(m=>m.name).join(', ') + (members[0]? ' — ' + members[0].costume : ''), tag: size===2 ? 'Duo' : 'Group', size, photo:null };
  });
  const soloBy = g => entries.filter(e => !e.team_id && e.gender === g).map(e => ({ type:'entry', id:e.id, label:e.name, sub:e.costume, tag:null, photo: e.photo ? samplePhoto(e.photo) : null }));
  if(kind==='individual_male') return soloBy('male');
  if(kind==='individual_female') return soloBy('female');
  if(kind==='duo') return teamContestants.filter(t => t.size===2);
  if(kind==='group') return teamContestants.filter(t => t.size>=3);
  return [];
}

const $ = id => document.getElementById(id);
const icon = id => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;

// ---------- Toast ----------
let toastTimer;
function toast(msg, isErr){
  const el = $('toast');
  el.textContent = msg; el.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- Tabs ----------
const tabBtns = document.querySelectorAll('.nav [data-tab]');
const panels = { register: $('register-panel'), vote: $('vote-panel') };
function showTab(name){
  tabBtns.forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('active', on); on ? b.setAttribute('aria-current','page') : b.removeAttribute('aria-current'); });
  Object.keys(panels).forEach(k => { panels[k].hidden = k !== name; });
  if(name === 'vote') renderVotePanel();
  history.replaceState(null, '', location.pathname + location.search + (name === 'vote' ? '#vote' : ''));
  window.scrollTo(0, 0);
}
tabBtns.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.querySelectorAll('.nav [data-soon]').forEach(b => b.addEventListener('click', () => toast('The results board is not part of this prototype.')));

try{
  new QRCode($('qrcode'), { text:'https://example.com/party.html', width:168, height:168, colorDark:T.qr.dark, colorLight:T.qr.light });
}catch(e){}
$('qrLink').textContent = 'Sample code. The real page link goes here.';

// ---------- Check-in ----------
const NEW_GROUP = '__new__';
function syncGroupInput(){
  const el = $('groupInput');
  el.hidden = $('groupSelect').value !== NEW_GROUP;
  if(!el.hidden) el.focus();
}
$('groupSelect').addEventListener('change', syncGroupInput);
function loadGroups(){
  const sel = $('groupSelect');
  sel.innerHTML = '';
  const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
  add('', "None — I'm solo");
  state.teams.map(t => t.display_name).sort().forEach(n => add(n, n));
  add(NEW_GROUP, '<Add New>');
}
$('registerForm').addEventListener('submit', ev => {
  ev.preventDefault();
  const name = $('nameInput').value.trim();
  const costume = $('costumeInput').value.trim();
  const gender = $('genderInput').value;
  const groupSel = $('groupSelect');
  const groupName = groupSel.value === NEW_GROUP ? $('groupInput').value.trim() : groupSel.value;
  if(!name || !costume || !gender || (groupSel.value === NEW_GROUP && !groupName)){
    $('registerMsg').textContent = 'Enter a name, a costume, a gender and, for a new group, its name.';
    return;
  }
  $('registerMsg').textContent = '';
  let teamId = null;
  if(groupName){
    let team = state.teams.find(t => normalize(t.display_name) === normalize(groupName));
    if(!team){ team = { id:'t' + (state.seq++), display_name:groupName }; state.teams.push(team); }
    teamId = team.id;
  }
  const entry = { id:'e' + (state.seq++), name, costume, gender, team_id:teamId };
  state.entries.push(entry);
  state.reg = { entryId:entry.id, teamId, name, costume };
  save();
  $('registerForm').reset(); syncGroupInput();
  showRegistrationState(); loadGroups();
  toast('Checked in. Time to vote!');
  showTab('vote');
});
function showRegistrationState(){
  const r = state.reg;
  $('registerForm').hidden = !!r;
  $('registeredCard').hidden = !r;
  if(r){
    $('registeredName').textContent = r.name;
    $('registeredText').textContent = `${r.costume}. Good luck!`;
  }
}
$('resetBtn').addEventListener('click', () => {
  state = freshState(); save(); currentCategoryId = null;
  showRegistrationState(); loadGroups(); showTab('register');
  toast('Sample data reset.');
});

// ---------- Vote panel ----------
let currentCategoryId = qs.get('cat');
let justVoted = null;
function renderVotePanel(){
  const cats = state.categories;
  if(!cats.some(c => c.id === currentCategoryId)) currentCategoryId = cats.length ? cats[0].id : null;
  renderCategoryTabs();
  const cat = cats.find(c => c.id === currentCategoryId);
  if(cat) renderVoteList(cat);
}
function renderCategoryTabs(){
  const tabsEl = $('categoryTabs');
  tabsEl.innerHTML = '';
  state.categories.forEach((cat, i) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'cat'; el.setAttribute('role','tab');
    el.setAttribute('aria-selected', cat.id === currentCategoryId ? 'true' : 'false');
    el.style.setProperty('--i', i);
    el.innerHTML = `${T.tabExtra(cat, i)}<span class="cat-name">${escapeHtml(cat.name)}</span>${state.myVotes[cat.id] ? `<span class="cat-done">${icon(T.votedIcon)}<span class="sr">voted</span></span>` : ''}`;
    el.addEventListener('click', () => { currentCategoryId = cat.id; renderCategoryTabs(); renderVoteList(cat); });
    tabsEl.appendChild(el);
  });
  const done = state.categories.filter(c => state.myVotes[c.id]).length;
  $('ballotCount').innerHTML = `<b>${done}</b> of ${state.categories.length} voted`;
}
function castVote(c, category){
  if(isOwnContestant(c)){ toast("You can't vote for yourself!", true); return false; }
  if(!state.reg){ toast('Check in first so we know who is voting.', true); return false; }
  state.myVotes[category.id] = c.id; save();
  justVoted = c.id;
  toast(`Voted for ${c.label} in ${category.name}!`);
  renderCategoryTabs(); renderVoteList(category);
  return true;
}
function renderVoteList(category){
  const listEl = $('voteList');
  const catIndex = state.categories.indexOf(category);
  const contestants = buildContestants(category.kind);
  if(contestants.length === 0){
    listEl.innerHTML = `<div class="empty">No entries eligible for ${escapeHtml(category.name)} yet.</div>`;
    return;
  }
  const myVote = state.myVotes[category.id] || null;
  listEl.innerHTML = '';
  contestants.forEach((c, i) => {
    const own = isOwnContestant(c);
    const voted = myVote === c.id;
    const row = document.createElement('div');
    row.className = 'entry' + (voted ? ' voted' : '') + (own ? ' own' : '') + (c.photo ? ' hasphoto' : '') + (justVoted === c.id ? ' just' : '');
    row.style.setProperty('--i', i);
    const info = document.createElement('button');
    info.type = 'button'; info.className = 'entry-info';
    info.setAttribute('aria-label', c.photo ? `See ${c.label}'s photo` : `Vote for ${c.label}`);
    info.innerHTML = `<span class="portrait">${c.photo ? `<img src="${c.photo}" alt="" loading="lazy">` : `<span class="mono" aria-hidden="true">${escapeHtml(c.label.trim().charAt(0).toUpperCase())}</span>`}</span>`
      + `<span class="body"><span class="name">${escapeHtml(c.label)}</span>${c.tag ? `<span class="tag">${c.tag}</span>` : ''}<span class="costume">${escapeHtml(c.sub)}</span></span>`;
    const vote = document.createElement('button');
    vote.type = 'button'; vote.className = 'entry-vote';
    vote.setAttribute('aria-pressed', voted ? 'true' : 'false');
    vote.setAttribute('aria-label', `Vote for ${c.label}`);
    vote.innerHTML = voted ? `<span class="stamp">${icon(T.votedIcon)}${T.votedLabel}</span>` : `<span class="vote-label">${own ? T.ownLabel : T.voteLabel}</span>`;
    const doVote = () => { if(!voted) castVote(c, category); };
    vote.addEventListener('click', doVote);
    // With a photo, the name/photo opens the big view; without one there's nothing to show, so it votes.
    info.addEventListener('click', () => c.photo ? openLightbox(c, category, { own, voted }) : doVote());
    row.append(info, vote);
    row.insertAdjacentHTML('beforeend', T.entryExtra(c, i, category, catIndex));
    listEl.appendChild(row);
  });
  justVoted = null;
}

// ---------- Photo view ----------
let lightboxReturn = null;
function closeLightbox(){
  $('lightbox').hidden = true;
  if(lightboxReturn){ lightboxReturn.focus(); lightboxReturn = null; }
}
function openLightbox(c, category, { own, voted }){
  lightboxReturn = document.activeElement;
  const img = new Image();
  img.src = c.photo; img.alt = `${c.label} — ${c.sub}`;
  $('lbFrame').replaceChildren(img);
  $('lbName').textContent = c.label;
  $('lbSub').textContent = c.sub;
  const btn = $('lbVote');
  btn.textContent = voted ? 'Voted' : own ? 'This is you' : `Vote in ${category.name}`;
  btn.disabled = voted || own;
  btn.onclick = () => { if(castVote(c, category)) closeLightbox(); };
  $('lightbox').hidden = false;
  $('lbClose').focus();
}
$('lbClose').addEventListener('click', closeLightbox);
$('lightbox').addEventListener('click', e => { if(e.target.id === 'lightbox') closeLightbox(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('lightbox').hidden) closeLightbox(); });

showRegistrationState();
loadGroups();
showTab(location.hash === '#vote' || state.reg ? 'vote' : 'register');
})();
