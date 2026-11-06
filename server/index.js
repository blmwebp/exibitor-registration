import 'dotenv/config';
import { loadConfig } from './config.js';
import { createMailer } from './mail.js';
import { createApp } from './app.js';
import { connectDatabase, initializeDatabase } from './database.js';
try {
 const config = loadConfig();
 const db = connectDatabase(config.DATABASE_URL);
 db.on('error', () => console.error('Database connection interrupted.'));
 await initializeDatabase(db);
 const app = createApp({config, db, sendRegistration:createMailer(config)});
 const server = app.listen(config.PORT, () => console.log(`Registration server listening on port ${config.PORT}`));
 for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
  server.close(async () => { await db.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
 });
} catch { console.error('Startup failed. Check the environment variables and Neon connection.'); process.exit(1); }
