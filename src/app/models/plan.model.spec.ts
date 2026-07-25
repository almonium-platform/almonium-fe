import {ApiContractError} from '../shared/runtime-validation';
import {parsePlans, parseSessionUrlResponse} from './plan.model';

describe('plan API validation', () => {
  it('parses the backend plan contract', () => {
    expect(parsePlans([{id: 1, name: 'Monthly', type: 'MONTHLY', description: 'Premium', price: 4.99}]))
      .toEqual([{id: 1, name: 'Monthly', type: 'MONTHLY', description: 'Premium', price: 4.99}]);
  });

  it('rejects an invalid checkout response before it reaches navigation', () => {
    expect(() => parseSessionUrlResponse({sessionUrl: 42})).toThrowError(ApiContractError);
  });
});
