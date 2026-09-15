import {Channel} from 'stream-chat';
import {AppConstants} from '../../../app.constants';
import {channelMark} from './channel-mark';

function channel(type: string, id: string): Channel {
  return {type, id} as Channel;
}

describe('channel mark', () => {
  it('gives the app-wide channel the emblem', () => {
    expect(channelMark(channel(AppConstants.BROADCAST_CHAT_TYPE, 'almonium'))).toEqual({kind: 'emblem'});
  });

  it('reads the language off the suffix, whichever language it is', () => {
    for (const code of ['de', 'en', 'es', 'fr', 'it', 'pl', 'ukr']) {
      expect(channelMark(channel(AppConstants.BROADCAST_CHAT_TYPE, `almonium-${code}`)))
        .toEqual({kind: 'crest', code: code.toUpperCase()});
    }
  });

  it('leaves people and Saved Messages to the plate and the hashed hue', () => {
    expect(channelMark(channel(AppConstants.PRIVATE_CHAT_TYPE, 'private-abc'))).toBeNull();
    expect(channelMark(channel(AppConstants.SELF_CHAT_TYPE, 'self-abc'))).toBeNull();
    expect(channelMark(undefined)).toBeNull();
  });

  it('ignores a broadcast id that is not the brand channel or a language of it', () => {
    expect(channelMark(channel(AppConstants.BROADCAST_CHAT_TYPE, 'almonium-book-club'))).toBeNull();
    expect(channelMark(channel(AppConstants.BROADCAST_CHAT_TYPE, 'announcements'))).toBeNull();
  });
});
