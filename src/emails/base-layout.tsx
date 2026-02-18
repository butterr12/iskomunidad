import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "https://iskomunidad.com";

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>iskomunidad</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              Built for the campus community.
            </Text>
            <Text style={footerSubtext}>
              You received this email because you have an account on
              iskomunidad. If you didn&apos;t request this, you can safely
              ignore it.
            </Text>
            <Text style={legalLinks}>
              <Link href={`${baseUrl}/privacy`} style={legalLink}>
                Privacy Policy
              </Link>
              {" · "}
              <Link href={`${baseUrl}/terms`} style={legalLink}>
                Terms of Service
              </Link>
            </Text>
            <Text style={footerSubtext}>
              © {new Date().getFullYear()} iskomunidad ·
              contact@hello.iskomunidad.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f5f5f4",
  fontFamily: fontStack,
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
  padding: "40px 20px",
};

const header: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "24px",
};

const logo: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
  color: "#bf0000",
  margin: 0,
  letterSpacing: "-0.5px",
};

const content: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "36px 32px",
  border: "1px solid #e7e5e4",
};

const divider: React.CSSProperties = {
  borderColor: "#e7e5e4",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "0 12px",
};

const footerText: React.CSSProperties = {
  fontSize: "13px",
  color: "#78716c",
  margin: "0 0 8px",
};

const footerSubtext: React.CSSProperties = {
  fontSize: "12px",
  color: "#a8a29e",
  margin: 0,
  lineHeight: "18px",
};

const legalLinks: React.CSSProperties = {
  fontSize: "12px",
  color: "#a8a29e",
  margin: "12px 0 8px",
};

const legalLink: React.CSSProperties = {
  color: "#78716c",
  textDecoration: "underline",
};
