import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HOSPITAL_NAME, PRODUCT_NAME } from "@/components/brand";
import { DemoBanner } from "@/components/demo-banner";
import { Providers } from "@/components/providers";
import { SkipLink } from "@/components/skip-link";
import { themeScript } from "@/components/theme/theme-script";
import { siteUrl } from "@/lib/firebase/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${PRODUCT_NAME} · portfolio demo`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: `A hospital management system demo for the fictional ${HOSPITAL_NAME}. Fake data only.`,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#14181d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-NG"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SkipLink />
        <DemoBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
