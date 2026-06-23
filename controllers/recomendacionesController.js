const pool = require('../models/dbpostgre');

exports.generarRecomendaciones = async (req, res) => {
  const contexto = normalizarContexto(req.body || {});

  try {
    const restaurantes = await cargarRestaurantesConPlato();
    const recomendaciones = restaurantes
      .map((restaurante) => puntuarRestaurante(restaurante, contexto))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((recomendacion, index) => formatearRecomendacion(recomendacion, index));

    if (recomendaciones.length === 0) {
      return res.status(200).json([recomendacionFallback(contexto)]);
    }

    res.status(200).json(recomendaciones);
  } catch (err) {
    console.error('Error al generar recomendaciones:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

async function cargarRestaurantesConPlato() {
  const restaurantTable = await getRestaurantTableName();
  const restaurantIdColumn = await getRestaurantIdColumn(restaurantTable);
  const platoRestaurantColumn = await getPlatosRestaurantColumn();

  const result = await pool.query(
    `SELECT
       r.${restaurantIdColumn} AS restaurante_id,
       r.name,
       r.image_path,
       r.wait_time,
       r.price_level,
       r.type_of_food,
       r.country,
       r.es_popular,
       r.logo_restaurante,
       r.relevancia,
       r.valoracion,
       p.id AS plato_id,
       p.name AS plato_name,
       p.description AS plato_description,
       p.price AS plato_price,
       p.image_path AS plato_image_path
     FROM ${restaurantTable} r
     LEFT JOIN LATERAL (
       SELECT id, name, description, price, image_path
       FROM platos
       WHERE ${platoRestaurantColumn} = r.${restaurantIdColumn}
       ORDER BY price ASC NULLS LAST, id ASC
       LIMIT 1
     ) p ON true`
  );

  return result.rows;
}

function puntuarRestaurante(restaurante, contexto) {
  const food = normalizarTexto(restaurante.type_of_food);
  const country = normalizarTexto(restaurante.country);
  const price = String(restaurante.price_level || '');
  const waitTime = Number(restaurante.wait_time || 30);
  const rating = Number(restaurante.valoracion || 0);
  const relevance = Number(restaurante.relevancia || 0);
  const razones = [];
  const etiquetas = new Set();

  let score = 0;
  score += rating * 12;
  score += relevance * 2;
  score += restaurante.es_popular ? 7 : 0;
  score += Math.max(0, 20 - waitTime) * 0.8;

  if (waitTime <= 12) {
    score += 6;
    razones.push('rapido para pedir sin esperar mucho');
    etiquetas.add('rapido');
  }

  if (contexto.momento === 'mediodia' && contexto.tipoDia === 'laborable') {
    if (waitTime <= 15) score += 12;
    if (esEconomico(price)) score += 7;
    if (contieneAlguno(food, ['poke', 'kebab', 'hamburguesa', 'bocadillo', 'pizza'])) score += 8;
    razones.push('encaja con una pausa de mediodia entre semana');
    etiquetas.add('mediodia');
  }

  if (contexto.momento === 'noche') {
    if (contieneAlguno(food, ['sushi', 'pizza', 'mexicana', 'tapas', 'gastro', 'asiatica'])) score += 10;
    if (rating >= 4.2) score += 8;
    razones.push('buena opcion para cerrar el dia con algo mas especial');
    etiquetas.add('noche');
  }

  if (contexto.tipoDia === 'fin_de_semana') {
    if (contieneAlguno(food, ['sushi', 'mexicana', 'pizza', 'argentina', 'tapas', 'gastro'])) score += 9;
    razones.push('tiene perfil de plan de fin de semana');
    etiquetas.add('plan');
  }

  if (contexto.momento === 'tarde') {
    if (contieneAlguno(food, ['poke', 'sushi', 'empanadas', 'bocadillo', 'tapas'])) score += 7;
    if (waitTime <= 20) score += 4;
    razones.push('funciona bien para una comida ligera de tarde');
    etiquetas.add('tarde');
  }

  if (contexto.clima === 'lluvia' || contexto.clima === 'frio') {
    if (contieneAlguno(food, ['ramen', 'asiatica', 'india', 'kebab', 'pizza'])) score += 14;
    razones.push('el clima pide algo caliente y reconfortante');
    etiquetas.add('confort');
  }

  if (contexto.clima === 'soleado') {
    if (contieneAlguno(food, ['poke', 'sushi', 'ceviche', 'mexicana', 'tapas'])) score += 8;
    razones.push('apetece algo fresco o facil de compartir');
    etiquetas.add('fresco');
  }

  for (const preferencia of contexto.perfil.topTiposComida) {
    const preferenciaNormalizada = normalizarTexto(preferencia.clave);
    if (preferenciaNormalizada && (food.includes(preferenciaNormalizada) || preferenciaNormalizada.includes(food))) {
      score += preferencia.conteo * 4;
      razones.unshift(`se parece a tu gusto habitual por ${preferencia.clave}`);
      etiquetas.add('personalizado');
      break;
    }
  }

  for (const preferencia of contexto.perfil.topRangosPrecio) {
    if (String(preferencia.clave || '') === price) {
      score += preferencia.conteo * 2;
      razones.unshift('respeta el rango de precio que sueles elegir');
      etiquetas.add('precio');
      break;
    }
  }

  for (const preferencia of contexto.perfil.topRestaurantes) {
    if (String(preferencia.clave || '') === String(restaurante.restaurante_id)) {
      score += preferencia.conteo * 7;
      razones.unshift('ya forma parte de tus elecciones frecuentes');
      etiquetas.add('favorito');
      break;
    }
  }

  if (contieneAlguno(food, ['sushi'])) etiquetas.add('sushi');
  if (contieneAlguno(food, ['pizza'])) etiquetas.add('pizza');
  if (contieneAlguno(food, ['hamburguesa', 'americana'])) etiquetas.add('burger');
  if (contieneAlguno(food, ['asiatica', 'ramen'])) etiquetas.add('asiatica');
  if (country) etiquetas.add(restaurante.country);

  return {
    ...restaurante,
    score: Number(score.toFixed(2)),
    razones: limpiarRazones(razones),
    etiquetas: Array.from(etiquetas).slice(0, 4)
  };
}

function formatearRecomendacion(recomendacion, index) {
  const plato = recomendacion.plato_name;
  const precioPlato = recomendacion.plato_price ? `${Number(recomendacion.plato_price).toFixed(2)} EUR` : null;
  const descripcionPlato = recomendacion.plato_description || recomendacion.type_of_food;
  const motivo = recomendacion.razones[0] || 'equilibra valoracion, rapidez y relevancia en Beloz';

  return {
    titulo: index === 0 ? `Ahora pediria en ${recomendacion.name}` : recomendacion.name,
    descripcion: plato
      ? `${plato}${precioPlato ? ` (${precioPlato})` : ''}. ${descripcionPlato}`
      : `Restaurante de ${recomendacion.type_of_food} con valoracion ${recomendacion.valoracion}.`,
    etiquetas: recomendacion.etiquetas,
    motivo,
    restaurante_id: recomendacion.restaurante_id,
    restaurante_nombre: recomendacion.name,
    image_path: recomendacion.plato_image_path || recomendacion.image_path,
    price_level: recomendacion.price_level,
    wait_time: recomendacion.wait_time,
    type_of_food: recomendacion.type_of_food,
    country: recomendacion.country,
    valoracion: Number(recomendacion.valoracion || 0),
    score: recomendacion.score
  };
}

function recomendacionFallback(contexto) {
  return {
    titulo: 'Explora algo nuevo',
    descripcion: 'Prueba restaurantes con buena valoracion y tiempos de espera bajos.',
    etiquetas: ['explorar'],
    motivo: contexto.momento === 'noche'
      ? 'es buen momento para descubrir un sitio con mas calma'
      : 'Beloz no encontro datos suficientes para personalizar mas'
  };
}

function normalizarContexto(body) {
  return {
    momento: normalizarEnum(body.momento_del_dia || body.momentoDelDia),
    tipoDia: normalizarEnum(body.tipo_de_dia || body.tipoDeDia),
    diaSemana: normalizarEnum(body.dia_de_la_semana || body.diaDeLaSemana),
    clima: normalizarEnum(body.clima?.estado || body.clima),
    perfil: normalizarPerfil(body.perfil_sabor || body.perfilSabor || {})
  };
}

function normalizarPerfil(perfil) {
  return {
    totalEventos: Number(perfil.total_eventos || perfil.totalEventos || 0),
    topTiposComida: normalizarConteos(perfil.top_tipos_comida || perfil.topTiposComida),
    topRangosPrecio: normalizarConteos(perfil.top_rangos_precio || perfil.topRangosPrecio),
    topRestaurantes: normalizarConteos(perfil.top_restaurantes || perfil.topRestaurantes)
  };
}

function normalizarConteos(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      clave: String(item.clave || item.key || ''),
      conteo: Number(item.conteo || item.count || 0)
    }))
    .filter((item) => item.clave && item.conteo > 0)
    .slice(0, 5);
}

function normalizarEnum(value) {
  return normalizarTexto(value).replace(/_/g, '_');
}

function normalizarTexto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function contieneAlguno(texto, tokens) {
  return tokens.some((token) => texto.includes(token));
}

function esEconomico(price) {
  const value = String(price || '').trim();
  const euroCount = (value.match(/€/g) || []).length;
  if (euroCount > 0) return euroCount === 1;

  const compactValue = value.replace(/\s/g, '');
  return compactValue.length <= 1 || compactValue === '?';
}

function limpiarRazones(razones) {
  const seen = new Set();
  return razones.filter((razon) => {
    if (!razon || seen.has(razon)) return false;
    seen.add(razon);
    return true;
  });
}

async function getRestaurantTableName() {
  const result = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('restaurante', 'restaurantes')
     ORDER BY CASE table_name
       WHEN 'restaurante' THEN 1
       WHEN 'restaurantes' THEN 2
     END
     LIMIT 1`
  );

  return result.rows[0]?.table_name || 'restaurante';
}

async function getRestaurantIdColumn(tableName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = $1
       AND column_name IN ('restaurante_id', 'id')
     ORDER BY CASE column_name
       WHEN 'restaurante_id' THEN 1
       WHEN 'id' THEN 2
     END
     LIMIT 1`,
    [tableName]
  );

  return result.rows[0]?.column_name || 'restaurante_id';
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
