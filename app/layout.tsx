import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  || "https://agent-frontier.monilpat.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Frontier Max — Benchmark intelligence, made actionable",
  description:
    "Make public AI benchmark evidence legible, then turn workload constraints into transparent model decisions.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Frontier Max",
    title: "Frontier Max — From benchmark to runtime",
    description: "Interpret benchmark evidence, choose a workload policy, and make the route inspectable.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Frontier Max — From benchmark to runtime" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Frontier Max — From benchmark to runtime",
    description: "Interpret benchmark evidence, choose a workload policy, and make the route inspectable.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
