# ParyajNet

Plataforma web de apuestas: **deportes**, **lotería / borlette** y **casino provably fair**.
Idiomas: português, español, français, English. Monedas: **BRL** (reales) y **MXN** (pesos mexicanos).

Stack: Next.js 15 (App Router, server actions) · next-intl · Prisma · Tailwind CSS 4.

## Arranque rápido

```bash
cp .env.example .env        # y pon un AUTH_SECRET: openssl rand -hex 32
npm install
npm run db:push             # crea la base SQLite (dev.db)
npm run db:seed             # partidos, sorteos, admin y jugador demo (ver SEED_* en .env)
npm run dev                 # http://localhost:3000
```

`npm test` corre las pruebas de reglas (liquidación, pagos de borlette, RNG y RTP del casino).
`npm run db:reset` borra y vuelve a sembrar la base.

## Qué incluye

| Área | Detalle |
| --- | --- |
| Deportes | Fútbol: 1X2, doble oportunidad, goles 1.5/2.5/3.5, hándicap, ambos anotan y marcador exacto (generados con un modelo Poisson a partir de 1X2 y goles 2.5). Baloncesto: ganador, hándicap y puntos totales. Sencillas y combinadas (máx. 20, una por partido). Liquidación automática por marcador; los hándicaps y totales de línea entera se anulan en empate. |
| En vivo | Marcador y reloj en vivo, refresco cada 5 s. Las apuestas en vivo se retienen `LIVE_BET_DELAY_MS` y se revalidan: si hubo gol o cambio de momio en ese tiempo, se rechazan. Un cambio de marcador suspende todos los mercados hasta que se reabran. El boleto detecta momios cambiados y pide aceptarlos. |
| Feed de cuotas | `POST /api/feed` (Bearer `FEED_API_KEY`) crea y actualiza eventos, mercados, momios, marcador en vivo y resultados, idempotente por `externalId`. Un adaptador para tu proveedor (Sportradar, Betradar, Genius…) solo tiene que traducir al formato de `src/lib/feed.ts`. |
| KYC | CPF con dígitos verificadores, CURP con dígito verificador y fecha de nacimiento cruzada, o pasaporte. Foto del documento y selfie (reducidas en el navegador). Un documento por cuenta. Revisión en `/admin/kyc`; las imágenes solo las ve un admin. Retiros bloqueados sin KYC; `KYC_REQUIRED_TO_PLAY=true` también exige KYC para jugar y depositar (obligatorio en Brasil). |
| Lotería | Borlette (2 cifras, lotes 1/2/3 pagan 50×/20×/10×), Loto 3 (500×) y Mariage (1000×). Tabla en `src/lib/lottery-rules.ts`. |
| Casino | Dice y Limbo, 1% de ventaja de la casa. HMAC-SHA256(server seed, `clientSeed:nonce`); el hash se muestra antes de jugar y la semilla se revela al rotarla. |
| Billetera | Una billetera por moneda, libro mayor inmutable (`Transaction`), débitos atómicos que nunca dejan saldo negativo. |
| Pagos | Depósitos PIX (BRL), SPEI y OXXO (MXN); retiros PIX / SPEI con aprobación manual. Adaptadores de proveedor en `src/lib/payment-providers/`; webhook firmado en `POST /api/payments/webhook` (idempotente, retiene pagos con monto distinto). Proveedor **simulado** por defecto (`PAYMENTS_PROVIDER=mock`). |
| Juego responsable | Verificación de 18+ en el registro, límite diario de depósito, autoexclusión (1 día a 1 año). |
| Admin | `/admin`: KPIs y GGR por moneda, crear/editar/suspender/liquidar eventos, sorteos, aprobar pagos, lista de jugadores. |

Límites por moneda (apuesta mín./máx., pago máximo, depósitos): `src/lib/money.ts`.

## Estructura

```
prisma/schema.prisma        modelo de datos
src/lib/*-rules.ts          reglas puras (probadas en rules.test.ts)
src/lib/{sports,lottery,casino,payments,wallet}.ts   lógica con base de datos
src/app/actions/            server actions (validación con zod)
src/app/[locale]/           páginas (pt/es/fr/en)
messages/*.json             traducciones
```

## Despliegue (Vercel + PostgreSQL)

`scripts/set-db-provider.mjs` elige el proveedor de Prisma según `DATABASE_URL`: `file:` usa SQLite y `postgres://` usa PostgreSQL. No hay que tocar el schema.

1. Crea una base PostgreSQL (Neon, Supabase, Vercel Postgres…).
2. En Vercel, importa el repositorio y define las variables de `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `PAYMENTS_WEBHOOK_SECRET`, `FEED_API_KEY`…). `vercel.json` ya usa `npm run build:vercel`, que aplica el schema antes de compilar, y la región `gru1` (São Paulo).
3. Siembra datos de demo una vez: `DATABASE_URL=postgres://… npm run db:seed`.

## Antes de producción

- **Pagos en México (Conekta, ya integrado):**
  1. En el panel de Conekta copia tu llave privada (`key_…`) a `CONEKTA_PRIVATE_KEY`.
  2. Crea la llave de webhooks: `curl -X POST https://api.conekta.io/webhook_keys -u key_…: -H "Accept: application/vnd.conekta-v2.3.0+json" -H "Content-Type: application/json" -d '{"active":true}'` y guarda `public_key` en `CONEKTA_WEBHOOK_PUBLIC_KEY`.
  3. Registra el webhook `https://<tu-dominio>/api/payments/webhook/conekta` (eventos `order.paid`, `order.expired`).
  4. Pon `PAYMENTS_PROVIDER_MX=conekta`. Prueba primero con llaves de sandbox.
- **PIX (Brasil):** falta elegir proveedor. Implementa `PaymentProvider` (`src/lib/payment-providers/types.ts`), regístralo en `index.ts` y pon `PAYMENTS_PROVIDER_PIX=<nombre>`. Mientras tanto PIX usa el proveedor mock, que muestra el botón "simular pago": no lo dejes así en producción.
- **KYC:** la revisión es manual. Para escalar, conecta un proveedor (idwall, unico, Truora, Metamap…) y consulta PEP y listas de sanciones.
- **Migraciones:** `prisma db push` basta para empezar; con usuarios reales pasa a `prisma migrate`.
- **Licencias:** operar apuestas con dinero real exige autorización en cada país: en Brasil, la Secretaria de Prêmios e Apostas (Lei 14.790/2023, dominio `.bet.br`); en México, un permiso de SEGOB. Las loterías tipo borlette tienen reglas propias y pueden no estar permitidas a operadores privados. Consúltalo con un abogado antes de lanzar.
- **Seguridad:** limitar la frecuencia de peticiones en login y apuestas, 2FA para admins y registros de auditoría de las acciones de admin.
