import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { LocaleSwitcher } from "@/components/HeaderControls";
import { DemoBar } from "@/components/casino/DemoBar";
import { DemoWalletProvider } from "@/components/casino/DemoWalletProvider";
import { getCurrentUser } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e17",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: "SPORTSBOOK PRO · Premium Sports & Casino", template: "%s · SPORTSBOOK PRO" },
    description: t("description"),
    appleWebApp: { capable: true, title: "SPORTSBOOK PRO", statusBarStyle: "black-translucent" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [t, user] = await Promise.all([getTranslations("footer"), getCurrentUser()]);

  return (
    <html lang={locale}>
      <body className="min-h-dvh pb-[calc(4.25rem+env(safe-area-inset-bottom))] font-sans antialiased md:pb-0 bg-slate-950 text-slate-100">
        <NextIntlClientProvider>
          <DemoWalletProvider>
            <DemoBar />
            <Header />
            <main className="mx-auto max-w-7xl px-4 py-5 md:py-6">{children}</main>
            <footer className="mt-16 border-t border-amber-500/20 bg-slate-950 print:hidden">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-slate-400 sm:flex-row sm:items-center">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 font-bold text-amber-300">
                  DEMO 18+
                </span>
                <p className="max-w-3xl">{t("responsible")}</p>
                <div className="md:hidden">
                  <LocaleSwitcher />
                </div>
                <p className="sm:ml-auto font-semibold text-slate-300">© {new Date().getFullYear()} SPORTSBOOK PRO</p>
              </div>
            </footer>
            <BottomNav role={user?.role ?? null} />
          </DemoWalletProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
