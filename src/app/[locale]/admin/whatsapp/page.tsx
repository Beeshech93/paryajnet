import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  whatsappConnectAction,
  whatsappLogoutAction,
  whatsappTestAction,
  whatsappWebhookAction,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { evolution, evolutionConfig } from "@/lib/evolution";
import { formatPhone } from "@/lib/orders-rules";

export const dynamic = "force-dynamic";

export default async function AdminWhatsapp() {
  const t = await getTranslations("admin.whatsapp");
  const cfg = evolutionConfig();
  let state = "not_configured";
  let qr: string | null = null;
  let pairingCode: string | null = null;
  let error: string | null = null;
  if (cfg) {
    try {
      state = await evolution.state(cfg);
      if (state !== "open" && state !== "missing") ({ qr, pairingCode } = await evolution.connect(cfg));
    } catch (err) {
      error = String(err).slice(0, 300);
      state = "error";
    }
  }
  const h = await headers();
  const baseUrl = process.env.SITE_URL ?? `https://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const messages = await prisma.whatsAppMessage.findMany({
    where: { status: { not: "DEDUP" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { order: { select: { code: true } } },
  });
  const dot = state === "open" ? "bg-brand" : state === "connecting" ? "bg-gold" : "bg-danger";

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-bold">{t("title")}</h1>
          <span className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-sm">
            <span className={`size-2.5 rounded-full ${dot}`} />{" "}
            {t.has(`states.${state}`) ? t(`states.${state}`) : state}
          </span>
          {cfg && (
            <span className="text-xs text-muted">
              {cfg.url} · {cfg.instance}
            </span>
          )}
        </div>

        {!cfg && (
          <div className="space-y-2 rounded-xl bg-gold/10 p-4 text-sm">
            <p>{t("setupIntro")}</p>
            <pre className="overflow-x-auto rounded-lg bg-bg p-3 font-mono text-xs">{`EVOLUTION_API_URL=https://wa.tu-dominio.com
EVOLUTION_API_KEY=…
EVOLUTION_INSTANCE=paryajnet
EVOLUTION_WEBHOOK_TOKEN=…
WHATSAPP_AGENT_NUMBER=55119…`}</pre>
            <p className="text-xs text-muted">{t("setupDocker")}</p>
          </div>
        )}
        {error && <p className="rounded-xl bg-danger/10 p-3 font-mono text-xs text-danger">{error}</p>}

        {cfg && state === "missing" && (
          <ActionForm action={whatsappConnectAction} success={t("created")}>
            <SubmitButton>{t("createInstance")}</SubmitButton>
          </ActionForm>
        )}

        {cfg && qr && (
          <div className="grid gap-4 sm:grid-cols-[240px_1fr] sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" className="w-60 rounded-xl bg-white p-2" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{t("scanTitle")}</p>
              <p className="text-muted">{t("scanBody")}</p>
              {pairingCode && (
                <p>
                  {t("pairingCode")}: <b className="font-mono tracking-widest">{pairingCode}</b>
                </p>
              )}
              <Link href="/admin/whatsapp" className="btn-ghost py-1.5 text-xs">
                ↻ {t("refresh")}
              </Link>
            </div>
          </div>
        )}

        {cfg && state !== "missing" && (
          <div className="grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
            <ActionForm
              action={whatsappWebhookAction}
              success={t("webhookSet")}
              resetOnSuccess={false}
              className="space-y-2"
            >
              <label className="label" htmlFor="wh-base">
                {t("webhookLabel")}
              </label>
              <div className="flex gap-2">
                <input id="wh-base" name="baseUrl" defaultValue={baseUrl} className="input font-mono text-xs" />
                <SubmitButton className="btn-primary whitespace-nowrap">{t("setWebhook")}</SubmitButton>
              </div>
              <p className="text-xs text-muted">{t("webhookHelp")}</p>
            </ActionForm>
            <ActionForm
              action={whatsappTestAction}
              success={t("testSent")}
              resetOnSuccess={false}
              className="space-y-2"
            >
              <label className="label" htmlFor="wh-phone">
                {t("testLabel")}
              </label>
              <div className="flex gap-2">
                <input id="wh-phone" name="phone" required placeholder="(11) 98765-4321" className="input" />
                <SubmitButton className="btn-ghost whitespace-nowrap">{t("sendTest")}</SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}
        {cfg && state === "open" && (
          <ActionForm action={whatsappLogoutAction}>
            <SubmitButton className="btn-danger py-1.5 text-xs">{t("logout")}</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("log")}</h2>
        <div className="card divide-y divide-line text-sm">
          {messages.map((m) => (
            <div key={m.id} className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5">
              <span className={`w-6 text-center ${m.direction === "IN" ? "text-gold-strong" : "text-brand-strong"}`}>
                {m.direction === "IN" ? "←" : "→"}
              </span>
              <span className="w-40 text-xs text-muted">
                {formatPhone(m.phone)}
                <br />
                <LocalTime value={m.createdAt} />
              </span>
              <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{m.body}</span>
              {m.order && (
                <Link href={`/admin/orders/${m.order.code}`} className="font-mono text-xs text-brand-strong">
                  {m.order.code}
                </Link>
              )}
              <span
                className={`text-xs ${m.status === "FAILED" ? "text-danger" : m.status === "SKIPPED" ? "text-gold-strong" : "text-muted"}`}
              >
                {m.status}
              </span>
            </div>
          ))}
          {messages.length === 0 && <p className="p-5 text-muted">—</p>}
        </div>
      </section>
    </div>
  );
}
