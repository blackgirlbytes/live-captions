import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getLocale, getMessages } from "@/i18n/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });

// Social sites need absolute image URLs. Set NEXT_PUBLIC_SITE_URL for another domain.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://live-captions-zeta.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const { common } = await getMessages();
  return {
    metadataBase: new URL(siteUrl),
    // The tab just says "Heard" next to the logo; link previews get the descriptive title.
    title: { default: "Heard", template: "%s · Heard" },
    description: common.meta.description,
    icons: { icon: "/icon.svg" },
    // The images come from opengraph-image.png and twitter-image.png in this folder.
    openGraph: {
      type: "website",
      siteName: "Heard",
      title: common.meta.title,
      description: common.meta.description,
    },
    twitter: {
      card: "summary_large_image",
      title: common.meta.title,
      description: common.meta.description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#08080b",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
