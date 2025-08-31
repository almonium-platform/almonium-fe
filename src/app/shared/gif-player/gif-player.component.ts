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
        loading="eager"
        decoding="sync"
        fetchpriority="high"
      />
    }
  `,
  styles: `
    /* Keep the GIF on its own layer */
    .logo {
      will-change: transform; /* hint compositing */
      transform: translateZ(0); /* force layer in Chrome */
      backface-visibility: hidden; /* avoid repaint quirks */
      contain: paint; /* isolate painting */
    }
  `
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
  private lastReplayAt = 0;

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

  replayGif(): void {
    const now = Date.now();
    if (now - this.lastReplayAt < 900) {  // ignore follow-ups within ~1s
      return;
    }
    this.lastReplayAt = now;
    this.currentSrc = this.withBust(this.gifSrc);
    console.debug('[gif] replay', this.currentSrc);
  }

  get gifSrc(): string {
    return this.looped ? this.foldingLooped : this.foldingOnce;
  }

  private withBust(src: string) {
    const base = src.split('?')[0];
    return `${base}?t=${Date.now()}`;
  }
}
