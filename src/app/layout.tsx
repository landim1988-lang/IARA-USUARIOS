import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import { CREDIPI_LOGO_URL } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: "CREDIPI | Controle de Usuários",
  description: "Controle seguro dos acessos bancários da CREDIPI.",
  icons: {
    icon: CREDIPI_LOGO_URL,
    shortcut: CREDIPI_LOGO_URL,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full"><AppShell>{children}</AppShell></body>
    </html>
  );
}
