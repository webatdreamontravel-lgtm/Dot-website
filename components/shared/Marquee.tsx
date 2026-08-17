import { cn } from "@/lib/utils";

type MarqueeProps = {
  items: string[];
  className?: string;
  separator?: string;
};

export function Marquee({ items, className, separator = "·" }: MarqueeProps) {
  // Duplicate items so the loop is seamless
  const doubled = [...items, ...items];
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="marquee-track flex gap-8 whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="font-display text-xl md:text-2xl tracking-tight inline-flex items-center gap-8"
          >
            {item}
            <span aria-hidden className="opacity-40">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
