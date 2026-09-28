# WhatsApp agent — Evolution API

The ParyajNet agent talks to customers through [Evolution API](https://doc.evolution-api.com) v2,
a self-hosted WhatsApp gateway. It runs in Docker, so it lives on its own server (it can't run on Vercel).

## 1. Run Evolution API

On a VPS with Docker (1 GB RAM is enough):

```bash
cd evolution
cp .env.example .env        # set SERVER_URL, AUTHENTICATION_API_KEY (openssl rand -hex 32), POSTGRES_PASSWORD
docker compose up -d
```

Put it behind HTTPS (Caddy example: `wa.your-domain.com { reverse_proxy localhost:8080 }`).

## 2. Connect it to ParyajNet

In Vercel → Project → Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| `EVOLUTION_API_URL` | `https://wa.your-domain.com` |
| `EVOLUTION_API_KEY` | same as `AUTHENTICATION_API_KEY` |
| `EVOLUTION_INSTANCE` | `paryajnet` |
| `EVOLUTION_WEBHOOK_TOKEN` | a random secret (`openssl rand -hex 24`) |
| `WHATSAPP_AGENT_NUMBER` | the agent's number, e.g. `5511987654321` (for the "open WhatsApp" button) |
| `SITE_URL` | `https://your-site` (links in messages) |

Redeploy, then in **Admin → WhatsApp**:

1. **Create WhatsApp instance**.
2. Scan the QR code with the phone that will be the agent (WhatsApp → Linked devices).
3. **Set webhook** — Evolution will post customer messages to `/api/whatsapp/webhook`.
4. **Send test** to your own number.

Use a dedicated number (WhatsApp Business app works). Unofficial gateways can be
restricted by WhatsApp if used for spam: the agent only messages customers who
created a service with that number.

## What the agent does

| When | Message |
| --- | --- |
| Customer creates a service | Summary, amount, PIX key, QR code image and PIX copy-and-paste code |
| Customer sends a photo/PDF | Stores it as the receipt of their open service and confirms reception |
| Admin confirms | "Payment confirmed, service active" |
| Admin rejects | Reason |
| Result: won / void | Asks for the PIX key; recognises CPF, CNPJ, phone, e-mail or random key in the reply |
| Result: lost | Short message |
| Admin marks paid | Payout sent to the key |
| Anything else | Help + the customer's open service codes |

Without Evolution configured everything still works: messages are logged as `SKIPPED`
in Admin → WhatsApp, and customers see the payment details on the service page.
