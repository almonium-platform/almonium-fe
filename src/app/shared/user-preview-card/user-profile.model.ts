import {TargetLanguageWithProficiency} from "../../onboarding/language-setup/language-setup.model";
import {RelationshipStatus} from '../relationship.model';

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
