import {CatalogHit, catalogMeta, groupUnlocksByYear, isCatalogQuery, parseCatalogHits, parseWorkUnlocks, planCatalogResults} from './catalog.model';

describe('catalog model', () => {
  const hit = (title: string, state: CatalogHit['state'], extra: Partial<CatalogHit> = {}): CatalogHit => ({
    id: title, title, originalTitle: null, originalLanguage: null, author: 'Someone', year: 1900, state, workSlug: null, freeFrom: null, readers: null, wantedByMe: false, readerCountry: null, readerFreeFrom: null, freeIn: [], ...extra,
  });

  it('reads the search answer, with every optional field allowed to be missing', () => {
    const [first, second] = parseCatalogHits([
      {id: 'a', title: 'Dracula', originalTitle: null, originalLanguage: 'en', author: 'Bram Stoker', year: 1897, state: 'WANTABLE', workSlug: null, freeFrom: 1983, readers: 4, wantedByMe: true},
      {id: 'b', title: 'Untitled', state: 'UNDER_COPYRIGHT'},
    ]);
    expect(first).toEqual({id: 'a', title: 'Dracula', originalTitle: null, originalLanguage: 'en', author: 'Bram Stoker', year: 1897, state: 'WANTABLE', workSlug: null, freeFrom: 1983, readers: 4, wantedByMe: true, readerCountry: null, readerFreeFrom: null, freeIn: []});
    expect(second.author).toBeNull();
    expect(second.year).toBeNull();
    expect(second.readers).toBeNull();
    expect(second.wantedByMe).toBeFalse();
    expect(() => parseCatalogHits([{id: 'c', title: 'X', state: 'LOCKED'}])).toThrowError(/hits\[0\]\.state/);
  });

  it('keeps wantable and not-in-your-country hits as rows and leaves what the shelf shows to the shelf', () => {
    const plan = planCatalogResults([
      hit('On shelf', 'ON_SHELF'),
      hit('Wanted', 'WANTABLE'),
      hit('Elsewhere', 'NOT_IN_YOUR_COUNTRY'),
      hit('Protected', 'UNDER_COPYRIGHT'),
    ]);
    expect(plan.copyright).toBeNull();
    expect(plan.rows.map(row => row.title)).toEqual(['Wanted', 'Elsewhere']);
  });

  it('gives the card to a book under copyright only when it is the best hit', () => {
    const plan = planCatalogResults([hit('Lolita', 'UNDER_COPYRIGHT'), hit('Pnin', 'UNDER_COPYRIGHT'), hit('Old', 'WANTABLE')]);
    expect(plan.copyright?.title).toBe('Lolita');
    expect(plan.rows.map(row => row.title)).toEqual(['Old']);
    expect(planCatalogResults([])).toEqual({copyright: null, rows: []});
  });

  it('writes author · year from whichever is known', () => {
    expect(catalogMeta({author: 'Bram Stoker', year: 1897})).toBe('Bram Stoker · 1897');
    expect(catalogMeta({author: null, year: 1897})).toBe('1897');
    expect(catalogMeta({author: 'Anon', year: null})).toBe('Anon');
    expect(catalogMeta({author: null, year: null})).toBe('');
  });

  it('asks the catalogue only once two letters or digits survive folding', () => {
    expect(isCatalogQuery('é')).toBeFalse();
    expect(isCatalogQuery(" '. ")).toBeFalse();
    expect(isCatalogQuery('Él')).toBeTrue();
    expect(isCatalogQuery('11')).toBeTrue();
  });
});

describe('the unlock map data (W7)', () => {
  it('reads the answer and groups countries by the year they free the work, unknown last', () => {
    const unlocks = parseWorkUnlocks({
      id: 'w', title: 'Winnie-the-Pooh', author: 'A. A. Milne', year: 1926, readerCountry: 'DE', readerFreeFrom: 2027,
      countries: [
        {country: 'CA', status: 'FREE', year: 2007, rule: 'Life + 50 for authors who died by 1971, life + 70 after'},
        {country: 'DE', status: 'PROTECTED', year: 2027, rule: "Author's life + 70 years"},
        {country: 'MX', status: 'PROTECTED', year: 2057, rule: "Author's life + 100 years"},
        {country: 'US', status: 'FREE', year: 2022, rule: '95 years after publication for works published before 1978, life + 70 after'},
        {country: 'XK', status: 'UNKNOWN', year: null, rule: "Author's life + 70 years"},
      ],
    });
    expect(unlocks.readerFreeFrom).toBe(2027);
    expect(groupUnlocksByYear(unlocks.countries).map(group => [group.year, group.countries.map(c => c.country)])).toEqual([
      [2007, ['CA']], [2022, ['US']], [2027, ['DE']], [2057, ['MX']], [null, ['XK']],
    ]);
    expect(() => parseWorkUnlocks({id: 'w', title: 'X', readerCountry: 'DE', countries: [{country: 'DE', status: 'LOCKED', year: null, rule: ''}]}))
      .toThrowError(/unlocks\.countries\[0\]\.status/);
  });
});
