import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Same family Flutter AppTheme uses (GoogleFonts.inter). */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "wrkspace",
  description: "A firm of software and IT wing",
  authors: [{ name: "redlix pro wing", url: "https://www.redlix.co.in" }],
  publisher: "www.podtem.co.in",
  applicationName: "wrkspace",
  appleWebApp: {
    capable: true,
    title: "wrkspace",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/branding/favicon.ico", sizes: "48x48" },
      { url: "/branding/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/icon.png",
    shortcut: "/branding/favicon.ico",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { ChunkReloadGuard } from "@/components/chunk-reload-guard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Unregister SWs once. Never wipe Cache Storage every load — that breaks chunk fetches. */}
        <Script id="purge-sw" strategy="beforeInteractive">{`
          try {
            var FLAG = 'wrkspace_sw_purged_v3';
            if (localStorage.getItem(FLAG) === '1') { /* already done */ }
            else if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                return Promise.all(regs.map(function(r) { return r.unregister(); }));
              }).then(function() {
                try { localStorage.setItem(FLAG, '1'); } catch (e) {}
              });
            }
          } catch (e) {}
        `}</Script>
        <ChunkReloadGuard />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
