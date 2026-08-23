import {ApiContractError} from '../runtime-validation';
import {parseUserProfileInfo} from './user-profile.model';

describe('user profile API validation', () => {
  const profile = {
    id: 'user-1', username: 'Ada', avatarUrl: 'avatar.png', registeredAt: '2026-01-01T00:00:00Z',
    premium: false, hidden: false, interests: ['Languages'], loginStreak: 3, fluentLangs: ['EN'],
    targetLangs: [{language: 'FR', cefrLevel: 'A2'}], relationshipId: null,
    relationshipStatus: 'STRANGER', acceptsRequests: true,
  };

  it('parses the backend profile contract', () => {
    expect(parseUserProfileInfo(profile)).toEqual(jasmine.objectContaining({
      username: 'Ada',
      isPremium: false,
    }));
  });

  it('parses the base profile returned after hiding relationship details', () => {
    const baseProfile = {
      id: 'user-1', username: 'Ada', avatarUrl: null, registeredAt: '2026-01-01T00:00:00Z',
      premium: true, hidden: true, relationshipId: null, relationshipStatus: 'STRANGER',
      acceptsRequests: true,
    };

    expect(parseUserProfileInfo(baseProfile)).toEqual(jasmine.objectContaining({
      avatarUrl: null,
      isPremium: true,
      interests: [],
      loginStreak: 0,
      fluentLangs: [],
      targetLangs: [],
    }));
  });

  it('rejects an invalid profile relationship state', () => {
    expect(() => parseUserProfileInfo({...profile, relationshipStatus: 'UNKNOWN'}))
      .toThrowError(ApiContractError);
  });
});
