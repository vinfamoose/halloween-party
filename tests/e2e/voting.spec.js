// Voting on the guest page, open and closed.
const { test, expect, partyData, checkedIn } = require('./helpers');

// Each row has a Vote button on the right (the row itself also votes when there's no photo).
const voteButton = (page, name) => page.locator(`.tape-vote[aria-label="Vote for ${name}"]`);

test('a guest can vote while voting is open', async ({ openPage }) => {
  const page = await openPage('/party.html', { storage: checkedIn });
  await expect(page.locator('#votingClosed')).toBeHidden();
  await voteButton(page, 'Sam').click();
  await expect(page.locator('#toast')).toContainText('Voted for Sam');
});

test('a guest cannot vote for themselves', async ({ openPage }) => {
  const page = await openPage('/party.html', { storage: checkedIn });
  await voteButton(page, 'Jordan').click();
  await expect(page.locator('#toast')).toContainText("can't vote for yourself");
});

test('closed voting shows a notice and disables the vote buttons', async ({ openPage }) => {
  const page = await openPage('/party.html', { storage: checkedIn, db: partyData({ voting_open: false }) });
  await expect(page.locator('#votingClosed')).toBeVisible();
  await expect(voteButton(page, 'Sam')).toBeDisabled();
  await expect(voteButton(page, 'Sam')).toHaveText('Closed');
});

test('a device reset by the admin goes back to check-in', async ({ openPage }) => {
  // This phone last saw reset generation 0; the admin has since reset devices (generation 1).
  const page = await openPage('/party.html', { storage: checkedIn, db: partyData({ reset_generation: 1 }) });
  await expect(page.getByRole('heading', { name: 'Check in' })).toBeVisible();
  await expect(page.locator('#toast')).toContainText('This device has been reset');
  expect(await page.evaluate(() => localStorage.getItem('costume-contest-registration'))).toBeNull();
});
