// A stand-in for supabase-js, loaded in place of the CDN script during the browser tests.
// It keeps an in-memory copy of the tables (from window.__TEST_DB, set by the test before the page
// loads) and supports just the query shapes the site uses: select/insert/upsert/update/delete with
// .eq(), .order(), .single() and .maybeSingle(), plus rpc(), auth, storage and a no-op realtime channel.
(function(){
  const db = window.__TEST_DB = window.__TEST_DB || {};
  const auth = window.__TEST_AUTH = window.__TEST_AUTH || { session: null, admin: false };
  const calls = window.__TEST_CALLS = [];
  let nextId = 1;
  const authListeners = [];
  const notify = ev => authListeners.forEach(cb => cb(ev, auth.session));

  function query(table){
    const filters = [];
    let op = 'select', payload = null, conflict = null, sortCol = null, one = null;
    const rows = () => (db[table] = db[table] || []);
    const matches = r => filters.every(([c, v]) => String(r[c]) === String(v));
    function run(){
      calls.push({ table, op, payload, filters: [...filters] });
      let data = null;
      if(op === 'select'){
        data = rows().filter(matches);
        if(sortCol) data = [...data].sort((a, b) => String(a[sortCol]).localeCompare(String(b[sortCol])));
      }else if(op === 'insert' || op === 'upsert'){
        data = (Array.isArray(payload) ? payload : [payload]).map(p => {
          const keys = conflict ? conflict.split(',') : null;
          const existing = keys && rows().find(r => keys.every(k => r[k] === p[k]));
          if(existing){ Object.assign(existing, p); return existing; }
          const row = { id: 'new-' + nextId++, ...p };
          rows().push(row); return row;
        });
      }else if(op === 'update'){
        data = rows().filter(matches); data.forEach(r => Object.assign(r, payload));
      }else if(op === 'delete'){
        data = rows().filter(matches); db[table] = rows().filter(r => !matches(r));
      }
      if(one) data = data[0] || null;
      if(one === 'single' && !data) return { data: null, error: { message: 'no rows' } };
      return { data, error: null };
    }
    const q = {
      select(){ return q; },
      insert(p){ op = 'insert'; payload = p; return q; },
      upsert(p, o){ op = 'upsert'; payload = p; conflict = o && o.onConflict; return q; },
      update(p){ op = 'update'; payload = p; return q; },
      delete(){ op = 'delete'; return q; },
      eq(c, v){ filters.push([c, v]); return q; },
      order(c){ sortCol = c; return q; },
      single(){ one = 'single'; return Promise.resolve(run()); },
      maybeSingle(){ one = 'maybe'; return Promise.resolve(run()); },
      then(res, rej){ return Promise.resolve(run()).then(res, rej); }
    };
    return q;
  }

  const appState = () => (db.app_state && db.app_state[0]) || null;
  const rpcs = {
    is_admin: () => !!(auth.session && auth.admin),
    admin_set_flags: a => {
      const s = appState();
      if(a.p_results_visible === true && !s.results_visible) s.results_revealed_at = new Date().toISOString();
      if(a.p_voting_open != null) s.voting_open = a.p_voting_open;
      if(a.p_results_visible != null) s.results_visible = a.p_results_visible;
    },
    admin_clear_votes: () => { db.votes = []; appState().votes_generation++; },
    reset_guest_devices: () => ++appState().reset_generation,
    admin_start_fresh: () => { db.votes = []; db.entries = []; db.teams = []; db.contestant_photos = []; }
  };

  window.supabase = { createClient: () => ({
    from: query,
    rpc: async (name, args = {}) => {
      calls.push({ rpc: name, args });
      if(name !== 'is_admin' && !(auth.session && auth.admin)) return { data: null, error: { message: 'admin only' } };
      return { data: rpcs[name] ? rpcs[name](args) : null, error: null };
    },
    channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
    storage: { from: () => ({
      upload: async () => ({ error: null }), remove: async () => ({ error: null }), list: async () => ({ data: [], error: null })
    }) },
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      onAuthStateChange(cb){ authListeners.push(cb); return { data: { subscription: { unsubscribe(){} } } }; },
      signInWithPassword: async ({ email, password }) => {
        if(password !== auth.password) return { error: { message: 'Invalid login credentials' } };
        auth.session = { user: { email } }; notify('SIGNED_IN'); return { data: { session: auth.session }, error: null };
      },
      signOut: async () => { auth.session = null; notify('SIGNED_OUT'); return { error: null }; }
    }
  }) };
})();
