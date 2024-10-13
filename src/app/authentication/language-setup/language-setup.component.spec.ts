import {ComponentFixture, TestBed} from '@angular/core/testing';

import {LanguageSetupComponent} from './language-setup.component';

describe('LanguageSelectionComponent', () => {
  let component: LanguageSetupComponent;
  let fixture: ComponentFixture<LanguageSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageSetupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LanguageSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
