// Every page loads without a JavaScript error (the fixture fails the test on any page error).
const { test, expect } = require('./helpers');

test('check-in page shows the form to a new guest', async ({ openPage }) => {
  const page = await openPage('/party.html');
  await expect(page.getByRole('heading', { name: 'Check in' })).toBeVisible();
  await expect(page.locator('#registeredCard')).toBeHidden();
});

test('a checked-in guest lands on the ballot', async ({ openPage }) => {
  const page = await openPage('/party.html', { storage: require('./helpers').checkedIn });
  await expect(page.getByText('Your ballot')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Individual Male' })).toBeVisible();
});

test('results page lists every category', async ({ openPage }) => {
  const page = await openPage('/results.html');
  for(const name of ['Individual Male', 'Individual Female', 'Best Duo', 'Best Group'])
    await expect(page.getByRole('heading', { name })).toBeVisible();
});

test('host page shows the guest list', async ({ openPage }) => {
  const page = await openPage('/host.html');
  await page.getByRole('tab', { name: 'Everyone' }).click();
  await expect(page.locator('#soloList')).toContainText('Jordan');
  await expect(page.locator('#groupList')).toContainText('Ghostbusters');
});
