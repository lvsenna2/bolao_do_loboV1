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
    const [localLoading, setLocalLoading] = useState(false);
    const lockRef = useRef(false);
    const isSubmitButton = type === "submit";
    const visuallyLoading = isLoading || localLoading;

    function handleClick(event: MouseEvent<HTMLButtonElement>) {
      if (isLoading || localLoading || lockRef.current || disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      lockRef.current = true;

      if (!isSubmitButton) {
        setLocalLoading(true);
      }

      const clickResult = onClick?.(event) as unknown;

      if (isSubmitButton) {
        window.setTimeout(() => {
          lockRef.current = false;
        }, 700);
        return;
      }

      const release = () => {
        lockRef.current = false;
        setLocalLoading(false);
      };

      if (
        clickResult &&
        typeof clickResult === "object" &&
        "finally" in clickResult &&
        typeof clickResult.finally === "function"
      ) {
        clickResult.finally(release);
        return;
      }

      window.setTimeout(release, 700);
    }

    return (
      <button
        ref={ref}
        aria-busy={visuallyLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-70",
          className
        )}
        disabled={disabled || isLoading || localLoading}
        onClick={handleClick}
        type={type}
        {...props}
      >
        {visuallyLoading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : icon}
        {visuallyLoading ? loadingLabel : children}
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
