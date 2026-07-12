"use client";

import { Loader2 } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useRef,
  useState
} from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
};

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      className,
      disabled,
      icon,
      isLoading = false,
      loadingLabel = "Processando...",
      onClick,
      type = "button",
      ...props
    },
    ref
  ) => {
    const [clicked, setClicked] = useState(false);
    const locked = isLoading || clicked;

    function handleClick(event: MouseEvent<HTMLButtonElement>) {
      if (locked || disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      setClicked(true);
      window.setTimeout(() => setClicked(false), 700);

      onClick?.(event);
    }

    return (
      <button
        ref={ref}
        aria-busy={locked}
        className={cn(
          "inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-70",
          className
        )}
        disabled={disabled || locked}
        onClick={handleClick}
        type={type}
        {...props}
      >
        {locked ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : icon}
        {locked ? loadingLabel : children}
      </button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";

type FormLoadingButtonProps = LoadingButtonProps & {
  pendingLabel?: string;
};

export function FormLoadingButton({
  children,
  isLoading,
  loadingLabel,
  pendingLabel,
  type = "submit",
  ...props
}: FormLoadingButtonProps) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  if (pending) {
    wasPending.current = true;
  }

  if (!pending && wasPending.current) {
    wasPending.current = false;
  }

  return (
    <LoadingButton
      isLoading={Boolean(isLoading) || pending}
      loadingLabel={pendingLabel ?? loadingLabel ?? "Salvando..."}
      type={type}
      {...props}
    >
      {children}
    </LoadingButton>
  );
}
