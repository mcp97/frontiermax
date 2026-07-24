import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  || "https://agent-frontier.alignedai.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Frontier Max — Turn benchmarks into decisions",
  description:
    "Independent model decision infrastructure. Compare public evidence, apply workload constraints, and publish an inspectable model route.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Frontier Max",
    title: "Frontier Max — Turn benchmarks into decisions",
    description: "Independent model decision infrastructure for inspectable, evidence-backed model routes.",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Frontier Max — Turn benchmarks into decisions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Frontier Max — Turn benchmarks into decisions",
    description: "Independent model decision infrastructure for inspectable, evidence-backed model routes.",
    images: ["/og.svg"],
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
