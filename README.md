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
| Sports | Football: 1X2, double chance, goals 1.5/2.5/3.5, handicap, BTTS, correct score (Poisson pricing from 1X2 + O/U 2.5). Basketball: winner, spread, total. Singles and accumulators. Live scores and admin live console. Odds feed at `POST /api/feed`. |
| Lottery | Borlette on the official NY (2:30 pm / 10:30 pm), FL (1:30 pm / 9:45 pm), GA (12:29 pm / 6:59 pm / 11:34 pm) draws, Eastern Time, created automatically. Lot 1 = last two digits of Pick 3; lots 2–3 = the pairs of Pick 4. Borlette 50×/20×/10×, Loto 3 500×, Mariage 1000×. Results by hand or `POST /api/lottery/results`. |
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
