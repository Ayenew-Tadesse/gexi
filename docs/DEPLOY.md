# Putting Gexi online (Render)

This puts a **demo version** of Gexi on the internet, with its own web address you can open on any phone or share with others. It uses [Render](https://render.com), which reads the `render.yaml` file in this project and sets everything up for you: the website and the database.

The demo version:
- uses the **fake payment page** (no real money) and shows a yellow "Demo site" banner,
- shows SMS login codes on screen (no real SMS is sent),
- loads the sample accounts and products automatically the first time,
- includes the admin **Test tools** (fast-forward time).

Time needed: about 15 minutes, mostly waiting.

---

## Step 1: Create a Render account

1. Go to https://render.com and click **Get Started**.
2. Choose **Sign up with GitHub** and log in with the GitHub account that owns the `gexi` repository. This lets Render read the code.

## Step 2: Create the Blueprint

1. In the Render dashboard, click **New +** (top right) → **Blueprint**.
2. Under *Connect a repository*, find **ayenew-tadesse/gexi** and click **Connect**.
   - If you don't see it, click **Configure account** / **Configure GitHub**, give Render access to the `gexi` repository, and come back.
3. Fill in the form:
   - **Blueprint Name:** `gexi`
   - **Branch:** choose the branch that has the code. Right now that's `claude/pensive-ritchie-61wefu`, or `main` once the code has been merged there.
4. Render shows what it will create: a web service called **gexi** and a database called **gexi-db**, both on the **Free** plan in **Frankfurt**.
5. It asks for two values, **CHAPA_SECRET_KEY** and **CHAPA_WEBHOOK_SECRET**. **Leave both empty** for the demo.
6. Click **Deploy Blueprint** (or **Apply**).

## Step 3: Wait for the first deploy

1. Click the **gexi** service. The **Logs** tab shows progress. The first deploy takes about 5–10 minutes.
2. It's ready when the logs show:
   ```
   ✅ Sample data ready. All passwords: password123
   ✅ Gexi API running …   DEMO MODE
   ```
   and the status at the top says **Live**.
3. Your web address is shown at the top of the page, e.g. `https://gexi.onrender.com` (Render may add some letters if the name is taken). Open it.

Log in with the sample accounts from the README (password `password123`, e.g. admin `0911000000`).

---

## Good to know about the free plan

- **It falls asleep** after 15 minutes without visitors. The next visit takes about a minute to wake it up, then it's fast again. Deadline checks (missed drop-offs, expiry) run while it's awake. Paid plans (from about $7/month) stay awake.
- **The free database is deleted after 30 days.** Render emails you before that. To keep your data, upgrade the database to a paid plan in the Render dashboard (*gexi-db → Upgrade*). If you're happy to start fresh, delete it and create the Blueprint again.
- **Updates go live automatically.** Every time new code is pushed to the chosen branch, Render rebuilds the site within a few minutes.
- Photos are stored in the database, so they survive restarts.

## Resetting the demo data

The sample data is only loaded when the database is empty. To start over: in Render, open **gexi-db** → **Delete Database**, then sync the Blueprint again (*Blueprints → gexi → Manual Sync*). This creates an empty database, and the site reloads the sample data on its next start.

---

## Turning the demo into the real shop (later)

Do this only when you're ready for real customers and real money.

1. In Render, open the **gexi** service → **Environment**.
2. Change these values:
   | Key | New value |
   |---|---|
   | `DEMO_MODE` | `false` |
   | `PAYMENT_PROVIDER` | `chapa` |
   | `CHAPA_SECRET_KEY` | your Chapa **live** secret key (from the Chapa dashboard) |
   | `CHAPA_WEBHOOK_SECRET` | the webhook secret you set in the Chapa dashboard |
   | `API_PUBLIC_URL` | your site address, e.g. `https://gexi.onrender.com` (lets Chapa notify the site of payments) |
3. Click **Save Changes**. Render restarts the site.
4. Replace the sample data with your real accounts. Ask a developer, or me, to help with this step: the sample accounts all share a known password and must be removed.
5. Before launch, also connect a real SMS provider and a custom domain (e.g. `gexi.et`): *Settings → Custom Domains* in Render.

The site **refuses to start** without a Chapa key when demo mode is off. That protects you from accidentally running the real shop with the fake payment page.
