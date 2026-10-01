import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CREDIPI | Controle de Usuários",
  description: "Controle seguro dos acessos bancários da CREDIPI.",
  icons: {
    icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CREDIPI%20CZAO-8svxede8NVqAQKHQTJUjZP4UrkkXrb.jpg",
    shortcut: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CREDIPI%20CZAO-8svxede8NVqAQKHQTJUjZP4UrkkXrb.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full"><AppShell>{children}</AppShell></body>
    </html>
  );
}
