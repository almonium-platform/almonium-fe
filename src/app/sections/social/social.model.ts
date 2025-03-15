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

export interface Friendship {
  id: string;
  requesterId: string;
  requesteeId: string;
  status: RelationshipStatus;
}

export enum RelationshipStatus {
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  FRIENDS = 'FRIENDS',
  FST_BLOCKED_SND = 'FST_BLOCKED_SND',
  SND_BLOCKED_FST = 'SND_BLOCKED_FST',
  MUTUAL_BLOCK = 'MUTUALLY_BLOCKED',
}

export enum RelationshipAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  CANCEL = 'CANCEL',
  UNFRIEND = 'UNFRIEND',
  BLOCK = 'BLOCK',
  UNBLOCK = 'UNBLOCK',
}
