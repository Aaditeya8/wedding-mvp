import type { Metadata } from "next";
import { Instrument_Serif, Cormorant_Garamond, Fraunces, Inter, Marcellus, Rozha_One, Prata } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Serif({
  weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument",
});
const cormorant = Cormorant_Garamond({
  weight: ["400", "500", "600"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-cormorant",
});
const fraunces = Fraunces({
  subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const marcellus = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-marcellus" });
const rozha = Rozha_One({ weight: "400", subsets: ["latin"], variable: "--font-rozha" });
const prata = Prata({ weight: "400", subsets: ["latin"], variable: "--font-prata" });

export const metadata: Metadata = {
  title: "Wedding",
  description: "Wedding invitations & RSVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // the /w page adds .fx to <html> pre-paint (scroll-fx arming) — same
    // pattern as next-themes; only attribute diffs are suppressed
    <html
      lang="en"
      className={`${instrument.variable} ${cormorant.variable} ${fraunces.variable} ${inter.variable} ${marcellus.variable} ${rozha.variable} ${prata.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
