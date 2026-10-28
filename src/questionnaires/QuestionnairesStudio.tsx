import { type FormEvent, useState } from 'react';
import type { Language } from '../utils/i18n';
import { questionnaireCopy } from './copy';
import {
  type QuestionnaireAnswer, type QuestionnaireDraft, type QuestionnaireQuestion,
  QUESTIONNAIRE_MAX_OPTIONS, QUESTIONNAIRE_MAX_QUESTIONS,
  duplicateQuestionnaire, newQuestion, newQuestionnaire, validateQuestionnaire,
} from './model';

type Mode = 'list' | 'edit' | 'preview';

export function QuestionnairesStudio({ lang }: { lang: Language }) {
  const c = questionnaireCopy[lang];
  // Strictly memory-only: no localStorage, Firebase collection or network requests.
  const [drafts, setDrafts] = useState<QuestionnaireDraft[]>([]);
  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<QuestionnaireDraft | null>(null);
  const [selected, setSelected] = useState<QuestionnaireDraft | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuestionnaireAnswer>>({});
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [previewFromEditor, setPreviewFromEditor] = useState(false);

  const startNew = () => {
    setEditing(newQuestionnaire(crypto.randomUUID()));
    setError('');
    setMode('edit');
  };
  const editDraft = (draft: QuestionnaireDraft) => {
    setEditing({ ...draft, questions: draft.questions.map(q => ({ ...q, options: [...q.options] })) });
    setError('');
    setMode('edit');
  };
  const updateQuestion = (id: string, update: (q: QuestionnaireQuestion) => QuestionnaireQuestion) => {
    setEditing(current => current ? {
      ...current,
      questions: current.questions.map(q => q.id === id ? update(q) : q),
    } : current);
  };
  const moveQuestion = (index: number, delta: number) => {
    setEditing(current => {
      if (!current) return null;
      const next = [...current.questions];
      const other = index + delta;
      if (other < 0 || other >= next.length) return current;
      [next[index], next[other]] = [next[other], next[index]];
      return { ...current, questions: next };
    });
  };
  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if (validateQuestionnaire(editing).length) {
      setError(c.invalid);
      return;
    }
    const draft: QuestionnaireDraft = {
      ...editing,
      title: editing.title.trim(),
      description: editing.description.trim(),
      questions: editing.questions.map(q => ({
        ...q,
        label: q.label.trim(),
        options: q.options.map(x => x.trim()),
      })),
    };
    setDrafts(current => [draft, ...current.filter(item => item.id !== draft.id)]);
    setEditing(null);
    setError('');
    setMode('list');
  };
  const showPreview = (draft: QuestionnaireDraft, fromEditor = false) => {
    setSelected({
      ...draft,
      questions: draft.questions.map(q => ({ ...q, options: [...q.options] })),
    });
    setPreviewFromEditor(fromEditor);
    setAnswers({});
    setCompleted(false);
    setError('');
    setMode('preview');
  };
  const previewEditingDraft = () => {
    if (!editing) return;
    if (validateQuestionnaire(editing).length) {
      setError(c.invalid);
      return;
    }
    showPreview(editing, true);
  };
  const duplicateDraft = (draft: QuestionnaireDraft) => {
    const copy = duplicateQuestionnaire(draft, () => crypto.randomUUID(), c.copySuffix);
    setDrafts(current => [copy, ...current]);
  };
  const returnFromPreview = () => {
    if (!previewFromEditor || !editing) {
      returnToList();
      return;
    }
    setMode('edit');
    setSelected(null);
    setAnswers({});
    setCompleted(false);
    setError('');
    setPreviewFromEditor(false);
  };
  const setAnswer = (id: string, answer: QuestionnaireAnswer) => {
    setAnswers(current => ({ ...current, [id]: answer }));
    setCompleted(false);
    setError('');
  };
  const submitPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const missingRequired = selected.questions.some(q => {
      if (!q.required) return false;
      const value = answers[q.id];
      return value === undefined || (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);
    });
    if (missingRequired) {
      setError(c.requiredError);
      return;
    }
    setCompleted(true);
    setError('');
    // Deliberately no submission, persistence or analytics.
  };
  const returnToList = () => {
    setEditing(null);
    setSelected(null);
    setAnswers({});
    setCompleted(false);
    setError('');
    setPreviewFromEditor(false);
    setMode('list');
  };

  return (
    <section className="dns-shell space-y-5 py-6" data-dns-questionnaires-preview>
      <div className="dns-card space-y-3 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dns-kicker">{c.badge}</p>
            <h1 className="text-2xl font-semibold text-dns-deep">{c.title}</h1>
            <p className="mt-2 max-w-[720px] text-sm text-dns-muted">{c.subtitle}</p>
          </div>
          {mode === 'list' ? (
            <button type="button" className="dns-button" data-variant="primary" onClick={startNew}>{c.new}</button>
          ) : (
            <button type="button" className="dns-button" data-variant="secondary" onClick={mode === 'preview' ? returnFromPreview : returnToList}>
              {mode === 'preview' && previewFromEditor ? c.backEdit : c.back}</button>
          )}
        </div>
        <p role="status" className="border-t border-dns-mid/10 pt-3 text-sm text-dns-muted">{c.safety}</p>
      </div>

      {mode === 'list' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-dns-deep">{c.drafts} ({drafts.length})</h2>
            {drafts.length > 0 && (
              <button type="button" className="dns-button" data-variant="secondary"
                onClick={() => setDrafts([])}>{c.clear}</button>
            )}
          </div>
          {drafts.length === 0 && (
            <div className="dns-card p-6 text-sm text-dns-muted">{c.empty}</div>
          )}
          {drafts.map(draft => (
            <article key={draft.id} className="dns-card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="dns-kicker">{c.draft} · {draft.questions.length} {c.questions.toLowerCase()}</p>
                  <h3 className="text-lg font-semibold text-dns-deep">{draft.title}</h3>
                  {draft.description && <p className="text-sm text-dns-muted">{draft.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="dns-button" data-variant="primary"
                    onClick={() => showPreview(draft)}>{c.preview}</button>
                  <button type="button" className="dns-button" data-variant="secondary"
                    onClick={() => editDraft(draft)}>{c.edit}</button>
                  <button type="button" className="dns-button" data-variant="secondary"
                    onClick={() => duplicateDraft(draft)}>{c.duplicate}</button>
                  <button type="button" className="dns-button" data-variant="secondary"
                    onClick={() => setDrafts(current => current.filter(item => item.id !== draft.id))}>
                    {c.delete}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {mode === 'edit' && editing && (
        <form className="dns-card space-y-6 p-5 md:p-6" onSubmit={saveDraft}>
          <div className="grid gap-4">
            <label className="space-y-1">
              <span className="dns-kicker">{c.name} *</span>
              <input className="dns-input w-full" required maxLength={160}
                value={editing.title}
                onChange={event => setEditing(current => current ? { ...current, title: event.target.value } : current)} />
            </label>
            <label className="space-y-1">
              <span className="dns-kicker">{c.description}</span>
              <textarea className="dns-input w-full" rows={3} maxLength={2000}
                value={editing.description}
                onChange={event => setEditing(current => current ? { ...current, description: event.target.value } : current)} />
            </label>
          </div>
          <div className="space-y-4 border-t border-dns-mid/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-dns-deep">{c.questions} ({editing.questions.length})</h2>
              <button type="button" className="dns-button" data-variant="secondary"
                disabled={editing.questions.length >= QUESTIONNAIRE_MAX_QUESTIONS}
                onClick={() => setEditing(current => current ? {
                  ...current, questions: [...current.questions, newQuestion(crypto.randomUUID())],
                } : current)}>
                {c.addQuestion}
              </button>
            </div>
            {editing.questions.map((q, index) => (
              <section key={q.id} className="space-y-4 rounded-md border border-dns-mid/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-dns-deep">{c.questions} {index + 1}</h3>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" aria-label={c.up} title={c.up} className="dns-button"
                      data-variant="secondary" disabled={index === 0}
                      onClick={() => moveQuestion(index, -1)}>↑</button>
                    <button type="button" aria-label={c.down} title={c.down} className="dns-button"
                      data-variant="secondary" disabled={index === editing.questions.length - 1}
                      onClick={() => moveQuestion(index, 1)}>↓</button>
                    <button type="button" className="dns-button" data-variant="secondary"
                      disabled={editing.questions.length === 1}
                      onClick={() => setEditing(current => current ? {
                        ...current, questions: current.questions.filter(item => item.id !== q.id),
                      } : current)}>{c.removeQuestion}</button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="dns-kicker">{c.question} *</span>
                    <input className="dns-input w-full" maxLength={160} required
                      value={q.label} onChange={event => updateQuestion(q.id, current => ({
                        ...current, label: event.target.value,
                      }))} />
                  </label>
                  <label className="space-y-1">
                    <span className="dns-kicker">{c.type}</span>
                    <select className="dns-input w-full" value={q.type}
                      onChange={event => updateQuestion(q.id, current => {
                        const type = event.target.value as QuestionnaireQuestion['type'];
                        return {
                          ...current, type,
                          options: (type === 'single' || type === 'multiple')
                            ? current.options.length >= 2 ? current.options : [c.option + ' 1', c.option + ' 2']
                            : [],
                        };
                      })}>
                      <option value="text">{c.text}</option>
                      <option value="single">{c.single}</option>
                      <option value="multiple">{c.multiple}</option>
                      <option value="yesNo">{c.yesNo}</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end text-sm">
                    <input type="checkbox" checked={q.required}
                      onChange={event => updateQuestion(q.id, current => ({ ...current, required: event.target.checked }))} />
                    {c.required}
                  </label>
                </div>
                {(q.type === 'single' || q.type === 'multiple') && (
                  <div className="space-y-2">
                    <h4 className="dns-kicker">{c.options}</h4>
                    {q.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <label className="flex-1">
                          <span className="sr-only">{c.option} {optionIndex + 1}</span>
                          <input className="dns-input w-full" maxLength={120} value={option}
                            onChange={event => updateQuestion(q.id, current => ({
                              ...current,
                              options: current.options.map((old, i) => i === optionIndex ? event.target.value : old),
                            }))} />
                        </label>
                        <button type="button" className="dns-button" data-variant="secondary"
                          aria-label={c.removeOption} disabled={q.options.length <= 2}
                          onClick={() => updateQuestion(q.id, current => ({
                            ...current, options: current.options.filter((_, i) => i !== optionIndex),
                          }))}>×</button>
                      </div>
                    ))}
                    <button type="button" className="dns-button" data-variant="secondary"
                      disabled={q.options.length >= QUESTIONNAIRE_MAX_OPTIONS}
                      onClick={() => updateQuestion(q.id, current => ({
                        ...current, options: [...current.options, c.option + ' ' + (current.options.length + 1)],
                      }))}>{c.addOption}</button>
                  </div>
                )}
              </section>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="dns-button" data-variant="secondary" onClick={returnToList}>{c.cancel}</button>
            <button type="button" className="dns-button" data-variant="secondary"
              onClick={previewEditingDraft}>{c.previewUnsaved}</button>
            <button type="submit" className="dns-button" data-variant="primary">{c.save}</button>
          </div>
        </form>
      )}

      {mode === 'preview' && selected && (
        <form className="dns-card space-y-5 p-5 md:p-6" onSubmit={submitPreview}>
          <div className="space-y-2">
            <p className="dns-kicker">{c.preview} · {c.draft}</p>
            <h2 className="text-2xl font-semibold text-dns-deep">{selected.title}</h2>
            {selected.description && <p className="text-sm text-dns-muted">{selected.description}</p>}
            <p className="text-sm font-semibold text-dns-muted">{c.noRealData}</p>
          </div>
          {selected.questions.map((q, index) => (
            <fieldset key={q.id} className="space-y-3 border-t border-dns-mid/10 pt-4">
              <legend className="font-semibold text-dns-deep">
                {index + 1}. {q.label} {q.required ? '*' : ''}
              </legend>
              {q.type === 'text' && (
                <textarea className="dns-input w-full" rows={3} maxLength={1000}
                  placeholder={c.answer} value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                  onChange={event => setAnswer(q.id, event.target.value)} />
              )}
              {q.type === 'single' && q.options.map(option => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={q.id} checked={answers[q.id] === option}
                    onChange={() => setAnswer(q.id, option)} />{option}
                </label>
              ))}
              {q.type === 'multiple' && q.options.map(option => {
                const current = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
                return (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={current.includes(option)}
                      onChange={event => setAnswer(q.id, event.target.checked
                        ? [...current, option] : current.filter(item => item !== option))} />{option}
                  </label>
                );
              })}
              {q.type === 'yesNo' && (
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name={q.id} checked={answers[q.id] === true}
                      onChange={() => setAnswer(q.id, true)} />{c.yes}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name={q.id} checked={answers[q.id] === false}
                      onChange={() => setAnswer(q.id, false)} />{c.no}
                  </label>
                </div>
              )}
            </fieldset>
          ))}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {completed && <p role="status" className="text-sm font-semibold text-dns-deep">{c.success}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="dns-button" data-variant="secondary"
              onClick={returnFromPreview}>
              {previewFromEditor ? c.backEdit : c.back}
            </button>
            <button type="submit" className="dns-button" data-variant="primary">{c.simulate}</button>
          </div>
        </form>
      )}
    </section>
  );
}
