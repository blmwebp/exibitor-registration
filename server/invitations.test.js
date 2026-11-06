import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from './app.js';
import { PGlite } from '@electric-sql/pglite';
import { initializeDatabase } from './database.js';

const config = {
  PUBLIC_ORIGIN: 'http://localhost:5173',
  ADMIN_USERNAME: 'test-admin',
  ADMIN_PASSWORD: 'test-password-long'
};
const authorization = 'Basic ' + Buffer.from(config.ADMIN_USERNAME + ':' + config.ADMIN_PASSWORD).toString('base64');
const assignment = { interestedIn: 'Nutrition & Food', boothType: 'Shell Scheme', boothSize: '9 sq. m', stallNo: 'H1' };
const details = {
  businessNature: 'Industrial chemical manufacturer',
  facia: 'Example Booth',
  GSTNumber: '',
  website: '',
  fullName: 'Test Person',
  companyName: '=1+1',
  email: 'test@example.com',
  contactNumber: '+91 98765 43210',
  country: 'India',
  designation: 'Manager',
  city: 'Delhi',
  specialRequirements: '',
  additionalMessage: 'Line one\nLine "two"',
  consent: true
};

test('admin invitation, locked assignment, one-time completion and durable CSV export', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'exhibitor-test-'));
  const path = join(folder, 'data.sqlite');
  let db = new PGlite(path);
  try {
    await initializeDatabase(db);
    let app = createApp({ config, db, sendRegistration: async () => { throw new Error('SMTP offline'); } });
    const post = (url, payload, admin = false) => {
      const call = request(app).post(url).set('Origin', config.PUBLIC_ORIGIN);
      if (admin) call.set('Authorization', authorization);
      return call.send(payload);
    };
    const adminGet = url => request(app).get(url).set('Authorization', authorization);
    assert.equal((await request(app).get('/api/admin/registrations.csv')).status, 401);
    assert.equal((await post('/api/admin/invitations', assignment)).status, 401);

    const first = await post('/api/admin/invitations', assignment, true);
    assert.equal(first.status, 201);
    const id = first.body.id;
    assert.match(id, /^EXH-[A-F0-9]{24}$/);
    assert.equal((await post('/api/admin/invitations', assignment, true)).status, 409);
    const lookup = await post('/api/invitations/lookup', { id: id.toLowerCase() });
    assert.deepEqual(lookup.body, { id, assignment });
    assert.equal((await post('/api/invitations/complete', { id, details: { ...details, stallNo: 'H2' } })).status, 400);
    assert.equal((await post('/api/invitations/complete', { id, details: { ...details, consent: false } })).status, 400);
    const submissions = await Promise.all([
      post('/api/invitations/complete', { id, details }),
      post('/api/invitations/complete', { id, details })
    ]);
    assert.deepEqual(submissions.map(response => response.status).sort(), [201, 409]);
    assert.equal((await post('/api/invitations/lookup', { id })).status, 409);
    assert.equal((await post('/api/admin/invitations/revoke', { id }, true)).status, 409);

    await db.close();
    db = new PGlite(path);
    await initializeDatabase(db);
    app = createApp({ config, db, sendRegistration: async () => {} });
    const list = await adminGet('/api/admin/invitations');
    assert.equal(list.body.invitations[0].registration.stallNo, 'H1');
    assert.equal(list.body.invitations[0].registration.email, details.email);
    const csv = await adminGet('/api/admin/registrations.csv');
    assert.equal(csv.status, 200);
    assert.match(csv.headers['content-disposition'], /exhibitor-registrations\.csv/);
    assert.ok(csv.text.includes('"\'=1+1"'));
    assert.ok(csv.text.includes('Line one\nLine ""two""'));

    const second = await post('/api/admin/invitations', { ...assignment, stallNo: 'H2' }, true);
    assert.equal(second.status, 201);
    assert.equal((await post('/api/admin/invitations/revoke', { id: second.body.id }, true)).status, 200);
    assert.equal((await post('/api/invitations/lookup', { id: second.body.id })).status, 404);
    assert.equal((await post('/api/admin/invitations', { ...assignment, stallNo: 'H2' }, true)).status, 201);
  } finally {
    await db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('admins manage options and staff while staff manage only registrations', async () => {
  const db = new PGlite();
  try {
    await initializeDatabase(db);
    const app = createApp({ config, db, sendRegistration: async () => {} });
    const staffPassword = 'test-staff-password-1234';
    const staffAuth = 'Basic ' + Buffer.from('event.staff:' + staffPassword).toString('base64');
    const get = (url, auth) => request(app).get(url).set('Authorization', auth);
    const post = (url, data, auth = authorization) => request(app).post(url)
      .set('Origin', config.PUBLIC_ORIGIN).set('Authorization', auth).send(data);

    assert.equal((await post('/api/admin/staff', { username: 'event.staff', password: staffPassword })).status, 201);
    assert.equal((await get('/api/admin/me', staffAuth)).body.role, 'staff');
    assert.equal((await get('/api/admin/settings', staffAuth)).status, 403);
    assert.equal((await post('/api/admin/settings', { kind: 'stallNo', value: 'H99', active: true }, staffAuth)).status, 403);
    assert.equal((await post('/api/admin/staff', { username: 'other', password: staffPassword }, staffAuth)).status, 403);

    assert.equal((await post('/api/admin/settings', { kind: 'stallNo', value: 'H99', active: true })).status, 200);
    assert.ok((await request(app).get('/api/options')).body.stallNo.includes('H99'));
    const invited = await post('/api/admin/invitations', { ...assignment, stallNo: 'H99' }, staffAuth);
    assert.equal(invited.status, 201);
    assert.equal((await post('/api/admin/settings', { kind: 'stallNo', value: 'H99', active: false })).status, 200);
    assert.equal((await post('/api/invitations/lookup', { id: invited.body.id }, '')).body.assignment.stallNo, 'H99');
    assert.ok(!(await request(app).get('/api/options')).body.stallNo.includes('H99'));
    assert.equal((await post('/api/admin/invitations', { ...assignment, stallNo: 'H99' }, staffAuth)).status, 400);

    assert.equal((await post('/api/registrations', { ...assignment, ...details }, '')).status, 201);
    assert.equal((await post('/api/admin/invitations', assignment, staffAuth)).status, 201);
    assert.equal((await get('/api/admin/invitations', staffAuth)).body.invitations.length, 3);
    assert.match((await get('/api/admin/registrations.csv', staffAuth)).text, /General enquiry/);
    assert.equal((await post('/api/admin/staff/status', { username: 'event.staff', active: false })).status, 200);
    assert.equal((await get('/api/admin/invitations', staffAuth)).status, 401);
  } finally {
    await db.close();
  }
});
