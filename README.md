# Costume Contest — GitHub Pages + Supabase (multi-category)

## 1. Set up Supabase
1. Go to supabase.com → New project (free tier is fine).
2. Open **SQL Editor** → paste in `supabase-schema.sql` → Run.
   This creates `teams`, `entries`, `categories` (seeded with the 4 votable
   categories), and `votes`.
3. Go to **Settings → API** → copy the **Project URL** and the **anon public key**.

## 2. Wire up the frontend
1. Open `index.html`.
2. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` near the top of the `<script>` block.

## 3. Deploy to GitHub Pages
1. Create a new GitHub repo (public), push `index.html` to the root.
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
