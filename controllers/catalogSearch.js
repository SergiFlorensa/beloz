function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function rank(row, query) {
  const text = normalize(query);
  if (!text) return null;
  const name = normalize(row.name);
  const keywords = normalize(row.type_of_food);
  const matches = (value) => text.split(' ').every((token) => value.split(' ').some((word) => word.startsWith(token)));
  if (name === text) return 0;
  if (name.startsWith(text)) return 1;
  if (matches(name)) return 2;
  if (matches(keywords)) return 3;
  if (matches(`${name} ${keywords}`)) return 4;
  return null;
}

function searchCatalog(rows, query) {
  return rows.map((row) => ({ row, score: rank(row, query) })).filter(({ score }) => score != null)
    .sort((a, b) => a.score - b.score || normalize(a.row.name).localeCompare(normalize(b.row.name)))
    .map(({ row }) => row);
}
module.exports = { normalize, searchCatalog };
