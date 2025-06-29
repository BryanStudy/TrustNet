import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fontMontserrat, fontSpaceMono } from "../../public/fonts";

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
      className={`${fontMontserrat.variable} ${fontSpaceMono.variable}`}
    >
      <body>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
