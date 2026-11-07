import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-sm font-medium transition-[background-color,box-shadow,color] duration-hover ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-maroon text-fg shadow-highlight-strong ring-1 ring-inset ring-maroon-bright hover:bg-maroon-bright",
        secondary: "bg-surface-2 text-fg shadow-highlight ring-1 ring-inset ring-ring hover:ring-ring-strong",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
      },
      size: { md: "h-8 px-3", sm: "h-7 px-2 text-xs", icon: "h-8 w-8", "icon-sm": "h-7 w-7" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...p }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...p} />
));
Button.displayName = "Button";
