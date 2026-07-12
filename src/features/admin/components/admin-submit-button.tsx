import type { ButtonHTMLAttributes, ReactNode } from "react";

import { FormLoadingButton } from "@/components/ui/loading-button";

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
  return (
    <FormLoadingButton
      className={className}
      disabled={disabled}
      pendingLabel={pendingLabel}
      type={type}
      {...props}
    >
      {children}
    </FormLoadingButton>
  );
}
