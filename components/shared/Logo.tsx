import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /**
   * What the logo is sitting on — not what colour the logo is.
   *
   * "dark" means dark text on a cream navbar, where the artwork's own navy
   * and teal already read: the logo goes down bare. "light" means the navbar
   * is transparent over a hero photograph, where navy-on-navy is invisible,
   * so it gets a cream chip.
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
        still a rectangle. So the dark background gets a reversed logo
        instead: navy → cream, teal → the brighter teal. 6.8–13.2:1 for the
        cream and 3.4–6.6:1 for the teal, all clear of the 3:1 a graphic
        needs, and nothing boxed in.
      */}
      <Image
        src={variant === "light" ? "/images/dot-logo-light.png" : "/images/dot-logo-mark.png"}
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
