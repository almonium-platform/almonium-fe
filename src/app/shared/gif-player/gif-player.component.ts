import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {Subject} from 'rxjs';

@Component({
  selector: 'app-gif-player',
  template: `
    <img
      #gifElement
      [src]="src"
      [alt]="alt"
      class="logo"
      (click)="replayGif()"
    />
  `,
})
export class GifPlayerComponent implements OnInit {
  @Input() src!: string; // Source of the GIF
  @Input() alt: string = 'GIF'; // Alt text for the GIF
  @Input() replayTrigger!: Subject<void>; // Observable to trigger replay

  @ViewChild('gifElement') gifElement!: ElementRef<HTMLImageElement>;

  ngOnInit(): void {
    if (this.replayTrigger) {
      this.replayTrigger.subscribe(() => {
        this.replayGif();
      });
    }
  }

  replayGif(): void {
    const gif = this.gifElement?.nativeElement;
    if (gif) {
      const src = gif.src;
      gif.src = ''; // Temporarily clear the src
      setTimeout(() => {
        gif.src = src; // Reset the src to replay the GIF
      });
    }
  }
}
