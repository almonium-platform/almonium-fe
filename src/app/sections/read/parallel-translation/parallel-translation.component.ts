import {Component, Input} from '@angular/core';
import {TuiHintDirective} from "@taiga-ui/core/portals";
import {TuiSkeleton} from "@taiga-ui/kit/directives";
import {SharedLucideIconsModule} from '../../../shared/shared-lucide-icons.module';

/**
 * The bar's companion button (L6): a filled plum circle carrying the companion's code while one
 * is open, an outlined circle with the book icon when none is.
 */
@Component({
  selector: 'app-parallel-translation',
  templateUrl: './parallel-translation.component.html',
  imports: [
    TuiHintDirective,
    TuiSkeleton,
    SharedLucideIconsModule,
  ],
  styleUrls: ['./parallel-translation.component.less']
})
export class ParallelTranslationComponent {
  @Input() inactive = false;
  @Input() showHint = true;
  @Input() loading = false;
  /** The open companion's language code, or null while reading one edition alone. */
  @Input() code: string | null = null;
  @Input() expanded = false;

  protected readonly openLabel = $localize`Companion and reading mode`;
  protected readonly closedLabel = $localize`Read with a companion edition`;
}
