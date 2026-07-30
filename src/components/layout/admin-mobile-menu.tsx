"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { adminNavigationItems } from "./navigation";
import { NavigationList } from "./navigation-list";

export function AdminMobileMenu() {
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
        aria-label="Abrir menu administrativo"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-app-border bg-app-surface text-app-foreground lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu administrativo"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside className="relative flex h-full w-[min(86vw,22rem)] flex-col border-r border-app-border bg-app-surface shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-app-border px-4">
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
            <div className="flex-1 overflow-y-auto p-4">
              <NavigationList items={adminNavigationItems} />
            </div>
            <div className="border-t border-app-border p-4">
              <Link
                className="inline-flex h-11 w-full items-center justify-center rounded-button border border-brand-gold/40 font-semibold text-brand-gold"
                href="/dashboard"
              >
                Voltar para área do usuário
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
