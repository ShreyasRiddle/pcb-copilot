import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { CognitoAuthShell } from "@/components/CognitoAuthShell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PCB Copilot",
  description: "Describe a circuit. Upload a datasheet. Get a sourced BOM in 30 seconds.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const skipOidcSigninCallback = h.get("x-oidc-oauth-error") === "1";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}>
      <body>
        <CognitoAuthShell skipOidcSigninCallback={skipOidcSigninCallback}>{children}</CognitoAuthShell>
      </body>
    </html>
  );
}
