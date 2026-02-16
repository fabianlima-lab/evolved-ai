import { DM_Sans } from "next/font/google";
import { getLocale } from "next-intl/server";
import SupportButton from "@/components/SupportButton";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const viewport = {
  themeColor: "#08090E",
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className={`${dmSans.variable} antialiased`}>
        {children}
        <SupportButton />
      </body>
    </html>
  );
}
