import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-normal transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_12px_28px_hsl(160_31%_28%_/_0.22)] hover:bg-[hsl(160_34%_23%)] hover:shadow-[0_16px_36px_hsl(160_31%_28%_/_0.26)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_12px_28px_hsl(4_63%_44%_/_0.18)] hover:bg-destructive/90",
        outline:
          "border border-border/80 bg-card/80 text-foreground shadow-[0_1px_0_hsl(0_0%_100%_/_0.85)_inset] hover:border-primary/25 hover:bg-accent/60",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_1px_0_hsl(0_0%_100%_/_0.72)_inset] hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
