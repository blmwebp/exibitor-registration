import Management from './Management';
import { useCallback, useState, type FormEvent } from 'react';
import { assignmentKeys, labels, options } from '../shared/form.js';

type Assignment = Record<keyof typeof options, string>;
type Invitation = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  assignment: Partial<Assignment>;
  source: string;
  registration: Record<string, string | boolean> | null;
};
const empty: Assignment = { interestedIn: '', boothType: '', boothSize: '', stallNo: '' };
const keys = assignmentKeys as (keyof Assignment)[];

async function adminRequest(auth: string, path: string, payload?: object) {
  const response = await fetch('/api/admin/' + path, {
    headers: { Authorization: auth, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    method: payload ? 'POST' : 'GET',
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'The request could not be completed.');
  }
  return response;
}

export default function Admin() {
  const [auth, setAuth] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>();
  const [choices, setChoices] = useState<typeof options>({ interestedIn: [], boothType: [], boothSize: [], stallNo: [] });
  const managementRequest = useCallback((path: string, payload?: object) => adminRequest(auth, path, payload), [auth]);

  async function loadChoices() {
    const response = await fetch('/api/options');
    if (!response.ok) throw new Error('Could not load registration options.');
    setChoices(await response.json());
    setAssignment(empty);
  }
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<{
  id: string;
  message: string;
} | null>(null);
  const [assignment, setAssignment] = useState<Assignment>(empty);
  const [newId, setNewId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh(credentials: string) {
    const response = await adminRequest(credentials, 'invitations');
    setInvitations((await response.json()).invitations);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The request failed.'); }
    finally { setBusy(false); }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bytes = new TextEncoder().encode(form.get('username') + ':' + form.get('password'));
    const credentials = 'Basic ' + btoa(String.fromCharCode(...bytes));
    void run(async () => {
      const identity = await adminRequest(credentials, 'me');
      const { role: userRole } = await identity.json();
      await Promise.all([refresh(credentials), loadChoices()]);
      setRole(userRole);
      setAuth(credentials);
    });
  }

  function create(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const response = await adminRequest(auth, 'invitations', assignment);
      setNewId((await response.json()).id);
      setAssignment(empty);
      await refresh(auth);
    });
  }

  async function copy(id: string) {
    setCopyFeedback(null);
    try {
      await navigator.clipboard.writeText(id);
      setCopyFeedback({ id, message: 'ID copied to clipboard.' });
    } catch {
      setCopyFeedback({ id, message: 'Select the displayed ID and copy it manually.' });
    }
  }

  function download() {
    void run(async () => {
      const response = await adminRequest(auth, 'registrations.csv');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'exhibitor-registrations.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  const assigned = new Set(invitations.filter(row => row.source === 'Invitation').map(row => row.assignment.stallNo));
  return (
    <main className="admin-panel mx-auto max-w-6xl px-5 py-10 sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div><p className="eyebrow">EXHIBITOR ADMIN</p><h1 className="text-3xl font-semibold">Registration dashboard</h1></div>
        <div className="flex flex-wrap items-center gap-4">
          <a className="underline" href="/">Public form</a>
          {auth && <button type="button" className="outline-button" disabled={busy} onClick={() => {
            setAuth(''); setRole(undefined); setInvitations([]); setNewId(''); setNotice(''); setError(''); setAssignment(empty);
          }}>Sign out</button>}
        </div>
      </div>
      {error && <p role="alert" className="alert mb-4">{error}</p>}
      {notice && <p role="status" className="mb-4">{notice}</p>}
      {!auth ? (
        <form className="form-card p-6 max-w-lg grid gap-4" onSubmit={login}>
          <div className="field"><label htmlFor="admin-username">Username</label><input id="admin-username" name="username" autoComplete="username" required maxLength={80} /></div>
          <div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={200} /></div>
          <button className="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      ) : (
        <>
          {role === 'admin' && <Management request={managementRequest} onOptionsChanged={loadChoices} />}
          <form className="form-card p-6 mb-6" onSubmit={create}>
            <h2 className="text-xl font-semibold mb-4">Create exhibitor invitation</h2>
            <div className="grid gap-4 sm:grid-cols-2 mb-5">
              {keys.map(key => (
                <div className="field" key={key}>
                  <label htmlFor={'admin-' + key}>{labels[key]}</label>
                  <select id={'admin-' + key} required disabled={busy} value={assignment[key]}
                    onChange={event => setAssignment(previous => ({ ...previous, [key]: event.target.value }))}>
                    <option value="">Select an option</option>
                    {choices[key].map(option => (
                      <option key={option} disabled={key === 'stallNo' && assigned.has(option)}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button className="submit" disabled={busy}>Create invitation</button>
            {newId && <div className="invitation-result mt-4">
              <p>Share this ID privately with the exhibitor.</p>
              <code className="break-all">{newId}</code>
              <button type="button" className="outline-button" onClick={() => void copy(newId)}>Copy ID</button>
                <span role="status" className="text-sm">
                  {copyFeedback?.id === newId ? copyFeedback.message : ''}
                </span>
            </div>}
          </form>
          <section className="form-card p-6">
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Invitations and registrations</h2>
              <div className="flex flex-wrap gap-3">
                <button className="outline-button" disabled={busy} onClick={() => void run(async () => { await Promise.all([refresh(auth), loadChoices()]); })}>Refresh</button>
                <button className="submit" disabled={busy} onClick={download}>Download CSV</button>
              </div>
            </div>
            {!invitations.length && <p>No invitations created yet.</p>}
            {invitations.map(row => (
              <details className="admin-entry" key={row.id}>
                <summary>
                  <strong>{row.source === 'General enquiry' ? 'General enquiry' : 'Stall ' + row.assignment.stallNo}</strong>
                  {' · '}{row.completedAt ? 'Completed' : 'Pending'}
                  {row.registration?.companyName ? ' · ' + row.registration.companyName : ''}
                </summary>
                <p className="my-3">Registration ID <code className="break-all">{row.id}</code></p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(labels).map(([key, label]) => {
                    const data = row.registration ?? row.assignment;
                    const value = (data as Record<string, string | boolean>)[key];
                    if (value === undefined) return null;
                    return <div key={key}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words">{value === true ? 'Yes' : value || '—'}</dd></div>;
                  })}
                </dl>
                {!row.completedAt && <div className="flex flex-wrap gap-3 mt-4">
                  <button className="outline-button" onClick={() => void copy(row.id)}>Copy ID</button>
                  <span role="status" className="self-center text-sm">
                    {copyFeedback?.id === row.id ? copyFeedback.message : ''}
                  </span>
                  <button className="outline-button" disabled={busy} onClick={() => {
                    if (!window.confirm('Revoke this invitation and release the stall?')) return;
                    void run(async () => {
                      await adminRequest(auth, 'invitations/revoke', { id: row.id });
                      if (newId === row.id) setNewId('');
                      await refresh(auth);
                    });
                  }}>Revoke invitation</button>
                 
                </div>}
                 
              </details>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
