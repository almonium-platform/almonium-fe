import {ApiContractError} from '../../shared/runtime-validation';
import {parseReviewSession} from './review.model';

describe('review contract parsing', () => {
  it('parses dates and constrained intent values', () => {
    const session = parseReviewSession({
      sessionId: '01900000-0000-7000-8000-000000000001',
      backlogCount: 12,
      items: [{
        itemId: '01900000-0000-7000-8000-000000000002',
        promptId: '01900000-0000-7000-8000-000000000003',
        intent: 'PRODUCE',
        promptType: 'FORM_RECALL',
        prompt: 'an edition',
        sourceContext: null,
        language: 'DE',
        savedAt: '2026-08-01T10:00:00Z',
        seenCount: 5,
        hints: [],
      }],
    });
    expect(session.items[0].savedAt).toEqual(new Date('2026-08-01T10:00:00Z'));
  });

  it('rejects unknown prompt intents instead of guessing', () => {
    expect(() => parseReviewSession({
      sessionId: '01900000-0000-7000-8000-000000000001',
      backlogCount: 1,
      items: [{
        itemId: '01900000-0000-7000-8000-000000000002',
        promptId: '01900000-0000-7000-8000-000000000003',
        intent: 'GUESS', promptType: 'FORM_RECALL', prompt: 'x', sourceContext: null,
        language: 'DE', savedAt: '2026-08-01T10:00:00Z', seenCount: 0, hints: [],
      }],
    })).toThrowError(ApiContractError);
  });
});
