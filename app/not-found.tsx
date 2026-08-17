import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar variant="solid" />
      <main className="bg-cream pt-32 md:pt-40 pb-24 min-h-[80svh] flex items-center">
        <div className="mx-auto max-w-3xl px-6 md:px-8 text-center">
          <p className="font-script text-2xl text-coral">Lost in the wild →</p>
          <h1 className="mt-2 font-display text-7xl md:text-9xl tracking-tight leading-none">
            4<span className="italic text-teal">0</span>4
          </h1>
          <p className="mt-6 text-lg text-navy/65 max-w-md mx-auto">
            This trail doesn&apos;t exist. Maybe a typo, maybe a page we&apos;ve retired, maybe a parallel universe.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="btn btn-primary">Take me home</Link>
            <Link href="/trips" className="btn bg-navy text-cream">View trips instead</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
