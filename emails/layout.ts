import { siteConfig } from "@/lib/data/siteConfig";

/**
 * The shell every email is built in.
 *
 * Table layout and inline styles throughout: Outlook and Gmail strip
 * <style> blocks and ignore flexbox, so anything cleverer than this renders
 * as a stack of unstyled text in the clients most people actually use.
 *
 * Templates live one per file beside this. They export a plain
 * { subject, html, text } object and know nothing about sending — which is
 * what makes them readable without a mail server, and testable without one.
 */

export const NAVY = "#0f1e3d";
export const CREAM = "#fef9e7";
export const YELLOW = "#f4c542";
export const MUTED = "#5a6785";

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

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * The receipt someone gets the moment their seat is paid for.
 *
 * Leads with the booking reference because that is the thing they will be
 * asked for on WhatsApp, and puts the money in plain figures — what was paid
 * now, and what (if anything) is still owed. A confirmation that hides the
 * balance is how a traveller arrives at the pickup point believing they had
 * paid in full.
 */
