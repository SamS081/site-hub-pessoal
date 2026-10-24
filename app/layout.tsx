import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

/*
 * Atol's three voices. Bricolage Grotesque is the display face: variable, with
 * its optical-size and width axes loaded so the huge wordmark can sit tight and
 * heavy while small headings stay open. Manrope carries the body; Geist Mono
 * the times and counts.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atol",
  description: "Seu dia é uma ilha: tarefas, notas e hábitos ao redor do que importa hoje.",
};

export const viewport: Viewport = {
  themeColor: "#04121a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
