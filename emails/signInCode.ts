import { siteConfig } from "@/lib/data/siteConfig";
import { CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * One-time code for signing in without a password.
 *
 * Separate from verificationEmail on purpose: that one welcomes someone to a
 * new account, and reading "Welcome to Dream On Travel — finish setting up"
 * when you have been a customer for a year is confusing enough to make people
 * think they have been signed out for good.
 *
 * A code and nothing else, for the reason verification.ts documents: a link
 * built from the running deployment once shipped production emails pointing
 * at "http://localhost:3000/…". A code reads the same everywhere.
 */
export function signInCodeEmail({
  name,
  code,
}: {
  name: string | null;
  code: string;
}) {
  const greeting = name ? `Hi ${escapeHtml(name.split(" ")[0])},` : "Hi,";
  const spaced = code.replace(/\s+/g, "");

  return {
    // The code is in the subject so it's readable from the notification
    // banner without opening anything.
    subject: `${spaced} is your ${siteConfig.name} sign-in code`,
    html: layout({
      heading: "Your sign-in code",
      preheader: `${spaced} — enter this to sign in.`,
      body: `
        <p style="margin:0 0 14px;">${greeting}</p>
        <p style="margin:0 0 4px;">Enter this code to sign in to your ${siteConfig.name} account:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="border-radius:12px;background:${CREAM};border:1px solid rgba(15,30,61,0.1);padding:16px 28px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:6px;color:${NAVY};">${spaced}</span>
          </td></tr>
        </table>
        <p style="margin:0 0 6px;font-size:13px;">The code expires in an hour and can only be used once.</p>
        <p style="margin:0;font-size:13px;color:${MUTED};">If you didn't try to sign in, you can ignore this email —
          nobody has been given access to your account.</p>`,
    }),
    text: `${greeting}

Enter this code to sign in to your ${siteConfig.name} account:

    ${spaced}

It expires in an hour and works once.

If you didn't try to sign in, you can ignore this email — nobody has been given access to your account.`,
  };
}
