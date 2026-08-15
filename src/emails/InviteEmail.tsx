import { Html, Head, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";

const PALETTES: Record<string, { bg: string; accent: string; text: string }> = {
  "ivory-editorial": { bg: "#faf8f4", accent: "#e8930c", text: "#232323" },
  "raj-mahal": { bg: "#2a0a10", accent: "#d4a439", text: "#f5ead6" },
  "gulaab-rococo": { bg: "#fdf2f6", accent: "#c2447a", text: "#4a2b3a" },
  "mehfil-noor": { bg: "#0d1220", accent: "#a9bce0", text: "#e8ecf7" },
  "pichwai-bagh": { bg: "#0e2b22", accent: "#e08cb2", text: "#f1e9d6" },
  "neel-chhapa": { bg: "#f6f6f0", accent: "#31509f", text: "#22335e" },
};

export function InviteEmail(props: { familyName: string; coupleNames: string; rsvpUrl: string; theme: string }) {
  const p = PALETTES[props.theme] ?? PALETTES["ivory-editorial"];
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: p.bg, color: p.text, fontFamily: "Georgia, serif" }}>
        <Container style={{ padding: "40px 24px", textAlign: "center" as const }}>
          <Text style={{ letterSpacing: 4, textTransform: "uppercase" as const, fontSize: 12 }}>
            You are cordially invited
          </Text>
          <Heading style={{ fontSize: 34, margin: "16px 0" }}>{props.coupleNames}</Heading>
          <Hr style={{ borderColor: p.accent, width: 80 }} />
          <Text style={{ fontSize: 16 }}>
            Dear {props.familyName}, we would be honoured to celebrate with you.
            Please let us know who is coming.
          </Text>
          <Button href={props.rsvpUrl} style={{
            backgroundColor: p.accent, color: "#fff", padding: "14px 36px",
            borderRadius: 4, fontSize: 16, letterSpacing: 1,
          }}>
            RSVP
          </Button>
          <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 24 }}>
            This link is personal to your family — feel free to share it within your household.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
