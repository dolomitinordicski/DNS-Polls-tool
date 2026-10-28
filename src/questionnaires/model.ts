/** Separate UI contract. Never write these drafts to the legacy date-polls collection. */
export type QuestionnaireQuestionType = 'text' | 'single' | 'multiple' | 'yesNo';

export interface QuestionnaireQuestion {
  id: string;
  label: string;
  type: QuestionnaireQuestionType;
  required: boolean;
  options: string[];
}

export interface QuestionnaireDraft {
  id: string;
  title: string;
  description: string;
  questions: QuestionnaireQuestion[];
}

export type QuestionnaireAnswer = string | string[] | boolean;

export const QUESTIONNAIRE_MAX_QUESTIONS = 12;
export const QUESTIONNAIRE_MAX_OPTIONS = 10;

export function validateQuestionnaire(draft: QuestionnaireDraft): string[] {
  const errors: string[] = [];
  if (!draft.title.trim() || draft.title.trim().length > 160) errors.push('title');
  if (draft.description.length > 2000) errors.push('description');
  if (draft.questions.length < 1 || draft.questions.length > QUESTIONNAIRE_MAX_QUESTIONS) errors.push('questions');
  const ids = new Set<string>();
  for (const q of draft.questions) {
    if (!q.id || ids.has(q.id) || !q.label.trim() || q.label.trim().length > 160 ||
      !['text', 'single', 'multiple', 'yesNo'].includes(q.type)) {
      errors.push('question');
    }
    ids.add(q.id);
    if (q.type === 'single' || q.type === 'multiple') {
      const clean = q.options.map(v => v.trim()).filter(Boolean);
      if (clean.length < 2 || clean.length > QUESTIONNAIRE_MAX_OPTIONS ||
          clean.some(v => v.length > 120) ||
          new Set(clean.map(v => v.toLocaleLowerCase())).size !== clean.length) {
        errors.push('options');
      }
    }
  }
  return [...new Set(errors)];
}

export function newQuestion(id: string): QuestionnaireQuestion {
  return { id, label: '', type: 'text', required: false, options: [] };
}

export function newQuestionnaire(id: string): QuestionnaireDraft {
  return { id, title: '', description: '', questions: [newQuestion(id + '-q1')] };
}
