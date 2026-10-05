import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Handfield",
  description: "Move tens of thousands of glowing particles with your hands, using your webcam. Hand tracking with MediaPipe, 3D with Three.js.",
};

// Deliberately dark-only: it's a light show.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="h-full bg-black">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" theme="dark" />
      </body>
    </html>
  );
}
