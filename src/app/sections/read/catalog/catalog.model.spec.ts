import {CatalogHit, catalogMeta, isCatalogQuery, parseCatalogHits, planCatalogResults} from './catalog.model';

describe('catalog model', () => {
  const hit = (title: string, state: CatalogHit['state'], extra: Partial<CatalogHit> = {}): CatalogHit => ({
    id: title, title, originalTitle: null, originalLanguage: null, author: 'Someone', year: 1900, state, workSlug: null, freeFrom: null, ...extra,
  });

  it('reads the search answer, with every optional field allowed to be missing', () => {
    const [first, second] = parseCatalogHits([
      {id: 'a', title: 'Dracula', originalTitle: null, originalLanguage: 'en', author: 'Bram Stoker', year: 1897, state: 'WANTABLE', workSlug: null, freeFrom: 1983},
      {id: 'b', title: 'Untitled', state: 'UNDER_COPYRIGHT'},
    ]);
    expect(first).toEqual({id: 'a', title: 'Dracula', originalTitle: null, originalLanguage: 'en', author: 'Bram Stoker', year: 1897, state: 'WANTABLE', workSlug: null, freeFrom: 1983});
    expect(second.author).toBeNull();
    expect(second.year).toBeNull();
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
