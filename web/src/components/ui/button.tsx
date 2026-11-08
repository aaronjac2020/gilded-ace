import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-semibold transition-[background-color,box-shadow,color] duration-hover ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-maroon text-card shadow-card hover:bg-maroon-bright active:bg-maroon",
        secondary: "bg-surface-1 text-fg shadow-card ring-1 ring-inset ring-ring hover:ring-ring-strong active:bg-surface-2",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
      },
      size: { lg: "h-12 px-6 text-base", md: "h-10 px-4", sm: "h-8 px-3", icon: "h-9 w-9", "icon-sm": "h-8 w-8" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...p }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...p} />
));
Button.displayName = "Button";
