// The big screen: live counts before the reveal, then each category's places turned over 3rd first,
// and the Best Host award when the admin shows it.
const { test, expect, partyData, podiumData, IDS } = require('./helpers');

const male = page => page.locator('.suit', { hasText: 'Individual Male' });

test('before the reveal it shows the counts, not the standings', async ({ openPage }) => {
  const page = await openPage('/display.html');
  await expect(page.locator('h1')).toContainText('Contest');
  await expect(page.locator('#tGuests')).toHaveText('5');
  await expect(page.locator('#tVotes')).toHaveText('3');
  await expect(page.locator('.suit')).toHaveCount(0);
});

test('turning over 3rd place shows only 3rd; 2nd and 1st stay face-down', async ({ openPage }) => {
  const page = await openPage('/display.html', { db: podiumData({ revealed: { [IDS.male]: 3 } }) });
  await expect(page.locator('h1')).toContainText('Results');
  await expect(page.locator('.suit')).toHaveCount(4);
  await expect(male(page)).toContainText('Morgan');
  await expect(male(page)).not.toContainText('Sam');
  await expect(male(page)).not.toContainText('Jordan');
  await expect(male(page).locator('.row.down')).toHaveCount(2);
  // a category nobody has turned over yet is all face-down
  await expect(page.locator('.suit', { hasText: 'Best Group' }).locator('.row.down')).toHaveCount(1);
  await expect(page.locator('.suit', { hasText: 'Best Group' })).not.toContainText('Ghostbusters');
});

test('the next place turned over flips into view live', async ({ openPage }) => {
  const page = await openPage('/display.html', { db: podiumData({ revealed: { [IDS.male]: 3 } }) });
  await expect(male(page)).toContainText('Morgan');
  await page.evaluate(id => { window.__TEST_DB.app_state[0].revealed = { [id]: 2 }; loadResults(); }, IDS.male);
  await expect(male(page).locator('.row.just')).toContainText('Sam');
  await expect(male(page).locator('.row.down')).toHaveCount(1);
  await expect(male(page)).not.toContainText('Jordan');
});

test('1st place is crowned the winner', async ({ openPage }) => {
  const page = await openPage('/display.html', { db: podiumData({ revealed: { [IDS.male]: 1 } }) });
  await expect(male(page).locator('.row.down')).toHaveCount(0);
  await expect(male(page).locator('.row.place-1')).toContainText('Jordan');
  await expect(male(page).locator('.row.place-1')).toContainText('WINNER');
});

test('the Best Host award shows only while the admin has it up', async ({ openPage }) => {
  const page = await openPage('/display.html', { db: partyData() });
  await expect(page.locator('#award')).toBeHidden();
  await page.evaluate(() => { window.__TEST_DB.app_state[0].award_shown = true; loadResults(); });
  await expect(page.locator('#award')).toBeVisible();
  await expect(page.locator('#award')).toContainText('Rachel Taylor');
  await page.evaluate(() => { window.__TEST_DB.app_state[0].award_shown = false; loadResults(); });
  await expect(page.locator('#award')).toBeHidden();
});
