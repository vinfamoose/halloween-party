// Shared set-up for the browser tests: a small party's worth of data, and a page that loads it
// through the Supabase stub instead of the real project.
const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');

const STUB = fs.readFileSync(path.join(__dirname, '../fixtures/supabase-stub.js'), 'utf8');

const IDS = { male: 'cat-m', female: 'cat-f', duo: 'cat-d', group: 'cat-g' };

// Two solo guests, a three-person group and a few votes. Pass overrides for app_state as needed.
function partyData(app = {}){
  return {
    categories: [
      { id: IDS.male, name: 'Individual Male', kind: 'individual_male', sort_order: 1 },
      { id: IDS.female, name: 'Individual Female', kind: 'individual_female', sort_order: 2 },
      { id: IDS.duo, name: 'Best Duo', kind: 'duo', sort_order: 3 },
      { id: IDS.group, name: 'Best Group', kind: 'group', sort_order: 4 }
    ],
    teams: [{ id: 't1', display_name: 'Ghostbusters' }],
    entries: [
      { id: 'e1', name: 'Jordan', costume: 'Zombie', gender: 'male', team_id: null },
      { id: 'e2', name: 'Sam', costume: 'Vampire', gender: 'male', team_id: null },
      { id: 'e3', name: 'Alex', costume: 'Ghostbuster', gender: 'female', team_id: 't1' },
      { id: 'e4', name: 'Riley', costume: 'Ghostbuster', gender: 'male', team_id: 't1' },
      { id: 'e5', name: 'Kai', costume: 'Ghostbuster', gender: 'male', team_id: 't1' }
    ],
    votes: [
      { device_id: 'd_1', category_id: IDS.male, entry_id: 'e1', team_id: null, voter_entry_id: 'e3', created_at: '2026-10-31T20:00:00Z' },
      { device_id: 'd_2', category_id: IDS.male, entry_id: 'e2', team_id: null, voter_entry_id: 'e3', created_at: '2026-10-31T20:01:00Z' },
      { device_id: 'd_3', category_id: IDS.group, entry_id: null, team_id: 't1', voter_entry_id: 'e1', created_at: '2026-10-31T20:02:00Z' }
    ],
    contestant_photos: [],
    app_state: [{ id: 1, reset_generation: 0, votes_generation: 0, voting_open: true, results_visible: true, results_revealed_at: null, ...app }]
  };
}

const test = base.extend({
  // Each test gets `openPage(url, { db, auth, storage })`, which loads a page against the given data and
  // fails the test on any JavaScript error.
  openPage: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', body: STUB }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await use(async (url, { db = partyData(), auth = { session: null, admin: false }, storage = {} } = {}) => {
      await page.addInitScript(([db, auth, storage]) => {
        window.__TEST_DB = db; window.__TEST_AUTH = auth;
        try{ Object.entries(storage).forEach(([k, v]) => localStorage.setItem(k, v)); }catch(e){}
      }, [db, auth, storage]);
      await page.goto(url);
      return page;
    });
    expect(errors, 'JavaScript errors on the page').toEqual([]);
  }
});

// A guest who has already checked in as Jordan.
const checkedIn = { 'costume-contest-registration': JSON.stringify({ entryId: 'e1', teamId: null, name: 'Jordan', costume: 'Zombie' }) };

module.exports = { test, expect, partyData, checkedIn, IDS };
