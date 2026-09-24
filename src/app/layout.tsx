import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Articulate · Read research, beautifully";
const description =
  "Search arXiv, ranked by Jev, summarized in clear articulate English. Learn to articulate ideas by reading great summaries of great papers.";

export const metadata: Metadata = {
  // Lets Next resolve the file-convention opengraph-image into an absolute
  // URL. Set NEXT_PUBLIC_SITE_URL to the production domain at deploy time.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: "Articulate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-neutral-950`}
      >
        {children}
      </body>
    </html>
  );
}
