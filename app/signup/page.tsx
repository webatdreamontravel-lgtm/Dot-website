import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Nothing to sign up for if they're already in.
  if (await getSessionProfile()) redirect("/account");

  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "";

  return <SignupForm next={target} />;
}
