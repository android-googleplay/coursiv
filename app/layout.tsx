import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { QuizProvider } from "@/components/quiz/quiz-context";
import { AuthProvider } from "@/components/auth/auth-context";
import { AccessGate } from "@/components/auth/access-gate";
import { LearnerProvider } from "@/components/member/learner-context";
import { MetaTrackingProvider } from "@/components/privacy/meta-tracking-provider";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Coursiv — Learn AI Skills",
  description: "Build your personalized AI income growth plan in minutes.",
  applicationName: "Coursiv",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#08080d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <Suspense fallback={<div className="onboarding-loading"><span /></div>}>
          <MetaTrackingProvider>
            <AuthProvider><LearnerProvider><AccessGate><QuizProvider>{children}</QuizProvider></AccessGate></LearnerProvider></AuthProvider>
          </MetaTrackingProvider>
        </Suspense>
      </body>
    </html>
  );
}
