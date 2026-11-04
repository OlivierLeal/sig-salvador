import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import "./globals.css";

const corpo = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-corpo" });
const titulo = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-titulo" });

export const metadata = {
  title: "Atlas da Desigualdade de Salvador",
  description: "Raça, gênero, renda, saneamento e vegetação nos setores censitários de Salvador (Censo 2022).",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${corpo.variable} ${titulo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
