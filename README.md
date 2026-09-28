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
1. Create a new GitHub repo (public), push the repo root (`index.html`, `results.html`, `style.css`, `shared.js`).
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
- `index.html` — guests on phones: Check In and Vote.
- `results.html` — live leaderboard, phone-sized on every screen (the Results tab links here).
- `display.html` — the big projector version of the leaderboard. Open it on the TV/laptop
  (`https://…/display.html`).
- `host.html` — host-only photo studio (needs the host login, see below).
- `style.css` / `shared.js` — shared styles and Supabase/data logic. Both pages
  are plain static files, so GitHub Pages (free) hosts them as-is.

## Host photo page (`host.html`)
Photograph every guest and group; the photos show up on the voting page and the results screen.

One-time setup (Supabase dashboard):
1. Run the `20260929030000_contestant_photos.sql` migration (the GitHub integration does this on push, or paste it into the SQL Editor). It creates the `contestant_photos` table and a public-read `photos` storage bucket where only a signed-in user can write.
2. **Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".** Otherwise anyone could register themselves as a "host".
3. **Authentication → Users → Add user** with your email and a password. That is the host login.

On the night: open `https://…/host.html` on your phone, sign in, and tap a guest or group to take (or pick) their photo. "Needs photo" shows who is still missing. Photos are resized on the phone before upload, so they stay small and the free tier is plenty.

Security note: `host.html` itself is a public page, but it can't do anything without the host login — the restriction is enforced by Supabase, not by hiding the URL.
