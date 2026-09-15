import {
  expectArray,
  expectBoolean,
  expectDate,
  expectEnum,
  expectNumber,
  expectRecord,
  expectString,
  expectUuid,
} from '../../shared/runtime-validation';

export const learningIntents = ['UNDERSTAND', 'PRODUCE', 'PRONOUNCE', 'DISAMBIGUATE', 'CHUNK'] as const;
export type LearningIntent = typeof learningIntents[number];

export const reviewPromptTypes = ['MEANING_RECALL', 'FORM_RECALL', 'SENSE_DISCRIMINATION'] as const;
export type ReviewPromptType = typeof reviewPromptTypes[number];

export const reviewOutcomes = ['CORRECT', 'RECOVERED_WITH_HINT', 'INCORRECT', 'CONFUSED', 'TYPO_CORRECTION'] as const;
export type ReviewOutcome = typeof reviewOutcomes[number];

export interface ReviewSummary {
  dueCount: number;
  sessionSize: number;
  understandCount: number;
  produceCount: number;
  disambiguateCount: number;
  leechCount: number;
  leeches: LeechItem[];
}

export interface LeechItem {
  itemId: string;
  entry: string;
  failedPromptType: string | null;
  failureCount: number;
}

export interface ReviewHint {
  type: string;
  label: string;
  cost: string;
  content: string;
}

export interface ReviewItem {
  itemId: string;
  promptId: string;
  intent: LearningIntent;
  promptType: ReviewPromptType;
  prompt: string;
  sourceContext: string | null;
  language: string;
  savedAt: Date;
  seenCount: number;
  hints: ReviewHint[];
}

export interface ReviewSession {
  sessionId: string;
  backlogCount: number;
  items: ReviewItem[];
}

export interface ConfusedItem {
  itemId: string;
  entry: string;
  meaning: string | null;
  example: string | null;
  directionCount: number;
}

export interface ReviewAnswer {
  eventId: string;
  outcome: ReviewOutcome;
  answer: string;
  expectedAnswer: string;
  confusedWith: ConfusedItem | null;
  dueAt: Date;
  leech: boolean;
  completedCount: number;
  sessionSize: number;
}

export interface ReviewSessionResult {
  total: number;
  straightThrough: number;
  afterHint: number;
  confused: number;
  stillDue: number;
  dessertSentences: string[];
}

export function parseReviewSummary(value: unknown): ReviewSummary {
  const summary = expectRecord(value, 'reviewSummary');
  return {
    dueCount: expectNumber(summary['dueCount'], 'reviewSummary.dueCount'),
    sessionSize: expectNumber(summary['sessionSize'], 'reviewSummary.sessionSize'),
    understandCount: expectNumber(summary['understandCount'], 'reviewSummary.understandCount'),
    produceCount: expectNumber(summary['produceCount'], 'reviewSummary.produceCount'),
    disambiguateCount: expectNumber(summary['disambiguateCount'], 'reviewSummary.disambiguateCount'),
    leechCount: expectNumber(summary['leechCount'], 'reviewSummary.leechCount'),
    leeches: expectArray(summary['leeches'], 'reviewSummary.leeches').map((value, index) => {
      const path = `reviewSummary.leeches[${index}]`;
      const item = expectRecord(value, path);
      return {
        itemId: expectUuid(item['itemId'], `${path}.itemId`),
        entry: expectString(item['entry'], `${path}.entry`),
        failedPromptType: item['failedPromptType'] == null ? null : expectString(item['failedPromptType'], `${path}.failedPromptType`),
        failureCount: expectNumber(item['failureCount'], `${path}.failureCount`),
      };
    }),
  };
}

export function parseReviewSession(value: unknown): ReviewSession {
  const session = expectRecord(value, 'reviewSession');
  return {
    sessionId: expectUuid(session['sessionId'], 'reviewSession.sessionId'),
    backlogCount: expectNumber(session['backlogCount'], 'reviewSession.backlogCount'),
    items: expectArray(session['items'], 'reviewSession.items').map(parseReviewItem),
  };
}

function parseReviewItem(value: unknown, index: number): ReviewItem {
  const path = `reviewSession.items[${index}]`;
  const item = expectRecord(value, path);
  return {
    itemId: expectUuid(item['itemId'], `${path}.itemId`),
    promptId: expectUuid(item['promptId'], `${path}.promptId`),
    intent: expectEnum(item['intent'], learningIntents, `${path}.intent`),
    promptType: expectEnum(item['promptType'], reviewPromptTypes, `${path}.promptType`),
    prompt: expectString(item['prompt'], `${path}.prompt`),
    sourceContext: item['sourceContext'] == null ? null : expectString(item['sourceContext'], `${path}.sourceContext`),
    language: expectString(item['language'], `${path}.language`),
    savedAt: expectDate(item['savedAt'], `${path}.savedAt`),
    seenCount: expectNumber(item['seenCount'], `${path}.seenCount`),
    hints: expectArray(item['hints'], `${path}.hints`).map((hint, hintIndex) => {
      const hintPath = `${path}.hints[${hintIndex}]`;
      const parsed = expectRecord(hint, hintPath);
      return {
        type: expectString(parsed['type'], `${hintPath}.type`),
        label: expectString(parsed['label'], `${hintPath}.label`),
        cost: expectString(parsed['cost'], `${hintPath}.cost`),
        content: expectString(parsed['content'], `${hintPath}.content`),
      };
    }),
  };
}

export function parseReviewAnswer(value: unknown): ReviewAnswer {
  const answer = expectRecord(value, 'reviewAnswer');
  return {
    eventId: expectUuid(answer['eventId'], 'reviewAnswer.eventId'),
    outcome: expectEnum(answer['outcome'], reviewOutcomes, 'reviewAnswer.outcome'),
    answer: expectString(answer['answer'], 'reviewAnswer.answer'),
    expectedAnswer: expectString(answer['expectedAnswer'], 'reviewAnswer.expectedAnswer'),
    confusedWith: answer['confusedWith'] == null ? null : parseConfusedItem(answer['confusedWith']),
    dueAt: expectDate(answer['dueAt'], 'reviewAnswer.dueAt'),
    leech: expectBoolean(answer['leech'], 'reviewAnswer.leech'),
    completedCount: expectNumber(answer['completedCount'], 'reviewAnswer.completedCount'),
    sessionSize: expectNumber(answer['sessionSize'], 'reviewAnswer.sessionSize'),
  };
}

function parseConfusedItem(value: unknown): ConfusedItem {
  const item = expectRecord(value, 'reviewAnswer.confusedWith');
  return {
    itemId: expectUuid(item['itemId'], 'reviewAnswer.confusedWith.itemId'),
    entry: expectString(item['entry'], 'reviewAnswer.confusedWith.entry'),
    meaning: item['meaning'] == null ? null : expectString(item['meaning'], 'reviewAnswer.confusedWith.meaning'),
    example: item['example'] == null ? null : expectString(item['example'], 'reviewAnswer.confusedWith.example'),
    directionCount: expectNumber(item['directionCount'], 'reviewAnswer.confusedWith.directionCount'),
  };
}

export function parseReviewSessionResult(value: unknown): ReviewSessionResult {
  const result = expectRecord(value, 'reviewSessionResult');
  return {
    total: expectNumber(result['total'], 'reviewSessionResult.total'),
    straightThrough: expectNumber(result['straightThrough'], 'reviewSessionResult.straightThrough'),
    afterHint: expectNumber(result['afterHint'], 'reviewSessionResult.afterHint'),
    confused: expectNumber(result['confused'], 'reviewSessionResult.confused'),
    stillDue: expectNumber(result['stillDue'], 'reviewSessionResult.stillDue'),
    dessertSentences: expectArray(result['dessertSentences'], 'reviewSessionResult.dessertSentences')
      .map((sentence, index) => expectString(sentence, `reviewSessionResult.dessertSentences[${index}]`)),
  };
}
