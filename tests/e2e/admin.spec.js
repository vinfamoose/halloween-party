// The host page's Admin tab: sign-in, who gets the tools, and what they do.
const { test, expect } = require('./helpers');

const admin = { session: { user: { email: 'host@example.test' } }, admin: true };

test('signed out, the Admin tab asks you to sign in', async ({ openPage }) => {
  const page = await openPage('/host.html', { auth: { session: null, admin: true, password: 'pumpkin' } });
  await page.getByRole('tab', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();

  await page.getByLabel('Email').fill('host@example.test');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#loginMsg')).toContainText('wrong');

  await page.getByLabel('Password').fill('pumpkin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Party controls' })).toBeVisible();
});

test('a signed-in account that is not an admin gets no tools', async ({ openPage }) => {
  const page = await openPage('/host.html', { auth: { ...admin, admin: false } });
  await page.getByRole('tab', { name: 'Admin' }).click();
  await expect(page.locator('#notAdmin')).toBeVisible();
  await expect(page.locator('#adminTools')).toBeHidden();
});

test('the vote log flags suspicious votes', async ({ openPage }) => {
  const page = await openPage('/host.html', { auth: admin });
  await page.getByRole('tab', { name: 'Admin' }).click();
  await expect(page.locator('#logCount')).toContainText('3');
  await expect(page.locator('#voteLog')).toContainText('from different phones'); // Alex voted twice
});

test('the voting switch closes voting', async ({ openPage }) => {
  const page = await openPage('/host.html', { auth: admin });
  await page.getByRole('tab', { name: 'Admin' }).click();
  const sw = page.getByRole('switch', { name: 'Voting open' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => window.__TEST_DB.app_state[0].voting_open)).toBe(false);
});

test('destructive buttons need a second tap', async ({ openPage }) => {
  const page = await openPage('/host.html', { auth: admin });
  await page.getByRole('tab', { name: 'Admin' }).click();
  const btn = page.locator('#clearVotes');
  await btn.click();
  await expect(btn).toHaveText('Tap again to confirm');
  expect(await page.evaluate(() => window.__TEST_DB.votes.length)).toBe(3);
  await btn.click();
  await expect(page.locator('#toast')).toContainText('All votes cleared');
  expect(await page.evaluate(() => window.__TEST_DB.votes.length)).toBe(0);
});
