const STYLE: Record<string, string> = {
  NY: "bg-brand text-brand-ink",
  FL: "bg-gold text-brand-ink",
  GA: "bg-danger text-white",
};

/** Colour-coded state badge: New York blue, Florida yellow, Georgia red. */
export function StateBadge({ code, size = "md" }: { code: string | null; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "size-7 text-[10px]" : "size-10 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-black tracking-tight ${dims} ${
        code ? STYLE[code] : "bg-surface-2 text-muted"
      }`}
    >
      {code ?? "★"}
    </span>
  );
}
