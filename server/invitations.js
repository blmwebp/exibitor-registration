import { randomBytes } from 'node:crypto';
import { activeOptions } from './database.js';
import { authenticate, installManagement } from './staff.js';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { completionSchema, fieldErrors, labels, registrationSchema } from '../shared/form.js';

const assignmentSchema = registrationSchema.pick({
  interestedIn: true, boothType: true, boothSize: true, stallNo: true
});
const idSchema = z.string().trim().toUpperCase().regex(/^EXH-[0-9A-F]{24}$/);

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function installInvitations(app, { config, db, jsonRequest, sendRegistration }) {
  const find = async id => (await db.query('SELECT * FROM invitations WHERE id = $1', [id])).rows[0];
  const list = async () => (await db.query(`
    SELECT id, created_at, completed_at, assignment, registration, 'Invitation' AS source FROM invitations
    UNION ALL
    SELECT id, created_at, created_at, NULL::jsonb, registration, 'General enquiry' FROM exhibitor_enquiries
    ORDER BY created_at DESC
  `)).rows;
  const limiter = (limit, skipSuccessfulRequests = false) => rateLimit({
    windowMs: 15 * 60 * 1000, limit, skipSuccessfulRequests, standardHeaders: 'draft-8',
    legacyHeaders: false, message: { message: 'Too many attempts. Try again in 15 minutes.' }
  });

  app.get('/api/options', async (_req, res) => res.json(await activeOptions(db)));
  app.use('/api/admin', limiter(12, true), authenticate(db, config));
  installManagement(app, db, config, jsonRequest);

  app.get('/api/admin/invitations', async (_req, res) => {
    res.json({ invitations: (await list()).map(row => ({
      id: row.id, createdAt: row.created_at, completedAt: row.completed_at,
      source: row.source, assignment: row.assignment ?? {},
      registration: row.registration
    })) });
  });

  app.post('/api/admin/invitations', ...jsonRequest, async (req, res) => {
    const parsed = assignmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Select all four assignment details.' });
    const id = 'EXH-' + randomBytes(12).toString('hex').toUpperCase();
    const assignment = parsed.data;
    const choices = await activeOptions(db);
    if (!Object.entries(assignment).every(([kind, value]) => choices[kind].includes(value))) {
      return res.status(400).json({ message: 'Select currently active options. Refresh the dashboard for updated choices.' });
    }
    const { rows } = await db.query(`
      INSERT INTO invitations (id, stall, assignment) VALUES ($1, $2, $3)
      ON CONFLICT (stall) DO NOTHING RETURNING id
    `, [id, assignment.stallNo, assignment]);
    if (!rows.length) {
      return res.status(409).json({ message: 'This stall already has an invitation or completed registration.' });
    }
    res.status(201).json({ id });
  });

  app.post('/api/admin/invitations/revoke', ...jsonRequest, async (req, res) => {
    const id = idSchema.safeParse(req.body?.id);
    if (!id.success) return res.status(400).json({ message: 'Invalid registration ID.' });
    const { rows } = await db.query('DELETE FROM invitations WHERE id = $1 AND completed_at IS NULL RETURNING id', [id.data]);
    if (!rows.length) return res.status(409).json({ message: 'Only pending invitations can be revoked.' });
    res.json({ message: 'Invitation revoked and stall released.' });
  });

  app.get('/api/admin/registrations.csv', async (_req, res) => {
    const keys = Object.keys(labels);
    const rows = [['Registration ID', 'Completed at (UTC)', 'Source', ...Object.values(labels)]];
    for (const row of await list()) {
      if (!row.completed_at) continue;
      const data = row.registration;
      rows.push([row.id, new Date(row.completed_at).toISOString(), row.source, ...keys.map(key => data[key])]);
    }
    res.attachment('exhibitor-registrations.csv').type('text/csv; charset=utf-8')
      .send('\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n');
  });

  app.use('/api/invitations', limiter(30));

  app.post('/api/invitations/lookup', ...jsonRequest, async (req, res) => {
    const id = idSchema.safeParse(req.body?.id);
    if (!id.success) return res.status(400).json({ message: 'Enter a valid registration ID.' });
    const row = await find(id.data);
    if (!row) return res.status(404).json({ message: 'Registration ID not found. Check it with your agency.' });
    if (row.completed_at) return res.status(409).json({ message: 'This registration has already been completed.' });
    res.json({ id: row.id, assignment: row.assignment });
  });

  app.post('/api/invitations/complete', ...jsonRequest, async (req, res) => {
    const id = idSchema.safeParse(req.body?.id);
    if (!id.success) return res.status(400).json({ message: 'Enter a valid registration ID.' });
    const row = await find(id.data);
    if (!row) return res.status(404).json({ message: 'This invitation is unavailable. Contact your agency.' });
    if (row.completed_at) return res.status(409).json({ message: 'This registration has already been completed.' });
    const parsed = completionSchema.safeParse(req.body?.details);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Please check the highlighted fields.', errors: fieldErrors(parsed.error) });
    }
    const assignment = row.assignment;
    const details = { ...parsed.data, ...assignment };
    delete details.companyFax;
    const { rows } = await db.query(
      'UPDATE invitations SET completed_at = now(), registration = $1 WHERE id = $2 AND completed_at IS NULL RETURNING id',
      [details, row.id]
    );
    if (!rows.length) return res.status(409).json({ message: 'This invitation has changed. Contact your agency.' });
    res.status(201).json({ reference: row.id });
    Promise.resolve().then(() => sendRegistration(details, row.id)).catch(() => {
      console.error('Completed registration notification failed', { reference: row.id });
    });
  });
}
