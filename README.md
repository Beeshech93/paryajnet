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
| Deportes | Mercados 1X2, más/menos 2.5 goles y ambos anotan. Apuestas sencillas y combinadas (máx. 20, una por partido). Se rechaza la apuesta si el momio cambió. Liquidación automática a partir del marcador; cancelar un evento anula las selecciones y reembolsa. |
| Lotería | Borlette (2 cifras, lotes 1/2/3 pagan 50×/20×/10×), Loto 3 (500×) y Mariage (1000×). Tabla en `src/lib/lottery-rules.ts`. |
| Casino | Dice y Limbo, 1% de ventaja de la casa. HMAC-SHA256(server seed, `clientSeed:nonce`); el hash se muestra antes de jugar y la semilla se revela al rotarla. |
| Billetera | Una billetera por moneda, libro mayor inmutable (`Transaction`), débitos atómicos que nunca dejan saldo negativo. |
| Pagos | Depósitos PIX (BRL), SPEI y OXXO (MXN); retiros PIX / SPEI con aprobación manual. Proveedor **simulado** (`PAYMENTS_MODE=mock`). |
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

## Antes de producción

- **Base de datos:** cambia `provider = "sqlite"` a `"postgresql"` en `prisma/schema.prisma` y apunta `DATABASE_URL` a Postgres.
- **Pagos reales:** implementa `PaymentProvider` en `src/lib/payments.ts` con tu proveedor (PIX / SPEI / OXXO), recibe sus webhooks (verificando la firma) y llama a `confirmDeposit`. Pon `PAYMENTS_MODE=live`.
- **KYC:** falta la verificación de identidad (CPF en Brasil, CURP/INE en México) y las comprobaciones de PEP y sanciones.
- **Licencias:** operar apuestas con dinero real exige autorización en cada país: en Brasil, la Secretaria de Prêmios e Apostas (Lei 14.790/2023, dominio `.bet.br`); en México, un permiso de SEGOB. Las loterías tipo borlette tienen reglas propias y pueden no estar permitidas a operadores privados. Consúltalo con un abogado antes de lanzar.
- **Seguridad:** limitar la frecuencia de peticiones en login y apuestas, 2FA para admins y registros de auditoría de las acciones de admin.
