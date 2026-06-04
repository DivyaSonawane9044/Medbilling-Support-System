export const normalizeSearchQuery = (query) => (typeof query === 'string' ? query.trim().toLowerCase() : '');

export const matchesProductSearch = (product, query) => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return true;

  const fields = [product?.name, product?.company, product?.genericName];
  return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(normalizedQuery));
};

export const sortProductsByName = (products) => {
  if (!Array.isArray(products)) return [];
  return [...products].sort((a, b) => {
    const nameA = String(a?.name || '').toLowerCase();
    const nameB = String(b?.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
};
