export const LOCALE_TAGS: Record<string, string> = {
  pt: "pt-BR",
  es: "es-MX",
  fr: "fr-FR",
  en: "en-US",
};

export function formatMoneyClient(amount: number | string, locale: string, currency = "BRL") {
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? locale, { style: "currency", currency }).format(Number(amount));
}

export function formatNumber(value: number | string, locale: string, digits = 2) {
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}
