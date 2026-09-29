// The big screen: join screen before the reveal, leaderboard after it, then the Best Host award.
const { test, expect, partyData } = require('./helpers');

test('before the reveal it shows the QR code and counts, not the standings', async ({ openPage }) => {
  const page = await openPage('/display.html', { db: partyData({ results_visible: false }) });
  await expect(page.locator('h1')).toContainText('Contest');
  // The QR library draws a canvas and may swap it for an <img>; either way the box shows a drawn code.
  await expect(page.locator('#joinQr')).toBeVisible();
  await expect(page.locator('#joinQr canvas')).toHaveAttribute('width', '512');
  await expect(page.locator('#tGuests')).toHaveText('5');
  await expect(page.locator('#tVotes')).toHaveText('3');
  await expect(page.locator('.reel')).toHaveCount(0);
});

test('after the reveal it shows the leaderboard', async ({ openPage }) => {
  const page = await openPage('/display.html');
  await expect(page.locator('h1')).toContainText('Results');
  await expect(page.locator('.reel')).toHaveCount(4);
  await expect(page.locator('.intermission')).toHaveCount(0);
});

test('the Best Host award appears 30 seconds after a live reveal', async ({ page, openPage }) => {
  await page.clock.install();
  await openPage('/display.html', { db: partyData({ results_visible: false }) });
  await expect(page.locator('.intermission')).toBeVisible();

  // The admin reveals the results; the page picks it up on its next refresh.
  await page.evaluate(() => {
    Object.assign(window.__TEST_DB.app_state[0], { results_visible: true, results_revealed_at: new Date().toISOString() });
    loadResults();
  });
  await expect(page.locator('.reel')).toHaveCount(4);

  await page.clock.runFor(29_000);
  await expect(page.locator('#award')).toBeHidden();
  await page.clock.runFor(2_000);
  await expect(page.locator('#award')).toBeVisible();
  await expect(page.locator('#award')).toContainText('Rachel Taylor');
});

test('a big screen reloaded after the reveal shows the award straight away', async ({ openPage }) => {
  const revealed = new Date(Date.now() - 60_000).toISOString();
  const page = await openPage('/display.html', { db: partyData({ results_revealed_at: revealed }) });
  await expect(page.locator('#award')).toBeVisible();
});
