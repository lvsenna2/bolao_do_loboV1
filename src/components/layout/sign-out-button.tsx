"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  return (
    <Button
      aria-label={compact ? "Sair" : undefined}
      onClick={() => void signOut({ callbackUrl: "/login" })}
      size="sm"
      type="button"
      variant="ghost"
    >
      <LogOut aria-hidden className="h-4 w-4" />
      {!compact ? "Sair" : null}
    </Button>
  );
}
