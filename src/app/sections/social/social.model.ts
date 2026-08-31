import {RelationshipStatus} from '../../shared/relationship.model';
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableString,
  expectRecord,
  expectString,
} from '../../shared/runtime-validation';

export {RelationshipAction, RelationshipStatus} from '../../shared/relationship.model';

export interface PublicUserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  premium: boolean;
}

export interface RelatedUserProfile extends PublicUserProfile {
  relationshipId: string;
  relationshipStatus: RelationshipStatus;
}

/**
 * A handle search answers with every account, so a result may have no relationship at all. The
 * status is what the row's single control is drawn from.
 */
export interface UserSearchResult extends PublicUserProfile {
  relationshipId: string | null;
  relationshipStatus: RelationshipStatus;
}

export function parsePublicUserProfiles(value: unknown, path = 'users'): PublicUserProfile[] {
  return expectArray(value, path).map((item, index) => parsePublicUserProfile(item, `${path}[${index}]`));
}

export function parseRelatedUserProfiles(value: unknown, path = 'related users'): RelatedUserProfile[] {
  return expectArray(value, path).map((item, index) => {
    const profile = expectRecord(item, `${path}[${index}]`);
    return {
      ...parsePublicUserProfile(profile, `${path}[${index}]`),
      relationshipId: expectString(profile['relationshipId'], `${path}[${index}].relationshipId`),
      relationshipStatus: expectEnum(
        profile['relationshipStatus'],
        Object.values(RelationshipStatus),
        `${path}[${index}].relationshipStatus`,
      ),
    };
  });
}

export function parseUserSearchResults(value: unknown, path = 'user search results'): UserSearchResult[] {
  return expectArray(value, path).map((item, index) => {
    const profile = expectRecord(item, `${path}[${index}]`);
    return {
      ...parsePublicUserProfile(profile, `${path}[${index}]`),
      relationshipId: expectNullableString(profile['relationshipId'], `${path}[${index}].relationshipId`),
      relationshipStatus: expectEnum(
        profile['relationshipStatus'],
        Object.values(RelationshipStatus),
        `${path}[${index}].relationshipStatus`,
      ),
    };
  });
}

function parsePublicUserProfile(value: unknown, path: string): PublicUserProfile {
  const profile = expectRecord(value, path);
  return {
    id: expectString(profile['id'], `${path}.id`),
    username: expectString(profile['username'], `${path}.username`),
    avatarUrl: expectNullableString(profile['avatarUrl'], `${path}.avatarUrl`),
    premium: expectBoolean(profile['premium'], `${path}.premium`),
  };
}
