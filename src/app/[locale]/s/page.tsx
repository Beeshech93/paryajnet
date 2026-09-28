import { getTranslations, setRequestLocale } from "next-intl/server";
import { CodeLookup } from "@/components/orders/CodeLookup";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("myService") };
}

export default async function ServiceLookupPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("orders");
  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t("lookupTitle")}</h1>
      <p className="text-sm text-muted">{t("lookupBody")}</p>
      <CodeLookup />
    </div>
  );
}
