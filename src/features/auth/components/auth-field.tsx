"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ className, error, id, label, type = "text", ...props }, ref) => {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-app-foreground" htmlFor={id}>
          {label}
        </label>
        <input
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20",
            error ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20" : "",
            className
          )}
          id={id}
          type={type}
          {...props}
        />
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-300" id={`${id}-error`}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

AuthField.displayName = "AuthField";
