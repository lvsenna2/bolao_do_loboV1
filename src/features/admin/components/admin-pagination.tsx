import Link from "next/link";
import type { Route } from "next";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  pathname: string;
  searchParams: Record<string, string | string[] | undefined>;
  total: number;
};

function buildHref(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "page" || value === undefined || value === "") {
      return;
    }

    params.set(key, Array.isArray(value) ? value[0] : value);
  });

  params.set("page", String(page));

  return `${pathname}?${params.toString()}`;
}

export function AdminPagination({
  page,
  pageSize,
  pathname,
  searchParams,
  total
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-app-muted sm:flex-row sm:items-center sm:justify-between">
      <span>
        Pagina {page} de {totalPages} | {total} registros
      </span>
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={page <= 1}
          className={cn(
            buttonVariants({ size: "sm", variant: "secondary" }),
            page <= 1 ? "pointer-events-none opacity-50" : ""
          )}
          href={buildHref(pathname, searchParams, previousPage) as Route}
        >
          Anterior
        </Link>
        <Link
          aria-disabled={page >= totalPages}
          className={cn(
            buttonVariants({ size: "sm", variant: "secondary" }),
            page >= totalPages ? "pointer-events-none opacity-50" : ""
          )}
          href={buildHref(pathname, searchParams, nextPage) as Route}
        >
          Proxima
        </Link>
      </div>
    </div>
  );
}
