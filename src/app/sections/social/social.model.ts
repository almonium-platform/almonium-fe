export interface UserPublicProfile {
  id: string;
  username: string;
  status: FriendStatus;
  avatarUrl: string;
}

export interface RelatedUserProfile {
  id: string;
  username: string;
  avatarUrl: string;
  friendshipId: string;
  friendshipStatus: FriendshipStatus;
}

export interface Friend {
  id: string;
  username: string;
  avatarUrl: string;
  friendshipId: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  requesteeId: string;
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
