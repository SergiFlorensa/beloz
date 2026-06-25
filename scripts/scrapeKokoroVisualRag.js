require('dotenv').config();

const cheerio = require('cheerio');
const pool = require('../models/dbpostgre');

const RESTAURANT_NAME = 'Kokoro';
const SOURCE_URL = 'https://kokororestaurant.es/carta-restaurant/';
const SOURCE_MARKER = 'Fuente oficial: Kokoro Reus';

const CATEGORY_IMAGE_FALLBACKS = {
  'entrants freds': 'sushi_rolls.png',
  'entrants calents': 'gyoza.png',
  niguiris: 'sushi_nigiri.png',
  makis: 'sushi_rolls.png',
  sashimi: 'sushi_nigiri.png',
  rolls: 'california_roll.png',
  tempura: 'tempura_verduras.png',
  kumiawases: 'sushi_rolls.png',
  'plats calents': 'ramen.png',
};

function cleanText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizePrice(rawPrice) {
  const matches = cleanText(rawPrice).match(/\d+(?:[,.]\d+)?/g);
  if (!matches?.length) return null;
  const firstPrice = Number(matches[0].replace(',', '.'));
  return Number.isFinite(firstPrice) ? firstPrice : null;
}

function isAllergenImage(image) {
  return /(Alergens|Soja|Ous|Fruits|Llet|Apte|celiac|alergia)/i.test(
    `${image.src || ''} ${image.className || ''} ${image.alt || ''}`
  );
}

function categoryImage($, toggleElement, category) {
  const officialImage = $(toggleElement)
    .find('img')
    .map((_, image) => ({
      src: $(image).attr('src'),
      alt: $(image).attr('alt'),
      className: $(image).attr('class'),
    }))
    .get()
    .find((image) => image.src && !isAllergenImage(image));

  if (officialImage?.src) return officialImage.src;

  const normalizedCategory = normalizeKey(category);
  const fallback = Object.entries(CATEGORY_IMAGE_FALLBACKS).find(([key]) => normalizedCategory.includes(key));
  return fallback?.[1] || 'kokoro.jpg';
}

async function extractOfficialDishes() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${SOURCE_URL}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const rawDishes = [];

  $('.toggle').each((_, toggleElement) => {
    const category = cleanText($(toggleElement).find('.toggle-title .toggle-heading').first().text());
    if (!category) return;

    const imagePath = categoryImage($, toggleElement, category);
    $(toggleElement).find('.nectar_food_menu_item').each((__, itemElement) => {
      const name = cleanText($(itemElement).find('.item_name h3').first().text());
      const rawPrice = cleanText($(itemElement).find('.item_price h3').first().text());
      const price = normalizePrice(rawPrice);
      if (!name || !Number.isFinite(price) || price <= 0 || price > 80) return;

      const description = cleanText($(itemElement).find('.item_description').first().text());
      rawDishes.push({
        sourceName: name,
        name,
        category,
        rawPrice,
        price,
        description,
        image_path: imagePath,
      });
    });
  });

  const nameCounts = rawDishes.reduce((acc, dish) => {
    const key = normalizeKey(dish.sourceName);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const unique = new Map();
  for (const dish of rawDishes) {
    const duplicated = nameCounts[normalizeKey(dish.sourceName)] > 1;
    const displayName = duplicated ? `${dish.sourceName} (${shortCategory(dish.category)})` : dish.sourceName;
    unique.set(`${normalizeKey(displayName)}|${normalizeKey(dish.category)}`, {
      ...dish,
      name: displayName,
    });
  }

  return [...unique.values()];
}

function shortCategory(category) {
  return cleanText(category)
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/^Sushi\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getRestaurant() {
  const tableResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('restaurante', 'restaurantes')
    ORDER BY CASE table_name WHEN 'restaurante' THEN 1 ELSE 2 END
    LIMIT 1
  `);
  const tableName = tableResult.rows[0]?.table_name || 'restaurante';
  const idColumn = tableName === 'restaurantes' ? 'id' : 'restaurante_id';
  const result = await pool.query(
    `SELECT ${idColumn} AS restaurante_id, name FROM ${tableName} WHERE lower(name) = lower($1) LIMIT 1`,
    [RESTAURANT_NAME]
  );
  if (!result.rows[0]) {
    throw new Error(`${RESTAURANT_NAME} no existe en la tabla ${tableName}. No se inserta nada.`);
  }
  return result.rows[0];
}

async function getPlatosRestaurantColumn() {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'platos'
      AND column_name IN ('restaurantid', 'restaurante_id')
    ORDER BY CASE column_name WHEN 'restaurantid' THEN 1 ELSE 2 END
    LIMIT 1
  `);
  return result.rows[0]?.column_name || 'restaurantid';
}

async function findExistingDish(restauranteId, restaurantColumn, dish) {
  const result = await pool.query(
    `SELECT id, image_path
     FROM platos
     WHERE ${restaurantColumn} = $1
       AND lower(name) = lower($2)
       AND description ILIKE $3
     LIMIT 1`,
    [restauranteId, dish.name, `%[${dish.category}. ${SOURCE_MARKER}]%`]
  );
  return result.rows[0] || null;
}

async function upsertDish(restauranteId, restaurantColumn, dish) {
  const existing = await findExistingDish(restauranteId, restaurantColumn, dish);
  const priceNote = dish.rawPrice.includes('/') ? ` Precio oficial: ${dish.rawPrice}.` : '';
  const baseDescription = dish.description || `${dish.category} de ${RESTAURANT_NAME}.`;
  const description = `${baseDescription}${priceNote} [${dish.category}. ${SOURCE_MARKER}]`;
  const imagePath = dish.image_path || existing?.image_path || 'kokoro.jpg';

  if (existing) {
    await pool.query(
      `UPDATE platos
       SET description = $1, price = $2, image_path = $3
       WHERE id = $4`,
      [description, dish.price, imagePath, existing.id]
    );
    return 'updated';
  }

  await pool.query(
    `INSERT INTO platos (name, description, price, image_path, ${restaurantColumn})
     VALUES ($1, $2, $3, $4, $5)`,
    [dish.name, description, dish.price, imagePath, restauranteId]
  );
  return 'inserted';
}

async function deleteLegacyDishes(restauranteId, restaurantColumn) {
  const result = await pool.query(
    `DELETE FROM platos
     WHERE ${restaurantColumn} = $1
       AND (description IS NULL OR description NOT ILIKE $2)`,
    [restauranteId, `%${SOURCE_MARKER}%`]
  );
  return result.rowCount || 0;
}

async function syncPlatosIdSequence() {
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('platos', 'id'),
      COALESCE((SELECT MAX(id) FROM platos), 0) + 1,
      false
    )
  `);
}

async function main() {
  const restaurant = await getRestaurant();
  const restaurantColumn = await getPlatosRestaurantColumn();
  const dishes = await extractOfficialDishes();

  if (dishes.length === 0) {
    throw new Error(`No se extrajeron platos desde ${SOURCE_URL}`);
  }

  const counts = { inserted: 0, updated: 0, deletedLegacy: 0 };
  await pool.query('BEGIN');
  try {
    await syncPlatosIdSequence();
    counts.deletedLegacy = await deleteLegacyDishes(restaurant.restaurante_id, restaurantColumn);
    for (const dish of dishes) {
      const status = await upsertDish(restaurant.restaurante_id, restaurantColumn, dish);
      counts[status] += 1;
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  console.log(
    `${restaurant.name}: ${counts.inserted} platos insertados, ${counts.updated} actualizados, ${counts.deletedLegacy} antiguos eliminados desde carta oficial.`
  );
  console.log(`Fuente: ${SOURCE_URL}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
