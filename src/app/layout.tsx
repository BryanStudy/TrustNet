import type { Metadata } from "next";
import "./globals.css";
import {
  fontMontserrat,
  fontMontserratBold,
  fontSpaceMono,
  fontSpaceMonoBold,
} from "../../public/fonts";
import QueryProvider from "@/components/provider/query-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "TrustNet",
  description: "Trust in the Internet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontMontserrat.variable} ${fontSpaceMono.variable} ${fontMontserratBold.variable} ${fontSpaceMonoBold.variable}`}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
