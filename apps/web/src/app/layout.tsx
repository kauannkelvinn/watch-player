import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const khTeka = localFont({
  src: [
    { path: "../../public/fonts/khregular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/khmedium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/khbold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-kh-teka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Watch.Party",
  description: "Assista junto, em tempo real",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={khTeka.variable}>
      <body className="antialiased font-display">
        {children}
      </body>
    </html>
  );
}