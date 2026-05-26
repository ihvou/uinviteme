import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const markSizes = {
  sm: "h-12 w-12",
  md: "h-14 w-14",
  lg: "h-16 w-16",
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
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className={cn(markSizes[size], "shrink-0 object-contain", markClassName)}
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
