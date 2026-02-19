import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  alternates: { canonical: "/sign-in" },
  openGraph: { url: "/sign-in" },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
