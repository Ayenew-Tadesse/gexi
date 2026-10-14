# Gexi: pickup marketplace for Addis Ababa

Customers order online and pay with Chapa (Telebirr, CBE Birr, cards). Vendors drop items at the warehouse, staff check and pack them, and customers collect them at the pickup point with an SMS code. Seller agents manage vendors and listings and earn commission.

This guide assumes **no coding experience**. Follow the steps in order.

---

## 1. Install the tools (one time only)

You need three free programs.

| Program | What it is | Where to get it |
|---|---|---|
| **Node.js** (version 22 or newer, the "LTS" button) | Runs the app | https://nodejs.org |
| **PostgreSQL** (version 14 or newer) | The database | https://www.postgresql.org/download/ (Mac: [Postgres.app](https://postgresapp.com) is easiest) |
| **Git** | Downloads the code | https://git-scm.com/downloads |

> **Prefer not to install PostgreSQL?** If you have [Docker Desktop](https://www.docker.com/products/docker-desktop/), you can skip PostgreSQL and use step 3, option B instead.

To check that Node.js is installed, open a **terminal**: on Mac it's the *Terminal* app, and on Windows it's *PowerShell*. Then type:

```
node --version
```

You should see something like `v22.x.x`.

## 2. Download the code

In the terminal:

```
git clone https://github.com/ayenew-tadesse/gexi.git
cd gexi
```

Every command from now on is typed **inside this `gexi` folder**.

## 3. Create the database

**Option A: you installed PostgreSQL.** Open the PostgreSQL command line (`psql`; in Postgres.app, double-click a database) and paste these lines:

```sql
CREATE USER gexi WITH PASSWORD 'gexi' CREATEDB;
CREATE DATABASE gexi OWNER gexi;
CREATE DATABASE gexi_test OWNER gexi;
```

**Option B: you use Docker.** In the terminal:

```
docker compose up -d
```

## 4. Create your settings file

Copy the example settings file:

- Mac / Linux: `cp .env.example .env`
- Windows: `copy .env.example .env`

The defaults work for trying the app locally. `.env` holds secrets (like your Chapa key) and is **never** uploaded to GitHub.

## 5. Install and fill with sample data

```
npm install
npm run setup
```

`npm run setup` builds the database tables and adds sample agents, vendors, products and orders. You can run it again any time to **reset everything** back to the sample data.

## 6. Start the app

```
npm run dev
```

Open **http://localhost:5173** in your browser. To stop the app, press `Ctrl + C` in the terminal.

Tip: in Chrome, press `F12` → click the phone icon to see the mobile layout, and choose "Slow 3G" under *Network* to feel what it's like on a weak connection.

---

## Sample accounts

Every account uses the password **`password123`**.

| Role | Phone | Where they land |
|---|---|---|
| Admin | `0911000000` | `/admin` |
| Seller agent (Abebe) | `0911000001` | `/agent` |
| Seller agent (Hana, 6% commission) | `0911000002` | `/agent` |
| Warehouse staff | `0911000003` | `/warehouse` |
| Pickup staff | `0911000004` | `/pickup` |
| Customer (Liya) | `0911000010` | shop |
| Customer (Yonas) | `0911000011` | shop |
| Customer (Sara, prefers Amharic) | `0911000012` | shop |

You can also log in with an **SMS code** using any Ethiopian number. In development, no real SMS is sent. The code is shown on screen and printed in the terminal.

## Try the whole journey (about 5 minutes)

1. **Shop:** open http://localhost:5173, add a couple of products to the cart, and check out. Log in as Liya (`0911000010`).
2. **Pay:** you'll see a yellow **TEST PAYMENT PAGE**. Click *Pay (simulate success)*. Your order page now shows a **pickup code**.
3. **Warehouse:** in a private/incognito window, log in as `0911000003`. Under *Drop-offs*, click **Received ✓** on your items (or **Reject** one to see a refund). Then go to *To pack*, click **Mark as packed**, go to *Packed*, and click **Send to pickup point**.
4. **Pickup:** log in as `0911000004`, type the customer's pickup code, then click **Hand over order** and confirm the code.
5. **Admin:** log in as `0911000000`. Open *Payouts* and you'll see the vendor and agent money is now due. Select it and **Mark as paid**: the order becomes *Completed*. Also look at *Orders* (full history of who did what), *Reports*, *Settings* and *SMS log*.
6. **Agent:** log in as `0911000001` to add a vendor and list a product with photos.

**Testing deadlines without waiting days:** on the admin *Overview* page, the **Test tools** box moves the app's clock forward. **+2d** makes vendors miss their 48-hour drop-off window (orders get cancelled and refunded). **+8d** makes ready orders expire. **Back to real time** resets the clock.

---

## How the money works

- Every price is stored in **santim** (1 ETB = 100 santim), so totals never drift by a cent.
- Each sale is split into **vendor amount + agent commission + platform fee** (default 85% / 5% / 10%, changeable in *Admin → Settings*). An agent can have their own commission; the platform takes what's left.
- The agent's commission and the platform fee are rounded *down*, and the vendor gets the remainder, so the three parts always add up exactly.
- The split is **saved on each order item** when it's bought, so changing settings later never changes old orders.
- Payouts are created **only when the customer picks up**. The admin pays outside the app (Telebirr or bank) and marks them paid with the transfer reference.

## Order lifecycle and the edge cases

```
pending_payment → paid → awaiting_dropoff → received_at_warehouse → packed → ready_for_pickup → picked_up → completed
```

| Situation | What happens automatically |
|---|---|
| Customer doesn't finish paying within 30 min | Order cancelled, stock released |
| Item fails the quality check | Only that item is refunded. The rest of the order continues (all items fail → order cancelled) |
| Vendor misses the 48 h drop-off window | Missing items refunded. Order continues with what arrived, or is cancelled if nothing arrived |
| Customer doesn't collect within 7 days | Reminder SMS 1 day before. Then order **expired**, refund minus the expiry fee, items listed under *Warehouse → Returns* to give back to the vendor |
| Payment arrives after the order timed out | Automatic refund |

Every status change is stored with the time and the person who made it, or "System" for automatic changes. You can see this on the admin order page.

A background timer checks these deadlines every 5 minutes while the server is running.

## Payments with Chapa

During development the app uses a **fake payment page** (`PAYMENT_PROVIDER=mock`), so you can click around without a Chapa account. To use Chapa's real test mode:

1. Create an account at https://dashboard.chapa.co and copy your **test secret key** (it starts with `CHASECK_TEST-`).
2. In `.env`, set:
   ```
   PAYMENT_PROVIDER=chapa
   CHAPA_SECRET_KEY=CHASECK_TEST-xxxxxxxx
   ```
3. Restart with `npm run dev`. Checkout now opens Chapa's page, where you can use their test card or test Telebirr numbers.

Notes:
- An order is only marked paid after **our server asks Chapa directly** whether the payment succeeded. The browser and webhooks alone are never trusted.
- Webhooks (Chapa notifying us) need a public address. Locally the return page is enough. In production, set `API_PUBLIC_URL` and `CHAPA_WEBHOOK_SECRET`.
- Refunds are sent through Chapa's refund API. If that fails, the refund stays *Pending* in *Admin → Refunds* so you can do it by hand and mark it done.
- Keys live only in `.env`, never in the code.

## SMS

All messages go through one small interface (`server/src/services/sms/`). Right now the **console** provider prints messages in the terminal and saves them in *Admin → SMS log*. To use a real Ethiopian SMS gateway later, a developer adds one provider file with a `send(phone, message)` function and sets `SMS_PROVIDER` in `.env`. Message wording is in `server/src/services/sms/templates.js`, with English and Amharic.

## English and Amharic

- All screen text is in `client/src/i18n/locales/en.json` (English) and `am.json` (Amharic).
- `am.json` only contains a few starter translations. **Please have a native speaker check them.** Anything missing automatically shows in English.
- `npm run i18n:check -- --list` lists every text still waiting for an Amharic translation.
- Products and categories have separate English and Amharic names. Agents can fill in both.

## Restyling (for designers)

Everything visual comes from three files in `client/src/styles/`:

| File | What's in it |
|---|---|
| `tokens.css` | **Design tokens**: colours, font sizes, spacing, corner radius, shadows. Change these first. |
| `components.css` | Buttons, inputs, cards, status badges, tabs, tables, product grid, layouts. Uses only tokens. |
| `base.css` | Basic page and text defaults. |

The reusable React components (`Button`, `Input`, `Card`, `Badge`, `StatusBadge`, `Tabs`, `Modal`…) are all in `client/src/components/ui.jsx`. They only add class names, so restyling is CSS work. Status colours are mapped in one place (`ORDER_TONES` in `ui.jsx`).

## Speed on slow connections

- Customers download about **97 KB** of compressed JavaScript on first visit. Agent, staff and admin code is never sent to customers.
- Photos are converted to WebP in three sizes (320 / 640 / 1200 px) on upload, so phones only download the size they need. Images lazy-load.
- The cart is kept on the phone, so adding items doesn't need a connection.
- In production, files are compressed and cached by the phone for a year.
- System fonts only (no font downloads). `Noto Sans Ethiopic` covers Amharic on Android.

---

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development |
| `npm test` | Run the automated tests (money split, status changes, refunds, deadlines, permissions) |
| `npm run setup` | Reset the database to the sample data ⚠️ deletes everything |
| `npm run i18n:check` | Check translations |
| `npm run build` then `npm start` | Run the production version (needs `NODE_ENV=production`, a real `JWT_SECRET` and `PAYMENT_PROVIDER=chapa` in `.env`) |

## How the code is organised

```
gexi/
├── server/                     Express API (all business rules live here)
│   ├── src/lib/                money split, order status rules, phone numbers, clock
│   ├── src/services/           orders (lifecycle), payments, refunds, payouts, SMS, reports
│   ├── src/routes/             API addresses for each role (agent, warehouse, pickup, admin…)
│   ├── src/db/                 database tables (migrations) and sample data (seeds)
│   └── test/                   automated tests
├── client/                     React website
│   ├── src/styles/             design tokens and component styles
│   ├── src/components/         shared building blocks and layouts
│   ├── src/pages/              screens: customer/, agent/, staff/ (warehouse & pickup), admin/
│   └── src/i18n/               English and Amharic text
└── docs/PLAN.md                the original plan
```

## Changes from the original plan

- **The cart lives on the phone** (not in the database). This makes it faster on bad connections, and prices and stock are re-checked by the server at checkout.
- **Stock is reserved at checkout** (not at payment), so two people can't pay for the last item. It's released if payment isn't completed within 30 minutes.
- **Stock isn't restored** for items that failed the quality check or were never dropped off, because the agent should confirm what the vendor actually has. Items returned after an expired order **are** put back on sale.

## Known limitations / next steps

- Chapa was built against their documented API but has only been tested with the fake payment page. Test with your Chapa test key before going live.
- Payouts are marked paid by hand. Automatic transfers through Chapa can be added later.
- Dates are shown in the Gregorian calendar (Addis Ababa time). The Ethiopian calendar could be added for Amharic users.
- Vendors don't have logins (as planned). Agents manage them.
