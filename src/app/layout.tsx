import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { ThemeColorMeta } from "@/components/theme-color-meta";
import { QueryProvider } from "@/components/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${hoover.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <ThemeColorMeta />
            {children}
            <PwaInstallPrompt />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
