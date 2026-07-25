import {RelationshipStatus} from '../../shared/relationship.model';
import {expectArray, expectEnum, expectRecord, expectString} from '../../shared/runtime-validation';

export {RelationshipAction, RelationshipStatus} from '../../shared/relationship.model';

export interface PublicUserProfile {
  id: string;
  username: string;
  avatarUrl: string;
}

export interface RelatedUserProfile {
  id: string;
  username: string;
  avatarUrl: string;
  relationshipId: string;
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

function parsePublicUserProfile(value: unknown, path: string): PublicUserProfile {
  const profile = expectRecord(value, path);
  return {
    id: expectString(profile['id'], `${path}.id`),
    username: expectString(profile['username'], `${path}.username`),
    avatarUrl: expectString(profile['avatarUrl'], `${path}.avatarUrl`),
  };
}
