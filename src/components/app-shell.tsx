"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Banknote, Building2, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, Moon, Sun, Users, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accesses", label: "Acessos", icon: Banknote },
  { href: "/banks", label: "Bancos", icon: Building2 },
  { href: "/teams", label: "Equipes", icon: Users },
];
const themeEvent = "stilo-theme-change";

function subscribeToTheme(callback: () => void) {
  window.addEventListener(themeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(themeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot() {
  return localStorage.getItem("stilo-theme") === "dark";
}

function getServerThemeSnapshot() {
  return false;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/set-password") return;
    document.documentElement.dataset.theme = dark ? "dark" : "light";

    let timeout: ReturnType<typeof setTimeout>;
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        await authClient.signOut();
        router.replace("/login?expired=1");
      }, 15 * 60 * 1000);
    };
    const activityEvents = ["pointerdown", "keydown", "mousemove", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimeout));
    resetTimeout();

    return () => {
      clearTimeout(timeout);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimeout));
    };
  }, [pathname, dark, router]);

  if (pathname === "/login" || pathname === "/set-password") return children;

  function toggleTheme() {
    const nextTheme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("stilo-theme", nextTheme);
    window.dispatchEvent(new Event(themeEvent));
  }

  async function logout() {
    await authClient.signOut();
    router.replace("/login");
  }

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Image className="brand-logo brand-logo-small" src="/stilo-logo.png.jpeg" alt="Stilo" width={36} height={36} priority />
          <span><strong>stilo</strong><small>CONTROLE DE USUÁRIOS</small></span>
          <button className="icon-button sidebar-close" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </div>
        <div className="workspace-label">GESTÃO</div>
        <nav className="main-nav" aria-label="Navegação principal">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`nav-link ${pathname === href || pathname.startsWith(`${href}/`) ? "nav-link-active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === "Acessos" && <ChevronDown className="nav-chevron" size={15} />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a className="nav-link" href="mailto:suporte@credipi.com.br"><CircleHelp size={18} /><span>Suporte</span></a>
          <div className="sidebar-rule" />
          <div className="profile-row"><span className="profile-avatar">AD</span><span className="profile-copy"><strong>Administrador</strong><small>Conta principal</small></span><button className="icon-button" aria-label="Sair" title="Sair" onClick={logout}><LogOut size={17} /></button></div>
        </div>
      </aside>
      {menuOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <div className="topbar-context"><span className="topbar-dot" /> Ambiente seguro <span className="topbar-divider">/</span> Stilo</div>
          <button className="icon-button theme-toggle" title={dark ? "Ativar tema claro" : "Ativar tema escuro"} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"} onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
