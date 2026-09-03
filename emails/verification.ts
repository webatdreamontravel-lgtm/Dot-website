import { siteConfig } from "@/lib/data/siteConfig";
import { CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * Confirms someone owns the address they signed up with.
 *
 * A code and nothing else. There used to be a confirmation link underneath
 * for anyone who'd rather tap than type, but it was the only email that
 * built its URL from the running deployment — and when a local value found
 * its way into the hosting environment, every production email carried an
 * unclickable "http://localhost:3000/…". The mail sent perfectly and simply
 * could not be used, with nothing anywhere to say so.
 *
 * A code has no such failure mode. It is the same eight digits wherever it
 * is read, and the person is already sitting on the screen that wants it.
 */
export function verificationEmail({
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
    subject: `${spaced} is your Dream On Travel code`,
    html: layout({
      heading: "Your verification code",
      preheader: `${spaced} — enter this to finish setting up your account.`,
      body: `
        <p style="margin:0 0 14px;">${greeting}</p>
        <p style="margin:0 0 4px;">Welcome to ${siteConfig.name}. Enter this code on the signup screen to finish:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="border-radius:12px;background:${CREAM};border:1px solid rgba(15,30,61,0.1);padding:16px 28px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:6px;color:${NAVY};">${spaced}</span>
          </td></tr>
        </table>
        <p style="margin:0 0 6px;font-size:13px;">The code expires in an hour and can only be used once.</p>
        <p style="margin:0;font-size:13px;color:${MUTED};">Closed the tab? Head back to
          ${siteConfig.name} and choose &ldquo;Email me a code&rdquo; for a fresh one.</p>`,
    }),
    text: `${greeting}

Welcome to ${siteConfig.name}. Your verification code is:

    ${spaced}

Enter it on the signup screen to finish. It expires in an hour and works once.

Closed the tab? Head back to ${siteConfig.name} and choose "Email me a code" for a fresh one.

If you weren't expecting this, you can ignore it.`,
  };
}
