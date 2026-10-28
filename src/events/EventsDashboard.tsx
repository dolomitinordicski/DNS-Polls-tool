import React, { useEffect, useState } from 'react';
import type { Language } from '../utils/i18n';
import { subscribePrivateRecipientAuth, signInPrivateRecipientSync } from '../data/privateRecipientSync';
import type { PrivateRecipientAuthState } from '../data/privateRecipientSync';
import { eventCopy } from './copy';
import { eventUrl, listEvents } from './repository';
import type { DNSEvent } from './types';
import { EventEditor } from './EventEditor';
import { EventRegistrations } from './EventRegistrations';

interface Props { lang: Language; }

export function EventsDashboard({ lang }: Props) {
  const c = eventCopy(lang);
  const [auth, setAuth] = useState<PrivateRecipientAuthState>('signed-out');
  const [events, setEvents] = useState<DNSEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => subscribePrivateRecipientAuth(state => setAuth(state)), []);

  useEffect(() => {
    if (auth !== 'authorized') return;
    let active = true;
    setBusy(true);
    listEvents().then(items => { if (active) setEvents(items); })
      .catch(() => { if (active) setError(c.failed); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [auth, c.failed]);

  const login = async () => {
    setError('');
    try { await signInPrivateRecipientSync(); }
    catch (e) { setError(e instanceof Error ? e.message : c.failed); }
  };

  const copyLink = async (event: DNSEvent) => {
    try {
      await navigator.clipboard.writeText(eventUrl(event.id));
      setCopied(event.id);
    } catch { setError(c.failed); }
  };

  return (
    <div className="dns-shell space-y-5 py-6">
      <section className="dns-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="dns-kicker">Dolomiti NordicSki</div>
          <h1 className="text-2xl font-semibold text-dns-deep">{c.events}</h1>
        </div>
        {auth === 'authorized' && (
          <button className="dns-button" data-variant="primary" type="button"
            onClick={() => setCreating(true)}>{c.create}</button>
        )}
      </section>
      {auth !== 'authorized' ? (
        <section className="dns-card space-y-4 p-5">
          <p className="text-sm text-dns-muted">{c.loginHint}</p>
          <button type="button" className="dns-button" data-variant="primary"
            onClick={() => void login()}>{c.login}</button>
        </section>
      ) : creating ? (
        <EventEditor lang={lang} onCreated={event => {
          setEvents(current => [event, ...current]);
          setCreating(false);
          setSelected(event.id);
        }} onCancel={() => setCreating(false)} />
      ) : (
        <section className="space-y-4">
          {busy ? <p>{c.loading}</p> : !events.length ?
            <p className="dns-card p-5">{c.noEvents}</p> : events.map(event => (
              <article className="dns-card space-y-3 p-5" key={event.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{event.title}</h2>
                    <p className="text-sm text-dns-muted">
                      {event.startsAt.replace('T', ' ')} · {event.location}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="dns-button" data-variant="secondary"
                      onClick={() => void copyLink(event)}>
                      {copied === event.id ? c.copied : c.copy}
                    </button>
                    <button type="button" className="dns-button" data-variant="secondary"
                      onClick={() => setSelected(current => current === event.id ? null : event.id)}>
                      {c.participants}
                    </button>
                  </div>
                </div>
                {selected === event.id && <EventRegistrations event={event} lang={lang} />}
              </article>
            ))}
        </section>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
