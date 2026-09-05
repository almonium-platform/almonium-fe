import {TestBed} from '@angular/core/testing';
import {Channel} from 'stream-chat';
import {ChannelService, ChatClientService} from 'stream-chat-angular';
import {AppConstants} from '../../app.constants';
import {PrivateChatService} from '../../services/private-chat.service';
import {SocialChannelFacade} from './social-channel.facade';

describe('SocialChannelFacade', () => {
  let facade: SocialChannelFacade;

  const channel = (
    type: string,
    data: Record<string, unknown>,
    members: {id: string; name?: string; premium?: boolean; deleted_at?: string; deactivated_at?: string}[],
  ) =>
    ({
      type,
      data,
      state: {
        members: Object.fromEntries(members.map(member => [member.id, {user_id: member.id, user: member}])),
      },
    }) as unknown as Channel;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SocialChannelFacade,
        {provide: ChatClientService, useValue: {chatClient: {userID: 'me'}}},
        {provide: ChannelService, useValue: {}},
        // The real one: it owns the private channel's id shape, which is what is under test below.
        PrivateChatService,
      ],
    });
    facade = TestBed.inject(SocialChannelFacade);
  });

  it('identifies a private chat by its channel type, not its name', () => {
    expect(facade.isPrivate(channel(AppConstants.PRIVATE_CHAT_TYPE, {}, []))).toBeTrue();
    expect(facade.isPrivate(channel('broadcast', {name: 'Private Chat'}, []))).toBeFalse();
  });

  it('names a private chat after the other member', () => {
    const dm = channel(AppConstants.PRIVATE_CHAT_TYPE, {}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada'},
    ]);

    expect(facade.name(dm, 'fallback')).toBe('Ada');
  });

  it('never shows the placeholder that older private channels were created with', () => {
    const legacy = channel(AppConstants.PRIVATE_CHAT_TYPE, {name: 'Private Chat'}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada'},
    ]);

    expect(facade.name(legacy, 'fallback')).toBe('Ada');
  });

  it('reads membership off the other member, not off a friends list', () => {
    const dm = channel(AppConstants.PRIVATE_CHAT_TYPE, {}, [
      {id: 'me', name: 'Me', premium: true},
      {id: 'them', name: 'Ada', premium: true},
    ]);

    expect(facade.isInterlocutorPremium(dm)).toBeTrue();
    expect(facade.isInterlocutorPremium(channel(AppConstants.PRIVATE_CHAT_TYPE, {}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada'},
    ]))).toBeFalse();
  });

  it('never rings a channel, whoever its members are', () => {
    const broadcast = channel('broadcast', {name: 'Almonium'}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada', premium: true},
    ]);

    expect(facade.isInterlocutorPremium(broadcast)).toBeFalse();
  });

  it('rings nothing when Stream hands the avatar template no channel at all', () => {
    // A message sender, a header or a typing indicator arrives with channel undefined, and the
    // binding is read on every change detection.
    expect(facade.isInterlocutorPremium(undefined)).toBeFalse();
  });

  it('names a thread after the absence once its other member is deleted', () => {
    const dm = channel(AppConstants.PRIVATE_CHAT_TYPE, {}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada', deleted_at: '2026-03-04T10:00:00Z'},
    ]);

    expect(facade.isInterlocutorDeleted(dm)).toBeTrue();
    expect(facade.name(dm, 'fallback')).toBe('Deleted account');
  });

  it('treats a deactivated member the same as a deleted one', () => {
    // Deactivation is reversible and deletion is not, but neither thread can be written to.
    const dm = channel(AppConstants.PRIVATE_CHAT_TYPE, {}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada', deactivated_at: '2026-03-04T10:00:00Z'},
    ]);

    expect(facade.isInterlocutorDeleted(dm)).toBeTrue();
  });

  it('leaves a live thread and every channel alone', () => {
    expect(facade.isInterlocutorDeleted(channel(AppConstants.PRIVATE_CHAT_TYPE, {}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada'},
    ]))).toBeFalse();
    expect(facade.isInterlocutorDeleted(channel('broadcast', {name: 'Almonium'}, [
      {id: 'me', name: 'Me'},
    ]))).toBeFalse();
  });

  it('never rings an account that is gone, whatever it was paying when it left', () => {
    const dm = channel(AppConstants.PRIVATE_CHAT_TYPE, {}, [
      {id: 'me', name: 'Me'},
      {id: 'them', name: 'Ada', premium: true, deleted_at: '2026-03-04T10:00:00Z'},
    ]);

    expect(facade.isInterlocutorPremium(dm)).toBeFalse();
  });

  it('reads a private channel back to the friendship it belongs to', () => {
    const dm = {...channel(AppConstants.PRIVATE_CHAT_TYPE, {}, []), id: 'private_f-123'} as Channel;

    expect(facade.friendshipIdOf(dm)).toBe('f-123');
    expect(facade.friendshipCid('f-123')).toBe(`${AppConstants.PRIVATE_CHAT_TYPE}:private_f-123`);
  });

  it('has no friendship to name for a channel that is not a private chat', () => {
    const broadcast = {...channel('broadcast', {name: 'Almonium'}, []), id: 'almonium'} as Channel;

    expect(facade.friendshipIdOf(broadcast)).toBeNull();
  });

  it('keeps the stored name of every other channel', () => {
    const broadcast = channel('broadcast', {name: 'Almonium — Deutsch'}, []);

    expect(facade.name(broadcast, 'fallback')).toBe('Almonium — Deutsch');
  });
});
