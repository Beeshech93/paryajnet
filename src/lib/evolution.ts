/**
 * Minimal Evolution API v2 client (https://doc.evolution-api.com).
 *
 * Env:
 *   EVOLUTION_API_URL     base URL of your Evolution API server, e.g. https://wa.example.com
 *   EVOLUTION_API_KEY     global API key (AUTHENTICATION_API_KEY on the server)
 *   EVOLUTION_INSTANCE    instance name, e.g. "paryajnet"
 *   EVOLUTION_WEBHOOK_TOKEN  secret added to our webhook URL (?token=…)
 */
export type EvolutionConfig = { url: string; apiKey: string; instance: string };

export function evolutionConfig(): EvolutionConfig | null {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE || "paryajnet";
  return url && apiKey ? { url, apiKey, instance } : null;
}

async function call<T>(
  cfg: EvolutionConfig,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: { apikey: cfg.apiKey, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : {};
    if (!res.ok) {
      const msg = JSON.stringify((json as { response?: unknown }).response ?? json).slice(0, 300);
      throw new Error(`Evolution ${res.status} ${path}: ${msg}`);
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

const inst = (cfg: EvolutionConfig) => encodeURIComponent(cfg.instance);

export const evolution = {
  sendText(cfg: EvolutionConfig, number: string, text: string) {
    return call(cfg, "POST", `/message/sendText/${inst(cfg)}`, { number, text, delay: 800 });
  },

  /** `base64` must be the raw base64 string, without a data: prefix. */
  sendImage(cfg: EvolutionConfig, number: string, base64: string, caption: string, fileName = "pix.png") {
    return call(cfg, "POST", `/message/sendMedia/${inst(cfg)}`, {
      number,
      mediatype: "image",
      mimetype: "image/png",
      media: base64,
      fileName,
      caption,
    });
  },

  /** Download a received media message as base64 (used when the webhook didn't include it). */
  async mediaBase64(cfg: EvolutionConfig, messageId: string): Promise<{ base64: string; mimetype?: string }> {
    return call(cfg, "POST", `/chat/getBase64FromMediaMessage/${inst(cfg)}`, {
      message: { key: { id: messageId } },
      convertToMp4: false,
    });
  },

  async state(cfg: EvolutionConfig): Promise<string> {
    try {
      const r = await call<{ instance?: { state?: string } }>(cfg, "GET", `/instance/connectionState/${inst(cfg)}`);
      return r.instance?.state ?? "unknown";
    } catch (err) {
      if (String(err).includes(" 404 ")) return "missing";
      throw err;
    }
  },

  createInstance(cfg: EvolutionConfig) {
    return call(cfg, "POST", "/instance/create", {
      instanceName: cfg.instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    });
  },

  /** QR code (data URL) and pairing code to link the WhatsApp number. */
  async connect(cfg: EvolutionConfig): Promise<{ qr: string | null; pairingCode: string | null }> {
    const r = await call<{ base64?: string; code?: string; pairingCode?: string; qrcode?: { base64?: string } }>(
      cfg,
      "GET",
      `/instance/connect/${inst(cfg)}`,
    );
    const b64 = r.base64 ?? r.qrcode?.base64 ?? null;
    return {
      qr: b64 ? (b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`) : null,
      pairingCode: r.pairingCode ?? null,
    };
  },

  setWebhook(cfg: EvolutionConfig, url: string) {
    return call(cfg, "POST", `/webhook/set/${inst(cfg)}`, {
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: true,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      },
    });
  },

  logout(cfg: EvolutionConfig) {
    return call(cfg, "DELETE", `/instance/logout/${inst(cfg)}`);
  },
};
