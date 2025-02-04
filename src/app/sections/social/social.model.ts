export interface UserPublicProfile {
  id: number;
  username: string;
  status: FriendStatus;
  avatarUrl: string;
}

export interface RelatedUserPublicProfile {
  id: number;
  username: string;
  status: FriendStatus;
  avatarUrl: string;
  friendshipId: number;
}

export interface Friend {
  id: number;
  username: string;
  avatarUrl: string;
  friendshipId: number;
}

export interface Friendship {
  id: number;
  requesterId: number;
  requesteeId: number;
  status: FriendshipStatus;
}

export interface FriendshipToUserProjection {
  userId: number;
  isRequester: boolean;
  status: FriendshipStatus;
}

export enum FriendshipStatus {
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  FRIENDS = 'FRIENDS',
  FST_BLOCKED_SND = 'FST_BLOCKED_SND',
  SND_BLOCKED_FST = 'SND_BLOCKED_FST',
  MUTUALLY_BLOCKED = 'MUTUALLY_BLOCKED',
}

export enum FriendStatus {
  FRIENDS = 'FRIENDS',
  BLOCKED = 'BLOCKED',
  ASKED_THEM = 'ASKED_THEM',
  ASKED_ME = 'ASKED_ME',
}

export enum FriendshipAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  CANCEL = 'CANCEL',
  UNFRIEND = 'UNFRIEND',
  BLOCK = 'BLOCK',
  UNBLOCK = 'UNBLOCK',
}
