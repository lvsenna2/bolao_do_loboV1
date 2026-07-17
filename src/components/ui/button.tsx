import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-button px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-brand-blue text-white hover:bg-blue-700",
        accent: "bg-brand-gold text-slate-950 hover:bg-amber-400",
        secondary:
          "border border-app-border bg-app-surface text-app-foreground hover:border-brand-blue hover:text-brand-blue",
        ghost: "text-app-muted hover:bg-app-elevated hover:text-app-foreground",
        danger: "bg-brand-red text-white hover:bg-red-700"
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ className, size, variant }))} {...props} />
    );
  }
);

Button.displayName = "Button";
