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
- **Best Overall** — not voted on directly. It's a live leaderboard summing
  each entry/team's votes across all 4 categories above, shown at the top
  of the Results tab.

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
- `display.html` — the big projector version of the leaderboard. Open it on the TV/laptop
  (`https://…/display.html`).
- `host.html` — host page: photos, add/regroup/delete guests (no login; keep the link private).
- `style.css` / `shared.js` — shared styles and Supabase/data logic. Both pages
  are plain static files, so GitHub Pages (free) hosts them as-is.

## Host page (`host.html`)
Photograph every guest and group, add people who didn't register, regroup them, or delete entries. Photos show up on the voting page and the results screens.

There is **no login**: the page uses the same public key as the guest pages, so only give its link to the host. Run the `20260929030000`, `20260929040000` and `20260929050000` migrations once (the last one grants the host page its write access). On the night, open `https://…/host.html` on your phone and tap a guest or group to take (or pick) their photo; "Needs photo" shows who is still missing. Photos are resized on the phone before upload, so the free tier is plenty.

Because there's no login, anyone who finds the link (or reads the page source) could edit the guest list. That's fine for a private party; if it ever matters, put the login back.
