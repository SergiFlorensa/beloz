require('dotenv').config();

const { PDFParse } = require('pdf-parse');
const pool = require('../models/dbpostgre');

const RESTAURANT_NAME = 'Little Bangkok';
const PDF_URL = 'https://littlebangkok.cat/wp-content/uploads/2025/12/LA-CARTA-DE-LITTLE-BANGKOK.pdf';
const HOME_URL = 'https://littlebangkok.cat/';

const OFFICIAL_IMAGES = {
  'curry verde': 'https://littlebangkok.cat/wp-content/uploads/2020/05/cropped-Curry-Verde-Xavier-Vicheto-7.png',
  'pad hoy lai': 'https://littlebangkok.cat/wp-content/uploads/2020/05/cropped-Foto-Clientes-Isabel-G-Almejas-3.jpg',
};

const CATEGORY_IMAGE_FALLBACKS = {
  entrantes: 'spring_rolls.png',
  ensaladas: 'spring_rolls.png',
  sopas: 'tom_yum_soup.png',
  woks: 'pad_thai.png',
  curry: 'green_curry.png',
  pasta: 'pad_thai.png',
  arroz: 'pad_thai.png',
  especialidades: 'pad_thai.png',
  postres: 'mango_sticky_rice.png',
};

const LEGACY_NAMES = {
  'pho pia thod': ['Spring Rolls'],
  'tom yam kung': ['Tom Yum Soup'],
  'curry verde': ['Green Curry'],
  'kaoniau ma muang': ['Mango Sticky Rice'],
};

function cleanLine(line) {
  return String(line || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function cleanDescription(text) {
  return cleanLine(text)
    .replace(/\bd e\b/g, 'de')
    .replace(/\ba base de tres hierb as\b/g, 'a base de tres hierbas')
    .replace(/\bBangk ok\b/g, 'Bangkok')
    .replace(/\bcacahuete s\b/g, 'cacahuetes')
    .replace(/\bfr esas\b/g, 'fresas')
    .replace(/\bleche de coco\b/g, 'leche de coco');
}

function normalizePrice(raw) {
  let value = String(raw || '')
    .replace(/\s+/g, '')
    .replace(/\.+/g, ',')
    .replace(/,+/g, ',');

  let [euros, cents = '00'] = value.split(',');

  if (/^(\d)\1(\d)\2$/.test(euros)) {
    euros = euros[0] + euros[2];
  } else if (euros.length === 3 && euros[0] === euros[1]) {
    euros = euros.slice(1);
  } else if (
    euros.length === 2 &&
    euros[0] === euros[1] &&
    Number(euros) >= 33
  ) {
    euros = euros[0];
  }

  if (cents.length === 4 && cents[0] === cents[1] && cents[2] === cents[3]) {
    cents = cents[0] + cents[2];
  }
  if (cents.length > 2) cents = cents.slice(0, 2);

  return Number(`${euros}.${cents.padEnd(2, '0')}`);
}

function detectSection(line, currentSection) {
  const normalized = line.toUpperCase();
  if (normalized.startsWith('ENTRANTES /')) return 'Entrantes';
  if (normalized.startsWith('ENSALADAS /')) return 'Ensaladas';
  if (normalized.startsWith('SOPAS /')) return 'Sopas';
  if (normalized === 'WOKS') return 'Woks';
  if (normalized === 'CURRY') return 'Curry';
  if (normalized === 'PASTA' || normalized.startsWith('PASTA /')) return 'Pasta';
  if (normalized.startsWith('ARROZ /')) return 'Arroz';
  if (normalized.startsWith('ESPECIALIDADES')) return 'Especialidades';
  if (normalized.startsWith('POSTRES /')) return 'Postres';
  if (normalized.startsWith('VINOS /')) return 'STOP';
  return currentSection;
}

function isProductLine(line) {
  return /^(\d+[A-Z]?)\s+(.+?)\s+([0-9][0-9,.]*[0-9])$/.test(line);
}

function extractDescription(lines, startIndex) {
  const parts = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || isProductLine(line)) break;
    if (detectSection(line, '') && !/^[a-záéíóúñü]/.test(line)) break;

    if (parts.length === 0) {
      parts.push(line);
      continue;
    }

    if (/^[a-záéíóúñü]/.test(line)) {
      parts.push(line);
      continue;
    }
    break;
  }
  return cleanDescription(parts.join(' '));
}

function addManualVariablePriceDishes(dishes) {
  dishes.push({
    source_number: '50',
    name: 'Curry Verde',
    description:
      'Curry verde Thai con berenjena y albahaca. Precio base con pollo, cerdo o ternera; tambien disponible con tofu, langostinos o pato.',
    price: 14.5,
    image_path: OFFICIAL_IMAGES['curry verde'],
    category: 'Curry',
  });
}

async function extractOfficialDishes() {
  const parser = new PDFParse({ url: PDF_URL });
  const result = await parser.getText();
  await parser.destroy();

  const lines = result.text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !/^-- \d+ of \d+ --$/.test(line));

  const productRegex = /^(\d+[A-Z]?)\s+(.+?)\s+([0-9][0-9,.]*[0-9])$/;
  const dishes = [];
  let section = '';

  for (let index = 0; index < lines.length; index += 1) {
    section = detectSection(lines[index], section);
    if (section === 'STOP') break;

    const match = lines[index].match(productRegex);
    if (!match || !section) continue;

    const [, sourceNumber, name, rawPrice] = match;
    const price = normalizePrice(rawPrice);
    if (!Number.isFinite(price) || price <= 0 || price > 40) continue;

    const description = extractDescription(lines, index + 1);
    if (!description || description.length < 8) continue;

    dishes.push({
      source_number: sourceNumber,
      name: cleanLine(name),
      description,
      price,
      image_path: OFFICIAL_IMAGES[cleanLine(name).toLowerCase()] || null,
      category: section,
    });
  }

  addManualVariablePriceDishes(dishes);

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
  const imagePath = dish.image_path || existing?.image_path || imageFallbackForCategory(dish.category);
  const description = `${dish.description} [${dish.category}. Fuente oficial: Little Bangkok]`;

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

function imageFallbackForCategory(category) {
  return CATEGORY_IMAGE_FALLBACKS[String(category || '').toLowerCase()] || 'littlebangkok.jpg';
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

  const counts = { inserted: 0, updated: 0 };
  await pool.query('BEGIN');
  try {
    await syncPlatosIdSequence();
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
    `${restaurant.name}: ${counts.inserted} platos insertados, ${counts.updated} actualizados desde carta oficial.`
  );
  console.log(`Fuentes: ${PDF_URL} | ${HOME_URL}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
