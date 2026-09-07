"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { adminNavigationItems, mainNavigationItems } from "./navigation";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function NavigationSearch({ mode = "user" }: { mode?: "user" | "admin" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const items = mode === "admin" ? adminNavigationItems : mainNavigationItems;
  const results = items.filter((item) =>
    normalizeSearch(item.label).includes(normalizeSearch(query))
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Pesquisar seções"
        className={cn(
          "hidden h-10 items-center justify-center gap-2 rounded-button border px-3 text-sm transition sm:inline-flex",
          mode === "user"
            ? "border-white/15 bg-white/8 text-white/75 hover:border-brand-gold hover:text-brand-gold"
            : "border-app-border bg-app-surface text-app-muted hover:border-brand-gold hover:text-brand-gold"
        )}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        type="button"
      >
        <Search aria-hidden className="h-4 w-4" />
        <span className="hidden xl:inline">Pesquisar</span>
      </button>
      <Modal
        initialFocusRef={inputRef}
        label="Pesquisar seções"
        onClose={() => setOpen(false)}
        open={open}
      >
        <section className="mx-auto mt-[10dvh] flex max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden rounded-card border border-app-border bg-app-surface shadow-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-app-border px-5 py-3">
            <h2 className="font-semibold">Ir para uma seção</h2>
            <button
              aria-label="Fechar pesquisa"
              className="inline-flex h-10 w-10 items-center justify-center rounded-button text-app-muted hover:text-app-foreground"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 pt-4">
            <label className="sr-only" htmlFor="navigation-search">
              Nome da seção
            </label>
            <input
              ref={inputRef}
              className="h-12 w-full rounded-control border border-app-border bg-app-background px-4 text-base text-app-foreground placeholder:text-app-muted"
              id="navigation-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque palpites, ligas, ranking…"
              type="search"
              value={query}
            />
          </div>
          <p aria-live="polite" className="px-5 pt-3 text-xs text-app-muted">
            {results.length} {results.length === 1 ? "seção encontrada" : "seções encontradas"}
          </p>
          <nav aria-label="Resultados da pesquisa" className="min-h-0 overflow-y-auto p-3">
            {results.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="flex min-h-12 items-center gap-3 rounded-button px-3 text-sm font-medium hover:bg-app-elevated hover:text-brand-gold"
                  href={item.href as Route}
                  key={item.href}
                  onClick={() => setOpen(false)}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {results.length === 0 ? (
              <p className="px-2 py-6 text-sm text-app-muted">
                Nenhuma seção encontrada. Tente outro nome.
              </p>
            ) : null}
          </nav>
        </section>
      </Modal>
    </>
  );
}
