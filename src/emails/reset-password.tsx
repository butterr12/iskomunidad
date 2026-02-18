import { Button, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

interface ResetPasswordProps {
  url: string;
  name?: string;
}

export function ResetPassword({ url, name }: ResetPasswordProps) {
  const greeting = name ? `Hey ${name},` : "Hey there,";

  return (
    <BaseLayout preview="Reset your iskomunidad password">
      <Text style={heading}>Reset your password</Text>
      <Text style={paragraph}>{greeting}</Text>
      <Text style={paragraph}>
        We received a request to reset your password. Tap the button below to
        choose a new one.
      </Text>
      <Section style={buttonContainer}>
        <Button style={button} href={url}>
          Reset password
        </Button>
      </Section>
      <Text style={hint}>
        This link will expire in 1 hour. If you didn&apos;t request a password
        reset, you can safely ignore this email — your password won&apos;t
        change.
      </Text>
      <Text style={fallback}>
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
  lineHeight: "20px",
  margin: "0 0 16px",
};

const fallback: React.CSSProperties = {
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

export default ResetPassword;
