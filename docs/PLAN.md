# Marketplace Build Plan (draft for approval)

Pickup-only marketplace for Addis Ababa. This document covers the database, pages per role,
API endpoints, and the build order. Nothing is built yet. The plan waits for your approval.

---

## 1. How the pieces fit together (plain language)

```
 Phone browser ──► React app (the screens) ──► Express API (the rules) ──► PostgreSQL (the records)
                                                   │
                                                   ├──► Chapa (payments, test mode)
                                                   ├──► SMS sender (console log for now)
                                                   └──► Background timer (expiry checks every few minutes)
```

- **React app** is everything people see and tap. It holds no business rules.
- **Express API** holds every rule: who can do what, which status can follow which, and how money is split.
  Keeping the rules in one place means the screens can be redesigned freely without breaking anything.
- **PostgreSQL** stores the data.
- **Background timer** finds orders whose drop-off window or pickup window has run out and handles them
  (cancel and refund, or expire), and sends reminder SMS.

### Folder layout (one repository, two parts)
```
gexi/
  server/      Express API, database migrations, seed data, tests
  client/      React app (Vite), design tokens, components, translations
  docs/        This plan and other notes
  README.md    Step-by-step "how to run it" for non-developers
```

---

## 2. Tech stack decision: React + Express, or Next.js?

You asked me to flag it if something simpler exists. Here is the honest tradeoff.

| | **React + Express (what you asked for)** | **Next.js (alternative)** |
|---|---|---|
| Number of apps to run | Two (client and server), started with one command | One |
| First page load on slow 3G | Good, if we keep the JavaScript small (we will set a size budget) | Better: pages arrive already built from the server |
| How predictable it is to maintain | Very. A widely known, stable setup with few surprises | More "magic" (caching, server vs. client components), which confuses even experienced developers |
| Hiring a developer later | Very easy | Easy |
| Adding a mobile app later | Easy: the API is already separate | Possible, but needs extra work |

**My recommendation: stay with React + Express.** It's the most predictable choice for someone who will
hand the code to other developers. I'll protect speed on customer pages with these rules:
- Customer pages load in their own small bundle. Agent, staff, and admin code is never downloaded by customers.
- JavaScript budget for customer pages: about 100 KB compressed.
- Images are resized and converted to WebP on upload (small, medium, large), lazy-loaded, with fixed dimensions.
- Text compression (gzip/brotli) and long browser caching for static files.

If first-load speed on very poor connections matters more to you than predictability, choose Next.js and I'll adapt the plan.

Other tooling (small, standard choices):
- **Vite** builds the React app. **react-router** handles pages. **i18next** handles English and Amharic.
- **Plain CSS with CSS variables** for design tokens (no heavy UI library), so restyling to your designs is easy.
- **Knex** for database migrations and queries (readable SQL, no heavy ORM).
- **Zod** validates every request.
- **Vitest + Supertest** for tests.
- **Docker Compose** (optional) runs PostgreSQL with one command. The README also covers a free hosted database
  as a no-install option.

---

## 3. Key rules and decisions (please read; these shape everything)

1. **Money is stored as whole santim (1 ETB = 100 santim)**, never as decimals, so totals never drift by a cent.
2. **The split percentages are copied onto each order item when it's paid.** If the admin changes the
   commission next month, old orders keep the percentages they were sold with.
   Rounding rule: agent commission and platform fee are rounded down to the santim, and the vendor gets the remainder,
   so the three parts always add up exactly to the price.
3. **Who sets the agent's commission?** One global default (for example vendor 85%, agent 5%, platform 10%),
   with an optional per-agent override set by the admin.
4. **Orders with items from several vendors.** A customer can buy from several vendors in one order, with
   one payment and one pickup code. Drop-off and the quality check happen **per item**:
   - If one item fails the check or is never dropped off, **only that item** is cancelled and refunded.
     The rest of the order continues.
   - If every item fails, the whole order is cancelled.
   - (A simpler alternative is "any problem cancels the whole order." Tell me if you prefer that.)
5. **Stock.** Each product has a quantity. It's reserved when the customer pays and released on cancel or expiry.
6. **Pickup code.** A random 6-digit code, unique among open orders. Pickup staff can find the order by code or by phone,
   but **handover always requires the code** (protects against someone claiming another person's order).
7. **"Completed" status.** An order becomes `completed` once it has been picked up **and** the vendor and
   agent payouts are marked as paid. Until then it stays `picked_up`.
8. **Payouts** are created automatically when an order is picked up, with status "due". In this first version
   the admin pays them outside the app (Telebirr or a bank transfer) and marks them "paid" with a reference.
   Automatic payouts through Chapa can come later.
9. **Refunds** are recorded in a refunds table. We call Chapa's refund API where it's available in test mode.
   Otherwise the refund is flagged for the admin to complete by hand and mark as done. Either way, every refund is tracked.
10. **Expiry fee.** If a customer doesn't collect in time (default 7 days), they're refunded minus a
    configurable fee (default 0 ETB), and the item is marked "return to vendor."
11. **Logins.** Phone number in +251 format (we accept `09...`, `9...`, or `+2519...` and store `+2519...`).
    Customers can sign up themselves and log in with a password **or** a one-time SMS code.
    Agents and staff accounts are created by the admin. A signed-in session lasts 30 days on the customer's phone.
12. **Every status change is logged** with the time, the person (or "system" for the background timer), and a note.

---

## 4. Database tables

| Table | What it holds | Key columns |
|---|---|---|
| `users` | Everyone who logs in | id, phone (unique), name, password_hash, role (`customer`/`agent`/`warehouse`/`pickup`/`admin`), preferred_language, is_active |
| `otp_codes` | One-time SMS login codes | phone, code_hash, expires_at, attempts, used_at |
| `agent_profiles` | Extra agent details | user_id, commission_override_pct (optional), payout_method, payout_account |
| `vendors` | Vendor profiles (no login) | id, agent_id, name, phone, location_description, payout_method, payout_account, is_active |
| `categories` | Product categories | id, name_en, name_am, slug, sort_order |
| `products` | Listings | id, vendor_id, agent_id, category_id, title_en, title_am, description_en, description_am, price_santim, stock_qty, status (`draft`/`active`/`hidden`) |
| `product_images` | Photos | id, product_id, small_url, medium_url, large_url, sort_order |
| `carts`, `cart_items` | The customer's cart (saved on the server so it survives a lost connection) | user_id, product_id, quantity |
| `orders` | One per checkout | id, order_number, customer_id, status, total_santim, pickup_code, paid_at, dropoff_deadline, pickup_deadline, picked_up_at |
| `order_items` | One line per product | id, order_id, product_id, vendor_id, agent_id, qty, unit_price_santim, vendor_amount, agent_commission, platform_fee, item_status (`awaiting_dropoff`/`received`/`rejected`/`missed_dropoff`/`returned_to_vendor`), rejection_reason |
| `order_status_history` | The audit log | order_id, order_item_id (optional), from_status, to_status, changed_by (user or null for "system"), note, created_at |
| `payments` | Chapa transactions | order_id, tx_ref (unique), amount_santim, status, chapa_reference, raw_response, verified_at |
| `refunds` | Money returned to customers | order_id, order_item_id (optional), amount_santim, reason, status (`pending`/`processed`/`failed`), processed_by |
| `payouts` | Money owed to vendors and agents | payee_type (`vendor`/`agent`), payee_id, order_item_id, amount_santim, status (`due`/`paid`), paid_at, reference, paid_by |
| `settings` | Admin-configurable values | key/value: split percentages, dropoff_window_hours (48), pickup_window_days (7), expiry_fee_santim, pickup location text and hours |
| `sms_log` | Every SMS "sent" (also the dev console log) | to_phone, template, message, status, provider, created_at |

---

## 5. Order lifecycle (what the system enforces)

```
pending_payment ─(Chapa confirms)─► paid ─(auto: vendor SMS sent)─► awaiting_dropoff
   │                                                                     │
   └─(no payment in 30 min)─► cancelled                                  ├─(all remaining items received)─► received_at_warehouse
                                                                         └─(deadline passes, nothing received)─► cancelled + refund

received_at_warehouse ─(staff)─► packed ─(staff moves it to pickup point)─► ready_for_pickup ─(code confirmed)─► picked_up ─(payouts paid)─► completed
                                                                               │
                                                                               └─(7 days pass)─► expired + refund minus fee + return to vendor
```

- Only allowed moves are possible. For example, you can't mark an order "packed" before it's been received.
  This is a single, well-tested "state machine" file on the server.
- The customer's "ready for pickup" SMS (with the code) goes out when the order reaches `ready_for_pickup`.
- A reminder SMS goes out 1 day before pickup expiry.

---

## 6. Pages per role

**Customer** (mobile-first, smallest possible pages)
- Home: categories and featured products
- Search and category list (with simple filters: category, price)
- Product detail
- Cart
- Checkout: review, then pay with Chapa, then a return page showing "Payment confirmed"
- My orders (list) and order detail with a status timeline and the **pickup code** shown large
- Sign up, log in (password or SMS code), and profile (name, language)
- Pickup location info page (address, map link, opening hours)

**Seller agent**
- Dashboard: number of vendors, active listings, orders this month, commission earned and due
- Vendors: list, add, and edit (name, phone, location description, payout details)
- Products: list (filter by vendor), add and edit (photos, title, description, price, stock, category), hide or show
- Orders: orders containing their vendors' items, with item status
- Earnings: commission per sale, due vs. paid

**Warehouse staff**
- Awaiting drop-off: items grouped by vendor, with time left before the deadline
- Item check: mark **received** or **rejected** (with a reason)
- Ready to pack: orders where all remaining items are received, then **mark packed**
- Packed: **send to pickup point** (moves the order to `ready_for_pickup` and triggers the customer SMS)

**Pickup staff**
- Look up an order by pickup code or phone number
- Order detail: customer name, items, status. Then **confirm handover**, which requires the code

**Admin**
- Overview: sales, orders by status, refunds, payouts due
- Users: list and search, create agent and staff accounts, deactivate
- Agents, vendors, and products: view and edit any of them
- Orders: search and filter, view the full history log, and manual actions (cancel and refund)
- Settings: split percentages, time windows, expiry fee, pickup location
- Payouts: list of those due, mark paid (single or bulk)
- Refunds: list, mark manual refunds processed
- Reports: sales by day or month, by agent, by vendor, by category; CSV export
- SMS log

---

## 7. API endpoints

All endpoints are under `/api`. 🔒 means you must be logged in, and the role in brackets is required.

**Auth**
- `POST /auth/register` (phone, name, password)
- `POST /auth/login` (phone + password)
- `POST /auth/otp/request` and `POST /auth/otp/verify` (SMS code login)
- `POST /auth/logout`, `GET /auth/me`

**Public catalog**
- `GET /categories`
- `GET /products?q=&category=&page=`, `GET /products/:id`
- `GET /settings/public` (pickup location and hours)

**Customer** 🔒 [customer]
- `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`
- `POST /checkout` (creates the order and returns the Chapa checkout link)
- `GET /orders`, `GET /orders/:id`
- `PATCH /me` (name, language, password)

**Payments**
- `POST /payments/chapa/webhook` (Chapa calls this; the signature is checked)
- `GET /payments/chapa/verify/:txRef` (the return page calls this; we always double-check with Chapa)

**Agent** 🔒 [agent]
- `GET/POST /agent/vendors`, `GET/PATCH /agent/vendors/:id`
- `GET/POST /agent/products`, `GET/PATCH /agent/products/:id`, `POST /agent/products/:id/images`, `DELETE /agent/products/:id/images/:imageId`
- `GET /agent/orders`
- `GET /agent/earnings`, `GET /agent/dashboard`

**Warehouse** 🔒 [warehouse]
- `GET /warehouse/awaiting-dropoff`
- `POST /warehouse/items/:itemId/receive`, `POST /warehouse/items/:itemId/reject`
- `GET /warehouse/ready-to-pack`, `POST /warehouse/orders/:id/pack`
- `GET /warehouse/packed`, `POST /warehouse/orders/:id/send-to-pickup`

**Pickup** 🔒 [pickup]
- `GET /pickup/lookup?code=` or `?phone=`
- `POST /pickup/orders/:id/handover` (body: code)

**Admin** 🔒 [admin]
- `GET/POST /admin/users`, `PATCH /admin/users/:id`
- `GET /admin/agents`, `GET /admin/vendors`, `PATCH /admin/vendors/:id`, `GET/PATCH /admin/products/:id`
- `GET /admin/orders`, `GET /admin/orders/:id`, `POST /admin/orders/:id/cancel`
- `GET/PUT /admin/settings`
- `GET /admin/payouts`, `POST /admin/payouts/mark-paid`
- `GET /admin/refunds`, `POST /admin/refunds/:id/mark-processed`
- `GET /admin/reports/sales`, `.../by-agent`, `.../by-vendor` (each with a `?format=csv` option)
- `GET /admin/sms-log`

---

## 8. Build phases (with a check-in after each)

| Phase | What gets built | How you'll try it |
|---|---|---|
| **1. Foundation** | Project setup, database and migrations, design tokens and base components (button, input, card, badge), i18n wiring, phone login (password + SMS code shown in the console), roles, admin creating staff and agent accounts, seed users | Log in as each role and see a placeholder home for that role |
| **2. Agents and catalog** | Vendors CRUD, products CRUD with image compression, categories, agent dashboard (basic) | Log in as an agent, add a vendor, list a product with photos |
| **3. Storefront and payment** | Home, search, product page, cart, checkout with Chapa test mode, order history, pickup code, money split calculation | Shop as a customer and pay with Chapa's test card or test Telebirr |
| **4. Operations** | State machine, warehouse screens, pickup screens, status history, background timer (missed drop-off, expiry), refunds | Walk an order from paid to picked up, and trigger the edge cases with a "fast-forward time" dev tool |
| **5. Money and admin** | Payouts created on pickup, payouts screen, refunds screen, settings page, reports and CSV, admin management pages | Change percentages, pay out an agent, view reports |
| **6. Polish** | SMS interface finalized with templates and reminders, Amharic structure (with English text placeholders for translation), performance pass (bundle size check, image sizes, caching), README finished | Test on a throttled "slow 3G" connection, switch the language |

Tests written along the way (focused on the important logic):
- Money split and rounding (the three parts always add up)
- Every allowed and forbidden status change
- Missed drop-off leads to cancel and refund; failed check leads to item refund; uncollected order leads to expiry and refund minus fee
- Payouts created only after pickup
- Role permissions (for example, a customer can't call warehouse endpoints)
- Chapa webhook: duplicates and forged calls are ignored

Seed data: 1 admin, 2 agents, 1 warehouse and 1 pickup staff account, 3 customers, 5 vendors, about 25 products
across 5 categories (with placeholder images), and orders in every status so every screen has something on it.

---

## 9. Questions for you before Phase 1

1. **Stack:** React + Express (my recommendation) or Next.js?
2. **Multi-vendor orders:** per-item cancel and refund (my recommendation) or cancel the whole order?
3. **Default split:** is vendor 85% / agent 5% / platform 10% a reasonable starting placeholder?
4. **Product listings:** go live immediately when an agent publishes them, or need admin approval first?
5. **Name/brand:** what should the app be called on screen? (I'll use "Gexi" as a placeholder.)
