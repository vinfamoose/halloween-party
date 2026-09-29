// Shared by party.html (guests), results.html, display.html and host.html.
// ---- Fill these in from your Supabase project (Settings → API) ----
const SUPABASE_URL = "https://rxcgwuduvnfycrjhvgbu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_I-eXfzk5HEwkdZ2YAHIwjw_5o8SqYDl";
// ---------------------------------------------------------------------

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Dev Test Mode ----------
// When on, nothing is written to cookies/localStorage (except this flag itself): registration and
// votes live in memory only, and every vote gets a fresh device id, so one browser can act as many guests.
const DEV_FLAG = 'costume-contest-dev-mode';
function isDevMode(){ try{ return localStorage.getItem(DEV_FLAG) === '1'; }catch(e){ return false; } }
function setDevMode(on){ try{ on ? localStorage.setItem(DEV_FLAG, '1') : localStorage.removeItem(DEV_FLAG); }catch(e){} }
const memStore = {};

// ---------- Persistent storage (cookie + localStorage mirror) ----------
const COOKIE_MAX_AGE = 60*60*24*365; // 1 year
function readCookie(key){
  const m = document.cookie.split('; ').find(r => r.startsWith(key + '='));
  return m ? decodeURIComponent(m.slice(key.length + 1)) : null;
}
function readStore(key){
  if(isDevMode()) return key in memStore ? memStore[key] : null;
  let v = readCookie(key);
  if(v === null){ try{ v = localStorage.getItem(key); }catch(e){} }
  if(v !== null) writeStore(key, v); // re-sync so both copies survive
  return v;
}
function writeStore(key, value){
  if(isDevMode()){ memStore[key] = value; return; }
  document.cookie = `${key}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  try{ localStorage.setItem(key, value); }catch(e){}
}
function readJson(key){ try{ return JSON.parse(readStore(key)); }catch(e){ return null; } }

// ---------- Host "reset all guest devices" ----------
// The host bumps app_state.reset_generation; each device remembers the last generation it saw and wipes
// its check-in, votes and device id when the number changes. Stored outside readStore/writeStore so it
// works the same in Dev Test Mode.
const RESET_KEY = 'costume-contest-reset-gen';
const DEVICE_KEYS = ['costume-contest-device-id', 'costume-contest-registration', 'costume-contest-votes', DEV_FLAG];
function clearDeviceData(){
  DEVICE_KEYS.forEach(k => {
    document.cookie = `${k}=; max-age=0; path=/; SameSite=Lax`;
    try{ localStorage.removeItem(k); }catch(e){}
  });
  Object.keys(memStore).forEach(k => delete memStore[k]);
}
// Resolves true if this device was wiped.
async function applyDeviceReset(generation){
  if(generation == null){
    const { data } = await sb.from('app_state').select('reset_generation').eq('id', 1).maybeSingle();
    if(!data) return false; // migration not run yet
    generation = data.reset_generation;
  }
  const gen = String(generation);
  let seen = readCookie(RESET_KEY);
  if(seen === null){ try{ seen = localStorage.getItem(RESET_KEY); }catch(e){} }
  const wiped = (seen ?? '0') !== gen;
  if(wiped) clearDeviceData();
  document.cookie = `${RESET_KEY}=${gen}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  try{ localStorage.setItem(RESET_KEY, gen); }catch(e){}
  return wiped;
}

function getDeviceId(){
  if(isDevMode()) return "dev_" + crypto.randomUUID(); // fresh identity per action
  let id = readStore('costume-contest-device-id');
  if(!id){ id = 'd_' + crypto.randomUUID(); writeStore('costume-contest-device-id', id); }
  return id;
}
// { entryId, teamId, name, costume } once this device has checked in
function getRegistration(){ return readJson('costume-contest-registration'); }
function setRegistration(r){ writeStore('costume-contest-registration', JSON.stringify(r)); }
// { [categoryId]: contestantId } of votes this device has cast
function getLocalVotes(){ return readJson('costume-contest-votes') || {}; }
function setLocalVote(categoryId, contestantId){
  const v = getLocalVotes(); v[categoryId] = contestantId;
  writeStore('costume-contest-votes', JSON.stringify(v));
}
function isOwnContestant(c){
  const r = getRegistration();
  if(!r) return false;
  return (c.type === 'entry' && c.id === r.entryId) || (c.type === 'team' && r.teamId && c.id === r.teamId);
}
function normalize(s){ return s.trim().toLowerCase().replace(/\s+/g,' '); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- Photos ----------
function photoUrl(p){
  return SUPABASE_URL + '/storage/v1/object/public/photos/' + encodeURIComponent(p.path) + '?v=' + encodeURIComponent(p.updated_at || '');
}

// ---------- Shared data ----------
async function loadAll(){
  const [{data: entries}, {data: teams}, {data: categories}, {data: votes}, {data: photos}] = await Promise.all([
    sb.from('entries').select('id,name,costume,gender,team_id'),
    sb.from('teams').select('id,display_name'),
    sb.from('categories').select('id,name,kind,sort_order').order('sort_order'),
    sb.from('votes').select('device_id,category_id,entry_id,team_id'),
    sb.from('contestant_photos').select('entry_id,team_id,path,updated_at') // absent table just yields no photos
  ]);
  const photoMap = {};
  (photos||[]).forEach(p => { photoMap[(p.entry_id ? 'e_' + p.entry_id : 't_' + p.team_id)] = photoUrl(p); });
  return { entries: entries||[], teams: teams||[], categories: categories||[], votes: votes||[], photoMap };
}

function buildContestants(kind, state){
  const { entries, teams, photoMap = {} } = state;
  const teamContestants = teams.map(t => {
    const members = entries.filter(e => e.team_id === t.id);
    const size = members.length;
    return { type:'team', id:t.id, label:t.display_name, sub: members.map(m=>m.name).join(', ') + (members[0]? ' — ' + members[0].costume : ''), tag: size===2 ? 'Duo' : 'Group', size, photo: photoMap['t_'+t.id] || null };
  });
  const soloBy = g => entries.filter(e => !e.team_id && e.gender === g).map(e => ({ type:'entry', id:e.id, label:e.name, sub:e.costume, tag:null, photo: photoMap['e_'+e.id] || null }));
  if(kind==='individual_male') return soloBy('male');
  if(kind==='individual_female') return soloBy('female');
  if(kind==='duo') return teamContestants.filter(t => t.size===2);
  if(kind==='group') return teamContestants.filter(t => t.size>=3);
  return [];
}

function withCounts(contestants, categoryId, votes){
  const map = {};
  votes.filter(v => v.category_id === categoryId).forEach(v => {
    const key = v.entry_id || v.team_id;
    map[key] = (map[key]||0) + 1;
  });
  return contestants.map(c => ({ ...c, votes: map[c.id] || 0 }));
}

// Spine colour for a contestant: stable per id, so the shelf looks the same on every screen.
function spineTone(id){
  let h = 0; const s = String(id);
  for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return h % 4;
}
