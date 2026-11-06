import nodemailer from 'nodemailer';
import { labels } from '../shared/form.js';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createMailer(config) {
 const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE,
  requireTLS: !config.SMTP_SECURE,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  disableFileAccess: true, disableUrlAccess: true,
  tls: { minVersion: 'TLSv1.2' }
 });
 return async (data, reference) => {
  const rows = Object.entries(labels).map(([key,label]) => [label, key === 'consent' ? 'Yes — permission to contact granted' : data[key] || 'Not provided']);
  const result = await transporter.sendMail({
   from: {name: config.MAIL_FROM_NAME, address: config.SMTP_USER}, to: config.MAIL_TO,
   replyTo: {name: data.fullName, address: data.email},
   subject: `Exhibitor Registration | ${reference}`,
   text: `Exhibitor Registration\nReference: ${reference}\nReceived: ${new Date().toISOString()}\n\n` + rows.map(([k,v]) => `${k}: ${v}`).join('\n\n'),
   html: `<div style="font-family:Arial,sans-serif;max-width:720px;color:#153d33"><h1>New exhibitor enquiry</h1><p>Reference: ${reference}</p><table style="border-collapse:collapse;width:100%">${rows.map(([k,v]) => `<tr><th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(k)}</th><td style="padding:12px;border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join('')}</table></div>`
  });
  if (!result.accepted?.length || result.rejected?.length) throw new Error('SMTP did not accept the configured recipient.');
 };
}
