const pool = require('../models/dbpostgre');

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma3:12b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 12000);

exports.responderChat = async (req, res) => {
  const message = String(req.body?.message || '').trim();

  if (!message) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }

  try {
    const catalogo = await cargarCatalogo();
    const contexto = {
      message,
      perfil: normalizarPerfil(req.body?.perfil_sabor || req.body?.perfilSabor || {}),
      contextoApp: req.body?.contexto || {}
    };

    const respuestaReglas = generarRespuestaPorReglas(contexto, catalogo);
    const respuestaOllama = await generarRespuestaConOllama(contexto, catalogo, respuestaReglas);

    res.status(200).json(respuestaOllama || respuestaReglas);
  } catch (err) {
    console.error('Error en chat Beloz:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

async function generarRespuestaConOllama(contexto, catalogo, fallback) {
  if (!debeUsarOllama()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${ollamaUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.35,
          num_predict: 420
        },
        prompt: construirPrompt(contexto, catalogo, fallback)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama respondio ${response.status}`);
    }

    const data = await response.json();
    const parsed = parseJsonSeguro(data.response);
    if (!parsed?.respuesta) return null;

    return {
      provider: 'ollama',
      respuesta: String(parsed.respuesta).slice(0, 900),
      accion: normalizarAccion(parsed.accion),
      sugerencias: normalizarSugerencias(parsed.sugerencias, catalogo).slice(0, 3)
    };
  } catch (err) {
    console.warn('Ollama no disponible, usando fallback:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function construirPrompt(contexto, catalogo, fallback) {
  const restaurantes = catalogo.restaurantes.slice(0, 28).map((item) => ({
    restaurante_id: item.restaurante_id,
    name: item.name,
    type_of_food: item.type_of_food,
    price_level: item.price_level,
    wait_time: item.wait_time,
    valoracion: item.valoracion,
    plato: item.plato_name,
    plato_price: item.plato_price
  }));

  const perfil = {
    top_tipos_comida: contexto.perfil.topTiposComida,
    top_rangos_precio: contexto.perfil.topRangosPrecio,
    top_restaurantes: contexto.perfil.topRestaurantes
  };

  return [
    'Eres Beloz AI, un asistente gastronomico local dentro de una app de comida.',
    'Responde en espanol, con tono claro, directo y util. No inventes restaurantes fuera del catalogo.',
    'Tu objetivo es ayudar a decidir que pedir, elegir restaurante, comparar opciones o proponer planes.',
    'Devuelve SOLO JSON valido con esta forma:',
    '{"respuesta":"texto breve","accion":"recommend|compare|search|general","sugerencias":[{"restaurante_id":1,"motivo":"por que encaja"}]}',
    `Mensaje del usuario: ${contexto.message}`,
    `Perfil local anonimo: ${JSON.stringify(perfil)}`,
    `Catalogo disponible: ${JSON.stringify(restaurantes)}`,
    `Fallback si dudas: ${JSON.stringify(fallback)}`
  ].join('\n');
}

function generarRespuestaPorReglas(contexto, catalogo) {
  const terms = normalizarTexto(contexto.message);
  const presupuesto = extraerPresupuesto(terms);
  const preferidos = contexto.perfil.topTiposComida.map((item) => normalizarTexto(item.clave));

  const scored = catalogo.restaurantes
    .map((item) => {
      const text = normalizarTexto([
        item.name,
        item.type_of_food,
        item.country,
        item.plato_name,
        item.plato_description
      ].join(' '));
      let score = Number(item.valoracion || 0) * 10 + Number(item.relevancia || 0);

      for (const token of terms.split(/\s+/).filter((t) => t.length > 2)) {
        if (text.includes(token)) score += 9;
      }

      for (const tipo of preferidos) {
        if (tipo && text.includes(tipo)) score += 10;
      }

      if (presupuesto && Number(item.plato_price || 99) <= presupuesto) score += 12;
      if (terms.includes('rapido') || terms.includes('prisa')) {
        score += Math.max(0, 18 - Number(item.wait_time || 30));
      }
      if (terms.includes('barato') || terms.includes('economico')) {
        score += esPrecioBajo(item.price_level) ? 12 : 0;
      }
      if (terms.includes('ligero')) {
        if (contieneAlguno(text, ['poke', 'sushi', 'ensalada', 'ceviche'])) score += 12;
      }
      if (terms.includes('caliente') || terms.includes('frio') || terms.includes('lluvia')) {
        if (contieneAlguno(text, ['ramen', 'curry', 'pizza', 'kebab', 'india'])) score += 12;
      }

      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const sugerencias = scored.map((item) => ({
    restaurante_id: item.restaurante_id,
    restaurante_nombre: item.name,
    image_path: item.plato_image_path || item.image_path,
    plato: item.plato_name,
    price: item.plato_price ? Number(item.plato_price) : null,
    wait_time: item.wait_time,
    type_of_food: item.type_of_food,
    motivo: construirMotivo(item, terms)
  }));

  const respuesta = construirRespuestaTexto(contexto.message, sugerencias);

  return {
    provider: 'rules',
    respuesta,
    accion: sugerencias.length ? 'recommend' : 'general',
    sugerencias
  };
}

function construirRespuestaTexto(message, sugerencias) {
  if (!sugerencias.length) {
    return 'No he encontrado una opcion clara con los datos actuales. Prueba a decirme presupuesto, tipo de comida o si tienes prisa.';
  }

  const primera = sugerencias[0];
  const plato = primera.plato ? ` y pediria ${primera.plato}` : '';
  return `Para "${message}", mi primera opcion seria ${primera.restaurante_nombre}${plato}. ${primera.motivo}`;
}

function construirMotivo(item, terms) {
  if (terms.includes('rapido') || terms.includes('prisa')) {
    return `tiene una espera aproximada de ${item.wait_time} min`;
  }
  if (terms.includes('barato') || terms.includes('economico')) {
    return `encaja con un pedido de precio contenido (${item.price_level || 'sin nivel'})`;
  }
  if (item.plato_name && item.plato_price) {
    return `destaca por ${item.plato_name} por ${Number(item.plato_price).toFixed(2)} EUR`;
  }
  return `combina buena valoracion (${item.valoracion}) y comida ${item.type_of_food}`;
}

async function cargarCatalogo() {
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
       LIMIT 2
     ) p ON true
     ORDER BY r.valoracion DESC NULLS LAST, r.relevancia DESC NULLS LAST`
  );

  return { restaurantes: result.rows };
}

function normalizarSugerencias(items, catalogo) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const restauranteId = Number(item.restaurante_id);
      const match = catalogo.restaurantes.find((restaurante) => Number(restaurante.restaurante_id) === restauranteId);
      if (!match) return null;

      return {
        restaurante_id: match.restaurante_id,
        restaurante_nombre: match.name,
        image_path: match.plato_image_path || match.image_path,
        plato: match.plato_name,
        price: match.plato_price ? Number(match.plato_price) : null,
        wait_time: match.wait_time,
        type_of_food: match.type_of_food,
        motivo: String(item.motivo || '').slice(0, 180) || construirMotivo(match, '')
      };
    })
    .filter(Boolean);
}

function normalizarPerfil(perfil) {
  return {
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

function debeUsarOllama() {
  return process.env.AI_PROVIDER === 'ollama' || process.env.OLLAMA_ENABLED === 'true';
}

function ollamaUrl() {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
}

function parseJsonSeguro(value) {
  try {
    return JSON.parse(String(value || '').trim());
  } catch (err) {
    return null;
  }
}

function normalizarAccion(value) {
  const allowed = new Set(['recommend', 'compare', 'search', 'general']);
  return allowed.has(value) ? value : 'general';
}

function extraerPresupuesto(text) {
  const match = text.match(/(\d{1,3})(?:\s?eur|\s?euro|\s?€)?/);
  return match ? Number(match[1]) : null;
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

function esPrecioBajo(price) {
  const value = String(price || '').trim();
  const euroCount = (value.match(/€/g) || []).length;
  if (euroCount > 0) return euroCount === 1;
  return value.length <= 1 || value === '?';
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
