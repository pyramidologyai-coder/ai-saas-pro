import { brand } from "@/lib/brand";

export const metadata = {
  title: "Automology — an AI receptionist for small businesses",
  description:
    "Answers your customers instantly, quotes your real prices, and books " +
    "appointments straight into your diary. Day or night.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Automology",
    description: "An AI receptionist for small businesses.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* One place for the fonts, so no page has to remember to load them. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={brand.font.href} rel="stylesheet" />
      </head>
      <body style={{
        fontFamily: brand.font.body,
        margin: 0,
        background: brand.color.paper,
        color: brand.color.ink,
        WebkitFontSmoothing: "antialiased",
      }}>
        {children}
      </body>
    </html>
  );
}
