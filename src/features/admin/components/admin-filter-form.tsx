import { Search } from "lucide-react";

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
    <form className="mb-5 flex flex-col gap-3 rounded-card border border-app-border bg-app-surface p-4 lg:flex-row lg:items-end">
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
      <button
        className="inline-flex h-10 items-center justify-center rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
        type="submit"
      >
        {actionLabel}
      </button>
    </form>
  );
}
