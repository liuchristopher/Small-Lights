# small lights

A quiet place. Anonymous moments of peace, beauty, and small joy — to read on a hard day.

Built with Next.js 14 (App Router), PostgreSQL, Claude for moderation.

---

## Deploying this site

- **No terminal / no dev experience:** follow [`DEPLOY_RENDER.md`](./DEPLOY_RENDER.md). Takes ~30 minutes, costs ~$13/month. This is the recommended path.
- **Local dev and/or Vercel deploy:** follow the rest of this README. Requires Node.js, Git, and command-line comfort.

---

## What's here

- **Homepage** (`/`) shows one random moment at a time.
- **Per-moment pages** (`/m/[id]`) each have their own Open Graph share card, so links preview beautifully in DMs and social apps.
- **Submission** goes through a Claude-based moderator. Three outcomes:
  - **approve** → stored as `live`, appears in rotation
  - **reject** → stored as `rejected` (still counts toward rate limit) and the user sees "Thank you" anyway, so spammers can't probe the filter and false-positives don't wound sincere submitters
  - **crisis** → nothing is stored; the user is shown a warm screen with 988 / Samaritans / findahelpline.com
- **Rate limiting** is IP-hashed (never stores raw IPs): 2-minute cooldown, 5 per 24h.
- **Reporting** a moment adds a flag. At 3 flags the moment auto-hides from rotation.
- **Save** is client-side via `localStorage` (no accounts). Saved moments persist per-browser and include the text, so the user can re-read even if the moment is later hidden.
- **Admin** review queue at `/admin` (HTTP basic auth). Lists flagged/hidden/removed moments with restore/hide/remove controls.
- **Analytics** via Plausible (optional) — set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to enable.

---

## Requirements

- Node 20+
- A Neon (or any Postgres) database
- An Anthropic API key
- A Vercel account for deploy

---

## Local setup

```bash
pnpm install   # or npm install / yarn install
cp .env.example .env.local
```

Fill in `.env.local`:

```
DATABASE_URL=postgresql://...                          # from Neon dashboard
ANTHROPIC_API_KEY=sk-ant-...                           # from console.anthropic.com
HASH_SECRET=$(openssl rand -hex 32)                    # any long random string
ADMIN_PASSWORD=pick-a-strong-passphrase
NEXT_PUBLIC_SITE_URL=http://localhost:3000             # or your domain in prod
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=                          # leave empty for local
```

Create the database schema and seed moments:

```bash
psql $DATABASE_URL -f scripts/schema.sql
```

This creates tables, the flag-count trigger, and inserts 20 seed moments. The file is idempotent — safe to re-run.

Run the dev server:

```bash
pnpm dev
```

Visit `http://localhost:3000`. Admin: `http://localhost:3000/admin` (username `admin`, password from env).

---

## Deploy to Vercel

1. **Push to GitHub.** Create a new private repo and push this directory.
2. **Create a Neon project.** Copy the pooled connection string — it works on Vercel's serverless functions and on the Edge runtime for OG image generation.
3. **Import the repo into Vercel.** Framework preset is auto-detected.
4. **Set environment variables** in Vercel project settings (all five from `.env.example`). Set `NEXT_PUBLIC_SITE_URL` to your production domain (e.g. `https://smalllights.co`).
5. **Run the schema** against the Neon database:
   ```bash
   psql $DATABASE_URL -f scripts/schema.sql
   ```
   (Run locally against the production `DATABASE_URL`, or paste the SQL into the Neon console.)
6. **Deploy.** Vercel will build and serve.
7. **Point your domain** at Vercel. Once DNS propagates, update `NEXT_PUBLIC_SITE_URL` and redeploy so share links and OG URLs match.

### Post-deploy sanity checks

- Homepage loads and shows a moment
- "another moment" cycles to different moments
- Submit a test moment → appears as current
- Submit clearly spammy text → user still sees "Thank you", but nothing new appears in rotation (check the database: `select status, text from moments order by created_at desc limit 5`)
- Submit crisis-worded text → crisis screen shows
- Click "report" → moment rotates; confirm flag appears in `flags` table
- `/admin` → basic-auth prompt, then list renders
- Paste a `/m/[id]` URL into a Twitter composer or iMessage — the OG card should render the moment text on the cream background

---

## Operations

**Moderation review.** For the first month, spot-check once a week:

```sql
-- last 50 Claude decisions
select created_at, status, moderation_decision, left(text, 80) as preview
from moments
order by created_at desc limit 50;

-- all crisis-flagged submissions (we don't store text for these — they're never inserted —
-- but you'll want to watch moderation logs if you add them later)
```

If you see false positives in `rejected`, tune the system prompt in `lib/moderation.ts`. If you see false negatives (garbage in `live`), the admin queue lets users flag their way to hidden.

**Threshold tuning.** `FLAG_THRESHOLD = 3` is in `scripts/schema.sql` (inside `update_flag_count()`). If your audience is larger or the base rate of bad-faith flags is higher, raise it.

**Rate limits** are in `lib/rate-limit.ts`: 2-minute cooldown, 5 per 24h. Adjust if abuse or legitimate engagement patterns call for it.

---

## Architecture notes & known tradeoffs

- **`force-dynamic` on `/` and `/m/[id]`**: the homepage picks a random moment server-side on every request. If traffic grows, this becomes a lot of `order by random()` — switch to a materialized random pool or a cached-for-10-seconds approach.
- **`order by random() limit 1`** is fine up to ~50k rows. Past that, use `tablesample system_rows(1)` or pre-compute a rotating index.
- **Saves use `localStorage`**: this means clearing browser data loses saved moments. A "copy all" button on the saved view is the escape hatch. Adding accounts later would move this server-side.
- **Flag dedup by IP hash**: someone behind CGNAT might be unable to flag a moment another person on their network already flagged. This is a deliberate tradeoff against abuse; the alternative (no dedup) is worse.
- **Edge runtime for OG images**: requires Neon's serverless driver (which we use). If you swap databases, pick one with Edge support or switch the OG routes to `runtime = 'nodejs'`.
- **HASH_SECRET rotation**: rotating this invalidates all existing rate-limit and flag-dedup state. Only rotate if compromised.
- **No account system**: this is a feature, not a bug. Accounts would change the emotional tone of the site entirely.

---

## Roadmap ideas (not built)

- An RSS feed of new approved moments (great for people who want a drip of them)
- Email subscriptions: "one moment in your inbox each morning"
- A "send this to someone" flow that pre-fills an SMS/email with a gentle note + link
- Per-moment backgrounds (subtle color shift based on time of day)
- A global reset button in the admin ("enter vacation mode": all new submissions queued for manual review)
