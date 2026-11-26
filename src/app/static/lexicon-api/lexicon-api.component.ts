import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AppConstants} from '../../app.constants';
import {PublicFooterComponent} from '../../shared/public-footer/public-footer.component';
import {PageSeoService} from '../../shared/seo/page-seo.service';

const CONTACT = 'api@almonium.com';

/** The response the page shows, as the design draws it: `coger`, where one sense is everyday in Spain and vulgar in Mexico. */
const SAMPLE = `{
  "schema": 4,
  "language": "es",
  "headword": "coger",
  "lexemes": [{
    "pos": "VERB",
    "pronunciations": [
      { "ipa": "/ko.ˈxeɾ/", "variety": "es-ES" },
      { "ipa": "/ko.ˈxeɾ/", "variety": "es-MX" }
    ],
    "forms": [{ "form": "cojo", "features": "Mood=Ind|Tense=Pres|Person=1|Number=Sing" }],
    "senses": [
      {
        "id": "5b0e6c1a-…",
        "level": "A2",
        "definition": "tomar o sujetar algo o a alguien con la mano",
        "regions": [{ "code": "es-ES", "scope": "mainly" }],
        "patterns": [{
          "text": "coger a alguien de algo",
          "parts": [
            { "head": "coger" }, { "word": "a" },
            { "slot": "person" }, { "word": "de" },
            { "slot": "thing" }
          ]
        }],
        "collocations": ["coger de la mano", "coger en brazos"]
      },
      {
        "id": "c41d90f7-…",
        "level": "C1",
        "definition": "tener relaciones sexuales con una persona",
        "labels": { "attitude": ["vulgar"] },
        "regions": [
          { "code": "es-MX", "scope": "mainly" },
          { "code": "es-AR", "scope": "mainly" },
          { "code": "es-013", "scope": "mainly" }
        ]
      }
    ]
  }]
}`;

const STRUCTURAL_KEY = /("(?:schema|language|headword|lexemes|pos|pronunciations|forms|senses)")(?=:)/;

interface ComparisonRow {
  label: string;
  /** Almonium first, then publisher APIs, multilingual APIs, open dumps, a live model. */
  cells: [string, string, string, string, string];
}

/**
 * The Lexicon API page (design: "Lexicon API"): what the dictionary is as a product for other builders, one
 * response, how it compares, what is covered and what it costs. Access is by email while it is in early access,
 * so the page has no form and no key flow.
 */
@Component({
  selector: 'app-lexicon-api',
  imports: [RouterLink, PublicFooterComponent],
  templateUrl: './lexicon-api.component.html',
  styleUrl: './lexicon-api.component.less',
})
export class LexiconApiComponent implements OnInit, OnDestroy {
  private readonly seo = inject(PageSeoService);

  protected readonly contact = CONTACT;
  protected readonly contactHref = `mailto:${CONTACT}`;
  /** The entry schema as the backend serves it: one file, derived there, with nothing of how an entry was made. */
  protected readonly schemaHref = `${AppConstants.API_URL}/public/lexicon/schema`;
  protected readonly request = 'api.almonium.com/public/lexicon/es/entries?headword=coger';
  /** The sample split so the structural keys can be tinted. Odd segments are keys. */
  protected readonly sample = SAMPLE.split(STRUCTURAL_KEY).map((text, index) => ({text, key: index % 2 === 1}));

  protected readonly rivals = [
    {name: $localize`Publisher APIs`, examples: 'Oxford, Merriam-Webster'},
    {name: $localize`Multilingual APIs`, examples: 'Lexicala'},
    {name: $localize`Open dumps`, examples: 'Wiktionary, Kaikki'},
    {name: $localize`DIY live LLM`, examples: 'OpenAI, Anthropic'},
  ];

  protected readonly comparison: ComparisonRow[] = [
    {label: $localize`Best for`, cells: [
      $localize`Multilingual language-learning & reading apps`,
      $localize`English-first brand authority`,
      $localize`Broad bilingual lookups across many languages`,
      $localize`Maximum headword count at zero cost`,
      $localize`One-off prototypes & rare/niche terms`,
    ]},
    {label: $localize`Languages`, cells: [
      $localize`Core learner languages (English, German, French, Spanish, Italian, Portuguese, Russian, Japanese — expanding), one uniform schema`,
      $localize`Strong in English; other major languages fragmented or unavailable via API`,
      $localize`Broad (~50 languages), drawn from multiple underlying dictionary series`,
      $localize`100+ languages, uneven depth by edition`,
      $localize`Any language`,
    ]},
    {label: $localize`Learner structure`, cells: [
      $localize`Native: CEFR per sense, typed label axes (register, attitude, region, domain), variety spellings & IPA, valency frames, collocations, morph links, Japanese pitch accent & counters`,
      $localize`High in English Learner’s editions; uneven or missing in other languages (often HTML/XML payloads)`,
      $localize`Definitions, IPA, frequency, collocations, translations; lighter learner-grading & syntax frames`,
      $localize`Rich in places, noisy/inconsistent across entries; requires heavy parsing`,
      $localize`Flexible, but schema drifts and lacks consistent taxonomy`,
    ]},
    {label: $localize`Fact reliability & sense IDs`, cells: [
      $localize`Witness-checked (IPA, gender, stress, inflections) + stable sense IDs`,
      $localize`Human-edited print pedigree + stable IDs`,
      $localize`Human-curated lexical cores + stable IDs`,
      $localize`Volunteer-edited; IDs/structure shift across dumps`,
      $localize`Unverified IPA/gender/inflections; no stable sense IDs`,
    ]},
    {label: $localize`Headword breadth`, cells: [
      $localize`Frequency-first core (~30k–40k/lang) — built for learners, not archival/Scrabble`,
      $localize`High (100k–200k+ in flagship English sets)`,
      $localize`High across major languages`,
      $localize`Highest (500k+ incl. rare & archaic)`,
      $localize`Unbounded`,
    ]},
    {label: $localize`Latency & unit cost`, cells: [
      $localize`Low-latency REST, predictable per-call pricing`,
      $localize`Low latency; commercial pricing often annual/per-language (e.g., Oxford from £200/mo per language) or custom quote`,
      $localize`Low latency; RapidAPI tiers ($20–$150/mo) or custom enterprise`,
      $localize`Self-host/parse cost, or community APIs with no SLA`,
      $localize`1–4s latency; recurring token cost per uncached lookup`,
    ]},
    {label: $localize`Commercial & caching terms`, cells: [
      $localize`Commercial licence; live lookup only, no persistent caching or AI/ML training`,
      $localize`Often custom contracts, mandatory branding (e.g., MW), and strict no-caching clauses`,
      $localize`Commercial tiers available; enterprise for bulk/custom`,
      $localize`CC-BY-SA share-alike obligations`,
      $localize`Commercial-friendly, but you build & maintain the cache`,
    ]},
  ];

  /** Entries published per language, as the page was drawn. The bar is the share of the largest. */
  protected readonly coverage = [
    {language: $localize`English`, entries: '~24.8k', share: 100},
    {language: $localize`French`, entries: '~6.2k', share: 25},
    {language: $localize`Spanish`, entries: '~5.7k', share: 23},
    {language: $localize`German`, entries: '~5.6k', share: 22.6},
    {language: $localize`Portuguese`, entries: '~5.2k', share: 21},
    {language: $localize`Italian`, entries: '~2.9k', share: 11.7},
  ];

  protected readonly tiers = [
    {name: $localize`Sandbox`, price: $localize`Free`, period: false, volume: ''},
    {name: $localize`Indie`, price: '€49', period: true, volume: $localize`50k requests`},
    {name: $localize`Growth`, price: '€199', period: true, volume: $localize`300k requests`},
    {name: $localize`Scale`, price: '€499', period: true, volume: $localize`1.5M requests`},
    {name: $localize`Offline / Bulk`, price: $localize`Custom`, period: false, volume: ''},
  ];

  ngOnInit(): void {
    this.seo.describe({
      title: $localize`Lexicon API · Almonium`,
      description: $localize`A learner’s dictionary for European languages, served as JSON: one schema for every language, CEFR per sense, regions, patterns and IPA per variety, under a plain commercial licence.`,
      path: '/lexicon-api',
    });
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }
}
