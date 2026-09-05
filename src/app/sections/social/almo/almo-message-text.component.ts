import {ChangeDetectionStrategy, Component, Input, OnChanges, signal} from '@angular/core';
import {StreamChatModule, StreamMessage} from 'stream-chat-angular';
import {AlmoMessageMarks, almoMarksOf} from './almo-chat.model';
import {isAlmoCid} from './almo-channel';
import {AlmoSegment, segmentAlmoText} from './almo-text-segments';

/**
 * 11: the text of a bubble, in Almo's channel only. Everywhere else it is Stream's own text.
 *
 * Two marks and one gesture. A dotted underline is a word from this learner's queue, on his lines
 * and theirs alike; plum medium weight is a confusion pair he names in one plain sentence. Holding
 * a bubble swaps its text for the translation while held and puts it back on release: no label,
 * no toggle, the same gesture family as the parallel reader.
 */
@Component({
  selector: 'app-almo-message-text',
  standalone: true,
  imports: [StreamChatModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (marks; as marks) {
      <p class="str-chat__message-text-value almo-text"
         data-testid="text"
         [class.held]="held()"
         [class.holdable]="!!marks.translation"
         (pointerdown)="hold($event)"
         (pointerup)="release()"
         (pointercancel)="release()"
         (pointerleave)="release()"
         (contextmenu)="suppressWhileHolding($event)">
        @if (held() && marks.translation; as translation) {
          {{ translation }}
        } @else {
          @for (segment of segments; track $index) {
            @switch (segment.kind) {
              @case ('word') { <span class="almo-word">{{ segment.text }}</span> }
              @case ('contrast') { <span class="almo-contrast">{{ segment.text }}</span> }
              @default { {{ segment.text }} }
            }
          }
        }
      </p>
    } @else {
      <stream-message-text [message]="message" [isQuoted]="isQuoted" [shouldTranslate]="shouldTranslate"></stream-message-text>
    }
  `,
  styles: [`
    .almo-text.holdable {
      -webkit-touch-callout: none;
      user-select: none;
    }
  `],
})
export class AlmoMessageTextComponent implements OnChanges {
  /** How long a press has to last before it is a hold rather than a tap. */
  static readonly HOLD_MS = 350;

  @Input() message: StreamMessage | undefined | StreamMessage['quoted_message'];
  @Input() isQuoted = false;
  @Input() shouldTranslate = false;

  protected marks: AlmoMessageMarks | null = null;
  protected segments: AlmoSegment[] = [];
  protected readonly held = signal(false);
  private holdTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(): void {
    const message = this.message;
    const text = message?.text ?? '';
    // A quote is somebody else's rendering of the line; the marks belong to the bubble itself.
    if (!message || this.isQuoted || !text || !isAlmoCid(message.cid)) {
      this.marks = null;
      this.segments = [];
      return;
    }
    this.marks = almoMarksOf(message) ?? {words: [], contrast: [], translation: null};
    this.segments = segmentAlmoText(text, this.marks.words, this.marks.contrast);
  }

  protected hold(event: PointerEvent): void {
    if (!this.marks?.translation || event.button !== 0) return;
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => this.held.set(true), AlmoMessageTextComponent.HOLD_MS);
  }

  protected release(): void {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    this.held.set(false);
  }

  /** A long press on a phone also asks for the context menu; while it is a hold, it is not. */
  protected suppressWhileHolding(event: Event): void {
    if (this.held() || this.holdTimer) event.preventDefault();
  }
}
