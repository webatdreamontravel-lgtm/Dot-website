"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Instagram, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/shared/Logo";
import { AccountMenu, AccountMenuMobile } from "@/components/layout/AccountMenu";
import { navLinks, siteConfig } from "@/lib/data/siteConfig";
import { cn } from "@/lib/utils";

type NavbarProps = {
  variant?: "transparent" | "solid";
};

export function Navbar({ variant = "transparent" }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isSolid = variant === "solid" || scrolled;
  const textVariant = variant === "solid" ? "dark" : isSolid ? "dark" : "light";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        isSolid
          ? "bg-cream/85 backdrop-blur-md border-b border-navy/10"
          : "bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-8 py-4"
      >
        <Logo variant={textVariant === "dark" ? "dark" : "light"} />

        <ul className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  textVariant === "dark"
                    ? "text-navy/80 hover:text-navy hover:bg-navy/5"
                    : "text-cream/85 hover:text-cream hover:bg-cream/10",
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-2">
          <AccountMenu tone={textVariant === "dark" ? "dark" : "light"} />
          <a
            href={siteConfig.instagram}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className={cn(
              "h-10 w-10 inline-flex items-center justify-center rounded-full transition-colors",
              textVariant === "dark"
                ? "text-navy hover:bg-navy/10"
                : "text-cream hover:bg-cream/10",
            )}
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "btn",
              textVariant === "dark" ? "btn-primary" : "btn-cream",
              "px-5 py-2 text-sm",
            )}
          >
            <WhatsAppIcon className="h-4 w-4" />
            <span>WhatsApp</span>
          </a>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className={cn(
            "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full",
            textVariant === "dark" ? "text-navy hover:bg-navy/10" : "text-cream hover:bg-cream/10",
          )}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-cream border-t border-navy/10"
          >
            <ul className="px-6 py-4 flex flex-col gap-1">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 font-display text-2xl text-navy"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-navy/10 pt-2" onClick={() => setOpen(false)}>
                <AccountMenuMobile />
              </li>
              <li className="mt-2 flex gap-2">
                <a
                  href={siteConfig.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-cream border border-navy/15 flex-1 justify-center"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
                <a
                  href={siteConfig.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary flex-1 justify-center"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.6-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3 4.8 4.2 1.8.7 2.5.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.1-1.3c1.5.8 3.2 1.3 5 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-3-.2-.3c-.9-1.4-1.4-3-1.4-4.6 0-4.5 3.7-8.2 8.2-8.2 4.5 0 8.2 3.7 8.2 8.2 0 4.5-3.7 8.2-8.2 8.2z"/>
    </svg>
  );
}
