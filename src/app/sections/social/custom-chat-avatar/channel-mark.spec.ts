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

  it('gives a language channel its code on a crest of its own, and no emblem', () => {
    expect(channelMark(channel(AppConstants.BROADCAST_CHAT_TYPE, 'almonium-de')))
      .toEqual({kind: 'crest', code: 'DE', fill: 'var(--channel-crest-de)'});
  });

  it('generates a crest for a language the design has not placed yet', () => {
    const mark = channelMark(channel(AppConstants.BROADCAST_CHAT_TYPE, 'almonium-pl'));

    expect(mark?.kind).toBe('crest');
    expect((mark as {code: string}).code).toBe('PL');
    expect((mark as {fill: string}).fill).toMatch(/^oklch\(var\(--channel-crest-lightness\) 0\.1 \d{1,3}\)$/);
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
