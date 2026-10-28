import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  duplicateQuestionnaire, newQuestionnaire, validateQuestionnaire,
  QUESTIONNAIRE_MAX_QUESTIONS,
} from '../src/questionnaires/model.ts';

const makeValid = () => ({
  id: 'draft-1',
  title: 'Questionario di esempio',
  description: '',
  questions: [
    { id: 'q1', label: 'Quale area?', type: 'single', required: true, options: ['Ahrntal', 'Gsiesertal'] },
    { id: 'q2', label: 'Commenti', type: 'text', required: false, options: [] },
  ],
});

describe('Questionari local-only draft contract', () => {
  it('starts with one editable question, no fake saved answers', () => {
    const draft = newQuestionnaire('draft-test');
    assert.equal(draft.questions.length, 1);
    assert.deepEqual(validateQuestionnaire(draft).sort(), ['question', 'title']);
    assert.equal(draft.questions[0].type, 'text');
  });

  it('accepts a complete questionnaire', () => {
    assert.deepEqual(validateQuestionnaire(makeValid()), []);
  });

  it('requires title and between one and twelve questions', () => {
    const blank = makeValid();
    blank.title = ' ';
    blank.questions = [];
    assert.deepEqual(validateQuestionnaire(blank).sort(), ['questions', 'title']);
    blank.title = 'Valid title';
    blank.questions = Array.from({ length: QUESTIONNAIRE_MAX_QUESTIONS + 1 }, (_, i) => ({
      id: String(i), label: 'Question', type: 'yesNo', required: false, options: [],
    }));
    assert.deepEqual(validateQuestionnaire(blank), ['questions']);
  });

  it('rejects duplicate question IDs and invalid options', () => {
    const draft = makeValid();
    draft.questions[1].id = 'q1';
    draft.questions[0].options = ['  Gsiesertal ', 'gsiesertal'];
    assert.deepEqual(validateQuestionnaire(draft).sort(), ['options', 'question']);
  });

  it('rejects empty options and excessive input length', () => {
    const draft = makeValid();
    draft.title = 'x'.repeat(161);
    draft.description = 'x'.repeat(2001);
    draft.questions[0].options = ['Only one'];
    assert.deepEqual(validateQuestionnaire(draft).sort(), ['description', 'options', 'title']);
  });

  it('duplicates a draft without reusing question identities or option arrays', () => {
    const source = makeValid();
    const newIds = ['copy-id', 'copy-q1', 'copy-q2'];
    const copy = duplicateQuestionnaire(source, () => newIds.shift(), 'copia');
    assert.equal(copy.title, 'Questionario di esempio (copia)');
    assert.equal(copy.id, 'copy-id');
    assert.deepEqual(copy.questions.map(q => q.id), ['copy-q1', 'copy-q2']);
    assert.deepEqual(validateQuestionnaire(copy), []);
    copy.questions[0].options[0] = 'Nuova opzione';
    copy.questions[0].label = 'Una nuova domanda';
    assert.equal(source.questions[0].options[0], 'Ahrntal');
    assert.equal(source.questions[0].label, 'Quale area?');
  });

  it('keeps duplicated titles within the max length', () => {
    const source = makeValid();
    source.title = 'x'.repeat(160);
    const copy = duplicateQuestionnaire(source, () => 'distinct-id', 'Kopie');
    assert.equal(copy.title.length, 160);
  });

  it('allows free text, yes/no and multiple-choice types', () => {
    const draft = makeValid();
    draft.questions[0].type = 'multiple';
    draft.questions[1].type = 'yesNo';
    assert.deepEqual(validateQuestionnaire(draft), []);
  });
});
