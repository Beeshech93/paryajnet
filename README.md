# ParyajNet

Sports betting and borlette (New York, Florida, Georgia) for Brazil, in português, español, français and English.
**Customers have no accounts**: they create a *service*, pay by PIX and follow everything on WhatsApp, where an
agent (Evolution API) sends payment details, collects receipts and asks winners for their PIX key.
Only admins log in: they confirm payments and finalise services by their code.

Stack: Next.js 15 (App Router, server actions) · next-intl · Prisma · Tailwind CSS 4.

## How a service works

```
Customer (site)                 WhatsApp agent                        Admin (/admin/orders)
────────────────                ─────────────────                     ─────────────────────
Builds a bet slip / ticket
Name + WhatsApp + 18+  ──────▶  Summary, PIX key, QR, copia e cola
                                Customer sends receipt (photo/PDF) ─▶ Checks the bank, confirms
                                "Payment confirmed" ◀───────────────  (or rejects with a reason)
Event / draw settles ──────────▶ Won/void: asks for the PIX key
                                 Lost: short message
                                 Customer replies with the key ─────▶ Pays by PIX, "Paid · finalise"
                                 "Payout sent" ◀─────────────────────
```

- Code format `PJ` + 6 characters (e.g. `PJ7K3M9Q`); customers check it at `/s/<code>`, admins search it in **Services**.
- A service must be paid (receipt received) before the deadline: first kick-off / draw close minus `ORDER_LEAD_MINUTES`.
  Unpaid services expire. Only confirmed services are settled; if the admin confirms an on-time receipt after the
  result, it is settled right away.
- Pre-match only (live odds are shown but can't be picked: payment is confirmed by hand).
- Winnings are paid by the admin by PIX; the agent recognises CPF, CNPJ, phone, e-mail or random keys in free text.

## Quick start

```bash
cp .env.example .env        # set AUTH_SECRET (openssl rand -hex 32)
npm install
npm run db:push
npm run db:seed             # admin (SEED_ADMIN_*), demo games and lottery draws
npm run dev                 # http://localhost:3000 — admin at /login
```

Then in **Admin → Configuración** enter your PIX key (it goes into every payment message and QR).
`npm test` runs the rule tests (settlement, borlette payouts, PIX BR Code, phone/PIX-key parsing, Evolution payloads).

## Features

| Area | |
| --- | --- |
| Sports | **Real data from [The Odds API](https://the-odds-api.com)** (`ODDS_API_KEY`): games and odds (median of European bookmakers minus the house margin), live scores and results, which settle confirmed services automatically. Leagues, margin and update intervals in `/admin/sports-data`; syncs run after page views and by cron, throttled to protect the API quota. Football: 1X2 and totals from bookmakers, plus double chance, BTTS, handicaps and correct score derived with a Poisson model. Basketball: winner, spread, total. Games can also be created by hand or pushed to `POST /api/feed`. |
| Lottery | Borlette on the official NY (2:30 pm / 10:30 pm), FL (1:30 pm / 9:45 pm), GA (12:29 pm / 6:59 pm / 11:34 pm) draws, Eastern Time, created automatically. Lot 1 = last two digits of Pick 3; lots 2–3 = the pairs of Pick 4. Borlette 50×/20×/10×, Loto 3 500×, Mariage 1000×. Results by hand or `POST /api/lottery/results`. |
| Sales agents | Cash sales at a point of sale. The admin creates agents in `/admin/agents`; an agent signs in at `/login` and sells from the normal Sports / Lottery pages: the service is **confirmed at once** (WhatsApp optional), with a printable ticket. Winners bring the code: the agent opens it in `/agent`, hands over the cash and **finalises** it. Each agent's cash drawer (sold − paid out) is shown per day. A sale can be cancelled by its agent within 10 minutes. Online (PIX) services are still paid by the admin. |
| Password recovery | "Forgot your password?" on `/login` e-mails a one-time link (1 h) when `RESEND_API_KEY` + `MAIL_FROM` are set (Resend). Admins can always generate a 24 h link in **Admin → Usuários** to send by WhatsApp. Tokens are stored hashed, work once, and a password change signs out the user's other sessions. |
| Services | `Order` model: bet or ticket, customer name + WhatsApp, amount, deadline, receipt, payout and PIX key, status history. |
| WhatsApp agent | `src/lib/agent.ts` + `src/lib/evolution.ts`. Webhook `POST /api/whatsapp/webhook?token=…`. Every message is logged (Admin → WhatsApp). Works without Evolution (messages logged as `SKIPPED`). Setup: [evolution/README.md](evolution/README.md). |
| PIX | Static BR Code ("copia e cola") with amount and the service code as reference, CRC16 verified against the Banco Central example; QR sent as an image. |
| Admin | Services (to check / to pay / active / finished), WhatsApp connection (QR, webhook, test, log), events, draws, banners, PIX settings. |
| Advertising | Banner spaces on home, sports and lottery (`/admin/banners`). |

## Deploy (Vercel + PostgreSQL)

`scripts/vercel-build.mjs` resolves the database from `DATABASE_URL` or the variables a connected Postgres store
injects, applies the schema and builds. Variables: see `.env.example` (`AUTH_SECRET`, `FEED_API_KEY`, `CRON_SECRET`,
`EVOLUTION_*`, `WHATSAPP_AGENT_NUMBER`, `SITE_URL`). Seed the admin once: `DATABASE_URL=postgres://… npm run db:seed`.

## Before real money

- **Licences**: betting in Brazil requires authorisation from the Secretaria de Prêmios e Apostas (Lei 14.790/2023),
  which also requires identifying bettors (CPF). Private lotteries like borlette may not be licensable. Check with a lawyer.
- **WhatsApp**: Evolution API uses the WhatsApp Web protocol (unofficial). For volume, consider the official
  WhatsApp Business Cloud API; the agent only needs `sendText`, `sendImage` and a webhook, so it can be swapped.
