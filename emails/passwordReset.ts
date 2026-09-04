import { siteConfig } from "@/lib/data/siteConfig";
import { CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * Lets someone who has forgotten their password prove the address is theirs.
 *
 * A code and nothing else, for the same reason verification.ts carries no
 * link: a URL built from the running deployment once shipped every production
 * email with an unclickable "http://localhost:3000/…". A code reads the same
 * everywhere, and the person is already sitting on the screen that wants it.
 *
 * Deliberately does NOT say whether an account exists — this template is only
 * rendered when one does, and the action stays silent either way.
 */
export function passwordResetEmail({
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
    subject: `${spaced} is your ${siteConfig.name} password reset code`,
    html: layout({
      heading: "Reset your password",
      preheader: `${spaced} — enter this to set a new password.`,
      body: `
        <p style="margin:0 0 14px;">${greeting}</p>
        <p style="margin:0 0 4px;">Someone asked to reset the password for this account. Enter this code to choose a new one:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="border-radius:12px;background:${CREAM};border:1px solid rgba(15,30,61,0.1);padding:16px 28px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:6px;color:${NAVY};">${spaced}</span>
          </td></tr>
        </table>
        <p style="margin:0 0 6px;font-size:13px;">The code expires in an hour and can only be used once.</p>
        <p style="margin:0;font-size:13px;color:${MUTED};">If you didn't ask for this, you can ignore this email —
          your password stays as it is and nobody has been given access.</p>`,
    }),
    text: `${greeting}

Someone asked to reset the password for your ${siteConfig.name} account. Your reset code is:

    ${spaced}

Enter it on the reset screen to choose a new password. It expires in an hour and works once.

If you didn't ask for this, you can ignore this email — your password stays as it is and nobody has been given access.`,
  };
}
