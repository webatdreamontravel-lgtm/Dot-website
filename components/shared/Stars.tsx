import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * All five stars are always drawn. Rendering only the earned ones makes a
 * three-star review look like a perfect score out of three.
 */
export function Stars({
  rating,
  className,
  size = "sm",
}: {
  rating: number;
  className?: string;
  size?: "sm" | "lg";
}) {
  const box = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span className={cn("flex gap-0.5", className)} aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(box, i < rating ? "fill-yellow text-yellow" : "fill-none text-navy/20")}
        />
      ))}
    </span>
  );
}
