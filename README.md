# Costume Contest — GitHub Pages + Supabase (multi-category)

## 1. Set up Supabase
1. Go to supabase.com → New project (free tier is fine).
2. Open **SQL Editor** → paste in `supabase-schema.sql` → Run.
   This creates `teams`, `entries`, `categories` (seeded with the 4 votable
   categories), and `votes`.
3. Go to **Settings → API** → copy the **Project URL** and the **anon public key**.

## 2. Wire up the frontend
1. Open `shared.js` (the Supabase URL and key live there).
2. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` near the top of the `<script>` block.

## 3. Deploy to GitHub Pages
1. Create a new GitHub repo (public), push the whole repo root (`party.html`, `results.html`, `display.html`, `host.html`, `style.css`, `shared.js`, `results.js`).
2. Repo → **Settings → Pages** → Source: `main` branch, `/ (root)` → Save.
3. Your live URL: `https://yourusername.github.io/repo-name/`.

## How the categories work
- **Best Individual** — anyone who checked in without a group name.
- **Best Couples Costume** — automatically populated by any group name exactly
  2 people used.
- **Best Group Costume** — any group name 3+ people used.
- **Most Phoned In** — open to everyone, solo or grouped.

## Changing the categories later
Edit the `insert into categories (...)` rows in the schema (or update the
table directly in the Supabase Table Editor) — the app reads categories
from the database, so adding, renaming, or reordering them there is enough;
no code changes needed unless you introduce a new `kind` beyond
`individual` / `couples` / `group` / `open`.

## Notes
- Group matching is on trimmed, lowercased text — "Ghostbusters Crew" and
  "ghostbusters crew" link to the same team; genuinely different spellings
  ("Ghost Busters") will create a second team.
- One vote per device per category, enforced by a `(device_id, category_id)`
  primary key on `votes` and a device id stored in the browser's `localStorage`.

## Pages
- `party.html` — guests on phones: Check In and Vote.
- `results.html` — live leaderboard, phone-sized on every screen (the Results tab links here).
- `display.html` — the big projector screen. Open it on the TV/laptop (`https://…/display.html`).
  While results are hidden it shows a QR code to check in & vote, how many have checked in and voted, and
  whether voting is open; at the reveal it becomes the leaderboard.
- `host.html` — host page: photos, add/regroup/delete guests (no login; keep the link private).
- `style.css` / `shared.js` — shared styles and Supabase/data logic. Both pages
  are plain static files, so GitHub Pages (free) hosts them as-is.

## Host page (`host.html`)
Photograph every guest and group, add people who didn't register, regroup them, or delete entries. Photos show up on the voting page and the results screens.

There is **no login**: the page uses the same public key as the guest pages, so only give its link to the host. Run the `20260929030000`, `20260929040000` and `20260929050000` migrations once (the last one grants the host page its write access). On the night, open `https://…/host.html` on your phone and tap a guest or group to take (or pick) their photo; "Needs photo" shows who is still missing. Photos are resized on the phone before upload, so the free tier is plenty.

### Admin tab
The host page's **Admin** tab needs a sign-in; the Photos & guests tab stays open. To set it up once:
1. Run the `20260929060000_device_reset`, `20260929070000_admin`, `20260929080000_admin_controls` and
   `20260929090000_results_revealed_at` migrations.
2. Supabase → **Authentication → Users → Add user** (email + password) for yourself, and turn off
   **Allow new users to sign up** (Authentication → Sign In / Providers).
3. SQL Editor: `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`

What's in it (every action is also checked in the database, so only accounts in `admins` can run them):
- **Voting open** switch: when off, guests see "Voting is closed" and the database rejects new or changed votes.
- **Results visible** switch: when off, the phone results page shows "Results will be revealed soon…" and the
  big screen shows the check-in QR code and live counts instead of the standings.
  This only hides them on those pages; vote counts are still readable from the database with the public key.
  **30 seconds after you switch it back on**, both results pages are taken over by a full-screen
  **Best Host** award. Name and title are at the top of `results.js` (`BEST_HOST`); put the photo in the repo
  root as `best-host.jpg` (portrait works best). Without the photo the award shows a crown instead. Guests can
  close it on their phones; the big screen keeps it up. Switching results off again takes it down.
- **Vote log**: every vote by category. Flags a guest who voted more than once in a category from different
  phones, votes cast in Dev Test Mode, and anyone who voted for themselves or their own group.
- **Clear all votes**: deletes every vote but keeps guests and photos; phones forget their votes so everyone can vote again.
- **Reset all guest devices**: every guest phone forgets its check-in, votes and Dev Test Mode, as if its
  cookies were cleared. Open pages reset instantly; closed ones the next time they're opened. Nothing online is deleted.
- **Start fresh**: after a test run, deletes every guest, group, vote and photo and resets every guest device.
  Categories and the two switches are left as they are.

Because there's no login, anyone who finds the link (or reads the page source) could edit the guest list. That's fine for a private party; if it ever matters, put the login back.

## CI (GitHub Actions)
Every pull request runs `.github/workflows/ci.yml`, which has two jobs:

- **Database migrations**: starts a throwaway Supabase database, creates the original tables from
  `supabase/ci/baseline.sql`, applies every migration in order, then runs `supabase/ci/smoke_test.sql` to check
  that guests can check in and vote, that only admins can use the admin controls, and that closed voting really is
  closed. The run's summary page lists every migration and whether it applied.
- **Front-end tests**: Playwright opens the pages in a headless browser (phone-sized, plus a 1920×1080 big
  screen for `display.html`) against a fake Supabase client (`tests/fixtures/supabase-stub.js`), and fails on any
  JavaScript error or broken behaviour: voting open/closed, device reset, the reveal and Best Host award timing,
  admin sign-in and tools. The HTML report (screenshots and traces of any failures) is attached to each run.

Neither job touches the real project. To run the browser tests yourself: `cd tests && npm ci && npx playwright install chromium && npx playwright test`.

### Making the checks required
A red check is only a warning until `main` is protected. `.github/rulesets/protect-main.json` is a ready-made
ruleset: in GitHub go to **Settings → Rules → Rulesets → New ruleset → Import a ruleset** and pick that file. It:
- requires changes to `main` to go through a pull request (no approvals needed, since it's a one-person repo),
- requires **Database migrations** and **Front-end tests** to pass before merging,
- blocks force-pushes and deleting `main`,
- lets repository admins bypass it only when merging a pull request (an emergency override), not by pushing straight to `main`.

## Deploy pipeline
`.github/workflows/deploy.yml` runs on every push to `main` (so, every merged PR), one stage at a time:

1. **CI**: the same two checks as a pull request (`ci.yml`).
2. **Apply migrations to Supabase**: links the real project, prints which migrations production already
   has and which this deploy will apply, then runs `supabase db push`.
3. **Publish to GitHub Pages**: copies only the site files (`*.html`, `*.css`, `*.js`, `best-host.jpg`)
   and deploys them.

Each stage runs only if the previous one passed, and the database always goes first, so new pages never go
live before the tables they need. Only one deploy runs at a time. You can also start one by hand from the
Actions tab (**Deploy → Run workflow**).

One-off setup:
1. **Settings → Pages → Build and deployment → Source: GitHub Actions** (instead of "Deploy from a branch").
2. **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - `SUPABASE_ACCESS_TOKEN`: create one at supabase.com → Account → Access Tokens.
   - `SUPABASE_DB_PASSWORD`: your database password (Supabase → Project Settings → Database; reset it there if you don't have it).
3. **Supabase → Project Settings → Integrations → GitHub**: turn off **Deploy to production**, so this
   workflow is the only thing applying migrations.

Until the secrets are set, the migrations stage fails with a message saying so, and the site isn't published
by this workflow. On the first run, check the "Show which migrations production already has" step: every
migration already applied should appear in the Remote column.
