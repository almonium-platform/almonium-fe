import {CEFRLevel} from '../models/userinfo.model';

/**
 * What each CEFR code stands for, in the reader's own words. Onboarding asks the question with these sentences
 * and stores the code, so anywhere the code is shown back as a choice has to offer the same sentence: nobody
 * picked "B1", they picked the line about looking words up.
 */
export const CEFR_LEVEL_COPY: Record<CEFRLevel, string> = {
  [CEFRLevel.A1]: 'I know some words and set phrases.',
  [CEFRLevel.A2]: 'I can follow short, direct sentences about familiar things.',
  [CEFRLevel.B1]: 'I can get through a simple story if I look words up often.',
  [CEFRLevel.B2]: 'I can follow a novel with a dictionary nearby.',
  [CEFRLevel.C1]: 'I read fluently and stop only at unusual or literary words.',
  [CEFRLevel.C2]: 'I read anything, including older and specialised prose.',
};

/** The codes paired with their sentences, in order, for a list that shows both. */
export const CEFR_LEVEL_ENTRIES = Object.entries(CEFR_LEVEL_COPY) as [CEFRLevel, string][];
