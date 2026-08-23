import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {UtilsService} from '../../services/utils.service';
import {PopupTemplateStateService} from '../modals/popup-template/popup-template-state.service';
import {QRCodeComponent} from './qr-code.component';

describe('QRCodeComponent', () => {
  it('navigates to the route contained in a same-origin absolute URL', fakeAsync(() => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    const popup = jasmine.createSpyObj<PopupTemplateStateService>('PopupTemplateStateService', [
      'closeImmediately',
    ]);

    TestBed.configureTestingModule({
      providers: [
        {provide: Router, useValue: router},
        {provide: UtilsService, useValue: {}},
        {provide: PopupTemplateStateService, useValue: popup},
        {provide: TuiNotificationService, useValue: {}},
      ],
    });

    const component = TestBed.runInInjectionContext(() => new QRCodeComponent());
    component.linkToEncode = `${window.location.origin}/users/alice?from=qr#profile`;

    (component as unknown as {redirect(): void}).redirect();
    tick();

    expect(popup.closeImmediately.calls.count()).toBe(1);
    expect(router.navigateByUrl.calls.allArgs()).toEqual([['/users/alice?from=qr#profile']]);
  }));
});
