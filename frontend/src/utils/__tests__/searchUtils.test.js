import { describe, expect, it } from 'vitest';
import { matchesProductSearch, normalizeSearchQuery, sortProductsByName } from '../searchUtils';

describe('searchUtils', () => {
  const product = {
    name: 'CetaMist Tablet',
    company: 'Acme Pharma',
    genericName: 'Cetirizine',
  };

  it('normalizes search queries by trimming and lowercasing', () => {
    expect(normalizeSearchQuery('  Hello WORLD ')).toBe('hello world');
    expect(normalizeSearchQuery(null)).toBe('');
    expect(normalizeSearchQuery(undefined)).toBe('');
  });

  it('matches exact name queries', () => {
    expect(matchesProductSearch(product, 'CetaMist Tablet')).toBe(true);
  });

  it('matches partial name queries', () => {
    expect(matchesProductSearch(product, 'cetamis')).toBe(true);
  });

  it('matches company name queries', () => {
    expect(matchesProductSearch(product, 'acme')).toBe(true);
  });

  it('matches generic name queries', () => {
    expect(matchesProductSearch(product, 'cetir')).toBe(true);
  });

  it('returns false for unrelated queries', () => {
    expect(matchesProductSearch(product, 'ibuprofen')).toBe(false);
  });

  it('returns true for empty search query', () => {
    expect(matchesProductSearch(product, '')).toBe(true);
    expect(matchesProductSearch(product, '   ')).toBe(true);
  });

  it('sorts products alphabetically by name', () => {
    const products = [
      { name: 'ZetaFoo' },
      { name: 'alphaBar' },
      { name: 'MediC' },
    ];
    const sorted = sortProductsByName(products);
    expect(sorted.map((item) => item.name)).toEqual(['alphaBar', 'MediC', 'ZetaFoo']);
  });
});
