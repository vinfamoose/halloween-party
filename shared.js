// Shared by party.html (guests), results.html, display.html and host.html.
// ---- Fill these in from your Supabase project (Settings → API) ----
const SUPABASE_URL = "https://rxcgwuduvnfycrjhvgbu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_I-eXfzk5HEwkdZ2YAHIwjw_5o8SqYDl";
// ---------------------------------------------------------------------

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Persistent storage (cookie + localStorage mirror) ----------
const COOKIE_MAX_AGE = 60*60*24*365; // 1 year
function readCookie(key){
  const m = document.cookie.split('; ').find(r => r.startsWith(key + '='));
  return m ? decodeURIComponent(m.slice(key.length + 1)) : null;
}
function readStore(key){
  let v = readCookie(key);
  if(v === null){ try{ v = localStorage.getItem(key); }catch(e){} }
  if(v !== null) writeStore(key, v); // re-sync so both copies survive
  return v;
}
function writeStore(key, value){
  document.cookie = `${key}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  try{ localStorage.setItem(key, value); }catch(e){}
}
function readJson(key){ try{ return JSON.parse(readStore(key)); }catch(e){ return null; } }

// ---------- Party state set by the admin (app_state) ----------
// Defaults apply until the migrations are run, so the pages keep working without them.
// revealed: { [categoryId]: the best place turned over so far, 3, 2 or 1 } (see placeShown below).
const APP_DEFAULTS = { reset_generation: 0, votes_generation: 0, voting_open: true, revealed: {}, award_shown: false };
async function getAppState(){
  const { data } = await sb.from('app_state').select('*').eq('id', 1).maybeSingle();
  return { ...APP_DEFAULTS, ...(data || {}) };
}

// ---------- Admin resets reaching guest devices ----------
// The admin bumps a generation number; each device remembers the last one it saw and clears its own data
// when it changes: reset_generation wipes check-in, votes and device id; votes_generation only the votes.
const VOTES_KEY = 'costume-contest-votes';
const DEVICE_KEYS = ['costume-contest-device-id', 'costume-contest-registration', VOTES_KEY];
function forget(keys){
  keys.forEach(k => {
    document.cookie = `${k}=; max-age=0; path=/; SameSite=Lax`;
    try{ localStorage.removeItem(k); }catch(e){}
  });
}
function clearDeviceData(){ forget(DEVICE_KEYS); }
// True if the generation changed since this device last looked (a first visit counts as having seen 0).
function generationChanged(key, generation){
  const gen = String(generation);
  let seen = readCookie(key);
  if(seen === null){ try{ seen = localStorage.getItem(key); }catch(e){} }
  document.cookie = `${key}=${gen}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  try{ localStorage.setItem(key, gen); }catch(e){}
  return (seen ?? '0') !== gen;
}
// Takes an app_state row (or fetches it). Resolves 'device', 'votes' or null for what was cleared.
async function applyDeviceReset(app){
  app = app || await getAppState();
  const device = generationChanged('costume-contest-reset-gen', app.reset_generation);
  const votes = generationChanged('costume-contest-votes-gen', app.votes_generation);
  if(device){ clearDeviceData(); return 'device'; }
  if(votes){ forget([VOTES_KEY]); return 'votes'; }
  return null;
}

function getDeviceId(){
  let id = readStore('costume-contest-device-id');
  if(!id){ id = 'd_' + crypto.randomUUID(); writeStore('costume-contest-device-id', id); }
  return id;
}
// { entryId, teamId, name, costume } once this device has checked in
function getRegistration(){ return readJson('costume-contest-registration'); }
function setRegistration(r){ writeStore('costume-contest-registration', JSON.stringify(r)); }
// { [categoryId]: contestantId } of votes this device has cast
function getLocalVotes(){ return readJson(VOTES_KEY) || {}; }
function setLocalVote(categoryId, contestantId){
  const v = getLocalVotes(); v[categoryId] = contestantId;
  writeStore(VOTES_KEY, JSON.stringify(v));
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

// ---------- Places for the reveal ----------
// 1st, 2nd and 3rd go to the three highest vote counts; a tie shares its place, and nobody places without a vote.
const PLACE_NAMES = ['', '1st', '2nd', '3rd'];
function withPlaces(contestants){
  const top = [...new Set(contestants.map(c => c.votes).filter(n => n > 0))].sort((a, b) => b - a).slice(0, 3);
  return contestants
    .map(c => ({ ...c, place: top.includes(c.votes) ? top.indexOf(c.votes) + 1 : null }))
    .sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label));
}
// The places a category has, best first: [1, 2, 3], or fewer when there are fewer different vote counts.
function placesOf(placed){ return [...new Set(placed.map(c => c.place).filter(Boolean))].sort(); }
// The admin turns places over from the bottom: once `shown` is 2, both 2nd and 3rd are face-up.
function placeShown(place, shown){ return shown > 0 && place >= shown; }
// What the next tap turns over: the lowest place still face-down, or null once 1st is showing.
function nextPlace(places, shown){
  const left = places.filter(p => !placeShown(p, shown));
  return left.length ? Math.max(...left) : null;
}

// Suit pip for a category: categories are dealt the four suits in order, so every screen agrees.
const SUITS = ['spade','heart','club','diamond'];
function suitPip(i){
  return `<svg class="pip${i % 2 ? ' red' : ''}" aria-hidden="true"><use href="#s-${SUITS[i % 4]}"/></svg>`;
}
