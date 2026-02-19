import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  alternates: { canonical: "/sign-up" },
  openGraph: { url: "/sign-up" },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
