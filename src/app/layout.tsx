/**
 * @component RootLayout
 *
 * Top-level Next.js layout wrapping the entire application.
 *
 * Sets global metadata, viewport config, and the Roboto font variable.
 * Wraps all pages inside the shared Providers tree and mounts the
 * ToastContainer for app-wide toast notifications.
 */
import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";
import Providers from "./providers";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/src/languages/en.json";

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const APP_NAME = "Team Wallet";
const APP_DESCRIPTION =
  "Securely manage shared crypto wallets with your team on Solana. Multi-sig treasury with proposal voting, token management, and program upgrades.";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://teamwallet.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#013870",
};

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "Solana",
    "multisig",
    "multi-sig",
    "treasury",
    "team wallet",
    "DAO",
    "crypto",
    "web3",
    "token management",
    "shared wallet",
  ],
  authors: [{ name: "Tecneural" }],
  creator: "Tecneural",
  metadataBase: new URL(APP_URL),

  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Team Wallet — Multi-sig Treasury Management on Solana",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/images/og-image.png"],
  },

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  manifest: "/manifest.webmanifest",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" style={{ colorScheme: "light" }}>
      <body suppressHydrationWarning className={`${roboto.variable}`}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="light"
          hideProgressBar
          newestOnTop
          closeOnClick
        />
      </body>
    </html>
  );
}
