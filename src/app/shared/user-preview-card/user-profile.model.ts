import {TargetLanguageWithProficiency} from "../../onboarding/language-setup/language-setup.model";
import {RelationshipStatus} from '../relationship.model';
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableString,
  expectNumber,
  expectRecord,
  expectString,
} from '../runtime-validation';
import {LanguageCode} from '../../models/language.enum';
import {CEFRLevel} from '../../models/userinfo.model';

export {RelationshipStatus} from '../relationship.model';

export interface UserProfileInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
  registeredAt: string;
  isPremium: boolean;
  hidden: boolean;
  interests: string[];
  loginStreak: number;
  fluentLangs: string[];
  targetLangs: TargetLanguageWithProficiency[];
  relationshipId: string | null;
  relationshipStatus: RelationshipStatus;
  acceptsRequests: boolean | null;
}

export function parseUserProfileInfo(value: unknown): UserProfileInfo {
  const profile = expectRecord(value, 'user profile');
  const hidden = expectBoolean(profile['hidden'], 'user profile.hidden');
  return {
    id: expectString(profile['id'], 'user profile.id'),
    username: expectString(profile['username'], 'user profile.username'),
    avatarUrl: expectNullableString(profile['avatarUrl'], 'user profile.avatarUrl'),
    registeredAt: expectString(profile['registeredAt'], 'user profile.registeredAt'),
    isPremium: expectBoolean(profile['premium'], 'user profile.premium'),
    hidden,
    interests: expectProfileDetailArray(profile['interests'], 'user profile.interests', hidden)
      .map((interest, index) => expectString(interest, `user profile.interests[${index}]`)),
    loginStreak: profile['loginStreak'] === undefined && hidden
      ? 0
      : expectNumber(profile['loginStreak'], 'user profile.loginStreak'),
    fluentLangs: expectProfileDetailArray(profile['fluentLangs'], 'user profile.fluentLangs', hidden)
      .map((language, index) => expectEnum(language, Object.values(LanguageCode), `user profile.fluentLangs[${index}]`)),
    targetLangs: expectProfileDetailArray(profile['targetLangs'], 'user profile.targetLangs', hidden).map((target, index) => {
      const targetLanguage = expectRecord(target, `user profile.targetLangs[${index}]`);
      return {
        language: expectEnum(
          targetLanguage['language'],
          Object.values(LanguageCode),
          `user profile.targetLangs[${index}].language`,
        ),
        cefrLevel: expectEnum(
          targetLanguage['cefrLevel'],
          Object.values(CEFRLevel),
          `user profile.targetLangs[${index}].cefrLevel`,
        ),
      };
    }),
    relationshipId: expectNullableString(profile['relationshipId'], 'user profile.relationshipId'),
    relationshipStatus: expectEnum(
      profile['relationshipStatus'],
      Object.values(RelationshipStatus),
      'user profile.relationshipStatus',
    ),
    acceptsRequests: profile['acceptsRequests'] === null
      ? null
      : expectBoolean(profile['acceptsRequests'], 'user profile.acceptsRequests'),
  };
}

function expectProfileDetailArray(value: unknown, path: string, hidden: boolean): unknown[] {
  return value === undefined && hidden ? [] : expectArray(value, path);
}
