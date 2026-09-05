/**
 * 10: the copy for every state where the app has to say no.
 *
 * The five strings answer one question between them - what happened to my message - so they live
 * together rather than in the five places that render them, where they drift apart. Two are
 * Stream's own strings and are fed into the SDK's translation table from here; the rest belong to
 * this section's markup. The SDK's defaults are longer than these and say "click", which is wrong
 * on a phone.
 */

/**
 * The cap a message is refused at. Stream enforces its own `max_message_length` per channel type
 * and that is the authority; this is the client's copy of the number, so the refusal happens
 * before the send rather than as a bounce afterwards.
 */
export const MAX_MESSAGE_LENGTH = 2000;

/** The name a thread carries once the person on the other side is gone. */
export const DELETED_ACCOUNT_NAME = 'Deleted account';

export const SOCIAL_COPY = {
  /** A send that never reached Stream. The line is the retry target, so it says what to do. */
  sendFailed: 'Not sent. Tap to try again.',
  /** A send Stream refused. There is nothing to retry, so the line states the rule instead. */
  sendRefused: 'You cannot post in this channel.',
  /** Blocking is reversible: the thread stays and the composer names who, beside the way back. */
  blocked: (handle: string) => `You blocked @${handle}.`,
  /** The account is gone. The history stays; there is nobody left to write to. */
  deletedAccount: 'This account no longer exists.',
  /** Refused before it is sent, so the number is the whole message. */
  tooLong: `${MAX_MESSAGE_LENGTH.toLocaleString('en-US')} characters maximum.`,
} as const;
