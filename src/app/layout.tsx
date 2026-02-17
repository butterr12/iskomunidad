import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { ThemeColorMeta } from "@/components/theme-color-meta";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

const satoshi = localFont({
  src: [
    { path: "../../public/fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const cabinetGrotesk = localFont({
  src: "../../public/fonts/CabinetGrotesk-Extrabold.woff2",
  weight: "100 900",
  variable: "--font-cabinet-grotesk",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const hoover = localFont({
  src: "../../public/fonts/Hoover-Variable.ttf",
  variable: "--font-hoover",
  display: "swap",
});

export const metadata: Metadata = {
  title: "iskomunidad",
  description:
    "Discover and explore local landmarks and attractions in your community",
  applicationName: "iskomunidad",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "iskomunidad",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${satoshi.variable} ${cabinetGrotesk.variable} ${geistMono.variable} ${hoover.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <ThemeColorMeta />
            {children}
            <PwaInstallPrompt />
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
