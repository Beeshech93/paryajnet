import { prisma } from "./db";
import { AppError } from "./types";

export const PLACEMENTS = ["HOME", "SPORTS", "LOTTERY", "CASINO"] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const BANNER_THEMES = ["blue", "yellow", "red"] as const;
export const BANNER_LOCALES = ["all", "pt", "es", "fr", "en"] as const;
export const BANNER_MAX_BYTES = 1.5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type PublicBanner = {
  id: string;
  title: string;
  kind: string;
  hasLink: boolean;
  external: boolean;
  image: string | null;
  mobileImage: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  theme: string;
};

/** Active banners for a placement and language, without the image bytes. */
export async function activeBanners(placement: Placement, locale: string): Promise<PublicBanner[]> {
  const now = new Date();
  const rows = await prisma.banner.findMany({
    where: {
      placement,
      active: true,
      locale: { in: ["all", locale] },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      linkUrl: true,
      imageMime: true,
      mobileMime: true,
      headline: true,
      body: true,
      cta: true,
      theme: true,
      updatedAt: true,
    },
  });
  return rows.map((b) => {
    const v = b.updatedAt.getTime();
    return {
      id: b.id,
      title: b.title,
      kind: b.kind,
      hasLink: !!b.linkUrl,
      external: !!b.linkUrl && /^https?:\/\//.test(b.linkUrl),
      image: b.imageMime ? `/api/banners/${b.id}/image?v=${v}` : null,
      mobileImage: b.mobileMime ? `/api/banners/${b.id}/image?variant=mobile&v=${v}` : null,
      headline: b.headline,
      body: b.body,
      cta: b.cta,
      theme: b.theme,
    };
  });
}

/** Only absolute http(s) URLs or site-relative paths are allowed as banner links. */
export function normalizeLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const url = new URL(v);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {}
  throw new AppError("invalid_link");
}

export async function readImage(file: File | null, required: boolean) {
  if (!file || file.size === 0) {
    if (required) throw new AppError("banner_image_missing");
    return null;
  }
  if (!IMAGE_TYPES.includes(file.type)) throw new AppError("kyc_file_type");
  if (file.size > BANNER_MAX_BYTES) throw new AppError("kyc_file_too_large", { max: 1.5 });
  return { mime: file.type, data: new Uint8Array(await file.arrayBuffer()) };
}
