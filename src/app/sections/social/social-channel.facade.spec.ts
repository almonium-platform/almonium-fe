import {TestBed} from '@angular/core/testing';
import {Channel} from 'stream-chat';
import {ChannelService, ChatClientService} from 'stream-chat-angular';
import {AppConstants} from '../../app.constants';
import {PrivateChatService} from '../../services/private-chat.service';
import {SocialChannelFacade} from './social-channel.facade';

describe('SocialChannelFacade', () => {
  let facade: SocialChannelFacade;

  const channel = (type: string, data: Record<string, unknown>, members: {id: string; name?: string}[]) =>
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
        {provide: PrivateChatService, useValue: {}},
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

  it('keeps the stored name of every other channel', () => {
    const broadcast = channel('broadcast', {name: 'Almonium — Deutsch'}, []);

    expect(facade.name(broadcast, 'fallback')).toBe('Almonium — Deutsch');
  });
});
