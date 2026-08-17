import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function Logo({ className, variant = "light" }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="Dream On Travel — Home"
      className={cn(
        "group inline-flex items-center transition-transform duration-300 hover:scale-[1.02]",
        className,
      )}
    >
      <Image
        src="/images/dot-logo.png"
        alt="Dream On Travel"
        width={320}
        height={320}
        priority
        className={cn(
          "object-contain",
          variant === "light"
            ? "h-12 w-12 md:h-14 md:w-14 rounded-xl"
            : "h-12 w-12 md:h-14 md:w-14 rounded-xl",
        )}
      />
      <span className="sr-only">Dream On Travel</span>
    </Link>
  );
}
