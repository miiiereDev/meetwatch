import { describe, it, expect } from 'vitest';
import {
  jaroWinkler,
  localPartOfEmail,
  nameSimilarity,
  normalizeEmail,
  normalizeName,
  stripAccents,
} from '../src/domain/names.js';

describe('stripAccents', () => {
  it('removes diacritics', () => {
    expect(stripAccents('José García')).toBe('Jose Garcia');
    expect(stripAccents(' Zoë ')).toBe(' Zoé '.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
  });
});

describe('normalizeName', () => {
  it('lowercases, strips accents and punctuation, collapses spaces', () => {
    expect(normalizeName('  Dr. José García-Smith ')).toBe('dr jose garcia smith');
    expect(normalizeName("O'Brien, Ada")).toBe('o brien ada');
    expect(normalizeName('   ')).toBe('');
  });
});

describe('normalizeEmail / localPartOfEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ava.T@School.EDU ')).toBe('ava.t@school.edu');
    expect(localPartOfEmail('Ava.T@School.EDU')).toBe('ava.t');
  });
});

describe('jaroWinkler', () => {
  it('is 1 for identical strings and 0 for empty input', () => {
    expect(jaroWinkler('jon smith', 'jon smith')).toBe(1);
    expect(jaroWinkler('', 'jon')).toBe(0);
  });

  it('scores near matches above 0.9 and unrelated names low', () => {
    expect(jaroWinkler('jon smith', 'john smith')).toBeGreaterThan(0.9);
    expect(jaroWinkler('ava thompson', 'ruby anderson')).toBeLessThan(0.5);
  });
});

describe('nameSimilarity', () => {
  it('is case, accent and punctuation insensitive', () => {
    expect(nameSimilarity('Ava Thompson', 'ava thompson')).toBe(1);
    expect(nameSimilarity('José García', 'jose garcia')).toBe(1);
  });

  it('handles Last, First ordering', () => {
    expect(nameSimilarity('Smith, Jon', 'Jon Smith')).toBe(1);
    expect(nameSimilarity('MARTINEZ, Ana', 'ana martinez')).toBe(1);
  });

  it('scores typos high enough to match but distinct names low', () => {
    const typo = nameSimilarity('Ava Thompson', 'Ava Thomspn');
    expect(typo).toBeGreaterThan(0.9);
    expect(nameSimilarity('Ava Thompson', 'Eva Thomspn')).toBeLessThan(1);
    expect(nameSimilarity('Ava Thompson', 'Liam Rivera')).toBeLessThan(0.6);
  });
});
