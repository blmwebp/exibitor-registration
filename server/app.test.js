import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from './app.js';
import {escapeHtml} from './mail.js';
import {loadConfig} from './config.js';
const config={PUBLIC_ORIGIN:'http://localhost:5173',TRUST_PROXY_HOPS:0};
const valid={interestedIn:'Nutrition & Food',stallNo:'H1',facia:'Example Booth',GSTNumber:'',boothType:'Shell Scheme',boothSize:'9 sq. m',businessNature:'Industrial chemical manufacturer',website:'https://example.com',fullName:'Test Person',companyName:'Example Company',email:'test@example.com',contactNumber:'+91 98765 43210',country:'India',designation:'Manager',city:'Delhi',specialRequirements:'Accessible booth',additionalMessage:'Please call',consent:true,companyFax:''};
const post=(app,data=valid)=>request(app).post('/api/registrations').set('Origin',config.PUBLIC_ORIGIN).send(data);
test('accepts validated enquiry and calls injected mailer with all fields',async()=>{
 let sent; const app=createApp({config,sendRegistration:async(data,reference)=>{sent={data,reference};}});
 const res=await post(app); assert.equal(res.status,201);assert.deepEqual(sent.data,valid);assert.equal(sent.reference,res.body.reference);
});
test('rejects invalid fields and missing consent without sending',async()=>{
 let calls=0;const app=createApp({config,sendRegistration:async()=>calls++});
 const res=await post(app,{...valid,email:'bad',consent:false,website:'javascript:alert(1)'});
 assert.equal(res.status,400);assert.ok(res.body.errors.email);assert.ok(res.body.errors.consent);assert.ok(res.body.errors.website);assert.equal(calls,0);
});
test('blocks foreign origins, honeypot, unknown fields and header newlines',async()=>{
 const app=createApp({config,sendRegistration:async()=>assert.fail('Should not send')});
 assert.equal((await request(app).post('/api/registrations').set('Origin','https://foreign.example').send(valid)).status,403);
 for (const data of [{...valid,companyFax:'spam'},{...valid,to:'attacker@example.com'},{...valid,fullName:'Name\r\nBcc: other@example.com'}]) assert.equal((await post(app,data)).status,400);
});
test('SMTP failure returns a failure response with no secrets',async()=>{
 const app=createApp({config,sendRegistration:async()=>{throw new Error('secret password');}});
 const res=await post(app);assert.equal(res.status,502);assert.ok(!res.text.includes('secret'));
});
test('limits repeated submissions',async()=>{
 const app=createApp({config,sendRegistration:async()=>{}});
 for(let i=0;i<5;i++) assert.equal((await post(app)).status,201);
 assert.equal((await post(app)).status,429);
});
test('handles malformed JSON and oversized requests',async()=>{
 const app=createApp({config,sendRegistration:async()=>{}});
 assert.equal((await request(app).post('/api/registrations').set('Origin',config.PUBLIC_ORIGIN).set('Content-Type','application/json').send('{broken')).status,400);
 assert.equal((await post(app,{...valid,additionalMessage:'x'.repeat(30000)})).status,413);
});
test('escapes HTML submitted to email template',()=>assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;'));
test('configuration rejects missing secrets and unsafe production origin',()=>{
 assert.throws(()=>loadConfig({}));
 assert.throws(()=>loadConfig({DATABASE_URL:'postgresql://localhost/test',ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'strong-test-password',NODE_ENV:'production',PUBLIC_ORIGIN:'http://example.com',SMTP_HOST:'smtp.gmail.com',SMTP_USER:'sender@gmail.com',SMTP_PASS:'placeholder',MAIL_TO:'recipient@example.com',MAIL_FROM_NAME:'Registration'}));
});
