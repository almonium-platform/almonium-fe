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
  avatarUrl: string;
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
  return {
    id: expectString(profile['id'], 'user profile.id'),
    username: expectString(profile['username'], 'user profile.username'),
    avatarUrl: expectString(profile['avatarUrl'], 'user profile.avatarUrl'),
    registeredAt: expectString(profile['registeredAt'], 'user profile.registeredAt'),
    isPremium: expectBoolean(profile['isPremium'], 'user profile.isPremium'),
    hidden: expectBoolean(profile['hidden'], 'user profile.hidden'),
    interests: expectArray(profile['interests'], 'user profile.interests')
      .map((interest, index) => expectString(interest, `user profile.interests[${index}]`)),
    loginStreak: expectNumber(profile['loginStreak'], 'user profile.loginStreak'),
    fluentLangs: expectArray(profile['fluentLangs'], 'user profile.fluentLangs')
      .map((language, index) => expectEnum(language, Object.values(LanguageCode), `user profile.fluentLangs[${index}]`)),
    targetLangs: expectArray(profile['targetLangs'], 'user profile.targetLangs').map((target, index) => {
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
