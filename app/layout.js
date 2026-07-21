import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "Quotramax - Instant Preliminary Roof Estimates",
  description: "Convert website visitors and ad traffic into estimate requests with our frictionless, 60-second ballpark calculator.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#070a13] text-slate-100 font-sans">{children}</body>
    </html>
  );
}
