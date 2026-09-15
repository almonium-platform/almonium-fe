import {LanguageCode} from '../../models/language.enum';
import {CEFRLevel, Learner} from '../../models/userinfo.model';
import {reconcileSubmittedLearnerLevels} from './language-setup.model';

describe('reconcileSubmittedLearnerLevels', () => {
  it('keeps existing levels and applies every level selected for new languages', () => {
    const learners = [
      new Learner('existing', LanguageCode.EN, CEFRLevel.B1, true),
      new Learner('new-de', LanguageCode.DE, CEFRLevel.A1, true),
      new Learner('new-fr', LanguageCode.FR, CEFRLevel.A1, true),
    ];

    const reconciled = reconcileSubmittedLearnerLevels(learners, [
      {language: LanguageCode.DE, cefrLevel: CEFRLevel.B2},
      {language: LanguageCode.FR, cefrLevel: CEFRLevel.C1},
    ]);

    expect(reconciled.map(learner => learner.selfReportedLevel))
      .toEqual([CEFRLevel.B1, CEFRLevel.B2, CEFRLevel.C1]);
  });
});
