import { siteConfig } from "@/lib/data/siteConfig";

/**
 * Email templates.
 *
 * Table layout and inline styles throughout: Outlook and Gmail strip
 * <style> blocks and ignore flexbox, so anything cleverer than this renders
 * as a stack of unstyled text in the clients most people actually use.
 */

const NAVY = "#0f1e3d";
const CREAM = "#fef9e7";
const YELLOW = "#f4c542";
const MUTED = "#5a6785";

export function layout({ heading, body, preheader }: {
  heading: string;
  body: string;
  /** The grey line after the subject in an inbox list. */
  preheader: string;
}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf5;border-radius:16px;border:1px solid rgba(15,30,61,0.08);">
    <tr><td style="padding:28px 32px 0;">
      <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:${YELLOW};color:${NAVY};font-weight:700;font-size:12px;">DOT</span>
      <span style="margin-left:10px;font-size:17px;font-weight:600;color:${NAVY};">${siteConfig.name}</span>
    </td></tr>
    <tr><td style="padding:22px 32px 0;">
      <h1 style="margin:0;font-size:25px;line-height:1.25;color:${NAVY};font-weight:700;">${heading}</h1>
    </td></tr>
    <tr><td style="padding:14px 32px 30px;font-size:15px;line-height:1.6;color:${MUTED};">${body}</td></tr>
  </table>
  <p style="max-width:520px;margin:18px auto 0;font-size:12px;line-height:1.6;color:rgba(15,30,61,0.45);text-align:center;">
    ${siteConfig.name} · a strangers-to-friends travel community<br>
    Not expecting this? You can safely ignore it.
  </p>
</td></tr></table></body></html>`;
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
    <tr><td style="border-radius:999px;background:${NAVY};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:${CREAM};text-decoration:none;border-radius:999px;">${label}</a>
    </td></tr></table>`;
}

/**
 * Confirms someone owns the address they signed up with.
 *
 * Leads with a code rather than a link: the person is still sitting on the
 * signup screen waiting, and a code lets them finish there instead of
 * bouncing out to their inbox and back. The link is kept underneath for
 * anyone who'd rather just tap it, or who opens the mail on another device.
 */
export function verificationEmail({
  name,
  code,
  confirmUrl,
}: {
  name: string | null;
  code: string;
  confirmUrl: string;
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
        <p style="margin:0 0 16px;font-size:13px;">The code expires in an hour and can only be used once.</p>
        <p style="margin:0 0 6px;font-size:13px;">Not on that screen any more? Tap this instead:</p>
        <p style="margin:0;font-size:13px;word-break:break-all;">
          <a href="${confirmUrl}" style="color:${MUTED};">${confirmUrl}</a></p>`,
    }),
    text: `${greeting}

Welcome to ${siteConfig.name}. Your verification code is:

    ${spaced}

Enter it on the signup screen to finish. It expires in an hour and works once.

Not on that screen any more? Use this link instead:
${confirmUrl}

If you weren't expecting this, you can ignore it.`,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
