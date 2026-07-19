import {SocialConfirmationService} from './social-confirmation.service';

describe('SocialConfirmationService', () => {
  it('runs the pending action once and closes the confirmation', () => {
    const service = new SocialConfirmationService();
    const action = jasmine.createSpy('action');
    service.open({title: 'Delete', message: 'Sure?', confirmText: 'Delete', action});

    service.confirm();
    service.confirm();

    expect(action).toHaveBeenCalledTimes(1);
    expect(service.state()).toBeNull();
  });
});
