import { useEffect, useState } from 'react';
import type { Language } from '../utils/i18n';
import { eventCopy } from './copy';
import { listRegistrations } from './repository';
import type { DNSEvent, EventRegistration } from './types';

interface Props { event: DNSEvent; lang: Language; }

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const escaped = /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + escaped.replace(/"/g, '""') + '"';
}

export function EventRegistrations({ event, lang }: Props) {
  const c = eventCopy(lang);
  const [rows, setRows] = useState<EventRegistration[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    listRegistrations(event.id)
      .then(data => { if (active) setRows(data); })
      .catch(() => { if (active) setError(c.failed); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [event.id, c.failed]);

  const exportCsv = () => {
    const columns = ['firstName', 'lastName', 'email', ...event.questions.map(q => q.label)];
    const data = rows.map(row => [
      row.firstName, row.lastName, row.email,
      ...event.questions.map(q => row.answers[q.id] ?? ''),
    ]);
    const csv = [columns, ...data].map(r => r.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'dns-event-' + event.id + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="dns-card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{c.participants} ({rows.length})</h3>
        <button type="button" className="dns-button" data-variant="secondary"
          disabled={!rows.length} onClick={exportCsv}>{c.export}</button>
      </div>
      {loading ? <p>{c.loading}</p> : error ? <p role="alert">{error}</p> :
       !rows.length ? <p className="text-sm text-dns-muted">{c.noRegistrations}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-dns-mid/15">
              <th className="p-2">{c.firstName}</th>
              <th className="p-2">{c.lastName}</th>
              <th className="p-2">{c.email}</th>
            </tr></thead>
            <tbody>{rows.map(row => (
              <tr className="border-b border-dns-mid/10" key={row.id}>
                <td className="p-2">{row.firstName}</td>
                <td className="p-2">{row.lastName}</td>
                <td className="p-2">{row.email}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
