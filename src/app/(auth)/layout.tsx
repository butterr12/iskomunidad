import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-background bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/6 to-transparent px-4 py-8 overflow-y-auto dark:from-primary/10 safe-bottom">
      <div className="flex flex-1 flex-col items-center justify-center w-full">
        <Link
          href="/"
          className="mb-6 text-3xl font-bold tracking-tight font-[family-name:var(--font-hoover)]"
          style={{ color: "#bf0000" }}
        >
          iskomunidad
        </Link>
        {children}
      </div>
    </div>
  );
}
