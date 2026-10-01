import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stilo | Controle de Usuários",
  description: "Controle seguro dos acessos bancários da Stilo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full"><AppShell>{children}</AppShell></body>
    </html>
  );
}
