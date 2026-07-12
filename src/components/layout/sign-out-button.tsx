"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { buttonVariants } from "@/components/ui/button";

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  return (
    <LoadingButton
      aria-label={compact ? "Sair" : undefined}
      className={buttonVariants({ size: "sm", variant: "ghost" })}
      icon={<LogOut aria-hidden className="h-4 w-4" />}
      isLoading={isPending}
      loadingLabel={compact ? "" : "Saindo..."}
      onClick={() => {
        setIsPending(true);
        void signOut({ callbackUrl: "/login" });
      }}
      type="button"
    >
      {!compact ? "Sair" : null}
    </LoadingButton>
  );
}
