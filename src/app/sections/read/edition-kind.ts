/**
 * An edition's kind, in words (G15): the processor names it original, adaptation, machine_translation or
 * human_translation; the reader also sees Lightly modernised when the register says so. "Machine" never reaches a shelf or a
 * chip; the pill on the book page that names the translator is where that detail lives.
 */
export type EditionKind = 'original' | 'adapted' | 'translation' | 'edition';

export function editionKind(editionType: string | undefined | null): EditionKind {
  switch (editionType) {
    case 'original': return 'original';
    case 'adaptation': return 'adapted';
    case 'machine_translation':
    case 'human_translation': return 'translation';
    default: return 'edition';
  }
}

export function editionKindLabel(editionType: string | undefined | null, literaryRegister?: string | null): string {
  if (editionType === 'adaptation' && literaryRegister === 'lightly modernised') return $localize`Lightly modernised`;
  switch (editionKind(editionType)) {
    case 'original': return $localize`Original`;
    case 'adapted': return $localize`Adapted`;
    case 'translation': return $localize`Translation`;
    default: return $localize`Edition`;
  }
}
