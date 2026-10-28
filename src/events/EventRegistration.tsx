import React, { useEffect, useState } from 'react';
import type { Language } from '../utils/i18n';
import { eventCopy } from './copy';
import { getEvent, registerForEvent } from './repository';
import type { DNSEvent } from './types';

interface Props { lang: Language; eventId: string; }

export function EventRegistration({ lang, eventId }: Props) {
  const c = eventCopy(lang);
  const [event, setEvent] = useState<DNSEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getEvent(eventId).then(value => { if (active) setEvent(value); })
      .catch(() => { if (active) setEvent(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || event.status !== 'open' || busy) return;
    if (!firstName.trim() || !lastName.trim() || !email.trim() ||
        event.questions.some(q => q.required &&
          (answers[q.id] === undefined || answers[q.id] === '' || answers[q.id] === false))) {
      setError(c.invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await registerForEvent(event.id, {
        firstName: firstName.trim(), lastName: lastName.trim(),
        email: email.trim().toLowerCase(), answers,
      });
      setDone(true);
    } catch (e) {
      console.error(e);
      setError(c.failed);
    } finally { setBusy(false); }
  };

  if (loading) return <div className="dns-shell py-8">{c.loading}</div>;
  if (!event) return <div className="dns-shell py-8" role="alert">{c.unavailable}</div>;

  return (
    <div className="dns-shell max-w-[900px] py-8">
      <section className="dns-card space-y-4 p-5 md:p-7">
        <div className="dns-kicker">Dolomiti NordicSki · {c.events}</div>
        <h1 className="text-2xl font-semibold text-dns-deep">{event.title}</h1>
        <p className="whitespace-pre-wrap text-sm">{event.description}</p>
        <div className="flex flex-wrap gap-5 text-sm text-dns-mid">
          <span>{c.date}: {event.startsAt.replace('T', ' ')}</span>
          {event.location && <span>{c.location}: {event.location}</span>}
        </div>
        {done ? (
          <p role="status" className="border-t border-dns-mid/10 pt-5 font-semibold">{c.success}</p>
        ) : event.status !== 'open' ? (
          <p role="status">{c.closed}</p>
        ) : (
          <form className="space-y-4 border-t border-dns-mid/10 pt-5" onSubmit={submit}>
            <h2 className="text-lg font-semibold">{c.register}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                [c.firstName, firstName, setFirstName],
                [c.lastName, lastName, setLastName],
              ] as const).map(([label, value, update]) => (
                <label key={label} className="space-y-1">
                  <span className="dns-kicker">{label} *</span>
                  <input className="dns-input w-full" required maxLength={80}
                    value={value} onChange={e => update(e.target.value)} />
                </label>
              ))}
              <label className="space-y-1 sm:col-span-2">
                <span className="dns-kicker">{c.email} *</span>
                <input className="dns-input w-full" type="email" required maxLength={254}
                  value={email} onChange={e => setEmail(e.target.value)} />
              </label>
            </div>
            {event.questions.map(q => (
              <label key={q.id} className="block space-y-1">
                <span className="dns-kicker">{q.label}{q.required ? ' *' : ''}</span>
                {q.type === 'checkbox' ? (
                  <input type="checkbox" className="ml-3" checked={answers[q.id] === true}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.checked }))} />
                ) : q.type === 'select' ? (
                  <select className="dns-input w-full" required={q.required}
                    value={String(answers[q.id] ?? '')}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}>
                    <option value="">—</option>
                    {(q.options || []).map(option =>
                      <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input className="dns-input w-full" maxLength={300} required={q.required}
                    value={String(answers[q.id] ?? '')}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                )}
              </label>
            ))}
            <p className="text-xs text-dns-muted">{c.privacy}</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" className="dns-button" data-variant="primary" disabled={busy}>
              {busy ? c.loading : c.register}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
