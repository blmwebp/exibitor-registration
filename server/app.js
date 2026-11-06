import { activeOptions } from './database.js';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registrationSchema, fieldErrors } from '../shared/form.js';
import { installInvitations } from "./invitations.js";
export function createApp({config, sendRegistration, db}) {
 const app = express();
 app.disable('x-powered-by');
 app.set('trust proxy', config.TRUST_PROXY_HOPS || false);
 app.use(helmet({contentSecurityPolicy: {directives: { 'img-src': ["'self'",'data:'], 'script-src': ["'self'"], 'style-src': ["'self'","'unsafe-inline'"] }}}));
 app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store'); next(); });
 app.get('/api/health', (req,res) => res.json({status:'ok'}));
 app.use('/api/registrations', rateLimit({windowMs:15*60*1000, limit:5, standardHeaders:'draft-8', legacyHeaders:false, message:{message:'Too many attempts. Please try again in 15 minutes.'}}));
 const jsonRequest = [(req,res,next) => {
  if (req.get('origin') !== config.PUBLIC_ORIGIN) return res.status(403).json({message:'Request origin is not allowed.'});
  if (!req.is('application/json')) return res.status(415).json({message:'Use application/json.'});
  next();
 }, express.json({limit:'24kb'})];
 if (db) installInvitations(app, {config, db, jsonRequest, sendRegistration});
 app.post('/api/registrations', ...jsonRequest, async (req,res) => {
  const result = registrationSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({message:'Please check the highlighted fields.', errors:fieldErrors(result.error)});
  const reference = randomUUID();
  if (db) {
   const choices = await activeOptions(db);
   if (!Object.entries(choices).every(([key, values]) => values.includes(result.data[key]))) {
    return res.status(400).json({message:'Please refresh the form and select currently available options.'});
   }
   const { companyFax, ...details } = result.data;
   await db.query('INSERT INTO exhibitor_enquiries (id, registration) VALUES ($1, $2)', [reference, details]);
   res.status(201).json({message:'Your enquiry has been recorded.', reference});
   Promise.resolve().then(() => sendRegistration(details, reference)).catch(() => {
    console.error('Enquiry notification failed', {reference});
   });
   return;
  }
  try {
   await sendRegistration(result.data, reference);
   return res.status(201).json({message:'Your enquiry has been sent to our team.', reference});
  } catch {
   console.error('Registration email failed', {reference});
   return res.status(502).json({message:'We could not send your enquiry. Please try again shortly.'});
  }
 });
 app.use('/api', (req,res) => res.status(404).json({message:'API route not found.'}));
 const dist = fileURLToPath(new URL('../dist/', import.meta.url));
 if (existsSync(dist)) { app.use(express.static(dist)); app.get(['/', '/admin'], (req,res) => res.sendFile(dist+'index.html')); }
 app.use((err,req,res,next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({message:'Submission is too large.'});
  if (err instanceof SyntaxError) return res.status(400).json({message:'Invalid JSON request.'});
  console.error('Request failed');
  res.status(500).json({message:'Something went wrong. Please try again.'});
 });
 return app;
}
