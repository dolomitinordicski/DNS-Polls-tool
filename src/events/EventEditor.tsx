import React, { useState } from 'react';
import type { Language } from '../utils/i18n';
import type { DNSEvent, EventQuestion, EventQuestionType } from './types';
import { createEvent } from './repository';
import { eventCopy } from './copy';

interface Props {
  lang: Language;
  onCreated: (event: DNSEvent) => void;
  onCancel: () => void;
}

export function EventEditor({ lang, onCreated, onCancel }: Props) {
  const c = eventCopy(lang);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [questions, setQuestions] = useState<EventQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changeQuestion = (id: string, change: Partial<EventQuestion>) =>
    setQuestions(current => current.map(q => q.id === id ? { ...q, ...change } : q));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startsAt ||
        questions.some(q => !q.label.trim() || (q.type === 'select' && !q.options?.length))) {
      setError(c.invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const event = await createEvent({
        title: title.trim(), description: description.trim(), location: location.trim(),
        startsAt, status: 'open',
        questions: questions.map(q => ({ ...q, label: q.label.trim() })),
      });
      onCreated(event);
    } catch (e) {
      console.error(e);
      setError(c.failed);
    } finally { setBusy(false); }
  };

  return (
    <form className="dns-card space-y-5 p-5 md:p-6" onSubmit={submit}>
      <h2 className="text-xl font-semibold text-dns-deep">{c.create}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="dns-kicker">{c.title} *</span>
          <input className="dns-input w-full" required maxLength={160} value={title}
            onChange={e => setTitle(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="dns-kicker">{c.location}</span>
          <input className="dns-input w-full" maxLength={200} value={location}
            onChange={e => setLocation(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="dns-kicker">{c.date} *</span>
          <input className="dns-input w-full" type="datetime-local" required value={startsAt}
            onChange={e => setStartsAt(e.target.value)} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="dns-kicker">{c.description}</span>
          <textarea className="dns-input w-full" rows={3} maxLength={2000} value={description}
            onChange={e => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="space-y-3 border-t border-dns-mid/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{c.questions}</h3>
          <button type="button" className="dns-button" data-variant="secondary"
            disabled={questions.length >= 8}
            onClick={() => setQuestions(current => [...current, {
              id: crypto.randomUUID(), label: '', type: 'text', required: false,
            }])}>{c.addQuestion}</button>
        </div>
        {questions.map((q, index) => (
          <div key={q.id} className="grid gap-3 rounded-md border border-dns-mid/10 p-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="dns-kicker">{c.fieldLabel} {index + 1}</span>
              <input className="dns-input w-full" maxLength={120} value={q.label}
                onChange={e => changeQuestion(q.id, { label: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="dns-kicker">{c.fieldType}</span>
              <select className="dns-input w-full" value={q.type}
                onChange={e => changeQuestion(q.id, {
                  type: e.target.value as EventQuestionType,
                  options: e.target.value === 'select' ? [lang === 'de' ? 'Ja' : 'Sì', lang === 'de' ? 'Nein' : 'No'] : undefined,
                })}>
                <option value="text">{c.text}</option>
                <option value="select">{c.select}</option>
                <option value="checkbox">{c.checkbox}</option>
              </select>
            </label>
            {q.type === 'select' && (
              <label className="space-y-1 sm:col-span-2">
                <span className="dns-kicker">{c.options}</span>
                <input className="dns-input w-full" maxLength={600} defaultValue={(q.options || []).join(', ')}
                  onBlur={e => changeQuestion(q.id, {
                    options: e.target.value.split(',').map(v => v.trim()).filter(Boolean).slice(0, 10),
                  })} />
              </label>
            )}
            <div className="flex items-center justify-between sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.required}
                  onChange={e => changeQuestion(q.id, { required: e.target.checked })} />
                {c.required}
              </label>
              <button type="button" className="text-sm text-dns-mid"
                onClick={() => setQuestions(current => current.filter(item => item.id !== q.id))}>
                {c.remove}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="dns-button" data-variant="secondary" onClick={onCancel}>
          {c.back}
        </button>
        <button type="submit" className="dns-button" data-variant="primary" disabled={busy}>
          {busy ? c.loading : c.save}
        </button>
      </div>
    </form>
  );
}
