import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "outline"
  | "ghost"
  | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "border border-border bg-muted text-foreground hover:bg-muted/70",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm",
  outline: "border border-border bg-transparent text-foreground hover:bg-muted/50",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
