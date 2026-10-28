import { useState } from 'react';
import type { Language } from '../utils/i18n';
import { eventCopy } from './copy';
import type { DNSEvent } from './types';
import { EventEditor } from './EventEditor';

/**
 * Safe UI workshop: client-side React state only.
 * No Firestore requests, registration access, external links or saved credentials.
 * Refreshing the page deliberately resets all preview entries.
 */
export function EventsDesignPreview({ lang }: { lang: Language }) {
  const c = eventCopy(lang);
  const [events, setEvents] = useState<DNSEvent[]>([]);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const isGerman = lang === 'de';

  const createLocalDraft = async (
    data: Omit<DNSEvent, 'id' | 'createdAt' | 'schemaVersion'>,
  ): Promise<DNSEvent> => ({
    ...data,
    // No public registrations are enabled in the design workshop.
    status: 'closed',
    id: 'preview-' + crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  });

  return (
    <section className="dns-shell space-y-5 py-6" data-dns-events-design-preview>
      <div className="dns-card space-y-3 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="dns-kicker">DNS Polls · {isGerman ? 'Veranstaltungen' : 'Eventi'}</p>
            <h1 className="text-2xl font-semibold text-dns-deep">{c.events}</h1>
            <p className="text-sm text-dns-muted">
              {isGerman
                ? 'Veranstaltungen mit Anmeldung und individuellen Zusatzfragen gestalten.'
                : 'Progetta eventi con iscrizioni e domande personalizzate.'}
            </p>
          </div>
          {!creating && (
            <button type="button" className="dns-button" data-variant="primary"
              onClick={() => setCreating(true)}>{c.create}</button>
          )}
        </div>
        <p role="status" className="text-sm text-dns-muted">
          <strong>{isGerman ? 'Entwurf ohne Anmeldung.' : 'Anteprima senza accesso.'}</strong>{' '}
          {isGerman
            ? 'Nur lokal in dieser Sitzung: keine Firestore-Daten, keine Veröffentlichung, keine echten Anmeldungen. Nach dem Neuladen werden die Entwürfe verworfen.'
            : 'Solo in questa sessione: nessun dato Firestore, nessuna pubblicazione, nessuna iscrizione reale. Ricaricando la pagina le bozze vengono cancellate.'}
        </p>
      </div>

      {creating ? (
        <EventEditor
          lang={lang}
          onSave={createLocalDraft}
          saveLabel={isGerman ? 'In Vorschau übernehmen' : 'Aggiungi all’anteprima'}
          onCreated={event => {
            setEvents(current => [event, ...current]);
            setExpanded(event.id);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-dns-deep">
              {isGerman ? 'Entwürfe dieser Sitzung' : 'Bozze di questa sessione'}
              {' '}({events.length})
            </h2>
            {events.length > 0 && (
              <button type="button" className="dns-button" data-variant="secondary"
                onClick={() => { setEvents([]); setExpanded(null); }}>
                {isGerman ? 'Vorschau leeren' : 'Svuota anteprima'}
              </button>
            )}
          </div>
          {!events.length && (
            <section className="dns-card space-y-2 p-5">
              <p className="font-semibold">{isGerman ? 'Noch keine Entwürfe' : 'Nessuna bozza'}</p>
              <p className="text-sm text-dns-muted">
                {isGerman
                  ? 'Erstellen Sie einen Probe-Event, um das Formular und die Veranstaltungsübersicht zu testen.'
                  : 'Crea un evento di prova per lavorare sul modulo e sulla visualizzazione dell’elenco.'}
              </p>
            </section>
          )}
          {events.map(event => (
            <article className="dns-card space-y-3 p-5" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-dns-deep">{event.title}</h3>
                  <p className="text-sm text-dns-muted">
                    {event.startsAt.replace('T', ' ')}{event.location ? ' · ' + event.location : ''}
                  </p>
                </div>
                <button type="button" className="dns-button" data-variant="secondary"
                  aria-expanded={expanded === event.id}
                  onClick={() => setExpanded(current => current === event.id ? null : event.id)}>
                  {expanded === event.id
                    ? (isGerman ? 'Details schließen' : 'Chiudi dettagli')
                    : (isGerman ? 'Details anzeigen' : 'Mostra dettagli')}
                </button>
              </div>
              {expanded === event.id && (
                <div className="space-y-3 border-t border-dns-mid/10 pt-3">
                  {event.description && <p className="text-sm">{event.description}</p>}
                  <p className="text-sm text-dns-muted">
                    {isGerman ? 'Anmeldung geschlossen · Nur Vorschau' : 'Iscrizioni chiuse · Solo anteprima'}
                  </p>
                  <h4 className="font-semibold">{c.questions} ({event.questions.length})</h4>
                  {event.questions.map(q => (
                    <div key={q.id} className="rounded-md border border-dns-mid/10 p-3">
                      <p className="text-sm font-semibold">{q.label}{q.required ? ' *' : ''}</p>
                      <p className="text-xs text-dns-muted">
                        {q.type === 'text' ? c.text : q.type === 'select' ? c.select : c.checkbox}
                        {q.options?.length ? ' · ' + q.options.join(' / ') : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
