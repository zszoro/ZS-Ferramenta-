import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZS Ferramenta | IA para Sites e SaaS",
  description:
    "Chat de IA para gerar e editar sites, SaaS e sistemas com preview ao vivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-[#070a0f] text-slate-100">{children}</body>
    </html>
  );
}
