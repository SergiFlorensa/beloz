require('dotenv').config();

const cheerio = require('cheerio');
const pool = require('../models/dbpostgre');

const RESTAURANT_NAME = 'Casanova Pizza & Empanadas Argentinas';
const SOURCE_URL = 'https://pizza-casanova-reus.es/';
const SOURCE_MARKER = 'Fuente oficial: Pizza Casanova Reus';

const CATEGORY_IMAGE_FALLBACKS = {
  oferta: 'pepepizza.png',
  ofertas: 'pepepizza.png',
  complementos: 'patatas_bravas.jpg',
  empanadas: 'empanada_criolla.jpg',
  pizzas: 'pizza_margherita.jpg',
  veganas: 'vegepizza.jpeg',
  helados: 'mcflurry.png',
  bebidas: 'bebida_yogur.png',
};

const NAME_IMAGE_FALLBACKS = [
  { pattern: /empanada.*carne/i, image: 'empanada_carne.jpg' },
  { pattern: /empanada.*pollo/i, image: 'empanada_pollo.jpg' },
  { pattern: /empanada.*jam[oó]n|jam[oó]n.*queso/i, image: 'empanada_jamon_queso.jpg' },
  { pattern: /empanada.*espinaca/i, image: 'empanada_espinaca.jpg' },
  { pattern: /empanada.*caprese/i, image: 'empanada_caprese.jpg' },
  { pattern: /barbacoa|bbq/i, image: 'pizza_barbacoa.jpg' },
  { pattern: /margarita|margherita/i, image: 'pizza_margherita.jpg' },
  { pattern: /vegana|vegetal|verdura/i, image: 'vegepizza.jpeg' },
  { pattern: /nugget/i, image: 'nuggets_pollo.jpg' },
  { pattern: /patata/i, image: 'patatas_bravas.jpg' },
];

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

function parsePrice(rawPrice) {
  const normalized = cleanText(rawPrice)
    .replace(/[^\d,.-]/g, '')
    .replace('.', '')
    .replace(',', '.');
  const price = Number(normalized);
  return Number.isFinite(price) ? price : null;
}

async function extractOfficialDishes() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${SOURCE_URL}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const dishes = [];

  $('.menu__category').each((_, categoryElement) => {
    const category = cleanText($(categoryElement).find('.menu__category-name').first().text());
    if (!category) return;

    const productList = $(categoryElement).find('.menu__product-list').first();
    const children = productList.children().toArray();

    for (let index = 0; index < children.length; index += 1) {
      const productElement = children[index];
      const name = cleanText($(productElement).find('.menu__product-name').first().text());
      if (!name) continue;

      const description = cleanText($(productElement).find('.menu__product-description').first().text());
      const price = parsePrice($(children[index + 1]).text());
      if (!Number.isFinite(price) || price <= 0 || price > 60) continue;

      dishes.push({
        name,
        description: description || `${category} de ${RESTAURANT_NAME}`,
        price,
        category,
        image_path: imageForDish(name, category),
      });
    }
  });

  const unique = new Map();
  for (const dish of dishes) {
    unique.set(normalizeKey(dish.name), dish);
  }
  return [...unique.values()];
}

function imageForDish(name, category) {
  const nameMatch = NAME_IMAGE_FALLBACKS.find((item) => item.pattern.test(name));
  if (nameMatch) return nameMatch.image;

  const categoryKey = normalizeKey(category);
  const categoryMatch = Object.entries(CATEGORY_IMAGE_FALLBACKS).find(([key]) => categoryKey.includes(key));
  return categoryMatch?.[1] || 'casanova_logo.jpg';
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

async function findExistingDish(restauranteId, restaurantColumn, dishName) {
  const result = await pool.query(
    `SELECT id, image_path FROM platos WHERE ${restaurantColumn} = $1 AND lower(name) = lower($2) LIMIT 1`,
    [restauranteId, dishName]
  );
  return result.rows[0] || null;
}

async function upsertDish(restauranteId, restaurantColumn, dish) {
  const existing = await findExistingDish(restauranteId, restaurantColumn, dish.name);
  const imagePath = dish.image_path || existing?.image_path || imageForDish(dish.name, dish.category);
  const description = `${dish.description} [${dish.category}. ${SOURCE_MARKER}]`;

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

  const counts = { inserted: 0, updated: 0 };
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
