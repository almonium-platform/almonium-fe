import {logger} from '../../../shared/logger';
import {getErrorMessage} from '../../../shared/http-error';
import {Component, DestroyRef, EventEmitter, inject, Input, Output, TemplateRef, ViewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {QRCodeComponent} from '../../../shared/qr-code/qr-code.component';
import {SharedLucideIconsModule} from '../../../shared/shared-lucide-icons.module';
import {SharedLinkService} from '../shared-link.service';
import {Deck} from '../shared-link.model';

/**
 * The owner's sheet: the only way a deck link comes into existence. Visibility is a labelled switch that reads its
 * own state, never a button reading "Turn off"; flipping it needs no confirmation because it is reversible and the
 * same switch turns it back on. The sheet says that the handle and avatar travel with the link, at the moment the
 * decision is made.
 */
@Component({
  selector: 'app-deck-share-sheet',
  templateUrl: './deck-share-sheet.component.html',
  styleUrls: ['./deck-share-sheet.component.less'],
  imports: [QRCodeComponent, SharedLucideIconsModule],
})
export class DeckShareSheetComponent {
  private sharedLinkService = inject(SharedLinkService);
  private alertService = inject(TuiNotificationService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('sheet', {static: true}) content!: TemplateRef<unknown>;
  @Input({required: true}) deck!: Deck;
  @Output() changed = new EventEmitter<Deck>();

  protected copied = false;
  protected showQr = false;
  protected switching = false;

  get link(): string {
    return this.sharedLinkService.deckLink(this.deck.shareId);
  }

  /** The link without its scheme, the way it is read aloud. */
  get displayLink(): string {
    return this.link.replace(/^https?:\/\//, '');
  }

  copy(): void {
    navigator.clipboard.writeText(this.link).then(
      () => {
        this.copied = true;
        setTimeout(() => this.copied = false, 1500);
      },
      (error: unknown) => logger.error('Failed to copy the deck link', error),
    );
  }

  toggleQr(): void {
    this.showQr = !this.showQr;
  }

  setShareEnabled(enabled: boolean): void {
    if (this.switching || enabled === this.deck.shareEnabled) return;
    this.switching = true;
    this.sharedLinkService.setShareEnabled(this.deck.id, enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: deck => {
          this.deck = deck;
          this.switching = false;
          this.changed.emit(deck);
        },
        error: (error: unknown) => {
          this.switching = false;
          this.alertService.open(getErrorMessage(error, 'The link could not be changed. Please try again.'), {appearance: 'negative'}).subscribe();
        },
      });
  }
}
