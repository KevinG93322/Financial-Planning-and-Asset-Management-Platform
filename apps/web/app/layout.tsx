import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AuthProvider } from "../components/AuthProvider";
import { Shell } from "../components/Shell";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Financial Platform",
  description: "Household planning, content-hash records, and a local demo vault.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable}`}>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
