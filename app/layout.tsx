import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import ShellWrapper from "@/components/ShellWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "TBSS · 노무법인 더보상 업무지원시스템",
  description: "노무법인 더보상 내부 업무 지원 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>
        <SessionProvider>
          <ShellWrapper>{children}</ShellWrapper>
        </SessionProvider>
      </body>
    </html>
  );
}
