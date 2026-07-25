import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-gif-player',
  template: `
    <video
      #vid
      class="logo"
      playsinline
      muted
      preload="auto"
      [autoplay]="playOnLoad"
      [loop]="looped"
    >
      <source src="assets/gif/folding.webm" type="video/webm" />
    </video>
  `,
})
export class GifPlayerComponent implements OnInit, OnDestroy {
  @Input() replayTrigger?: Subject<void>;
  @Input() looped = false;        // one asset; loop is controlled here
  @Input() playOnLoad = true;

  @ViewChild('vid', { static: true }) vid!: ElementRef<HTMLVideoElement>;
  private sub?: Subscription;
  private readonly endedListener = () => {
    if (!this.looped) this.freezeLastFrame();
  };
  private readonly loadedMetadataListener = () => {
    this.vid.nativeElement.play().catch(() => undefined);
  };

  ngOnInit() {
    // freeze on last frame when not looped
    this.vid.nativeElement.addEventListener('ended', this.endedListener);

    if (this.replayTrigger) {
      this.sub = this.replayTrigger.subscribe(() => this.replay());
    }

    // if autoplay + not looped and you want it to rest on last frame on first load
    if (this.playOnLoad && !this.looped) {
      this.vid.nativeElement.addEventListener('loadedmetadata', this.loadedMetadataListener);
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.vid.nativeElement.removeEventListener('ended', this.endedListener);
    this.vid.nativeElement.removeEventListener('loadedmetadata', this.loadedMetadataListener);
  }

  replay() {
    const v = this.vid.nativeElement;
    v.pause();
    // if previously frozen at end, jump to start
    v.currentTime = 0;
    v.play().catch(() => undefined);
  }

  private freezeLastFrame() {
    const v = this.vid.nativeElement;
    // pause just before the end so the last frame stays visible
    // (HTMLVideo shows poster/first frame after 'ended')
    const t = Math.max(0, v.duration - 0.05);
    v.currentTime = t;
    v.pause();
  }
}
