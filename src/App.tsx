import Admin from './Admin';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { registrationSchema, completionSchema, options, labels, fieldErrors, assignmentKeys } from '../shared/form.js';
type Values = Record<string, string | boolean>;
const initial: Values = { interestedIn:'', boothType:'', boothSize:'',stallNo:'', businessNature:'', facia:'', GSTNumber:'', website:'', fullName:'', companyName:'', email:'', contactNumber:'', country:'', designation:'', city:'', specialRequirements:'', additionalMessage:'', consent:false, companyFax:'' };
const optional = ['GSTNumber','website','specialRequirements','additionalMessage'];
export default function App() {
 return window.location.pathname.replace(/\/$/, '') === '/admin' ? <Admin /> : <Registration />;
}

function Registration() {
 const [choices, setChoices] = useState<typeof options>({ interestedIn: [], boothType: [], boothSize: [], stallNo: [] });
 const [optionsError, setOptionsError] = useState('');
 const [optionsReady, setOptionsReady] = useState(false);
 useEffect(() => {
  const controller = new AbortController();
  fetch('/api/options', { signal: controller.signal }).then(async response => {
   if (!response.ok) throw new Error('Options could not be loaded.');
   setChoices(await response.json());
   setOptionsReady(true);
  }).catch(() => {
   if (!controller.signal.aborted) setOptionsError('Registration options could not be loaded. Refresh the page to try again.');
  });
  return () => controller.abort();
 }, []);

 const [values,setValues] = useState<Values>({...initial});
 const [errors,setErrors] = useState<Record<string,string>>({});
 const [busy,setBusy] = useState(false);
 const [notice,setNotice] = useState('');
 const [reference,setReference] = useState('');
 const [idInput,setIdInput] = useState('');
 const [invitationId,setInvitationId] = useState('');
 const [lookupBusy,setLookupBusy] = useState(false);
 const [lookupError,setLookupError] = useState('');
 const [completedInvitation,setCompletedInvitation] = useState(false);

 async function lookup(event: FormEvent) {
  event.preventDefault();
  setLookupBusy(true);
  setLookupError('');
  try {
   const response = await fetch('/api/invitations/lookup', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({id:idInput}), signal:AbortSignal.timeout(15000)
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.message);
   setInvitationId(result.id);
   setValues(previous => ({...previous,...result.assignment}));
   setErrors({});
   setNotice('');
  } catch(error) {
   setLookupError(error instanceof Error ? error.message : 'Could not load the invitation.');
  } finally {
   setLookupBusy(false);
  }
 }

 function clearInvitation() {
  setInvitationId('');
  setIdInput('');
  setLookupError('');
  setValues(previous => ({...previous,...Object.fromEntries(assignmentKeys.map(key => [key,'']))}));
  setErrors({});
  setNotice('');
 }

 const form = useRef<HTMLFormElement>(null);
 function update(key:string,value:string|boolean) { setValues(v => ({...v,[key]:value})); setErrors(e => {const n={...e};delete n[key];return n;}); setNotice(''); }
 function focusError(errs:Record<string,string>) { const key=Object.keys(errs)[0]; requestAnimationFrame(() => (form.current?.elements.namedItem(key) as HTMLElement | null)?.focus()); }
 async function submit(event:FormEvent) {
  event.preventDefault(); if (busy || lookupBusy || (!invitationId && !optionsReady)) return; setNotice('');
  const details = Object.fromEntries(Object.entries(values).filter(([key]) => !assignmentKeys.includes(key)));
  const parsed = invitationId ? completionSchema.safeParse(details) : registrationSchema.safeParse(values);
  if (!parsed.success) { const e=fieldErrors(parsed.error); setErrors(e); focusError(e); return; }
  setBusy(true);
  try {
   const endpoint = invitationId ? '/api/invitations/complete' : '/api/registrations';
   const payload = invitationId ? {id:invitationId, details:parsed.data} : parsed.data;
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
   const body=await response.json();
   if (!response.ok) { if(body.errors) {setErrors(body.errors);focusError(body.errors);} throw new Error(body.message || 'Unable to send your enquiry.'); }
   setCompletedInvitation(Boolean(invitationId)); clearInvitation();
   setReference(body.reference); setValues({...initial}); setErrors({});
  } catch(error) { setNotice(error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'TypeError' ? error.message : 'Unable to confirm submission. Please check your connection before trying again.'); }
  finally {setBusy(false);}
 }
 function field(key:string, kind='text', placeholder='', choices?:readonly string[]) {
  if (invitationId && assignmentKeys.includes(key)) {
   return <div className="field" key={key}>
    <label htmlFor={key}>{labels[key as keyof typeof labels]} <span className="optional">(assigned)</span></label>
    <input id={key} name={key} value={String(values[key])} readOnly className="assigned-field" />
   </div>;
  }
  const label=labels[key as keyof typeof labels]; const required=!optional.includes(key);
  const common={id:key,name:key,value:String(values[key] || ''),onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>update(key,e.target.value),required,'aria-invalid':!!errors[key],'aria-describedby':errors[key]?`${key}-error`:undefined,disabled:busy};
  const maxLength=key==='businessNature'||key==='specialRequirements'?2000:key==='additionalMessage'?3000:key==='website'?300:key==='companyName'?200:key==='email'?254:key==='contactNumber'?25:120;
  const autocomplete:Record<string,string>={fullName:'name',companyName:'organization',email:'email',contactNumber:'tel',country:'country-name',designation:'organization-title',city:'address-level2',website:'url'};
  return <div className={kind==='textarea'?'field md:col-span-2':'field'} key={key}><label htmlFor={key}>{label} {required?<span className="required">*</span>:<span className="optional">(optional)</span>}</label>{choices?<select {...common}><option value="">Select an option</option>{choices.map(v=><option key={v}>{v}</option>)}</select>:kind==='textarea'?<textarea {...common} maxLength={maxLength} rows={3} placeholder={placeholder}/>:<input {...common} type={kind} maxLength={maxLength} autoComplete={autocomplete[key]} placeholder={placeholder}/>} {errors[key]&&<p className="error" id={`${key}-error`}>{errors[key]}</p>}</div>;
 }
 return <div className="min-h-screen">
    <header className="registration-header">
  <div className="registration-header-inner">
    {/* Left: sponsor */}
    <div className="header-brand header-sponsor">
      <img
        src="/assets/aifom.webp"
        alt="AIFOM"
        className="header-sponsor-logo"
      />

      <div className="header-brand-text">
        <span className="header-label">Organized By</span>
        <strong>AIFOM</strong>
        <span className="header-description">
          Supporting business connections
        </span>
      </div>
    </div>

    {/* Centre: page identity */}
    <div className="header-title">
      <span className="header-status">
        <span aria-hidden="true" />
        EXHIBITOR ENQUIRIES
      </span>
      <p>Connect. Exhibit. Grow.</p>
    </div>

    {/* Right: company */}
    <div className="header-brand header-company">
      <div className="header-brand-text">
        <span className="header-label">Connect with</span>
        <strong>Comp-Ny</strong>
        <span className="header-description">
          Exhibitor registration
        </span>
      </div>

      <img
        src="/assets/demo_logo.png"
        alt="Comp-Ny"
        className="header-company-logo"
      />
    </div>
  </div>
</header>
 <main className="mx-auto max-w-6xl px-5 py-10 sm:px-10 sm:py-16"><div className="mb-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div><p className="eyebrow">CONNECT. SHOWCASE. GROW.</p><p className="mt-5 max-w-xl text-base leading-7 text-[#66736b]">Bring your business to the exhibition floor. Tell us about your company and the space you have in mind.</p></div><div className="intro-note lg:self-end">
    <span className="note-icon" aria-hidden="true">
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 10l2-6h14l2 6" />
    <path d="M3 10h18M5 10v10M19 10v10M3 20h18" />
    <path d="M9 20v-6h6v6M9 4l-1 6M15 4l1 6" />
  </svg>
</span>
<div><h2 className="font-semibold">Let’s find the right space for you</h2><p className="mt-2 text-sm leading-6">Submit your interest and our team will contact you with participation options and next steps.</p>
    </div></div></div>
 {!reference && (
  <section className="form-card invitation-panel mb-6 p-5 sm:p-6" aria-label="Complete registration with ID">
   <h2 className="text-xl font-semibold">Complete registration with ID</h2>
   {invitationId ? (
    <div className="mt-3 flex flex-wrap gap-3 items-center">
     <p role="status">Invitation loaded. Your assigned stall details appear below.</p>
     <button type="button" className="outline-button" disabled={busy} onClick={clearInvitation}>Use a different ID</button>
    </div>
   ) : (
    <form onSubmit={lookup} className="mt-3">
     <p className="mb-3">Enter the ID shared by your agency. You can also use the form below to send a general enquiry.</p>
     <div className="flex flex-wrap gap-3 items-end">
      <div className="field invitation-input">
       <label htmlFor="registration-id">Registration ID</label>
       <input id="registration-id" placeholder="EXH-…" value={idInput} onChange={event => setIdInput(event.target.value)}
        required maxLength={40} disabled={lookupBusy || busy} autoComplete="off" spellCheck={false} />
      </div>
      <button className="submit" disabled={lookupBusy || busy}>{lookupBusy ? 'Checking…' : 'Load registration'}</button>
     </div>
     {lookupError && <p className="error" role="alert">{lookupError}</p>}
    </form>
   )}
  </section>
 )}
 {optionsError && !invitationId && !reference && <p className="alert mb-4" role="alert">{optionsError}</p>}
 {reference?<section className="success-card" aria-live="polite"><span className="success-icon" aria-hidden="true">✓</span><h2 className="mt-5 text-3xl font-semibold">{completedInvitation ? 'Registration complete.' : 'Thank you for your interest.'}</h2><p className="mt-3">{completedInvitation ? 'Your registration details have been saved.' : 'Your enquiry has been recorded. Our team will be in touch.'}</p><p className="mt-5 break-all text-sm text-[#66736b]">Reference: {reference}</p><button className="submit mt-8" onClick={()=>setReference('')}>Submit another enquiry</button></section>:
 <form ref={form} onSubmit={submit} noValidate className="form-card" aria-label="Exhibitor registration"><div className="form-heading"><div><p className="eyebrow">EXHIBITOR ENQUIRY</p><h2 className="mt-2 text-2xl font-semibold">Exhibitor Registration</h2></div><p className="text-xs text-[#6c776e]">Fields marked <span className="required">*</span> are required</p></div>
 <fieldset disabled={busy || lookupBusy}>
    <legend>
         <span className="section-icon" aria-hidden="true">
             <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 10l2-6h14l2 6H3Z" />
                <path d="M5 10v10M19 10v10M3 20h18M9 20v-6h6v6" />
             </svg>
         </span>
        Booth Details
        </legend>
        <p className="section-caption">{invitationId ? 'These participation details were assigned by your agency.' : 'Choose how you would like to take part.'}</p>
        <div className="grid gap-5 md:grid-cols-2">{field('interestedIn','text','',choices.interestedIn)}
          {field('boothType','text','',choices.boothType)}
          {field('boothSize','text','',choices.boothSize)}
          {field('stallNo','text','',choices.stallNo)}
          {field('facia','text','Facia Name')}
          {field('GSTNumber','text','GST Number')}
          {field('website','url','https://yourcompany.com')}
          {field('businessNature','textarea','Tell us about your products, services and industry.')}
          </div>
          </fieldset>
 <fieldset disabled={busy || lookupBusy}>
    <legend>
                         <span className="section-icon" aria-hidden="true">
                             <svg viewBox="0 0 24 24" fill="none">
                                 <rect x="3" y="5" width="18" height="14" rx="3" />
                                 <circle cx="9" cy="10" r="2" />
                                 <path d="M6 16c0-3 6-3 6 0M15 9h3M15 13h3" />
                             </svg>
                         </span> 
        Your business & contact
    </legend><p className="section-caption">Help our team reach the right person.</p><div className="grid gap-5 md:grid-cols-2">{field('fullName','text','Your full name')}{field('companyName','text','Registered company name')}{field('email','email','you@company.com')}{field('contactNumber','tel','+91 98765 43210')}{field('country','text','Country')}{field('designation','text','Your designation')}{field('city','text','City')}</div></fieldset>
 <fieldset disabled={busy || lookupBusy}>
    <legend>
                         <span className="section-icon" aria-hidden="true">
                             <svg viewBox="0 0 24 24" fill="none">
                                 <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z" />
                                 <path d="M7 9h9M7 13h6" />
                             </svg>
                         </span> 
        A few more details
        </legend><p className="section-caption">Let us know what would make your participation a success.</p><div className="grid gap-5 md:grid-cols-2">{field('specialRequirements','textarea','Power, equipment, location preferences or accessibility needs.')}{field('additionalMessage','textarea','Anything else you would like to share?')}</div></fieldset>
 <div className="honeypot" aria-hidden="true"><label htmlFor="companyFax">Leave this field empty</label><input id="companyFax" name="companyFax" value={String(values.companyFax)} onChange={e=>update('companyFax',e.target.value)} tabIndex={-1} autoComplete="off"/></div>
 <div className="form-bottom"><label className="consent" htmlFor="consent"><input id="consent" name="consent" type="checkbox" checked={!!values.consent} onChange={e=>update('consent',e.target.checked)} disabled={busy} aria-invalid={!!errors.consent} aria-describedby={errors.consent?'consent-error':undefined}/><span>I consent to being contacted by the organising team regarding my exhibitor enquiry and understand that the details provided will be used to process this request. <span className="required">*</span></span></label>{errors.consent&&<p id="consent-error" className="error">{errors.consent}</p>}{notice&&<p className="alert" role="alert">{notice}</p>}<div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-[#6c776e]">{invitationId ? 'Review your details before completing registration.' : 'This enquiry records your stall preference. Availability is subject to confirmation.'}</p><button className="submit" type="submit" disabled={busy || lookupBusy || (!invitationId && !optionsReady)}>{busy ? 'Submitting…' : invitationId ? 'Complete Registration' : 'Send Enquiry'}<span aria-hidden="true">↗</span></button></div><p role="status" className="sr-only">{busy?'Sending your enquiry. Please wait.':''}</p></div></form>}
 <footer className="py-7 text-center text-xs text-[#738075]">© {new Date().getFullYear()} Comp-Ny. Exhibitor enquiries.</footer></main></div>;
}
