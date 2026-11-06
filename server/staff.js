import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { assignmentKeys } from '../shared/form.js';

const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest();
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,60}$/);
const accountSchema = z.object({ username: usernameSchema, password: z.string().min(10).max(200) });
const optionSchema = z.object({ kind: z.enum(assignmentKeys), value: z.string().trim().min(1).max(120), active: z.boolean() });

export function authenticate(db, config) {
  const expected = digest('Basic ' + Buffer.from(config.ADMIN_USERNAME + ':' + config.ADMIN_PASSWORD).toString('base64'));
  return async (req, res, next) => {
    const header = req.get('authorization') || '';
    if (timingSafeEqual(digest(header), expected)) {
      req.exhibitorRole = 'admin';
      return next();
    }
    if (header.startsWith('Basic ') && header.length < 1600) {
      const credentials = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const separator = credentials.indexOf(':');
      const username = usernameSchema.safeParse(credentials.slice(0, separator));
      const password = credentials.slice(separator + 1);
      if (separator > 0 && username.success && password.length <= 200) {
        const { rows } = await db.query('SELECT password_hash FROM exhibitor_staff WHERE username = $1 AND active', [username.data]);
        if (rows[0]) {
          const [salt, hash] = rows[0].password_hash.split(':');
          if (timingSafeEqual(await derive(password, salt, 64), Buffer.from(hash, 'hex'))) {
            req.exhibitorRole = 'staff';
            return next();
          }
        }
      }
    }
    return res.status(401).json({ message: 'Invalid username or password.' });
  };
}

export function installManagement(app, db, config, jsonRequest) {
  app.get('/api/admin/me', (req, res) => res.json({ role: req.exhibitorRole }));
  app.use(['/api/admin/settings', '/api/admin/staff'], (req, res, next) => {
    if (req.exhibitorRole !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
    next();
  });

  app.get('/api/admin/settings', async (_req, res) => {
    const { rows } = await db.query('SELECT kind, value, active FROM exhibitor_options ORDER BY kind, length(value), value');
    res.json({ choices: rows });
  });
  app.post('/api/admin/settings', ...jsonRequest, async (req, res) => {
    const parsed = optionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Enter a valid option name (1–120 characters).' });
    const { kind, active } = parsed.data;
    const value = kind === 'stallNo' ? parsed.data.value.toUpperCase() : parsed.data.value;
    await db.query(`
      INSERT INTO exhibitor_options (kind, value, active) VALUES ($1, $2, $3)
      ON CONFLICT (kind, value) DO UPDATE SET active = EXCLUDED.active
    `, [kind, value, active]);
    res.json({ ok: true });
  });

  app.get('/api/admin/staff', async (_req, res) => {
    const { rows } = await db.query('SELECT username, active FROM exhibitor_staff ORDER BY username');
    res.json({ users: rows });
  });
  app.post('/api/admin/staff', ...jsonRequest, async (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Use a 3–60 character username (letters, numbers, dots, dashes, underscores) and a password of at least 10 characters.' });
    const { username, password } = parsed.data;
    if (username === config.ADMIN_USERNAME.toLowerCase()) return res.status(409).json({ message: 'That username belongs to the admin.' });
    const salt = randomBytes(16).toString('hex');
    const hash = (await derive(password, salt, 64)).toString('hex');
    const result = await db.query('INSERT INTO exhibitor_staff (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING username', [username, salt + ':' + hash]);
    if (!result.rows.length) return res.status(409).json({ message: 'That username already exists.' });
    res.status(201).json({ username });
  });
  app.post('/api/admin/staff/status', ...jsonRequest, async (req, res) => {
    const parsed = z.object({ username: usernameSchema, active: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid account status.' });
    const { rows } = await db.query('UPDATE exhibitor_staff SET active = $2 WHERE username = $1 RETURNING username', [parsed.data.username, parsed.data.active]);
    if (!rows.length) return res.status(404).json({ message: 'Account not found.' });
    res.json({ ok: true });
  });
}
