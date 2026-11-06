import { useEffect, useState, type FormEvent } from 'react';
import { assignmentKeys, labels } from '../shared/form.js';

type Choice = { kind: keyof typeof labels; value: string; active: boolean };
type Staff = { username: string; active: boolean };
type Props = {
  request: (path: string, payload?: object) => Promise<Response>;
  onOptionsChanged: () => Promise<void>;
};

export default function Management({ request, onOptionsChanged }: Props) {
  const [choices, setChoices] = useState<Choice[]>([]);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [users, setUsers] = useState<Staff[]>([]);
  const [kind, setKind] = useState('stallNo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([request('settings').then(r => r.json()), request('staff').then(r => r.json())])
      .then(([catalog, staff]) => {
        if (active) { setChoices(catalog.choices); setUsers(staff.users); }
      })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [request]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The update failed.'); }
    finally { setBusy(false); }
  }

  function saveOption(value: string, active: boolean, form?: HTMLFormElement) {
    void run(async () => {
      await request('settings', { kind, value, active });
      form?.reset();
      setChoices((await (await request('settings')).json()).choices);
      await onOptionsChanged();
      setNotice(active ? 'Option is active.' : 'Option archived.');
    });
  }

  function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      await request('staff', { username: data.get('username'), password: data.get('password') });
      form.reset();
      setShowStaffPassword(false);
      setUsers((await (await request('staff')).json()).users);
      setNotice('Registration staff account created.');
    });
  }

  return (
    <section className="grid gap-6 mb-6 lg:grid-cols-2" aria-label="Admin management">
      <div className="form-card p-6">
        <h2 className="text-xl font-semibold mb-4">Registration settings</h2>
        <form className="grid gap-3" onSubmit={event => {
          event.preventDefault();
          const form = event.currentTarget;
          saveOption(String(new FormData(form).get('option') ?? '').trim(), true, form);
        }}>
          <div className="field">
            <label htmlFor="option-category">Category</label>
            <select id="option-category" value={kind} disabled={busy} onChange={event => setKind(event.target.value)}>
              {assignmentKeys.map(key => <option key={key} value={key}>{labels[key as keyof typeof labels]}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="new-option">Option name</label><input id="new-option" name="option" required maxLength={120} /></div>
          <button className="submit" disabled={busy}>Add or reactivate option</button>
        </form>
        <ul className="mt-4">
          {choices.filter(choice => choice.kind === kind).map(choice => (
            <li key={choice.value} className="admin-entry flex flex-wrap gap-3 items-center justify-between">
              <span className="break-all">{choice.value}{choice.active ? '' : ' (archived)'}</span>
              <button className="outline-button" type="button" disabled={busy}
                onClick={() => saveOption(choice.value, !choice.active)}>
                {choice.active ? 'Archive' : 'Reactivate'}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="form-card p-6">
        <h2 className="text-xl font-semibold mb-4">Registration staff</h2>
        <form className="grid gap-3" onSubmit={createStaff}>
          <div className="field"><label htmlFor="staff-username">Username</label><input id="staff-username" name="username" minLength={3} maxLength={60} autoComplete="off" required /></div>
          <div className="field"><label htmlFor="staff-password">Password (at least 10 characters)</label>
            <div className="flex items-center gap-2">
              <input
                id="staff-password"
                name="password"
                className="min-w-0 flex-1"
                type={showStaffPassword ? 'text' : 'password'}
                minLength={16}
                maxLength={200}
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="outline-button shrink-0"
                aria-controls="staff-password"
                aria-label={showStaffPassword ? 'Hide staff password' : 'Show staff password'}
                onClick={() => setShowStaffPassword(visible => !visible)}
              >
                {showStaffPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </form>
        <ul className="mt-4">
          {users.map(user => (
            <li key={user.username} className="admin-entry flex flex-wrap gap-3 items-center justify-between">
              <span>{user.username}{user.active ? '' : ' (disabled)'}</span>
              <button className="outline-button" type="button" disabled={busy} onClick={() => void run(async () => {
                await request('staff/status', { username: user.username, active: !user.active });
                setUsers((await (await request('staff')).json()).users);
                setNotice(user.active ? 'Account disabled.' : 'Account reactivated.');
              })}>{user.active ? 'Disable' : 'Reactivate'}</button>
            </li>
          ))}
        </ul>
      </div>
      {error && <p className="alert lg:col-span-2" role="alert">{error}</p>}
      {notice && <p className="lg:col-span-2" role="status">{notice}</p>}
    </section>
  );
}
