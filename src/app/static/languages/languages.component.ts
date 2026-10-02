import {Component, OnDestroy, OnInit, computed, inject, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {PublicFooterComponent} from '../../shared/public-footer/public-footer.component';
import {PageSeoService} from '../../shared/seo/page-seo.service';
import {LanguageNameService} from '../../services/language-name.service';
import {
  CapabilityStatus,
  IpaMatch,
  LANGUAGE_CAPABILITIES,
  LANGUAGE_CAPABILITIES_UPDATED,
  LanguageCapability,
} from './language-capabilities';

type SortKey = 'speakers' | 'name';

interface LanguageRow extends LanguageCapability {
  name: string;
  speakers: string;
}

/**
 * The public capability table: one row per language the app lists, saying what works there today,
 * what has been built and tested but is not switched on, and what is only planned. It names the
 * speech engines, because a learner choosing a language is entitled to know whose voice they will
 * hear and whether it says what the transcription shows.
 */
@Component({
  selector: 'app-languages',
  imports: [DatePipe, PublicFooterComponent],
  templateUrl: './languages.component.html',
  styleUrl: './languages.component.less',
})
export class LanguagesComponent implements OnInit, OnDestroy {
  private readonly seo = inject(PageSeoService);
  private readonly languageNames = inject(LanguageNameService);

  protected readonly updated = LANGUAGE_CAPABILITIES_UPDATED;
  protected readonly sortKey = signal<SortKey>('speakers');
  protected readonly withVoiceOnly = signal(false);

  private readonly all: LanguageRow[] = LANGUAGE_CAPABILITIES.map(row => ({
    ...row,
    name: this.languageNames.getLanguageName(row.code),
    speakers: this.speakersLabel(row.nativeSpeakersMillions),
  }));

  protected readonly rows = computed(() => {
    const rows = this.withVoiceOnly() ? this.all.filter(row => row.voice.status !== 'none') : [...this.all];
    return this.sortKey() === 'name'
      ? rows.sort((a, b) => a.name.localeCompare(b.name))
      : rows.sort((a, b) => b.nativeSpeakersMillions - a.nativeSpeakersMillions || a.name.localeCompare(b.name));
  });

  protected readonly total = this.all.length;
  protected readonly withVoice = this.all.filter(row => row.voice.status !== 'none').length;
  protected readonly followingIpa = this.all.filter(row => ['stress', 'sounds', 'no-stress'].includes(row.ipaMatch)).length;

  protected readonly statusLabels: Record<CapabilityStatus, string> = {
    live: $localize`Live`,
    ready: $localize`Tested`,
    planned: $localize`Planned`,
    none: '—',
  };

  protected readonly ipaLabels: Record<IpaMatch, string> = {
    stress: $localize`Sounds and stress`,
    sounds: $localize`Sounds`,
    'no-stress': $localize`Sounds; the language has no word stress`,
    'not-followed': $localize`Reads the spelling only`,
    untested: '—',
  };

  ngOnInit(): void {
    this.seo.describe({
      title: $localize`Languages · Almonium`,
      description: $localize`What Almonium can do in each of its ${this.total}:count: languages: which voice speaks it, whether the audio follows the written pronunciation, and what the dictionary knows.`,
      path: '/languages',
    });
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }

  protected sortBy(key: SortKey): void {
    this.sortKey.set(key);
  }

  protected toggleVoiceOnly(checked: boolean): void {
    this.withVoiceOnly.set(checked);
  }

  /** Millions down to one decimal, thousands below a million, and a plain word where there are none. */
  private speakersLabel(millions: number): string {
    if (millions === 0) return $localize`none`;
    if (millions >= 10) return $localize`${Math.round(millions)}:count: million`;
    if (millions >= 1) return $localize`${millions.toFixed(1).replace(/\.0$/, '')}:count: million`;
    return $localize`${Math.round(millions * 1000)}:count: thousand`;
  }
}
