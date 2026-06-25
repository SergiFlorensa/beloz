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

    const respuestaCarta = generarRespuestaCartaRestaurante(contexto, catalogo);
    if (respuestaCarta) {
      return res.status(200).json({ ...respuestaCarta, provider: 'rules_fast' });
    }

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

function generarRespuestaCartaRestaurante(contexto, catalogo) {
  const terms = normalizarTexto(contexto.message);
  if (!esConsultaCarta(terms)) return null;

  const restaurante = encontrarRestauranteMencionado(terms, catalogo.restaurantes);
  if (!restaurante) return null;

  const platos = catalogo.restaurantes
    .filter((item) => Number(item.restaurante_id) === Number(restaurante.restaurante_id) && item.plato_name)
    .map((item) => ({
      ...item,
      category: extraerCategoriaPlato(item.plato_description),
      cleanDescription: limpiarDescripcionFuente(item.plato_description),
    }))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || Number(a.plato_id) - Number(b.plato_id));

  if (!platos.length) return null;

  const grouped = new Map();
  for (const plato of platos) {
    const category = plato.category || 'Carta';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(plato);
  }

  const sections = [...grouped.entries()].slice(0, 8).map(([category, items]) => {
    const names = items.slice(0, 4).map((item) => `${item.plato_name} (${Number(item.plato_price).toFixed(2)} EUR)`);
    const suffix = items.length > names.length ? ` y ${items.length - names.length} mas` : '';
    return `${normalizarCategoriaVisible(category)}: ${names.join(', ')}${suffix}`;
  });

  const destacados = platos
    .filter((item) => terms.split(/\s+/).some((token) => token.length > 2 && normalizarTexto(`${item.plato_name} ${item.cleanDescription} ${item.category}`).includes(token)))
    .slice(0, 3);
  const sugerenciasBase = destacados.length ? destacados : platos.slice(0, 3);

  return {
    respuesta: `${restaurante.name} tiene ${platos.length} platos cargados desde carta real. ${sections.join('. ')}.`,
    accion: 'menu',
    intent: 'menu_list',
    sugerencias: sugerenciasBase.map((item) => ({
      restaurante_id: item.restaurante_id,
      restaurante_nombre: item.name,
      image_path: item.plato_image_path || item.image_path,
      plato: item.plato_name,
      price: item.plato_price ? Number(item.plato_price) : null,
      wait_time: item.wait_time,
      type_of_food: item.type_of_food,
      motivo: `${normalizarCategoriaVisible(item.category)}: ${limpiarDescripcionFuente(item.plato_description).slice(0, 120)}`
    }))
  };
}

function esConsultaCarta(text) {
  return containsAny(text, ['lista de platos', 'listado de platos', 'carta', 'menu', 'platos del restaurante', 'platos de']);
}

function encontrarRestauranteMencionado(text, items) {
  const unicos = restaurantesUnicos(items);
  return unicos
    .map((item) => {
      const name = normalizarTexto(item.name);
      const tokens = name.split(/\s+/).filter((token) => token.length > 2);
      const score = tokens.reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
      return { item, score, fullMatch: text.includes(name) };
    })
    .filter((match) => match.fullMatch || match.score >= Math.min(2, normalizarTexto(match.item.name).split(/\s+/).length))
    .sort((a, b) => Number(b.fullMatch) - Number(a.fullMatch) || b.score - a.score)[0]?.item || null;
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
      const restaurantText = normalizarTexto([item.name, item.type_of_food, item.country].join(' '));
      const dishText = normalizarTexto([item.plato_name, item.plato_description].join(' '));
      const text = `${restaurantText} ${dishText}`;
      let score = Number(item.valoracion || 0) * 10 + Number(item.relevancia || 0);

      for (const token of terms.split(/\s+/).filter((t) => t.length > 2)) {
        if (text.includes(token)) score += 9;
        if (dishText.includes(token)) score += 10;
        if (normalizarTexto(item.plato_name).includes(token)) score += 8;
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
      if (terms.includes('ligero') || terms.includes('sano') || terms.includes('saludable')) {
        if (contieneAlguno(text, ['poke', 'sushi', 'ensalada', 'ceviche'])) score += 12;
      }
      if (esConsultaVegetal(terms)) {
        if (contieneAlguno(text, ['vegano', 'vegana', 'vegetariano', 'vegetariana', 'vegetal', 'verduras', 'setas', 'tofu', 'yasai', 'niku nashi'])) score += 18;
      }
      if (terms.includes('caliente') || terms.includes('frio') || terms.includes('lluvia')) {
        if (contieneAlguno(text, ['ramen', 'curry', 'pizza', 'kebab', 'india'])) score += 12;
      }
      if (terms.includes('picante')) {
        if (contieneAlguno(text, ['mexicana', 'india', 'curry', 'taco', 'kebab', 'spicy'])) score += 12;
      }
      if (terms.includes('postre') || terms.includes('dulce')) {
        if (contieneAlguno(text, ['postre', 'dulce', 'tarta', 'cake', 'brownie', 'helado'])) score += 12;
      }
      if (terms.includes('bebida') || terms.includes('beber')) {
        if (contieneAlguno(text, ['bebida', 'drink', 'refresco', 'agua', 'cerveza'])) score += 8;
      }
      if (terms.includes('grupo') || terms.includes('compartir') || terms.includes('familia')) {
        score += Number(item.valoracion || 0) * 2;
      }

      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score);

  const scoredUnicos = restaurantesUnicos(scored).slice(0, 3);
  const intent = determinarIntentPlantilla(contexto.message);

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

  const respuesta = construirRespuestaTexto(contexto, sugerencias, plantillas, intent);
  const sugerenciasFinales = debeOcultarSugerencias(intent) ? [] : sugerencias;

  return {
    provider: 'rules',
    respuesta,
    accion: sugerenciasFinales.length ? 'recommend' : 'general',
    intent,
    sugerencias: sugerenciasFinales
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

function construirRespuestaTexto(contexto, sugerencias, plantillas, intent) {
  if (!sugerencias.length) {
    return renderPlantilla(
      elegirPlantilla(plantillas, 'fallback_clarify', contexto.message),
      datosPlantilla(contexto.message)
    ) || 'No he encontrado una opcion clara con los datos actuales. Prueba a decirme presupuesto, tipo de comida o si tienes prisa.';
  }

  const primera = sugerencias[0];
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
     LEFT JOIN platos p ON p.${platoRestaurantColumn} = r.${restaurantIdColumn}
     ORDER BY r.valoracion DESC NULLS LAST, r.relevancia DESC NULLS LAST, p.price ASC NULLS LAST`
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
  if (debeOcultarSugerencias(respuestaReglas.intent)) return true;
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
    'recomienda',
    'postre',
    'dulce',
    'salado',
    'bebida',
    'beber',
    'picante',
    'grupo',
    'familia',
    'ninos',
    'pareja',
    'cita',
    'trabajo',
    'oficina',
    'sano',
    'saludable',
    'proteina',
    'recoger',
    'domicilio',
    'delivery',
    'abierto',
    'horario',
    'direccion',
    'favorito',
    'repetir',
    'oferta',
    'descuento',
    'no se',
    'elige',
    'sin ',
    'compartir',
    'gracias',
    'problema',
    'error'
  ]);
}

function determinarIntentPlantilla(message) {
  const text = normalizarTexto(message);
  const presupuesto = extraerPresupuesto(text);
  const tokenCount = text.split(/\s+/).filter(Boolean).length;

  if (containsGreeting(text)) return 'greet';
  if (containsAny(text, ['gracias', 'muchas gracias', 'perfecto gracias', 'ok gracias'])) return 'thanks';
  if (containsAny(text, ['problema', 'error', 'no carga', 'fallo', 'no funciona', 'mal', 'incidencia'])) return 'complaint_issue';
  if (containsAny(text, ['abierto', 'horario', 'direccion', 'ubicacion', 'donde esta', 'telefono', 'contacto'])) return 'hours_location';
  if (containsAny(text, ['recoger', 'recogida', 'domicilio', 'delivery', 'llevar', 'para llevar', 'pickup'])) return 'pickup_delivery';
  if (containsAny(text, ['favorito', 'favoritos', 'repetir', 'lo de siempre', 'otra vez', 'ultimo pedido'])) return 'favorites_repeat';
  if (containsAny(text, ['oferta', 'descuento', 'promo', 'promocion', 'cupon', 'ahorrar'])) return 'promotions';
  if (containsAny(text, ['no se', 'elige tu', 'elige por mi', 'lo que sea', 'me da igual', 'indeciso', 'indecisa'])) return 'indecisive';
  if (esConsultaAlergenos(text)) return 'dietary';
  if (!esConsultaVegetal(text) && containsAny(text, ['sin ', 'no quiero', 'evita', 'evitar', 'quita', 'sin queso', 'sin carne', 'sin picante'])) return 'negative_filter';
  if (containsAny(text, ['compartir', 'raciones', 'para dos', 'para 2', 'para picar', 'picar'])) return 'portion_sharing';
  if (containsAny(text, ['grupo', 'varios', 'muchos', 'amigos', 'personas'])) return 'group_order';
  if (containsAny(text, ['familia', 'ninos', 'peques', 'infantil'])) return 'family_kids';
  if (containsAny(text, ['pareja', 'cita', 'romantica', 'romantico', 'quedar bien'])) return 'date_night';
  if (containsAny(text, ['trabajo', 'oficina', 'reunion', 'pausa', 'tupper'])) return 'work_lunch';
  if (containsAny(text, ['proteina', 'proteico', 'pollo', 'carne', 'pescado'])) return 'high_protein';
  if (containsAny(text, ['sano', 'saludable', 'fit', 'cuidarme', 'bajo en grasa'])) return 'healthy';
  if (containsAny(text, ['picante', 'spicy', 'fuerte'])) return 'spicy';
  if (containsAny(text, ['postre', 'dulce', 'helado', 'tarta', 'brownie'])) return 'dessert';
  if (containsAny(text, ['bebida', 'beber', 'refresco', 'agua', 'cerveza'])) return 'drink';
  if (containsAny(text, ['salado', 'dulce o salado', 'antojo dulce', 'antojo salado'])) return 'sweet_salty';
  if (containsAny(text, ['compara', 'comparar', 'mejor que', 'diferencia'])) return 'compare';
  if (containsAny(text, ['carrito', 'pagar', 'checkout', 'confirmar pedido'])) return 'cart_checkout';
  if (containsAny(text, ['pedido', 'pedir', 'ordenar'])) return 'order_help';
  if (containsAny(text, ['tarda', 'tiempo', 'espera', 'cuando llega'])) return 'delivery_time';
  if (esConsultaVegetal(text)) return 'recommend_food_type';
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
  if (tokenCount <= 2) return 'single_word_hint';
  return 'recommend_general';
}

function debeOcultarSugerencias(intent) {
  return new Set([
    'thanks',
    'complaint_issue',
    'hours_location',
    'dietary',
    'order_help',
    'cart_checkout',
    'negative_filter'
  ]).has(intent);
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

function esConsultaVegetal(text) {
  return containsAny(text, ['vegetariano', 'vegetariana', 'vegano', 'vegana', 'sin carne', 'solo verduras', 'vegetal']);
}

function esConsultaAlergenos(text) {
  return containsAny(text, ['sin gluten', 'celiaco', 'celiaca', 'alergia', 'alergeno', 'alergenos', 'intolerancia', 'lactosa']);
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
    'dulce',
    'salado',
    'grupo',
    'familia',
    'ninos',
    'pareja',
    'cita',
    'trabajo',
    'oficina',
    'proteina',
    'recoger',
    'domicilio',
    'delivery',
    'abierto',
    'horario',
    'direccion',
    'favorito',
    'oferta',
    'descuento',
    'compartir',
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

function extraerCategoriaPlato(description) {
  const match = String(description || '').match(/\[([^\].]+)\.\s*Fuente oficial:/i);
  return match?.[1]?.trim() || 'Carta';
}

function limpiarDescripcionFuente(description) {
  return String(description || '')
    .replace(/\s*\[[^\]]*Fuente oficial:[^\]]*\]\s*$/i, '')
    .trim();
}

function categoryRank(category) {
  const index = CATEGORY_ORDER.findIndex((item) => item.toLowerCase() === String(category || '').toLowerCase());
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function normalizarCategoriaVisible(category) {
  const value = String(category || 'Carta').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Carta';
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
