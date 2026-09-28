"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PublicBanner } from "@/lib/banners";

const ROTATE_MS = 6000;

const THEMES: Record<string, string> = {
  blue: "from-sky-300 via-sky-400 to-blue-500 text-brand-ink",
  yellow: "from-yellow-200 via-gold to-amber-400 text-brand-ink",
  red: "from-rose-500 via-danger to-red-700 text-white",
};

export function BannerCarousel({ banners, className }: { banners: PublicBanner[]; className?: string }) {
  const t = useTranslations("ads");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const seen = useRef(new Set<string>());
  const current = banners[index % banners.length];

  // Rotate while visible and not hovered.
  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % banners.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [banners.length, paused]);

  // Count one impression per banner, the first time it is actually on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || seen.current.has(current.id)) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !seen.current.has(current.id)) {
          seen.current.add(current.id);
          navigator.sendBeacon?.(`/api/banners/${current.id}/view`);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [current.id]);

  const content =
    current.kind === "TEXT" ? (
      <div
        className={`relative flex min-h-28 flex-col justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r p-5 sm:min-h-32 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${
          THEMES[current.theme] ?? THEMES.blue
        }`}
      >
        <span
          className="absolute -right-10 -bottom-12 size-40 rounded-full border-[14px] border-white/25"
          aria-hidden
        />
        <div className="relative">
          <p className="font-display text-xl font-bold sm:text-2xl">{current.headline}</p>
          {current.body && <p className="mt-1 text-sm font-medium opacity-85">{current.body}</p>}
        </div>
        {current.cta && (
          <span className="relative inline-flex w-fit shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-ink shadow-sm">
            {current.cta}
          </span>
        )}
      </div>
    ) : (
      <picture>
        {current.mobileImage && <source media="(max-width: 640px)" srcSet={current.mobileImage} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.image ?? ""} alt={current.title} className="block w-full rounded-2xl object-cover" />
      </picture>
    );

  return (
    <aside
      ref={root}
      aria-label={t("label")}
      className={`relative ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {current.hasLink ? (
        <a
          href={`/api/banners/${current.id}/click`}
          target={current.external ? "_blank" : undefined}
          rel={current.external ? "noopener sponsored" : undefined}
          className="block transition hover:brightness-105"
        >
          {content}
        </a>
      ) : (
        content
      )}
      <span className="pointer-events-none absolute top-2 right-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
        {t("label")}
      </span>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`${i + 1} / ${banners.length}`}
              aria-current={i === index % banners.length}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index % banners.length ? "w-6 bg-brand" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
