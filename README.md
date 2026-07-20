# NFCPlantApp

# NFC Plant Tracker

Tap an NFC tag on a plant pot, log that you watered it, check a dashboard
of all your plants. No app store, no backend server — just static files,
Supabase, and Vercel.

## Files

- `index.html` — the log page. Reads `?plant=` from the URL and logs a
  watering for that plant.
- `dashboard.html` — overview of every plant: last watered, streak,
  total waterings, and a recent-activity feed.
- `config.js` — Supabase connection, plant ID handling, and the shared
  math (streaks, relative time). Edit this file to point at your project.
- `styles.css` — shared styles for both pages.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then run this
in the SQL editor:

```sql
create table watering_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  plant_id text
);

alter table watering_logs enable row level security;

create policy "Allow public inserts"
on watering_logs for insert
to anon
with check (true);

create policy "Allow public reads"
on watering_logs for select
to anon
using (true);
```

These policies allow anyone with the anon key to read and write this
table — fine for a proof of concept, not something to keep once this
holds real user data. See "Locking it down" below.

Grab your **Project URL** and **anon public key** from
Project Settings → API, and paste them into the top of `config.js`.

### 2. Deploy

Push this folder to a GitHub repo, then import it into
[vercel.com](https://vercel.com) as a new project. No build command
needed — it's static files. You'll get a URL like
`your-project.vercel.app`.

### 3. Encode the NFC tags

Use an app like NFC Tools to write a URL to each tag:

```
https://your-project.vercel.app/?plant=fiddle_leaf
```

One page, many links — give each plant's tag a different `?plant=`
value. That value becomes the `plant_id` in the database and the name
shown on both pages.

## How plant identity works

There's no plant picker in the UI. The `?plant=` query parameter *is*
the plant selection — it's decided by which physical tag someone tapped,
not by anything chosen on screen. `config.js` sanitizes it (lowercase,
alphanumeric + underscore/hyphen only, 40 char max) before it touches
the database, so a malformed or missing value falls back to `plant_01`
rather than breaking anything.

## Known limitations (by design, for now)

- **No auth.** Anyone with the link can log a watering or read the
  dashboard. Fine for personal use, not for anything public-facing.
- **No manual plant picker.** If someone opens the site without a
  `?plant=` param, it silently defaults to `plant_01`. Fine for tag-only
  use; would need a dropdown fallback for browser-only use.
- **Single global watering interval.** `WATER_INTERVAL_DAYS` in
  `config.js` applies to every plant. Different species want different
  schedules.
- **Dashboard doesn't auto-refresh.** It fetches once on load; there's
  a manual refresh button but no polling or realtime subscription.

## Where this could go next

Roughly in order of effort:

1. **`plants` table** — map `plant_id` to a friendly name, photo, and
   per-plant watering interval instead of a single global default.
2. **Realtime dashboard** — Supabase supports realtime subscriptions;
   the dashboard could update live instead of needing a manual refresh.
3. **Manual plant picker** — a dropdown on the log page as a fallback
   for anyone arriving without a `?plant=` param (testing, sharing the
   link, browser bookmarks).
4. **Push notifications / streak reminders** — the original vision from
   the project brief. Needs a real app shell (the React Native app
   mentioned in scope) or a service worker + Web Push, since a static
   page can't notify a phone that isn't open.
5. **Locking it down** — once this isn't just personal-use, move off
   fully public RLS policies. Options: Supabase Auth (magic link or
   OAuth) scoped so each user only sees their own plants, or at minimum
   a per-household shared secret in the insert policy.
6. **Duplicate-tap protection** — right now nothing stops the same tag
   being logged twice in a row beyond the 3-second button cooldown. A
   database-side check (e.g. reject inserts within N minutes of the
   last one for that `plant_id`) would be more robust than relying on
   the client.
