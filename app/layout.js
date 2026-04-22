import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Obliq Administration",
  description: "Internal CMS + CRM + medical workflow system for Obliq.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
