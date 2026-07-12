"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type AdminSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function AdminSubmitButton({
  children,
  className,
  disabled,
  pendingLabel = "Salvando...",
  type = "submit",
  ...props
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={cn("disabled:cursor-not-allowed disabled:opacity-60", className)}
      disabled={disabled || pending}
      type={type}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
