import Link from "next/link";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-background bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/6 to-transparent px-4 overflow-y-auto dark:from-primary/10">
      <Link
        href="/"
        className="mb-6 text-3xl font-bold tracking-tight font-[family-name:var(--font-hoover)]"
        style={{ color: "#bf0000" }}
      >
        iskomunidad
      </Link>
      {children}
      <PwaInstallPrompt />
    </div>
  );
}
