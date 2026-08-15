import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
  authenticated?: boolean;
};

export function SiteHeader({ authenticated = false }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-app-border bg-app-background">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {authenticated ? (
            <Link className={buttonVariants({ size: "sm", variant: "accent" })} href="/dashboard">
              Minha conta
            </Link>
          ) : (
            <>
              <Link
                className={buttonVariants({ size: "sm", variant: "secondary" })}
                href="/login"
              >
                Entrar
              </Link>
              <Link
                className={buttonVariants({
                  className: "hidden sm:inline-flex",
                  size: "sm",
                  variant: "accent"
                })}
                href="/register"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
