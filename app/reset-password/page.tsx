import type { Metadata } from "next";

import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only same-origin paths — an open redirect here would let someone send a
  // reset link that bounces somewhere else once the password is set.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "";

  return <ResetPasswordForm next={target} />;
}
