import {RelationshipStatus} from '../../shared/relationship.model';

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
