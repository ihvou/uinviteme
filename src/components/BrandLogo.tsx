import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const markSizes = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

const textSizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  size = "md",
  showText = true,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src="/logo.svg"
        alt=""
        aria-hidden="true"
        className={cn(markSizes[size], "shrink-0", markClassName)}
      />
      {showText && (
        <span
          className={cn(
            "font-display font-semibold text-foreground",
            textSizes[size],
            textClassName,
          )}
        >
          uInvite.Me
        </span>
      )}
    </span>
  );
}
