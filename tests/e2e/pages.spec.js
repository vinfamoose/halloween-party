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

test('printable sign-in sheet shows both steps and a QR code to the check-in page', async ({ openPage }) => {
  const page = await openPage('/sign-in.html');
  await expect(page.getByRole('heading', { name: 'Check In Your Costume' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Get Buzzed, Not Bitten' })).toBeVisible();
  // served from a local test server, so it points at the live site rather than 127.0.0.1
  await expect(page.locator('#qr')).toHaveAttribute('aria-label', 'QR code for https://vinfamoose.github.io/halloween-party/party.html');
  await expect(page.locator('#qr svg')).toBeVisible();
});

test('the bare site address goes to the check-in page', async ({ openPage }) => {
  const page = await openPage('/');
  await expect(page).toHaveURL(/\/party\.html$/);
  await expect(page.getByRole('heading', { name: 'Check in' })).toBeVisible();
});
