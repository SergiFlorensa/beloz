require('dotenv').config();

const cheerio = require('cheerio');
const pool = require('../models/dbpostgre');

const RESTAURANT_NAME = 'Ramen Shifu';
const SOURCE_URL = 'https://www.ramenshifu.com/ramen-shifu-reus/';
const SOURCE_LABEL = 'Ramen Shifu Reus';
const SOURCE_MARKER = 'Fuente oficial: Ramen Shifu Reus';

const MENU_CATEGORIES = new Set([
  'ENTRANTES',
  'BAO BUN',
  'RAMEN',
  'SPICY RAMEN',
  'RAMEN VEGANO',
  'NOODLES',
  'ARROCES',
  'BEBIDAS',
  'POSTRES',
  'MENÚ DEL DÍA',
  'MENU DEL DÍA',
]);

const LEGACY_NAMES = {
  'tonkotsu ramen': ['Ramen Tonkotsu'],
  'miso ramen': ['Ramen Miso'],
  gyozas: ['Gyoza'],
  yakisoba: ['Yakisoba'],
  'chashu don': ['Chashu Don'],
};

function cleanText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTitle(title) {
  const match = cleanText(title).match(/^(.*?)\s*-\s*-\s*-\s*([0-9]+,[0-9]{2})\s*€$/);
  if (!match) return null;

  return {
    name: cleanText(match[1]),
    price: Number(match[2].replace(',', '.')),
  };
}

function normalizeImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return new URL(url, SOURCE_URL).toString();
  return url;
}

async function fetchOfficialHtml() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`${SOURCE_LABEL} respondio ${response.status}`);
  }

  return response.text();
}

function extractDishes(html) {
  const $ = cheerio.load(html);
  const dishes = [];
  let currentCategory = '';

  $('h1,h2,h3,h4,h5,.image_with_text').each((_, element) => {
    const node = $(element);

    if (node.hasClass('image_with_text')) {
      const title = cleanText(node.find('.image_with_text_title').first().text());
      if (!title.includes('€')) return;

      const parsed = parseTitle(title);
      if (!parsed || !currentCategory) return;

      const blockText = cleanText(node.closest('.q_elements_item_content').text());
      const description = cleanText(blockText.replace(title, ''));
      const image = normalizeImageUrl(node.find('img').first().attr('src'));

      if (!description || !Number.isFinite(parsed.price)) return;

      dishes.push({
        name: parsed.name,
        description,
        price: parsed.price,
        image_path: image,
        category: currentCategory,
      });
      return;
    }

    const heading = cleanText(node.text()).toUpperCase();
    if (MENU_CATEGORIES.has(heading)) {
      currentCategory = heading;
    }
  });

  const unique = new Map();
  for (const dish of dishes) {
    unique.set(dish.name.toLowerCase(), dish);
  }

  return [...unique.values()];
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
    `SELECT ${idColumn} AS restaurante_id, name FROM ${tableName} WHERE lower(name) LIKE lower($1) LIMIT 1`,
    [`%${RESTAURANT_NAME}%`]
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
  const candidates = [dishName, ...(LEGACY_NAMES[dishName.toLowerCase()] || [])];

  for (const candidate of candidates) {
    const result = await pool.query(
      `SELECT id, image_path FROM platos WHERE ${restaurantColumn} = $1 AND lower(name) = lower($2) LIMIT 1`,
      [restauranteId, candidate]
    );
    if (result.rows[0]) return result.rows[0];
  }

  return null;
}

async function upsertDish(restauranteId, restaurantColumn, dish) {
  const existing = await findExistingDish(restauranteId, restaurantColumn, dish.name);
  const imagePath = dish.image_path || existing?.image_path || null;
  const description = `${dish.description} [${dish.category}. ${SOURCE_MARKER}]`;

  if (existing) {
    await pool.query(
      `UPDATE platos
       SET name = $1, description = $2, price = $3, image_path = $4
       WHERE id = $5`,
      [dish.name, description, dish.price, imagePath, existing.id]
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

async function removeStaleDishes(restauranteId, restaurantColumn, currentNames) {
  const result = await pool.query(
    `DELETE FROM platos
     WHERE ${restaurantColumn} = $1
       AND NOT (lower(name) = ANY($2))`,
    [
      restauranteId,
      [...currentNames].map((name) => name.toLowerCase()),
    ]
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
  const dishes = extractDishes(await fetchOfficialHtml());

  if (dishes.length < 20) {
    throw new Error(`Extraccion incompleta de ${SOURCE_LABEL}: solo ${dishes.length} platos.`);
  }

  const counts = { inserted: 0, updated: 0, deleted: 0 };
  await pool.query('BEGIN');
  try {
    await syncPlatosIdSequence();
    for (const dish of dishes) {
      const status = await upsertDish(restaurant.restaurante_id, restaurantColumn, dish);
      counts[status] += 1;
    }
    counts.deleted = await removeStaleDishes(
      restaurant.restaurante_id,
      restaurantColumn,
      new Set(dishes.map((dish) => dish.name))
    );
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  console.log(
    `${restaurant.name}: ${counts.inserted} platos insertados, ${counts.updated} actualizados, ${counts.deleted} obsoletos eliminados.`
  );
  console.log(`Fuente publica: ${SOURCE_URL}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
