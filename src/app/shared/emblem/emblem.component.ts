import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, OnInit, inject} from '@angular/core';
import {Subject, Subscription} from 'rxjs';
import {isReducedMotion} from '../../services/motion-preference';

export type EmblemMotion = 'unfold' | 'fold';

/* The ten blades of logo.svg, animated in place. Unfold is one becoming many
   (loading, discovering); fold is many becoming one (saving). Timing follows
   the Constitution: four blades within 250ms, the rest bloom over the remainder,
   then hold. The blade delays live in the template; these totals must match. */
const UNFOLD_MS = 980;
const FOLD_MS = 940;
const HOLD_MS = 900;

@Component({
  selector: 'app-emblem',
  templateUrl: './emblem.component.html',
  styleUrl: './emblem.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmblemComponent implements OnInit, OnDestroy {
  @Input() motion: EmblemMotion = 'unfold';
  @Input() looped = false;
  @Input() playOnLoad = true;
  @Input() replayTrigger?: Subject<void>;
  @Input() label = '';
  @Input() mono = false;
  @Input() set size(value: string | undefined) {
    const host = this.host.nativeElement;
    host.style.width = value ?? '';
    host.style.height = value ?? '';
  }

  protected playing = false;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly reducedMotion = isReducedMotion();
  private sub?: Subscription;
  private loopTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.sub = this.replayTrigger?.subscribe(() => this.replay());
    if (this.playOnLoad) this.replay();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.loopTimer);
  }

  replay(): void {
    if (this.reducedMotion) return;
    clearTimeout(this.loopTimer);
    if (this.playing) {
      // Restart from the first frame: drop the class, flush, put it back.
      this.playing = false;
      this.cdr.detectChanges();
      void this.host.nativeElement.offsetWidth;
    }
    this.playing = true;
    this.cdr.detectChanges();
    if (this.looped) {
      const run = (this.motion === 'fold' ? FOLD_MS : UNFOLD_MS) + HOLD_MS;
      this.loopTimer = setTimeout(() => this.replay(), run);
    }
  }
}
