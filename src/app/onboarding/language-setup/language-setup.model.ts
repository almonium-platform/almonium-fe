import {CEFRLevel, Learner} from '../../models/userinfo.model';

export interface TargetLanguageWithProficiency {
  language: string;
  cefrLevel: CEFRLevel;
  /** BCP-47 tag of the variety chosen beside the level; absent means the language's default. */
  variety?: string;
}

export interface LanguageSetupRequest {
  fluentLangs: string[];
  targetLangsData: TargetLanguageWithProficiency[];
}

export function reconcileSubmittedLearnerLevels(
  learners: Learner[],
  submitted: TargetLanguageWithProficiency[],
): Learner[] {
  const submittedLevels = new Map(submitted.map(item => [item.language, item.cefrLevel]));

  return learners.map(learner => new Learner(
    learner.id,
    learner.language,
    submittedLevels.get(learner.language) ?? learner.selfReportedLevel,
    learner.active,
    learner.variety,
  ));
}
