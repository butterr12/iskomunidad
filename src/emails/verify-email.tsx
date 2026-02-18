import { Button, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

interface VerifyEmailProps {
  url: string;
  name?: string;
}

export function VerifyEmail({ url, name }: VerifyEmailProps) {
  const greeting = name ? `Hey ${name},` : "Hey there,";

  return (
    <BaseLayout preview="Verify your email to get started on iskomunidad">
      <Text style={heading}>Verify your email</Text>
      <Text style={paragraph}>{greeting}</Text>
      <Text style={paragraph}>
        Welcome to iskomunidad! Tap the button below to verify your email
        address and start exploring your campus community.
      </Text>
      <Section style={buttonContainer}>
        <Button style={button} href={url}>
          Verify email address
        </Button>
      </Section>
      <Text style={hint}>
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
      </Text>
      <Text style={link}>{url}</Text>
    </BaseLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#1c1917",
  margin: "0 0 20px",
  letterSpacing: "-0.3px",
};

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  color: "#44403c",
  lineHeight: "24px",
  margin: "0 0 12px",
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "28px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#bf0000",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  borderRadius: "8px",
  padding: "12px 32px",
  display: "inline-block",
};

const hint: React.CSSProperties = {
  fontSize: "13px",
  color: "#78716c",
  margin: "0 0 4px",
};

const link: React.CSSProperties = {
  fontSize: "13px",
  color: "#bf0000",
  wordBreak: "break-all" as const,
  margin: 0,
};

export default VerifyEmail;
