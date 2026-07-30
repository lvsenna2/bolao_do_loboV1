import { Search } from "lucide-react";

import { FormLoadingButton } from "@/components/ui/loading-button";

type AdminFilterFormProps = {
  actionLabel?: string;
  children?: React.ReactNode;
  placeholder?: string;
  query?: string;
};

export function AdminFilterForm({
  actionLabel = "Filtrar",
  children,
  placeholder = "Pesquisar",
  query = ""
}: AdminFilterFormProps) {
  return (
    <form className="mb-5 flex min-w-0 flex-col gap-3 rounded-card border border-app-border bg-app-surface p-3 sm:p-4 lg:flex-row lg:items-end">
      <label className="flex-1 space-y-2">
        <span className="text-sm font-medium text-app-foreground">Pesquisa</span>
        <div className="relative">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted"
          />
          <input
            className="h-10 w-full rounded-control border border-app-border bg-app-background pl-9 pr-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            defaultValue={query}
            name="q"
            placeholder={placeholder}
            type="search"
          />
        </div>
      </label>
      {children}
      <FormLoadingButton
        className="inline-flex h-11 w-full items-center justify-center rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 lg:h-10 lg:w-auto"
        pendingLabel="Carregando..."
        type="submit"
      >
        {actionLabel}
      </FormLoadingButton>
    </form>
  );
}
