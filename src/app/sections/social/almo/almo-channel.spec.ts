import {Channel} from 'stream-chat';
import {AppConstants} from '../../../app.constants';
import {almoLanguageOf, isAlmoChannel, isAlmoCid, isAlmoUser} from './almo-channel';

describe('almo channel', () => {
  const channel = (type: string, id: string) => ({type, id, cid: `${type}:${id}`}) as unknown as Channel;

  it('knows his channel by the id the server mints, not by its name', () => {
    expect(isAlmoChannel(channel(AppConstants.PRIVATE_CHAT_TYPE, 'almo_5f1e_de'))).toBeTrue();
    expect(isAlmoChannel(channel(AppConstants.PRIVATE_CHAT_TYPE, 'private_5f1e'))).toBeFalse();
    // A broadcast room could be called anything; the id shape belongs to the private type alone.
    expect(isAlmoChannel(channel(AppConstants.BROADCAST_CHAT_TYPE, 'almo_5f1e_de'))).toBeFalse();
    expect(isAlmoChannel(undefined)).toBeFalse();
  });

  it('reads the same shape off a cid', () => {
    expect(isAlmoCid('private:almo_5f1e_de')).toBeTrue();
    expect(isAlmoCid('private:private_5f1e')).toBeFalse();
    expect(isAlmoCid(undefined)).toBeFalse();
  });

  it('knows the language a conversation is from the tail of the id', () => {
    expect(almoLanguageOf('almo_0b8e2e7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b_de')).toBe('DE');
    expect(almoLanguageOf('private:almo_0b8e_fr')).toBe('FR');
    expect(almoLanguageOf('private_0b8e')).toBeNull();
    expect(almoLanguageOf(undefined)).toBeNull();
  });

  it('knows him as a message sender', () => {
    expect(isAlmoUser({id: 'almo'})).toBeTrue();
    expect(isAlmoUser({id: 'ada'})).toBeFalse();
    expect(isAlmoUser(undefined)).toBeFalse();
  });
});
