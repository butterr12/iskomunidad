import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

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

export const viewport: Viewport = {
  themeColor: "#272530",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${hoover.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <PwaInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
