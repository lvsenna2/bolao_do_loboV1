"use client";

import { History, Menu, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { BrandLogo } from "@/components/brand/brand-logo";
import { mainNavigationItems } from "./navigation";
import { NavigationList } from "./navigation-list";
import { ThemeToggle } from "./theme-toggle";

/**
 * A barra inferior so cabe alguns atalhos, entao o menu lateral e o unico lugar do celular
 * onde todas as secoes (inclusive Jogos, Ranking e Ranking XP) ficam acessiveis.
 */
export function UserMobileMenu({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="Abrir menu"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-white/15 bg-white/8 text-white transition hover:border-brand-gold hover:text-brand-gold lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] lg:hidden">
              <button
                aria-label="Fechar menu"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                type="button"
              />
              <aside className="relative flex h-full w-full max-w-xs flex-col border-r border-brand-gold/20 bg-[#0b0b0b] text-white shadow-2xl">
                <div className="flex min-h-16 items-center justify-between border-b border-brand-gold/20 px-4 py-2">
                  <BrandLogo />
                  <button
                    aria-label="Fechar menu"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-button border border-white/15"
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <NavigationList className="[&_a]:h-11" items={mainNavigationItems} />
                  <div className="mt-4 space-y-1 border-t border-white/10 pt-4">
                    <Link
                      className="flex h-11 items-center gap-3 rounded-button px-3 text-sm font-medium text-white/75 transition hover:bg-white/5 hover:text-brand-gold"
                      href={"/rodadas-especiais/historico" as Route}
                    >
                      <History className="h-4 w-4" />
                      Historico especial
                    </Link>
                    {isAdmin ? (
                      <Link
                        className="flex h-11 items-center gap-3 rounded-button px-3 text-sm font-medium text-white/75 transition hover:bg-white/5 hover:text-brand-gold"
                        href={"/admin" as Route}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Painel administrativo
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="flex items-center justify-between rounded-control bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/65">Aparencia</span>
                    <ThemeToggle />
                  </div>
                </div>
              </aside>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
