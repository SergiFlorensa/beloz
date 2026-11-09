const { buildGroundedResponse, immediateResponse, optionalOllamaRanking, withConversationContext } = require('./chat/groundedChat');

function createChatHandler({ pool, env = process.env, fetchImpl = globalThis.fetch, now = Date.now }) {
  let cache = null;
  let pending = null;
  const ttl = Math.max(1000, Math.min(Number(env.CATALOG_CACHE_TTL_MS) || 300000, 300000));
  const query = (text, values) => pool.query({ text, values, query_timeout: 5000 });

  async function loadCatalog() {
    if (cache && cache.expiresAt > now()) return cache.data;
    if (pending) return pending;
    pending = (async () => {
      const schema = await query(`SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('restaurante', 'restaurantes', 'platos')`);
      const has = (table, column) => schema.rows.some((row) => row.table_name === table && row.column_name === column);
      // SQL identifiers come only from this allowlist, never from the request.
      const table = schema.rows.some((row) => row.table_name === 'restaurante') ? 'restaurante' : 'restaurantes';
      const id = has(table, 'restaurante_id') ? 'restaurante_id' : 'id';
      const restaurantColumn = has('platos', 'restaurantid') ? 'restaurantid' : 'restaurante_id';
      if (!has(table, id) || !has('platos', restaurantColumn)) throw new Error('Catalog schema unavailable');
      const result = await query(`SELECT r.${id} AS restaurante_id, r.name, r.image_path,
        r.wait_time, r.price_level, r.type_of_food, r.country, r.relevancia, r.valoracion,
        p.id AS plato_id, p.name AS plato_name, p.description AS plato_description,
        p.price AS plato_price, p.image_path AS plato_image_path,
        to_jsonb(p)->>'source_url' AS source_url,
        to_jsonb(p)->>'source_updated_at' AS source_updated_at
        FROM ${table} r LEFT JOIN platos p ON p.${restaurantColumn} = r.${id}
        ORDER BY r.${id}, p.id`);
      const data = { restaurantes: result.rows, retrieved_at: new Date(now()).toISOString() };
      cache = { data, expiresAt: now() + ttl };
      return data;
    })();
    try { return await pending; } finally { pending = null; }
  }

  return async (req, res) => {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.length > 2000) return res.status(400).json({ error: 'Escribe un mensaje de entre 1 y 2000 caracteres.' });
    const quick = immediateResponse(message.trim());
    if (quick) return res.status(200).json(quick);
    try {
      const catalog = await loadCatalog();
      const rawProfile = req.body?.perfil_sabor || req.body?.perfilSabor || {};
      const rawTypes = rawProfile.top_tipos_comida || rawProfile.topTiposComida;
      const profile = { top_tipos_comida: Array.isArray(rawTypes) ? rawTypes.filter((item) => item && typeof item === 'object').slice(0, 5) : [] };
      const contextualMessage = withConversationContext(message.trim(), req.body?.history, catalog);
      const base = buildGroundedResponse(contextualMessage, catalog, profile);
      const result = await optionalOllamaRanking(base, message.trim(), {
        enabled: String(env.AI_RESPONSE_MODE || 'fast').toLowerCase() === 'ollama' && (env.AI_PROVIDER === 'ollama' || env.OLLAMA_ENABLED === 'true'),
        url: env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434', model: env.OLLAMA_MODEL || 'gemma3:1b', timeoutMs: env.OLLAMA_TIMEOUT_MS, fetchImpl
      });
      return res.status(200).json(result);
    } catch {
      // Never leak connection strings, query text, or model output.
      return res.status(503).json({ error: 'No se ha podido consultar el catalogo. Intentalo de nuevo.', retryable: true });
    }
  };
}

let defaultHandler;
exports.responderChat = (req, res) => {
  defaultHandler ||= createChatHandler({ pool: require('../models/dbpostgre') });
  return defaultHandler(req, res);
};
exports.createChatHandler = createChatHandler;
