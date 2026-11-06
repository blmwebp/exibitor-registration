import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { connectDatabase, initializeDatabase } from '../server/database.js';
import { createMailer } from '../server/mail.js';

let appPromise;

async function initializeApp() {
  const config = loadConfig();
  const db = connectDatabase(config.DATABASE_URL);

  db.on('error', error => {
    console.error('Neon connection error', error.code ?? error.name);
  });

  try {
    await initializeDatabase(db);
    return createApp({
      config,
      db,
      sendRegistration: createMailer(config),
    });
  } catch (error) {
    await db.end();
    throw error;
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.searchParams.get('__route');

  if (route !== null) {
    url.searchParams.delete('__route');
    req.url = `/api/${route.replace(/^\/+/, '')}${url.search}`;
  }

  let app;
  try {
    appPromise ??= initializeApp();
    app = await appPromise;
  } catch (error) {
    appPromise = undefined;
    console.error(
      'Backend initialization failed',
      error.issues?.map(issue => issue.path.join('.')) ??
        error.code ?? error.name,
    );
    return res.status(503).json({ error: 'Backend initialization failed' });
  }

  return app(req, res);
}