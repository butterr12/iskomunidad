export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-background px-4 overflow-y-auto">
      {children}
    </div>
  );
}
