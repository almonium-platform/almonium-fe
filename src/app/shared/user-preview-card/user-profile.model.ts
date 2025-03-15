import {TargetLanguageWithProficiency} from "../../onboarding/language-setup/language-setup.model";

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

export enum RelationshipStatus {
  FRIENDS = 'FRIENDS',
  BLOCKED = 'BLOCKED',
  PENDING_OUTGOING = 'PENDING_OUTGOING',
  PENDING_INCOMING = 'PENDING_INCOMING',
  STRANGER = 'STRANGER',
}
