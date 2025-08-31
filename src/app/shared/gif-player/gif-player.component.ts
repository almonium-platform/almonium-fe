import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subject, Subscription} from 'rxjs';


@Component({
  selector: 'app-gif-player',
  template: `
    @if (visible) {
      <img
        #gifElement
        [src]="currentSrc"
        alt="logo"
        class="logo"
      />
    }
  `,
})
export class GifPlayerComponent implements OnInit, OnDestroy {
  private foldingOnce = 'assets/gif/folding-once.gif';
  private foldingLooped = 'assets/gif/folding-looped.gif';

  @Input() replayTrigger?: Subject<void>;
  @Input() looped = false;
  @Input() playOnLoad = true;

  @ViewChild('gifElement') gifElement!: ElementRef<HTMLImageElement>;
  visible = true;
  private subscription?: Subscription;

  // This is what the template binds to (Angular controls it, not direct DOM writes)
  currentSrc = '';

  ngOnInit(): void {
    // Initialize src
    this.currentSrc = this.playOnLoad ? this.withBust(this.gifSrc) : this.gifSrc;

    if (this.replayTrigger) {
      this.subscription = this.replayTrigger.subscribe(() => this.replayGif());
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  // Drive reload by changing the bound property
  replayGif(): void {
    this.currentSrc = this.withBust(this.gifSrc);
  }

  get gifSrc(): string {
    return this.looped ? this.foldingLooped : this.foldingOnce;
  }

  private withBust(src: string) {
    const base = src.split('?')[0];
    return `${base}?t=${Date.now()}`;
  }
}
