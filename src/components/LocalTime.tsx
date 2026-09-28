"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { LOCALE_TAGS } from "@/lib/locale-tags";

/** Formats a timestamp in the viewer's own time zone. */
export function LocalTime({ value, dateOnly }: { value: string | Date; dateOnly?: boolean }) {
  const locale = useLocale();
  const date = new Date(value);
  const text = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    dateStyle: "medium",
    ...(dateOnly ? {} : { timeStyle: "short" }),
  }).format(date);
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {text}
    </time>
  );
}

/** A datetime-local input that submits an ISO timestamp (viewer's time zone). */
export function DateTimeInput({ name, required }: { name: string; required?: boolean }) {
  const [iso, setIso] = useState("");
  return (
    <>
      <input
        type="datetime-local"
        className="input"
        required={required}
        onChange={(e) => setIso(e.target.value ? new Date(e.target.value).toISOString() : "")}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
