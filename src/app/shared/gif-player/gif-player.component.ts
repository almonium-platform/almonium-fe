import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subject, Subscription} from 'rxjs';


@Component({
  selector: 'app-gif-player',
  template: `
    @if (visible) {
      <img
        #gifElement
        [src]="gifSrc"
        alt="logo"
        class="logo"
      />
    }
  `,
  imports: [],
})
export class GifPlayerComponent implements OnInit, OnDestroy {
  private foldingOnce: string = '../../../assets/gif/folding-once.gif';
  private foldingLooped: string = '../../../assets/gif/folding-looped.gif';
  @Input() replayTrigger?: Subject<void>;
  @Input() looped: boolean = false;
  @Input() playOnLoad: boolean = true;

  @ViewChild('gifElement') gifElement!: ElementRef<HTMLImageElement>;
  visible: boolean = true;
  private subscription?: Subscription;

  ngOnInit(): void {
    if (this.replayTrigger) {
      this.subscription = this.replayTrigger.subscribe(() => {
        this.replayGif();
      });
    }

    // rn it plays anyway
    if (this.playOnLoad) {
      this.replayGif();
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  replayGif(): void {
    const gif = this.gifElement?.nativeElement;
    if (gif) {
      const originalSrc = this.gifSrc.split('?')[0]; // Strip any existing query parameters
      const timestamp = new Date().getTime();
      gif.src = `${originalSrc}?t=${timestamp}`; // Append the timestamp to force reload
    }
  }

  get gifSrc(): string {
    return this.looped ? this.foldingLooped : this.foldingOnce;
  }
}
