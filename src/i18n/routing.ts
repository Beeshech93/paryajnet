import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "ht", "fr", "en", "pt"],
  defaultLocale: "es",
});

export type Locale = (typeof routing.locales)[number];
