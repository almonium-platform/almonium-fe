import {ChangeDetectorRef, DestroyRef, Directive, ElementRef, effect, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ChannelService, MessageInputComponent} from 'stream-chat-angular';
import {STREAM_CHAT_TRANSLATIONS} from '../i18n';
import {AlmoChatCoordinator} from './almo-chat.coordinator';

/**
 * 11: the composer in Almo's channel. Its placeholder is in the target language - "Schreib auf
 * Deutsch" - and the opener chips above it only exist while it is empty, so this is where the
 * field reports whether it is. Everything else about the composer is the SDK's.
 */
@Directive({
  selector: 'stream-message-input[appAlmoComposer]',
  standalone: true,
})
export class AlmoComposerDirective {
  private readonly composer = inject(MessageInputComponent, {self: true});
  private readonly coordinator = inject(AlmoChatCoordinator);
  private readonly channelService = inject(ChannelService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private static readonly DEFAULT_PLACEHOLDER = STREAM_CHAT_TRANSLATIONS['Type your message'];

  constructor() {
    effect(() => {
      const chat = this.coordinator.activeChat();
      // The placeholder is copy from the server, and may not have arrived yet: empty means the default, not nothing.
      const placeholder = chat?.placeholder ?? '';
      this.composer.textareaPlaceholder = placeholder ? placeholder : AlmoComposerDirective.DEFAULT_PLACEHOLDER;
      this.cdRef.markForCheck();
    });

    const check = () => this.coordinator.composerEmpty.set(!(this.composer.textareaValue ?? '').trim());
    const element = this.host.nativeElement;
    element.addEventListener('input', check);
    this.destroyRef.onDestroy(() => element.removeEventListener('input', check));

    // A send empties the field without an input event, and so does switching threads.
    this.channelService.activeChannelMessages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => queueMicrotask(check));
    this.channelService.activeChannel$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => queueMicrotask(check));
  }
}
