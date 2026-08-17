"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AnimatedHeadingProps = {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
  delay?: number;
};

export function AnimatedHeading({
  children,
  className,
  as = "h2",
  delay = 0,
}: AnimatedHeadingProps) {
  const Tag = motion[as];
  return (
    <Tag
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "font-display tracking-tight leading-[0.95]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
