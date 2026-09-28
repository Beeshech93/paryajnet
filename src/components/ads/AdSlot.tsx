import { getLocale } from "next-intl/server";
import { activeBanners, type Placement } from "@/lib/banners";
import { BannerCarousel } from "./BannerCarousel";

/** Advertising space. Renders nothing when no banner is active for this placement and language. */
export async function AdSlot({ placement, className = "" }: { placement: Placement; className?: string }) {
  const banners = await activeBanners(placement, await getLocale());
  if (banners.length === 0) return null;
  return <BannerCarousel banners={banners} className={className} />;
}
