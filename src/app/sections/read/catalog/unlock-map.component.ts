import {ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit, inject} from '@angular/core';
import {geoNaturalEarth1, geoPath} from 'd3-geo';
import type {FeatureCollection} from 'geojson';
import {Subject, of} from 'rxjs';
import {catchError, takeUntil} from 'rxjs/operators';
import {logger} from '../../../shared/logger';
import {CountryUnlock, UnlockYearGroup, WorkUnlocks, groupUnlocksByYear} from './catalog.model';
import {CatalogService} from './catalog.service';
import {countryName} from './public-domain-day';
import {WorldAtlasService} from './world-atlas.service';

/** The map's drawing: 700 by 340 fits a Natural Earth projection with no wasted band. */
const WIDTH = 700;
const HEIGHT = 340;
/** How fast "play" walks through the years. */
export const PLAY_STEP_MS = 140;

/** One country as drawn: its outline and the rights row behind it, when the engine had one. */
interface DrawnCountry {
  alpha2: string | null;
  name: string;
  d: string;
  unlock: CountryUnlock | null;
}

/**
 * Where it's free (W7): a flat map of the world with a year slider. Drag the year or press play and countries turn
 * green as the work becomes free in each; the ones that unlock next are plum; hovering a country shows its date and
 * the rule behind it. A flat map beats a globe here because every country is visible at once and the story is time,
 * which the slider carries. Under 600px the same data stands as a list grouped by year.
 */
@Component({
  selector: 'app-unlock-map',
  templateUrl: './unlock-map.component.html',
  styleUrl: './unlock-map.component.less',
})
export class UnlockMapComponent implements OnInit, OnDestroy {
  private catalogService = inject(CatalogService);
  private atlas = inject(WorldAtlasService);
  private zone = inject(NgZone);
  private changes = inject(ChangeDetectorRef);
  @Input({required: true}) catalogWorkId!: string;
  protected data: WorkUnlocks | null = null;
  protected failed = false;
  protected countries: DrawnCountry[] = [];
  protected groups: UnlockYearGroup[] = [];
  /** Distinct years a country unlocks in, ascending: the slider's dots. */
  protected years: number[] = [];
  protected year = new Date().getFullYear();
  protected readonly nowYear = new Date().getFullYear();
  protected min = this.nowYear - 26;
  protected max = this.nowYear + 34;
  protected playing = false;
  protected tip: {name: string; line: string; rule: string | null; x: number; y: number} | null = null;
  protected home: {x: number; y: number} | null = null;
  private byAlpha2 = new Map<string, CountryUnlock>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.catalogService.unlocks(this.catalogWorkId).pipe(
      catchError(error => {
        logger.warn('The unlock map did not load.', error);
        this.failed = true;
        return of(null);
      }),
      takeUntil(this.destroy$),
    ).subscribe(data => {
      this.data = data;
      if (!data) return;
      this.byAlpha2 = new Map(data.countries.map(unlock => [unlock.country, unlock]));
      this.groups = groupUnlocksByYear(data.countries);
      this.years = [...new Set(data.countries.filter(u => u.status !== 'UNKNOWN' && u.year !== null).map(u => u.year!))].sort((a, b) => a - b);
      this.min = Math.min(this.min, ...this.years.map(y => Math.floor(y / 10) * 10));
      this.max = Math.max(this.max, ...this.years.map(y => Math.ceil(y / 10) * 10));
      this.draw();
    });
  }

  ngOnDestroy(): void {
    this.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private draw(): void {
    this.atlas.countries().then(shapes => {
      const collection: FeatureCollection = {
        type: 'FeatureCollection',
        features: shapes.map(shape => ({type: 'Feature', properties: {}, geometry: shape.geometry})),
      };
      const path = geoPath(geoNaturalEarth1().fitSize([WIDTH, HEIGHT], collection));
      this.countries = shapes.map(shape => ({
        alpha2: shape.alpha2,
        name: shape.name,
        d: path(shape.geometry) ?? '',
        unlock: shape.alpha2 ? this.byAlpha2.get(shape.alpha2) ?? null : null,
      }));
      const home = this.data && shapes.find(shape => shape.alpha2 === this.data?.readerCountry);
      if (home) {
        const [x, y] = path.centroid(home.geometry);
        this.home = {x, y};
      }
      this.changes.markForCheck();
    }).catch(error => {
      logger.warn('The world outlines did not load; the list stands in for the map.', error);
      this.failed = true;
      this.changes.markForCheck();
    });
  }

  protected get viewBox(): string {
    return `0 0 ${WIDTH} ${HEIGHT}`;
  }

  /** The year that unlocks next after the slider's year, for the plum highlight. */
  protected get nextYear(): number | null {
    return this.years.find(y => y > this.year) ?? null;
  }

  protected fill(country: DrawnCountry): string {
    const unlock = country.unlock;
    if (!unlock || unlock.status === 'UNKNOWN' || unlock.year === null) return 'var(--unlock-unchecked)';
    if (unlock.year <= this.year) return 'var(--unlock-free)';
    return unlock.year === this.nextYear ? 'var(--unlock-next)' : 'var(--unlock-protected)';
  }

  protected get summary(): string {
    if (!this.data) return '';
    const known = this.data.countries.filter(u => u.status !== 'UNKNOWN' && u.year !== null);
    const free = known.filter(u => (u.year!) <= this.year).length;
    const next = this.nextYear;
    const lead = this.year === this.nowYear ? $localize`Today it’s free to read in ${free}:count: countries.` : $localize`In ${this.year}:year: it’s free to read in ${free}:count: countries.`;
    if (next === null) return lead;
    const more = known.filter(u => u.year === next).length;
    const home = this.byAlpha2.get(this.data.readerCountry);
    const homeNext = home?.year === next ? $localize`, including ${countryName(this.data.readerCountry)}:country:` : '';
    return `${lead} ${$localize`On 1 January ${next}:year:, ${more}:count: more${homeNext}:home:.`}`;
  }

  protected get homeName(): string {
    return this.data ? countryName(this.data.readerCountry) : '';
  }

  protected name(code: string): string {
    return countryName(code);
  }

  protected setYear(value: number): void {
    this.stop();
    this.year = value;
  }

  protected onSlide(event: Event): void {
    this.setYear(Number((event.target as HTMLInputElement).value));
  }

  protected togglePlay(): void {
    if (this.playing) {
      this.stop();
      return;
    }
    if (this.year >= this.max) this.year = this.min;
    this.playing = true;
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        this.zone.run(() => {
          this.year += 1;
          if (this.year >= this.max) this.stop();
          this.changes.markForCheck();
        });
      }, PLAY_STEP_MS);
    });
  }

  protected stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
  }

  /** The slider's ticks: every unlock year as a dot, the decades and "Today" labelled. */
  protected get ticks(): {year: number; label: string | null; today: boolean}[] {
    const labelled = new Set<number>();
    for (let decade = Math.ceil(this.min / 10) * 10; decade <= this.max; decade += 10) labelled.add(decade);
    return [...new Set([...this.years, ...labelled, this.nowYear])]
      .sort((a, b) => a - b)
      .map(year => ({year, label: year === this.nowYear ? $localize`Today` : labelled.has(year) ? String(year) : null, today: year === this.nowYear}));
  }

  protected position(year: number): string {
    return `calc(8px + (100% - 16px) * ${(year - this.min) / (this.max - this.min)})`;
  }

  protected hover(country: DrawnCountry, event: MouseEvent): void {
    const card = (event.currentTarget as Element).closest('.unlock-map');
    const box = card?.getBoundingClientRect();
    const unlock = country.unlock;
    let line = $localize`Not checked yet`;
    if (unlock && unlock.status !== 'UNKNOWN' && unlock.year !== null) {
      line = unlock.year <= this.year ? $localize`Free to read since ${unlock.year}:year:` : $localize`Free from 1 January ${unlock.year}:year:`;
    }
    this.tip = {
      name: country.alpha2 ? countryName(country.alpha2) : country.name,
      line,
      rule: unlock ? unlock.rule : null,
      x: box ? Math.min(event.clientX - box.left + 14, box.width - 250) : 0,
      y: box ? event.clientY - box.top + 14 : 0,
    };
  }

  protected leave(): void {
    this.tip = null;
  }

  protected groupLabel(group: UnlockYearGroup): string {
    if (group.year === null) return $localize`Not checked yet`;
    return group.year <= this.nowYear ? $localize`Free since ${group.year}:year:` : $localize`Free from 1 January ${group.year}:year:`;
  }
}
