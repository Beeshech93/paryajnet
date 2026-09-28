import { createTranslator } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * Translator for code that runs outside a page request (WhatsApp agent,
 * webhooks, cron, scripts). Loads the catalogue for `locale` directly.
 */
export async function translator(locale: string, namespace: string) {
  const lang = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  const messages = (await import(`../../messages/${lang}.json`)).default;
  // Namespaces are chosen at runtime, so the translator is loosely typed on purpose.
  return createTranslator({ locale: lang, messages, namespace: namespace as never }) as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
}
