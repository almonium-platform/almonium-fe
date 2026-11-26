// Generated once from the Landing v3 design's showcase data; edit by hand from here on.
// Entry content (leads, definitions, labels, examples) is dictionary data and stays as written; only the
// three notes beside each word are landing copy, so only they are marked for translation.

export interface ShowcaseSense {
  lead: string;
  level: string;
  /** A leading "!" marks a warning label (vulgar, derogatory), drawn apart from neutral ones. */
  tags: string[];
  definition: string;
  /** The example split around the headword form: before, the form, after. */
  example?: [string, string, string];
  grammar?: string;
  /** "{head} [slot] word": braces mark the headword, brackets an open place. */
  patterns?: string[];
  collocations?: string[];
  opposite?: string;
}

export interface ShowcaseGroup {
  spelling?: string;
  pos: string;
  facts: string;
  note?: string;
  senses: ShowcaseSense[];
}

export interface ShowcaseWord {
  headword: string;
  /** What a one-word translator answers. */
  translation: string;
  /** The sense open when the word is first shown, counted across groups from 0. */
  selected: number;
  variant?: {label: string; word: string};
  pronunciations: {label: string; ipa: string}[];
  notes: {title: string; text: string}[];
  groups: ShowcaseGroup[];
  foot?: {label: string; word: string; gloss: string}[];
}

export interface ShowcaseLanguage {
  code: string;
  name: string;
  words: ShowcaseWord[];
}

export const SHOWCASE_LANGUAGES: ShowcaseLanguage[] = [
  {
    code: 'en',
    name: $localize`English`,
    words: [
      {
        headword: 'pants',
        translation: 'pantalones',
        selected: 1,
        pronunciations: [{label: 'American', ipa: '/pænts/'}, {label: 'British', ipa: '/pænts/'}],
        notes: [
          {title: $localize`One word, two garments`, text: $localize`Trousers in New York, underwear in London. Each sense says where it is used.`},
          {title: $localize`Slang is labelled`, text: $localize`Senses 3 and 4 are British slang, and the entry says so.`},
          {title: $localize`What it goes with`, text: $localize`a pair of pants, sweat pants: the phrases a learner would otherwise guess at.`},
        ],
        groups: [
          {
            pos: 'noun',
            facts: 'plural only',
            note: 'takes a plural verb; counted with "a pair of"',
            senses: [
              {
                lead: 'trousers',
                level: 'A1',
                tags: ['mainly North America', 'mainly Australia'],
                definition: 'a piece of clothing covering the body from the waist to the ankles, with a part for each leg',
                example: ['He spilled coffee on his ', 'pants', '.'],
                collocations: ['a pair of pants', 'wear pants', 'put on pants', 'take off pants', 'long pants', 'sweat pants'],
              },
              {
                lead: 'underwear',
                level: 'A2',
                tags: ['mainly British'],
                definition: 'a piece of underwear covering the bottom and worn under other clothes',
                example: ['I packed three pairs of ', 'pants', '.'],
                collocations: ['a pair of pants', 'wear pants', 'put on pants'],
              },
              {
                lead: 'nonsense',
                level: 'C1',
                tags: ['slang', 'British'],
                definition: 'something that is silly or untrue',
                example: ['That excuse is a load of ', 'pants', '.'],
                grammar: 'usually in "a load of pants"',
              },
            ],
          },
          {
            pos: 'adjective',
            facts: '',
            senses: [
              {
                lead: 'very bad',
                level: 'C1',
                tags: ['slang', 'British'],
                definition: 'very bad or of very low quality',
                example: ['The film was ', 'pants', '.'],
                grammar: 'only after a verb like be',
              },
            ],
          },
        ],
      },
      {
        headword: 'lead',
        translation: 'guiar',
        selected: 0,
        pronunciations: [{label: 'show the way, first place', ipa: '/liːd/'}, {label: 'the metal', ipa: '/lɛd/'}],
        notes: [
          {title: $localize`Two words, two sounds`, text: $localize`/liːd/ goes in front; /lɛd/ is a metal. They are separate words with separate grammar.`},
          {title: $localize`How it builds a sentence`, text: $localize`lead sb to do sth: the open places are marked, and a program can read them.`},
          {title: $localize`A sense of one country`, text: $localize`A dog's lead is British. The entry says so.`},
        ],
        groups: [
          {
            pos: 'verb',
            facts: 'past led',
            senses: [
              {
                lead: 'to show the way',
                level: 'A2',
                tags: [],
                definition: 'to show someone the way by going in front of them',
                example: ['She ', 'led', ' us through the old town.'],
                patterns: ['{lead} [sb] to [sth]', '{lead} [sb] into [sth]', '{lead} [sb] through [sth]', '{lead} [sb] to [do sth]'],
                collocations: ['lead the way'],
              },
            ],
          },
          {
            pos: 'noun',
            facts: '',
            senses: [
              {
                lead: 'first place',
                level: 'B1',
                tags: [],
                definition: 'a position ahead of others in a race or competition',
                example: ['She took the ', 'lead', ' on the final lap.'],
                collocations: ['take the lead', 'in the lead', 'hold the lead', 'lose the lead', 'extend the lead', 'a narrow lead'],
              },
              {
                lead: 'dog leash',
                level: 'B2',
                tags: ['British'],
                definition: 'a long strap or chain fixed to a dog\'s collar',
                example: ['Keep your dog on a ', 'lead', '.'],
              },
            ],
          },
          {
            pos: 'noun',
            facts: '',
            senses: [
              {
                lead: 'lead (metal)',
                level: 'B2',
                tags: [],
                definition: 'a soft heavy grey metal, once used for water pipes',
                example: ['The old pipes were made of ', 'lead', '.'],
                grammar: 'uncountable',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'de',
    name: $localize`German`,
    words: [
      {
        headword: 'Band',
        translation: 'band',
        selected: 3,
        pronunciations: [{label: 'ribbon, bond, book', ipa: '/bant/'}, {label: 'musicians', ipa: '/bɛnt/'}],
        notes: [
          {title: $localize`Four words in one spelling`, text: $localize`das Band, der Band, die Band: each has its own gender and its own plural.`},
          {title: $localize`Said two ways`, text: $localize`/bant/ for the ribbon and the book, /bɛnt/ for the musicians.`},
          {title: $localize`A label on each sense`, text: $localize`elevated, anatomy: you can see where a sense belongs before you use it.`},
        ],
        groups: [
          {
            pos: 'noun, neuter',
            facts: 'plural Bänder',
            senses: [
              {
                lead: 'ribbon, tape',
                level: 'A2',
                tags: [],
                definition: 'schmaler, langer Streifen aus Stoff oder Kunststoff zum Binden oder Schmücken',
                example: ['Sie trägt ein rotes ', 'Band', ' im Haar.'],
                collocations: ['ein Band binden', 'das Band durchschneiden', 'ein Band im Haar tragen'],
              },
              {
                lead: 'ligament',
                level: 'C1',
                tags: ['anatomy'],
                definition: 'festes Gewebe im Körper, das Knochen in einem Gelenk verbindet',
              },
            ],
          },
          {
            pos: 'noun, neuter',
            facts: 'plural Bande',
            senses: [
              {
                lead: 'bond',
                level: 'C1',
                tags: ['elevated'],
                definition: 'enge Beziehung, die Menschen innerlich miteinander verbindet',
                grammar: 'usually plural: Bande',
              },
            ],
          },
          {
            pos: 'noun, masculine',
            facts: 'plural Bände',
            senses: [
              {
                lead: 'volume (of a book)',
                level: 'B1',
                tags: [],
                definition: 'einzelnes Buch, das zu einer Reihe oder einem größeren Werk gehört',
                example: ['Der zweite ', 'Band', ' erscheint im Herbst.'],
              },
            ],
          },
          {
            pos: 'noun, feminine',
            facts: 'plural Bands',
            senses: [
              {
                lead: 'band (music)',
                level: 'A2',
                tags: [],
                definition: 'Gruppe von Musikern, die zusammen vor allem Pop, Rock oder Jazz spielen',
                example: ['Die ', 'Band', ' spielt heute Abend im Club.'],
              },
            ],
          },
        ],
      },
      {
        headword: 'umfahren',
        translation: 'drive around',
        selected: 0,
        pronunciations: [{label: 'knock down', ipa: '/ˈʊm.faː.ʁən/'}, {label: 'go around', ipa: '/ʊm.ˈfaː.ʁən/'}],
        notes: [
          {title: $localize`Stress flips the meaning`, text: $localize`Stressed on um-, it knocks something down. Stressed on -fah-, it goes around it.`},
          {title: $localize`Separable or not`, text: $localize`fährt um, but umfährt: the grammar changes with the stress.`},
          {title: $localize`Open places with a case`, text: $localize`jmdn./etw.: a person or a thing, in the accusative.`},
        ],
        groups: [
          {
            pos: 'verb',
            facts: 'separable: fährt um',
            note: 'stressed on um- and separable; compare inseparable umfáhren, to go around',
            senses: [
              {
                lead: 'to knock down',
                level: 'B2',
                tags: [],
                definition: 'mit einem Auto, Rad oder Ähnlichem jemanden oder etwas anstoßen und zu Boden werfen',
                example: ['Er hat das Schild ', 'umgefahren', '.'],
                patterns: ['[jmdn./etw.] {umfahren}'],
                collocations: ['einen Fußgänger umfahren', 'ein Verkehrsschild umfahren'],
              },
            ],
          },
          {
            pos: 'verb',
            facts: 'not separable: umfährt',
            note: 'stressed on -fah- and not separable; compare separable úmfahren, to knock down',
            senses: [
              {
                lead: 'to drive around',
                level: 'B2',
                tags: [],
                definition: 'sich mit einem Auto, Schiff oder Ähnlichem im Bogen um etwas herumbewegen',
                example: ['Wir ', 'umfahren', ' den Stau.'],
                patterns: ['[etw.] {umfahren}'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'fr',
    name: $localize`French`,
    words: [
      {
        headword: 'plus',
        translation: 'more',
        selected: 1,
        pronunciations: [{label: 'in negation, before an adjective', ipa: '/ply/'}, {label: 'meaning more, at the end', ipa: '/plys/'}],
        notes: [
          {title: $localize`Opposite meanings, one spelling`, text: $localize`J'en veux plus, with the s, asks for more. Je n'en veux plus, without it, wants no more.`},
          {title: $localize`When each sound is said`, text: $localize`The pronunciation rows give the context, not only the sound.`},
          {title: $localize`Speech and the standard`, text: $localize`ne is often dropped in speech. The entry says so.`},
        ],
        groups: [
          {
            pos: 'adverb',
            facts: 'never changes',
            senses: [
              {
                lead: 'more',
                level: 'A1',
                tags: [],
                definition: 'en plus grande quantité ou à un degré plus élevé',
                example: ['Il travaille ', 'plus', ' que moi.'],
                patterns: ['{plus} [+ adj] que [qqn/qqch]', '{plus} [+ adv] que [qqn/qqch]'],
                collocations: ['de plus en plus', 'plus ou moins', 'beaucoup plus', 'bien plus'],
                opposite: 'moins',
              },
              {
                lead: 'no more, no longer',
                level: 'A2',
                tags: [],
                definition: 'indique qu\'une action ou un état a cessé',
                example: ['Je ne fume ', 'plus', '.'],
                grammar: 'with ne in standard French; ne is often dropped in speech',
              },
            ],
          },
          {
            pos: 'noun, masculine',
            facts: '',
            senses: [
              {
                lead: 'an advantage',
                level: 'B2',
                tags: ['informal'],
                definition: 'élément positif qui donne un avantage supplémentaire',
                example: ['Parler deux langues est un vrai ', 'plus', '.'],
                collocations: ['un vrai plus', 'un petit plus', 'apporter un plus'],
              },
            ],
          },
        ],
      },
      {
        headword: 'monter',
        translation: 'to go up',
        selected: 0,
        pronunciations: [{label: '', ipa: '/mɔ̃.te/'}],
        notes: [
          {title: $localize`Être or avoir`, text: $localize`Elle est montée, but il a monté les valises: the auxiliary depends on the sense.`},
          {title: $localize`Patterns`, text: $localize`monter à, monter sur, monter + infinitive.`},
          {title: $localize`The company it keeps`, text: $localize`les prix montent, le ton monte.`},
        ],
        groups: [
          {
            pos: 'verb',
            facts: 'perfect with être or avoir',
            senses: [
              {
                lead: 'to go up',
                level: 'A1',
                tags: [],
                definition: 'aller vers un endroit plus haut',
                example: ['Elle est ', 'montée', ' au grenier.'],
                grammar: 'with être',
                patterns: ['{monter} à [qqch]', '{monter} sur [qqch]', '{monter} [+ inf]'],
                collocations: ['monter à l\'étage', 'monter au grenier', 'monter sur une chaise', 'monter se coucher'],
                opposite: 'descendre',
              },
              {
                lead: 'to rise',
                level: 'B1',
                tags: [],
                definition: 'augmenter, atteindre un niveau plus élevé',
                example: ['Les prix ', 'montent', ' chaque année.'],
                collocations: ['monter en flèche', 'les prix montent', 'la température monte', 'le ton monte'],
              },
              {
                lead: 'to carry up, to put together',
                level: 'B1',
                tags: [],
                definition: 'porter quelque chose vers le haut, ou assembler les pièces d\'un objet',
                example: ['Il a ', 'monté', ' les valises.'],
                grammar: 'with avoir',
              },
              {
                lead: 'to amount to',
                level: 'B2',
                tags: [],
                definition: 'atteindre au total une certaine somme ou quantité',
                grammar: 'reflexive: se monter à',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'es',
    name: $localize`Spanish`,
    words: [
      {
        headword: 'coger',
        translation: 'to take',
        selected: 0,
        pronunciations: [{label: 'Spain', ipa: '/ko.ˈxeɾ/'}, {label: 'Mexico', ipa: '/ko.ˈxeɾ/'}],
        notes: [
          {title: $localize`A regional trap`, text: $localize`Everyday in Madrid, vulgar in Mexico City and Buenos Aires.`},
          {title: $localize`Marked, not hidden`, text: $localize`The vulgar sense carries a warning and the countries where it holds.`},
          {title: $localize`What to say instead`, text: $localize`In much of Latin America: tomar or agarrar.`},
        ],
        groups: [
          {
            pos: 'verb',
            facts: '',
            note: 'g becomes j before a and o: cojo, coja; in much of Latin America tomar or agarrar is preferred',
            senses: [
              {
                lead: 'to take, to grab',
                level: 'A2',
                tags: ['mainly Spain'],
                definition: 'tomar o sujetar algo o a alguien con la mano',
                example: ['', 'Coge', ' el paraguas, que llueve.'],
                patterns: ['{coger} [algo]', '{coger} a [alguien] de [algo]'],
                collocations: ['coger de la mano', 'coger en brazos', 'coger el teléfono', 'coger fruta'],
              },
              {
                lead: 'to catch (a bus, a train)',
                level: 'A2',
                tags: ['mainly Spain'],
                definition: 'subir a un medio de transporte para viajar en él',
                example: ['', 'Cojo', ' el tren de las ocho.'],
              },
              {
                lead: 'to catch (a cold, a habit)',
                level: 'B1',
                tags: [],
                definition: 'empezar a tener una enfermedad, un sentimiento o una costumbre',
                example: ['He ', 'cogido', ' un resfriado.'],
                collocations: ['coger frío', 'coger un resfriado', 'coger cariño', 'coger miedo', 'coger la costumbre', 'coger el gusto'],
              },
              {
                lead: 'to have sex with',
                level: 'C1',
                tags: ['!vulgar', 'mainly Mexico', 'mainly Argentina', '+2'],
                definition: 'tener relaciones sexuales con una persona',
              },
            ],
          },
        ],
      },
      {
        headword: 'capital',
        translation: 'capital',
        selected: 1,
        pronunciations: [{label: 'Spain', ipa: '/ka.pi.ˈtal/'}, {label: 'Mexico', ipa: '/ka.pi.ˈtal/'}],
        notes: [
          {title: $localize`La or el`, text: $localize`la capital is a city; el capital is money. Two words, two genders.`},
          {title: $localize`The vocabulary of a field`, text: $localize`capital social, capital riesgo, fuga de capitales.`},
          {title: $localize`Grammar on each sense`, text: $localize`usually uncountable; only with a noun.`},
        ],
        groups: [
          {
            pos: 'noun, feminine',
            facts: '',
            senses: [
              {
                lead: 'capital city',
                level: 'A2',
                tags: [],
                definition: 'ciudad donde están el gobierno de un país o de una región',
                example: ['Lima es la ', 'capital', ' de Perú.'],
                patterns: ['{capital} de [algo]'],
                collocations: ['capital de provincia', 'capital del país', 'capital federal'],
              },
            ],
          },
          {
            pos: 'noun, masculine',
            facts: 'usually uncountable',
            senses: [
              {
                lead: 'capital (money)',
                level: 'B2',
                tags: [],
                definition: 'dinero o bienes que se tienen o se invierten para obtener ganancias',
                example: ['La empresa necesita más ', 'capital', '.'],
                collocations: ['invertir capital', 'capital inicial', 'capital social', 'fuga de capitales', 'ampliación de capital', 'capital riesgo'],
              },
            ],
          },
          {
            pos: 'adjective',
            facts: 'same form for masculine and feminine',
            senses: [
              {
                lead: 'capital (punishment)',
                level: 'C1',
                tags: [],
                definition: 'que se castiga con la muerte o que la impone como castigo',
                grammar: 'only with a noun: pena capital',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'it',
    name: $localize`Italian`,
    words: [
      {
        headword: 'ancora',
        translation: 'still',
        selected: 2,
        pronunciations: [{label: 'still, again', ipa: '/an.ˈko.ra/'}, {label: 'anchor', ipa: '/ˈan.ko.ra/'}],
        notes: [
          {title: $localize`Stress decides the word`, text: $localize`ancóra is still; àncora is an anchor. Italian writes both the same way.`},
          {title: $localize`Marked for you`, text: $localize`Italian does not write the stress. The entry does.`},
          {title: $localize`Figurative senses are labelled`, text: $localize`An anchor can also be a person.`},
        ],
        groups: [
          {
            pos: 'adverb',
            facts: 'stress: ancóra',
            senses: [
              {
                lead: 'still',
                level: 'A1',
                tags: [],
                definition: 'anche adesso o fino al momento indicato, senza interruzione',
                example: ['Piove ', 'ancora', '.'],
                collocations: ['non ancora', 'ancora oggi', 'ancora adesso'],
              },
              {
                lead: 'even (more, less)',
                level: 'A2',
                tags: [],
                definition: 'usato per rendere più forte un confronto',
                example: ['Oggi fa ', 'ancora', ' più freddo.'],
                patterns: ['{ancora} più [+ agg]', '{ancora} meno [+ agg]'],
              },
            ],
          },
          {
            pos: 'noun, feminine',
            facts: 'stress: àncora',
            senses: [
              {
                lead: 'anchor',
                level: 'B1',
                tags: [],
                definition: 'attrezzo di metallo che, calato sul fondo, tiene ferma una nave',
                example: ['La nave ha gettato l\'', 'ancora', '.'],
              },
              {
                lead: 'lifeline',
                level: 'C1',
                tags: ['figurative'],
                definition: 'persona o cosa che offre aiuto e sicurezza in un momento difficile',
              },
            ],
          },
        ],
      },
      {
        headword: 'pesca',
        translation: 'peach',
        selected: 1,
        pronunciations: [{label: 'peach', ipa: '/ˈpɛs.ka/'}, {label: 'fishing', ipa: '/ˈpes.ka/'}],
        notes: [
          {title: $localize`One vowel apart`, text: $localize`pèsca, with an open e, is a peach. pésca, with a close e, is fishing.`},
          {title: $localize`Six collocations`, text: $localize`andare a pesca, canna da pesca: the least guessable come first.`},
          {title: $localize`Counted or not, sense by sense`, text: $localize`A peach is counted; fishing is not.`},
        ],
        groups: [
          {
            pos: 'noun, feminine',
            facts: 'stress: pèsca, open e · plural pesche',
            senses: [
              {
                lead: 'peach',
                level: 'A2',
                tags: [],
                definition: 'frutto rotondo con buccia vellutata, polpa dolce e succosa e un nocciolo duro',
                example: ['Ho mangiato una ', 'pesca', ' matura.'],
                collocations: ['pesche sciroppate', 'succo di pesca', 'tè alla pesca', 'marmellata di pesche'],
              },
            ],
          },
          {
            pos: 'noun, feminine',
            facts: 'stress: pésca, close e',
            senses: [
              {
                lead: 'fishing',
                level: 'B1',
                tags: [],
                definition: 'attività di catturare animali che vivono nell\'acqua, per lavoro o per sport',
                example: ['La domenica va a ', 'pesca', ' sul lago.'],
                grammar: 'uncountable',
                collocations: ['andare a pesca', 'canna da pesca', 'pesca sportiva', 'pesca subacquea', 'pesca a strascico', 'pesca d\'altura'],
              },
            ],
          },
        ],
        foot: [{label: 'From', word: 'pescare', gloss: 'the activity · sense 2'}],
      },
    ],
  },
  {
    code: 'pt',
    name: $localize`Portuguese`,
    words: [
      {
        headword: 'rapariga',
        translation: 'girl',
        selected: 1,
        pronunciations: [{label: 'Portugal', ipa: '/ʁɐ.pɐ.ˈɾi.ɡɐ/'}, {label: 'Brazil', ipa: '/ʁa.pa.ˈɾi.ɡɐ/'}],
        notes: [
          {title: $localize`Fine in Lisbon, an insult in São Paulo`, text: $localize`Each sense names the countries where it holds.`},
          {title: $localize`Warnings stand out`, text: $localize`vulgar and derogatory get their own colour, apart from neutral labels.`},
          {title: $localize`The safe word`, text: $localize`In Brazil: menina or moça.`},
        ],
        groups: [
          {
            pos: 'noun, feminine',
            facts: '',
            senses: [
              {
                lead: 'girl',
                level: 'A2',
                tags: ['Portugal', 'Africa'],
                definition: 'pessoa jovem do sexo feminino, já não criança mas ainda não adulta',
                example: ['A ', 'rapariga', ' mora em Lisboa.'],
                collocations: ['rapariga nova'],
              },
              {
                lead: 'prostitute',
                level: 'C1',
                tags: ['!vulgar', '!derogatory', 'Brazil'],
                definition: 'mulher que recebe dinheiro para ter relações sexuais',
              },
            ],
          },
        ],
        foot: [{label: 'Feminine of', word: 'rapaz', gloss: ''}, {label: 'Don\'t confuse with', word: 'menina', gloss: 'the ordinary word for a girl in Portugal is an insult in Brazil, where menina or moça is used instead'}],
      },
      {
        headword: 'fato',
        translation: 'fact',
        selected: 1,
        variant: {label: 'Portugal, in sense 1', word: 'facto'},
        pronunciations: [{label: 'Brazil', ipa: '/ˈfa.tu/'}, {label: 'Portugal', ipa: '/ˈfa.tu/'}],
        notes: [
          {title: $localize`A fact in Brazil, a suit in Portugal`, text: $localize`In Portugal the fact is spelled facto, and fato is what you wear.`},
          {title: $localize`A spelling for each variety`, text: $localize`fato, facto: the entry knows which country writes which.`},
          {title: $localize`Patterns with their mood`, text: $localize`o fato de que + indicative.`},
        ],
        groups: [
          {
            pos: 'noun, masculine',
            facts: '',
            senses: [
              {
                lead: 'fact',
                level: 'A2',
                tags: ['mainly Brazil'],
                definition: 'coisa que aconteceu de verdade ou que existe',
                example: ['O ', 'fato', ' é que ninguém sabia.'],
                patterns: ['o {fato} de [+ inf]', 'o {fato} de que [+ ind]'],
                collocations: ['de fato', 'o fato é que', 'pelo fato de', 'fato consumado', 'fato histórico', 'apresentar os fatos'],
              },
              {
                lead: 'suit',
                level: 'B1',
                tags: ['mainly Portugal'],
                definition: 'conjunto de casaco e calças do mesmo tecido',
                example: ['Ele vestiu o ', 'fato', ' novo para o casamento.'],
                collocations: ['fato e gravata', 'vestir um fato', 'fato completo'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'ru',
    name: $localize`Russian`,
    words: [
      {
        headword: 'замок',
        translation: 'castle',
        selected: 1,
        pronunciations: [{label: 'castle', ipa: '/ˈza.mək/'}, {label: 'lock', ipa: '/zɐ.ˈmok/'}],
        notes: [
          {title: $localize`Stress decides the word`, text: $localize`за́мок is a castle; замо́к is a lock. Russian writes both the same way.`},
          {title: $localize`Forms keep their stress`, text: $localize`за́мка, замка́: the stress stays with its word.`},
          {title: $localize`Least guessable first`, text: $localize`закрыть на замок comes before висячий замок.`},
        ],
        groups: [
          {
            spelling: 'за́мок',
            pos: 'noun, masculine',
            facts: 'genitive за́мка',
            senses: [
              {
                lead: 'castle',
                level: 'A2',
                tags: [],
                definition: 'старинное укреплённое жилище знатного владельца со стенами и башнями',
                example: ['На холме стоит старый ', 'замок', '.'],
                collocations: ['средневековый замок', 'старинный замок', 'рыцарский замок', 'песочный замок'],
              },
            ],
          },
          {
            spelling: 'замо́к',
            pos: 'noun, masculine',
            facts: 'genitive замка́',
            senses: [
              {
                lead: 'lock',
                level: 'A2',
                tags: [],
                definition: 'устройство, которое запирают и открывают ключом или кодом',
                example: ['Закрой дверь на ', 'замок', '.'],
                collocations: ['закрыть на замок', 'под замком', 'висячий замок', 'кодовый замок', 'ключ от замка', 'повесить замок'],
              },
            ],
          },
        ],
      },
      {
        headword: 'год',
        translation: 'year',
        selected: 0,
        pronunciations: [{label: '', ipa: '/ɡot/'}],
        notes: [
          {title: $localize`пять лет, not пять годов`, text: $localize`After numbers the word changes completely. The entry says when.`},
          {title: $localize`Two forms after a preposition`, text: $localize`в году́, but о го́де.`},
          {title: $localize`A case on the open place`, text: $localize`в годы чего: a thing, in the genitive.`},
        ],
        groups: [
          {
            pos: 'noun, masculine',
            facts: 'after numbers: лет',
            note: 'after numbers and words of quantity: пять лет, много лет',
            senses: [
              {
                lead: 'year',
                level: 'A1',
                tags: [],
                definition: 'промежуток времени в двенадцать месяцев',
                example: ['Мне двадцать ', 'лет', '.'],
                grammar: 'after в: в этом году́, but о го́де',
                collocations: ['в этом году', 'в прошлом году', 'в следующем году', 'Новый год', 'круглый год', 'из года в год'],
              },
              {
                lead: 'years, a period',
                level: 'B1',
                tags: [],
                definition: 'период времени в жизни человека или в истории',
                example: ['В ', 'годы', ' войны он жил в деревне.'],
                grammar: 'plural only: го́ды',
                patterns: ['в {годы} [чего]'],
              },
            ],
          },
        ],
      },
    ],
  },
];
