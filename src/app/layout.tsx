import type { Metadata } from "next";
import { Instrument_Serif, Cormorant_Garamond, Fraunces, Inter } from "next/font/google";
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
    <html
      lang="en"
      className={`${instrument.variable} ${cormorant.variable} ${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
