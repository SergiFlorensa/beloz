const pool = require('../models/dbpostgre');

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma3:1b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 12000);
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 1024);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 120);
const OLLAMA_NUM_THREAD = Number(process.env.OLLAMA_NUM_THREAD || 4);
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';
const AI_RESPONSE_MODE = String(process.env.AI_RESPONSE_MODE || 'balanced').toLowerCase();
const CATALOG_CACHE_TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS || 300000);
const TEMPLATE_CACHE_TTL_MS = Number(process.env.TEMPLATE_CACHE_TTL_MS || 300000);

let catalogoCache = null;
let plantillasCache = null;

exports.responderChat = async (req, res) => {
  const message = String(req.body?.message || '').trim();

  if (!message) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }

  try {
    if (esPreguntaFueraDeDominio(message)) {
      const plantillas = await cargarPlantillasRespuesta();
      return res.status(200).json(respuestaFueraDeDominio(plantillas, message));
    }

    const catalogo = await cargarCatalogo();
    const plantillas = await cargarPlantillasRespuesta();
    const contexto = {
      message,
      perfil: normalizarPerfil(req.body?.perfil_sabor || req.body?.perfilSabor || {}),
      contextoApp: req.body?.contexto || {}
    };

    const respuestaReglas = generarRespuestaPorReglas(contexto, catalogo, plantillas);
    if (debeResponderConMotorRapido(contexto, respuestaReglas)) {
      return res.status(200).json({ ...respuestaReglas, provider: 'rules_fast' });
    }

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
        raw: true,
        think: false,
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          temperature: 0.1,
          top_k: 20,
          top_p: 0.75,
          num_ctx: OLLAMA_NUM_CTX,
          num_predict: OLLAMA_NUM_PREDICT,
          num_thread: OLLAMA_NUM_THREAD
        },
        prompt: construirPromptRapido(contexto, catalogo, fallback)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama respondio ${response.status}`);
    }

    const data = await response.json();
    const parsed = parseJsonSeguro(data.response);
    if (!parsed?.respuesta) return null;

    const sugerencias = normalizarSugerencias(parsed.sugerencias, catalogo).slice(0, 3);

    return {
      provider: 'ollama',
      respuesta: String(parsed.respuesta).slice(0, 900),
      accion: normalizarAccion(parsed.accion),
      sugerencias: sugerencias.length ? sugerencias : fallback.sugerencias
    };
  } catch (err) {
    console.warn('Ollama no disponible, usando fallback:', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function construirPromptRapido(contexto, catalogo, fallback) {
  const restaurantes = restaurantesUnicos(catalogo.restaurantes).slice(0, 10).map((item) => ({
    restaurante_id: item.restaurante_id,
    name: item.name,
    type_of_food: item.type_of_food,
    wait_time: item.wait_time,
    plato: item.plato_name,
    plato_price: item.plato_price
  }));

  return [
    'Responde como Beloz AI. Espanol, breve, util. No inventes restaurantes.',
    'Devuelve SOLO JSON compacto con esta forma:',
    '{"respuesta":"texto breve","accion":"recommend|compare|search|general","sugerencias":[{"restaurante_id":1,"motivo":"por que encaja"}]}',
    `Mensaje del usuario: ${contexto.message}`,
    `Top catalogo: ${JSON.stringify(restaurantes)}`,
    `Respuesta base: ${JSON.stringify({
      respuesta: fallback.respuesta,
      accion: fallback.accion,
      sugerencias: fallback.sugerencias.map((item) => ({
        restaurante_id: item.restaurante_id,
        motivo: item.motivo
      }))
    })}`
  ].join('\n');
}

function generarRespuestaPorReglas(contexto, catalogo, plantillas = []) {
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
    .sort((a, b) => b.score - a.score);

  const scoredUnicos = restaurantesUnicos(scored).slice(0, 3);

  const sugerencias = scoredUnicos.map((item) => ({
    restaurante_id: item.restaurante_id,
    restaurante_nombre: item.name,
    image_path: item.plato_image_path || item.image_path,
    plato: item.plato_name,
    price: item.plato_price ? Number(item.plato_price) : null,
    wait_time: item.wait_time,
    type_of_food: item.type_of_food,
    motivo: construirMotivo(item, terms)
  }));

  const respuesta = construirRespuestaTexto(contexto, sugerencias, plantillas);

  return {
    provider: 'rules',
    respuesta,
    accion: sugerencias.length ? 'recommend' : 'general',
    sugerencias
  };
}

function restaurantesUnicos(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item.restaurante_id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function construirRespuestaTexto(contexto, sugerencias, plantillas) {
  if (!sugerencias.length) {
    return renderPlantilla(
      elegirPlantilla(plantillas, 'fallback_clarify', contexto.message),
      datosPlantilla(contexto.message)
    ) || 'No he encontrado una opcion clara con los datos actuales. Prueba a decirme presupuesto, tipo de comida o si tienes prisa.';
  }

  const primera = sugerencias[0];
  const intent = determinarIntentPlantilla(contexto.message);
  return renderPlantilla(
    elegirPlantilla(plantillas, intent, contexto.message),
    datosPlantilla(contexto.message, primera)
  ) || `Para "${contexto.message}", mi primera opcion seria ${primera.restaurante_nombre}. ${primera.motivo}`;
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
  const now = Date.now();
  if (catalogoCache && catalogoCache.expiresAt > now) {
    return catalogoCache.data;
  }

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

  const catalogo = { restaurantes: result.rows };
  catalogoCache = {
    data: catalogo,
    expiresAt: now + CATALOG_CACHE_TTL_MS
  };
  return catalogo;
}

async function cargarPlantillasRespuesta() {
  const now = Date.now();
  if (plantillasCache && plantillasCache.expiresAt > now) {
    return plantillasCache.data;
  }

  try {
    const result = await pool.query(
      `SELECT intent, variant, response_text
       FROM chat_response_templates
       WHERE active = TRUE
       ORDER BY intent ASC, variant ASC`
    );

    plantillasCache = {
      data: result.rows,
      expiresAt: now + TEMPLATE_CACHE_TTL_MS
    };
    return result.rows;
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('No se pudieron cargar plantillas de chat:', err.message);
    }
    plantillasCache = {
      data: [],
      expiresAt: now + 30000
    };
    return [];
  }
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

function debeResponderConMotorRapido(contexto, respuestaReglas) {
  if (AI_RESPONSE_MODE === 'ollama') return false;
  if (AI_RESPONSE_MODE === 'fast') return true;
  if (!respuestaReglas.sugerencias.length) return false;

  const text = normalizarTexto(contexto.message);
  return contieneAlguno(text, [
    'quiero',
    'apetece',
    'sushi',
    'pizza',
    'hamburguesa',
    'barato',
    'rapido',
    'ligero',
    'cenar',
    'comer',
    'sorprendeme',
    'recomienda'
  ]);
}

function determinarIntentPlantilla(message) {
  const text = normalizarTexto(message);
  const presupuesto = extraerPresupuesto(text);

  if (containsGreeting(text)) return 'greet';
  if (containsAny(text, ['compara', 'comparar', 'mejor que', 'diferencia'])) return 'compare';
  if (containsAny(text, ['carrito', 'pagar', 'checkout', 'confirmar pedido'])) return 'cart_checkout';
  if (containsAny(text, ['pedido', 'pedir', 'ordenar'])) return 'order_help';
  if (containsAny(text, ['tarda', 'tiempo', 'espera', 'cuando llega'])) return 'delivery_time';
  if (containsAny(text, ['vegetariano', 'vegano', 'sin gluten', 'alergia', 'alergeno', 'alergenos'])) return 'dietary';
  if (containsAny(text, ['plato', 'menu', 'carta'])) return 'dish_info';
  if (containsAny(text, ['restaurante', 'local'])) return 'restaurant_info';
  if (containsAny(text, ['sorprendeme', 'sorpresa', 'diferente', 'algo nuevo'])) return 'surprise_me';
  if (containsAny(text, ['rapido', 'prisa', 'ya', 'urgente'])) return 'recommend_fast';
  if (presupuesto) return 'recommend_budget';
  if (containsAny(text, ['barato', 'economico', 'poco dinero'])) return 'recommend_budget_low';
  if (containsAny(text, ['ligero', 'suave', 'sano', 'saludable'])) return 'recommend_light';
  if (containsAny(text, ['frio', 'caliente', 'lluvia', 'contundente'])) return 'comfort_food';
  if (containsAny(text, ['sushi', 'pizza', 'hamburguesa', 'kebab', 'taco', 'pasta', 'ensalada', 'postre', 'bebida', 'asiatica', 'india', 'mexicana'])) {
    return 'recommend_food_type';
  }
  return 'recommend_general';
}

function elegirPlantilla(plantillas, intent, seed) {
  const candidates = plantillas.filter((item) => item.intent === intent);
  const fallback = candidates.length ? candidates : plantillas.filter((item) => item.intent === 'recommend_general');
  if (!fallback.length) return null;
  return fallback[hashString(seed) % fallback.length];
}

function datosPlantilla(message, sugerencia = {}) {
  const presupuesto = extraerPresupuesto(normalizarTexto(message));
  return {
    message,
    restaurante: sugerencia.restaurante_nombre || 'una opcion de Beloz',
    plato: sugerencia.plato || 'un plato recomendado',
    precio: sugerencia.price != null ? Number(sugerencia.price).toFixed(2) : 'precio disponible',
    tiempo: sugerencia.wait_time != null ? String(sugerencia.wait_time) : 'varios',
    tipo: sugerencia.type_of_food || 'comida',
    motivo: sugerencia.motivo || 'encaja con lo que buscas',
    presupuesto: presupuesto != null ? String(presupuesto) : 'tu presupuesto'
  };
}

function renderPlantilla(plantilla, data) {
  if (!plantilla?.response_text) return null;
  return plantilla.response_text.replace(/\{([a-z_]+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : '';
  });
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function containsGreeting(text) {
  return /^(hola|buenas|buenos dias|buenas tardes|hey)\b/.test(text);
}

function containsAny(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function esPreguntaFueraDeDominio(message) {
  const text = normalizarTexto(message);
  if (!text) return false;

  if (containsAny(text, [
    'fuera de comida',
    'otra cosa que no sea comida',
    'programar',
    'codigo',
    'politica',
    'noticias',
    'futbol',
    'matematicas',
    'historia',
    'curriculum',
    'cv',
    'bitcoin',
    'bolsa'
  ])) {
    return true;
  }

  const palabrasDominio = [
    'comer',
    'comida',
    'cenar',
    'almorzar',
    'restaurante',
    'plato',
    'pedido',
    'pedir',
    'hamburguesa',
    'pizza',
    'sushi',
    'kebab',
    'taco',
    'pasta',
    'ensalada',
    'barato',
    'rapido',
    'ligero',
    'precio',
    'euro',
    'vegetariano',
    'vegano',
    'postre',
    'bebida',
    'picante',
    'frio',
    'caliente'
  ];

  const parecePreguntaGeneral = containsAny(text, ['quien', 'cuando', 'donde', 'como', 'porque', 'cuanto es', 'explicame']);
  return parecePreguntaGeneral && !containsAny(text, palabrasDominio);
}

function respuestaFueraDeDominio(plantillas = [], message = '') {
  return {
    provider: 'rules_fast',
    respuesta: renderPlantilla(
      elegirPlantilla(plantillas, 'out_of_domain', message),
      datosPlantilla(message)
    ) || 'Puedo ayudarte con restaurantes, platos, precios, tiempos de espera y recomendaciones dentro de Beloz. Dime que te apetece, tu presupuesto o si tienes prisa.',
    accion: 'general',
    sugerencias: []
  };
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
