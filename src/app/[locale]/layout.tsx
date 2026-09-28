import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { LocaleSwitcher } from "@/components/HeaderControls";
import { getCurrentUser } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07111f",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: "ParyajNet", template: "%s · ParyajNet" },
    description: t("description"),
    appleWebApp: { capable: true, title: "ParyajNet", statusBarStyle: "black-translucent" },
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
    <html lang={locale} className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh pb-[calc(4.25rem+env(safe-area-inset-bottom))] font-sans antialiased md:pb-0">
        <NextIntlClientProvider>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-5 md:py-6">{children}</main>
          <footer className="mt-16 border-t border-line">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center">
              <span className="chip self-start border border-danger/50 text-danger">18+</span>
              <p className="max-w-3xl">{t("responsible")}</p>
              <div className="md:hidden">
                <LocaleSwitcher />
              </div>
              <p className="sm:ml-auto">© {new Date().getFullYear()} ParyajNet</p>
            </div>
          </footer>
          <BottomNav signedIn={!!user} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
