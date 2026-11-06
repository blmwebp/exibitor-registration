import pg from 'pg';
import { options } from '../shared/form.js';

export function connectDatabase(connectionString) {
  return new pg.Pool({ connectionString, connectionTimeoutMillis: 8000, max: 5 });
}

export async function initializeDatabase(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS invitations (
      id text PRIMARY KEY,
      stall text NOT NULL UNIQUE,
      assignment jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      registration jsonb
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS exhibitor_options (
      kind text NOT NULL,
      value text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      PRIMARY KEY (kind, value)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS exhibitor_staff (
      username text PRIMARY KEY,
      password_hash text NOT NULL,
      active boolean NOT NULL DEFAULT true
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS exhibitor_enquiries (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      registration jsonb NOT NULL
    )
  `);
  const defaults = Object.entries(options).flatMap(([kind, values]) => values.map(value => ({ kind, value })));
  await db.query(`
    INSERT INTO exhibitor_options (kind, value)
    SELECT kind, value FROM jsonb_to_recordset($1::jsonb) AS defaults(kind text, value text)
    ON CONFLICT DO NOTHING
  `, [JSON.stringify(defaults)]);
}

export async function activeOptions(db) {
  const choices = Object.fromEntries(Object.keys(options).map(kind => [kind, []]));
  const { rows } = await db.query('SELECT kind, value FROM exhibitor_options WHERE active ORDER BY kind, length(value), value');
  for (const { kind, value } of rows) choices[kind]?.push(value);
  return choices;
}
