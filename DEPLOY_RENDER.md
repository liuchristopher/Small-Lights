# Deploying small lights on Render

A complete walkthrough with **no terminal, no Node.js install, no Git commands**.
Total time: ~30 minutes. Monthly cost: ~$6 (database) + usage-based Anthropic API.

---

## Before you start — what you'll need

Two accounts to create (both free to sign up):
1. **GitHub** — [github.com](https://github.com) (code hosting)
2. **Render** — [render.com](https://render.com) (site + database hosting)
3. **Anthropic** — [console.anthropic.com](https://console.anthropic.com) (you may already have this)

---

## Step 1 — Put the code on GitHub (10 min, web only)

No Git install needed. We'll use GitHub's drag-and-drop uploader.

1. **Sign in** to GitHub.
2. Click the **+** in the top right → **New repository**.
3. Name it `small-lights`. Set visibility to **Private**. **Do not** check "Add a README" or "Add .gitignore". Click **Create repository**.
4. You'll land on an empty repo page. Look for the link that says **"uploading an existing file"** — click it.
5. **Unzip** `small-lights-app.zip` on your computer. You now have a folder called `small-lights-app` with about 30 files and sub-folders.
6. Open that folder. **Select all** the contents (Cmd+A / Ctrl+A) — you want the files *inside* the folder, not the folder itself.
7. **Drag and drop** them into the GitHub upload area.
8. Wait for upload to finish (10-30 seconds).
9. Scroll down, type `initial commit` in the commit message box, click **Commit changes**.

You should now see all the files on your GitHub repo page, including `render.yaml` at the top level. If you don't see `render.yaml`, the deploy won't work — re-check that you uploaded the contents and not the wrapping folder.

---

## Step 2 — Get your Anthropic API key (2 min)

1. Go to [console.anthropic.com](https://console.anthropic.com). Sign in.
2. Go to **Settings → API Keys → Create Key**. Name it `small-lights`.
3. **Copy the key** (starts with `sk-ant-...`) and paste it somewhere temporarily — you'll use it in the next step. You won't be able to see it again after closing.
4. Go to **Settings → Billing** and add a minimum of $5 credit. Moderation costs roughly $0.001 per submission, so $5 covers 5,000 submissions.

---

## Step 3 — Deploy on Render (10 min)

1. Go to [render.com](https://render.com). Click **Get Started** → sign in with GitHub. Grant Render access to your GitHub account.
2. In the Render dashboard, click **New** (top right) → **Blueprint**.
3. Render lists your GitHub repos. Find `small-lights` and click **Connect**.
4. Render reads the `render.yaml` file and shows a preview: **1 web service + 1 PostgreSQL database**. Name the Blueprint `small-lights` if asked.
5. Render will prompt for the three "sync: false" environment variables. Enter:
   - `ANTHROPIC_API_KEY` → paste your Anthropic key from Step 2
   - `ADMIN_PASSWORD` → pick any strong password. You'll use this to access `/admin`.
   - `NEXT_PUBLIC_SITE_URL` → leave as `https://small-lights.onrender.com` for now. We'll update this after first deploy to match the actual URL Render assigns.
   - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` → leave empty
6. Click **Apply** (or **Create Blueprint**).
7. Render starts provisioning. The **database** will be ready in ~1 minute. The **web service** takes 3-5 minutes to build.

While it builds, watch the logs — the build will succeed but the site will error on first load because the database tables don't exist yet. That's the next step.

---

## Step 4 — Set up the database (3 min)

1. In the Render dashboard, click your `small-lights-db` database.
2. Scroll down to **Connect**. Copy the **External Database URL**. (It's a long string starting with `postgresql://`.)
3. Still on the database page, look for a **Connect** button or **PSQL Command** section — Render provides a web-based SQL runner via **"psql Command"** or you can use an external tool.

**Easiest path — use Render's shell:**
- Click the database name, then look for the **Shell** or **Connect** tab. If Render offers a web-based SQL console, use that.

**If Render doesn't have a web SQL console, use a free online tool:**
- Go to [beekeeperstudio.io/cloud](https://www.beekeeperstudio.io/cloud) or [pgweb.dev](https://pgweb.dev), or install the free **TablePlus** or **DBeaver** desktop app.
- Paste the External Database URL to connect.

4. Once connected, open the file `scripts/schema.sql` from the zip in any text editor. Copy the entire contents.
5. Paste it into the SQL runner. Execute.
6. You should see something like `INSERT 0 25` at the end, meaning the 25 seed moments are in.

Running this file is safe to repeat — it won't duplicate data.

---

## Step 5 — Check the site (2 min)

1. In Render, click your `small-lights` web service. At the top you'll see a URL like `https://small-lights-abc1.onrender.com`.
2. Click it.
3. You should see the site with one of the seed moments displayed.
4. Try clicking **another moment** — it should cycle.
5. Try submitting a moment — about 2 seconds of moderation, then "Thank you."
6. Visit `/admin` — your browser prompts for username/password. Username is `admin`, password is what you set in Step 3.

**If the site is broken**, go back to the service page → **Logs** tab. The error almost always points at the problem (usually a typo in an env var).

---

## Step 6 — Match your site URL to the real one (2 min)

The `NEXT_PUBLIC_SITE_URL` you set in Step 3 needs to match the actual URL Render assigned.

1. Copy your actual site URL from the top of the web service page.
2. Click **Environment** in the service's left sidebar.
3. Click the edit icon next to `NEXT_PUBLIC_SITE_URL` → paste the real URL (no trailing slash).
4. Save. Render automatically redeploys in ~2 minutes.

Now share links and OG preview cards will use the correct URL.

---

## Step 7 — Custom domain (optional, 20 min + DNS wait)

If you want `smalllights.co` instead of `small-lights-abc1.onrender.com`:

1. Buy a domain — [Porkbun](https://porkbun.com) or [Namecheap](https://namecheap.com), ~$10-15/year.
2. In Render, click your web service → **Settings → Custom Domains → Add Custom Domain**. Type your domain.
3. Render shows you DNS records (usually a CNAME). At your domain registrar, open DNS settings and add the records Render specifies.
4. Wait 20 min to 24 hours for DNS to propagate. Render auto-issues SSL.
5. Once the domain is verified, go back to Environment Variables and update `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com`. Save → Render redeploys.

---

## Important things to know about Render

**Free web service sleeps after 15 min of inactivity.** First visit after a sleep takes ~30 seconds to wake up (cold start). For a low-traffic contemplative site like this, that's acceptable — but the first visitor of the day will wait.
- **To fix:** upgrade to **Starter** ($7/month) — no sleep, faster cold starts. Worth it once the site has real users.

**Database plan matters.** I set the Blueprint to use **basic-256mb** ($6/month). The truly-free Render Postgres tier **expires after 30 days** and gets deleted. Don't use the free tier for production — I'd rather you spend $6/month than lose all your moments.
- If you want to test first: open `render.yaml`, change `plan: basic-256mb` to `plan: free`, commit (via GitHub web edit). But don't forget — after 30 days you'll lose everything.

**Build time.** First deploy is 3-5 min. Subsequent deploys (from code pushes) are 2-3 min.

**Deploys happen automatically.** Any time you push to the GitHub `main` branch, Render rebuilds and deploys. For small edits — say, tuning the moderation prompt — edit the file directly on GitHub's web UI, click **Commit changes**, and Render picks it up within a minute.

---

## Ongoing costs, honest breakdown

| Item | Cost |
|---|---|
| Render web service (free, with sleeps) | $0/month |
| Render web service (Starter, recommended) | $7/month |
| Render Postgres (basic-256mb) | $6/month |
| Anthropic API (moderation) | ~$0.001/submission |
| Custom domain (optional) | ~$12/year |

Realistic minimum for a production-ready site: **$13/month + domain + Anthropic usage**.

---

## When things go wrong

**Site shows an error page.** Render service page → **Logs** tab. Recent errors are at the bottom. 90% of deploy issues are typos in env vars.

**Submissions not appearing.** Check logs around the time of submission. If you see `moderation_failed` — your Anthropic key may be wrong or out of credit.

**Admin page 401 loop.** Your browser cached a bad password. Try an incognito window.

**"cannot find module pg".** Happens if Render didn't reinstall dependencies after a code change. In Render dashboard → your service → **Manual Deploy → Clear build cache & deploy**.

**Database connection errors.** The `DATABASE_URL` env var on the web service should be auto-populated by the Blueprint from the linked database. If it's not, go to Environment Variables on the web service, edit `DATABASE_URL`, set it to the **Internal Database URL** (not External) from the database page.
