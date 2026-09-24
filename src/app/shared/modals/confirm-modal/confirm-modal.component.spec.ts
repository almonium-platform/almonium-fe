import {SimpleChange} from '@angular/core';
import {ConfirmModalComponent} from './confirm-modal.component';

describe('ConfirmModalComponent', () => {
  it('requires the configured confirmation word, case-sensitive but ignoring surrounding spaces', () => {
    const component = new ConfirmModalComponent();
    component.confirmationWord = 'olena_k';

    component.ngOnChanges({
      isVisible: new SimpleChange(false, true, false),
    });

    expect(component.isButtonDisabled).toBeTrue();

    component.confirmationValue = 'Olena_K';
    expect(component.isButtonDisabled).toBeTrue();

    component.confirmationValue = ' olena_k ';
    expect(component.isButtonDisabled).toBeFalse();
  });

  it('keeps the countdown and confirmation requirements independent', () => {
    const component = new ConfirmModalComponent();
    component.confirmationWord = 'DELETE';
    component.confirmationValue = 'DELETE';
    component.countdownDisabled = true;

    expect(component.isButtonDisabled).toBeTrue();

    component.countdownDisabled = false;
    expect(component.isButtonDisabled).toBeFalse();
  });
});
