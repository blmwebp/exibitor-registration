import { z } from 'zod';
export function loadConfig(env = process.env) {
 const secure = z.enum(['true', 'false']).default('true').parse(env.SMTP_SECURE) === 'true';
 const config = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PUBLIC_ORIGIN: z.url(), TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  ADMIN_USERNAME: z.string().regex(/^[!-9;-~]{1,80}$/),
  ADMIN_PASSWORD: z.string().min(8).max(200),
  DATABASE_URL: z.url().refine(value => /^postgres(?:ql)?:\/\//.test(value)),
  SMTP_HOST: z.string().min(1), SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_USER: z.email(), SMTP_PASS: z.string().min(1),
  MAIL_FROM_NAME: z.string().min(1).refine(s => !/[\r\n]/.test(s)), MAIL_TO: z.email()
 }).parse(env);
 const origin = new URL(config.PUBLIC_ORIGIN);
 if (origin.origin !== config.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN must be an origin without a trailing slash or path.');
 if (config.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new Error('Production PUBLIC_ORIGIN must use HTTPS.');
 return {...config, SMTP_SECURE: secure};
}
