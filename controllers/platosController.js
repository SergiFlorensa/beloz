const pool = require('../models/dbpostgre');

const CATEGORY_ORDER = [
  'Entrantes',
  'Ensaladas',
  'Sopas',
  'Woks',
  'Curry',
  'Pasta',
  'Arroz',
  'Especialidades',
  'Oferta 2x1',
  'Ofertas',
  'Complementos',
  'Empanadas Argentinas',
  'Pizzas',
  'Pizzas Veganas con Mözza Väcka',
  'Helados',
  'BAO BUN',
  'RAMEN',
  'SPICY RAMEN',
  'RAMEN VEGANO',
  'NOODLES',
  'ARROCES',
  'POSTRES',
  'BEBIDAS',
];

exports.getPlatosPorRestaurante = async (req, res) => {
  const restauranteId = req.params.id || req.query.restauranteId || req.query.restaurante_id;

  if (!restauranteId) {
    return res.status(400).json({ error: 'El ID del restaurante es requerido' });
  }

  try {
    const restaurantColumn = await getPlatosRestaurantColumn();
    const result = await pool.query(
      `SELECT id, name, description, price, image_path, ${restaurantColumn} AS restaurante_id
       FROM platos
       WHERE ${restaurantColumn} = $1`,
      [restauranteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron platos para el restaurante especificado.' });
    }

    const rows = result.rows
      .map((row) => ({
        ...row,
        category: extractCategory(row.description),
        description: cleanDescription(row.description),
      }))
      .sort((a, b) => {
        const categoryDiff = categoryRank(a.category) - categoryRank(b.category);
        return categoryDiff || Number(a.id) - Number(b.id);
      });

    res.status(200).json(rows);
  } catch (err) {
    console.error('Error al cargar platos:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function extractCategory(description) {
  const match = String(description || '').match(/\[([^\].]+)\.\s*Fuente oficial:/i);
  return match?.[1]?.trim() || 'Carta';
}

function cleanDescription(description) {
  return String(description || '')
    .replace(/\s*\[[^\]]*Fuente oficial:[^\]]*\]\s*$/i, '')
    .trim();
}

function categoryRank(category) {
  const index = CATEGORY_ORDER.findIndex((item) => item.toLowerCase() === String(category || '').toLowerCase());
  return index === -1 ? CATEGORY_ORDER.length : index;
}

async function getPlatosRestaurantColumn() {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'platos'
       AND column_name IN ('restaurantid', 'restaurante_id')
     ORDER BY CASE column_name
       WHEN 'restaurantid' THEN 1
       WHEN 'restaurante_id' THEN 2
     END
     LIMIT 1`
  );

  return result.rows[0]?.column_name || 'restaurantid';
}
