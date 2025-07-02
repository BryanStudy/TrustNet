import localFont from "next/font/local";

export const fontSpaceMono = localFont({
  src: "./SpaceMono-Regular.ttf",
  variable: "--font-space-mono",
  weight: "400",
  style: "normal",
});

export const fontSpaceMonoBold = localFont({
  src: "./SpaceMono-Bold.ttf",
  variable: "--font-space-mono-bold",
  weight: "700",
  style: "bold",
});

export const fontMontserrat = localFont({
  src: "./Montserrat-Regular.ttf",
  variable: "--font-montserrat",
  weight: "400",
  style: "normal",
});

export const fontMontserratBold = localFont({
  src: "./Montserrat-Bold.ttf",
  variable: "--font-montserrat-bold",
  weight: "700",
  style: "bold",
});
