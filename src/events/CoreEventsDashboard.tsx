import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { Language } from '../utils/i18n';
import { dnsCoreAuth } from '../lib/dnsCore';
import { eventCopy } from './copy';
import { listEvents } from './repository';
import { EventEditor } from './EventEditor';
import { EventsDesignPreview } from './EventsDesignPreview';
import type { DNSEvent } from './types';

export function CoreEventsDashboard({ lang }: { lang: Language }) {
  const c = eventCopy(lang);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [events, setEvents] = useState<DNSEvent[]>([]);
  const [creating, setCreating] = useState(false);
  const [designPreview, setDesignPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(dnsCoreAuth, user => setSignedIn(Boolean(user))), []);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setLoading(true);
    listEvents().then(data => { if (active) setEvents(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : c.failed); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signedIn, c.failed]);

  // Same local-only workshop when the DNS Core SSO bridge is enabled but
  // the user has not signed in. No token or Firestore read is attempted.
  if (!signedIn || designPreview) return (
    <EventsDesignPreview lang={lang}
      onExit={signedIn ? () => setDesignPreview(false) : undefined} />
  );

  return (
    <div className="dns-shell space-y-5 py-6">
      <section className="dns-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="dns-kicker">Dolomiti NordicSki · DNS Core</div>
          <h1 className="text-2xl font-semibold text-dns-deep">{c.events}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dns-button" data-variant="secondary"
            onClick={() => setDesignPreview(true)}>
            {lang === 'de' ? 'Oberfläche testen' : 'Anteprima interfaccia'}
          </button>
          {signedIn && !error && !creating && (
            <button type="button" className="dns-button" data-variant="primary"
              onClick={() => setCreating(true)}>{c.create}</button>
          )}
        </div>
      </section>
      {signedIn && creating ? (
        <EventEditor lang={lang} onCreated={event => {
          setEvents(current => [event, ...current]);
          setCreating(false);
        }} onCancel={() => setCreating(false)} />
      ) : signedIn && (
        <section className="space-y-3">
          <p role="status" className="text-sm text-dns-muted">
            {lang === 'de' ? 'Veranstaltungen starten geschlossen. Die öffentliche Anmeldung ist noch nicht aktiv.'
              : 'I nuovi eventi sono inizialmente chiusi. Le iscrizioni pubbliche non sono ancora attive.'}
          </p>
          {loading ? <p>{c.loading}</p> : error ? <p role="alert">{error}</p>
            : events.length === 0 ? <p className="dns-card p-5">{c.noEvents}</p>
              : events.map(event => <article className="dns-card p-5" key={event.id}>
                  <h2 className="text-lg font-semibold">{event.title}</h2>
                  <p className="text-sm text-dns-muted">
                    {event.startsAt.replace('T', ' ')} · {event.location} · {event.status}
                  </p>
                </article>)}
        </section>
      )}
    </div>
  );
}
