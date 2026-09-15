import {sharedItemsFirst} from './user-preview-card-display';
import {UserPreviewCardComponent} from './user-preview-card.component';

describe('user preview card display', () => {
  it('compiles the redesigned standalone card', () => {
    expect(UserPreviewCardComponent).toBeDefined();
  });

  it('puts shared values first while preserving the order within both groups', () => {
    const values = ['Environment', 'Languages', 'Science', 'Travel'];

    expect(sharedItemsFirst(values, value => value === 'Languages' || value === 'Travel'))
      .toEqual(['Languages', 'Travel', 'Environment', 'Science']);
  });

  it('does not mutate the API response array', () => {
    const values = ['Spanish', 'German'];

    sharedItemsFirst(values, value => value === 'German');

    expect(values).toEqual(['Spanish', 'German']);
  });
});
