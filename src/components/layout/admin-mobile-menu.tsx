"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

import { BrandLogo } from "@/components/brand/brand-logo";
import { adminNavigationItems } from "./navigation";
import { NavigationList } from "./navigation-list";
import { ThemeToggle } from "./theme-toggle";

export function AdminMobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    function closeOnDesktop() {
      if (desktop.matches) setOpen(false);
    }
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Abrir menu administrativo"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-app-border bg-app-surface text-app-foreground lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Modal label="Menu administrativo" onClose={() => setOpen(false)} open={open}>
        <aside
          onClick={(event) => {
            if ((event.target as Element).closest("a")) setOpen(false);
          }}
          className="relative flex h-full w-full max-w-sm flex-col border-r border-app-border bg-app-surface shadow-2xl"
        >
          <div className="flex min-h-16 items-center justify-between border-b border-app-border px-4 py-2">
            <BrandLogo href="/admin" />
            <button
              aria-label="Fechar menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-button border border-app-border"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted">
              Painel administrativo
            </p>
            <NavigationList className="[&_a]:h-11" items={adminNavigationItems} />
          </div>
          <div className="space-y-3 border-t border-app-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between rounded-control bg-app-elevated px-3 py-2">
              <span className="text-sm text-app-muted">Aparência</span>
              <ThemeToggle />
            </div>
            <Link
              className="inline-flex h-11 w-full items-center justify-center rounded-button border border-brand-gold/40 font-semibold text-brand-gold"
              href="/dashboard"
            >
              Voltar para área do usuário
            </Link>
          </div>
        </aside>
      </Modal>
    </>
  );
}
