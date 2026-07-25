import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl} from '@angular/forms';
import {CEFRLevel} from '../../models/userinfo.model';
import {CefrLevelSelectorComponent} from './cefr-level-selector.component';

describe('CefrLevelSelectorComponent', () => {
  let fixture: ComponentFixture<CefrLevelSelectorComponent>;
  let control: FormControl<CEFRLevel | null>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CefrLevelSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CefrLevelSelectorComponent);
    control = new FormControl<CEFRLevel | null>(null);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
  });

  it('renders every CEFR level and updates the form control', () => {
    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector<HTMLSelectElement>('select')!;

    expect(select.options.length).toBe(Object.values(CEFRLevel).length + 1);

    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(control.value).toBe(CEFRLevel.A1);
  });
});
