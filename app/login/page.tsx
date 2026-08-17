import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only same-origin paths — an open redirect here would let someone send a
  // login link that bounces somewhere else after sign-in.
  //
  // Left empty when there's no explicit destination, so the sign-in action
  // can decide from the account's role: admins to the panel, travellers back
  // to the site. Defaulting here would override that.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "";

  return <LoginForm next={target} />;
}
