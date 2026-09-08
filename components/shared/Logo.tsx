import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /**
   * What the logo is sitting on — not what colour the logo is.
   *
   * "dark" means dark text on a cream navbar, where the artwork's own navy
   * and teal already read: the logo goes down bare. "light" means a dark
   * ground -- the footer, or a transparent navbar over a hero photograph --
   * where navy-on-navy is invisible, so it gets the white lockup.
   *
   * The prop existed before this and picked between two identical class
   * strings, so it had never changed anything.
   */
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
      {/*
        Cropped and keyed, not the 320x320 original.
 
        That file centres the lockup in a square with 101px of padding above
        and 113px below — the artwork fills 30% of it — over a baked-in
        rgb(250,251,219) panel. At 48px the logo itself came out about 16px
        tall on a pale rectangle, which is why it read as a sticker rather
        than a wordmark. Cropped to the artwork (312x126) and the flat
        background keyed to alpha: 78% of the file is transparent now.
      */}
      {/*
        Two files, no panel behind either.
 
        The navy in the artwork measures 1.08–1.48:1 against the hero — the
        same luminance as the background, so it simply is not there. That is
        what the old baked-in panel was covering for, and a cream chip is
        still a rectangle. So the dark ground gets the brand's white lockup
        instead: 16.5:1 on the footer navy, and white is the brightest fill
        there is, so wherever the hero scrim carried the cream it carries
        this. One flat colour, no teal to lose against blue water.
 
        Same 312x126 frame as the mark with the artwork at the same offset,
        so the two swap without moving a pixel.
      */}
      <Image
        src={variant === "light" ? "/images/dot-logo-white.png" : "/images/dot-logo-mark.png"}
        alt="Dream On Travel"
        width={312}
        height={126}
        priority
        className="h-8 w-auto object-contain md:h-9"
      />
      <span className="sr-only">Dream On Travel</span>
    </Link>
  );
}
