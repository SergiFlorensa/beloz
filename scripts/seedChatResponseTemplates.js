require('dotenv').config();

const pool = require('../models/dbpostgre');

const SEED_SOURCE = 'beloz_chat_templates_v1';

function t(intent, variant, responseText, tags = []) {
  return { intent, variant, responseText, tags };
}

const templates = [
  t('greet', 1, 'Hola, soy Beloz AI. Dime que te apetece, tu presupuesto o si tienes prisa y te propongo opciones reales.', ['inicio']),
  t('greet', 2, 'Puedo ayudarte a decidir rapido. Prueba con algo como "quiero sushi por menos de 12 EUR".', ['inicio']),
  t('greet', 3, 'Estoy listo para recomendarte restaurantes y platos de Beloz segun precio, tiempo y tipo de comida.', ['inicio']),
  t('greet', 4, 'Cuanto mas concreto seas, mejor: comida, presupuesto, prisa, ligero, picante o algo para compartir.', ['inicio']),

  t('recommend_general', 1, 'Para "{message}", mi primera opcion seria {restaurante}. Pediria {plato} por {precio} EUR. {motivo}.', ['recomendacion']),
  t('recommend_general', 2, 'Te encaja {restaurante}: tiene comida {tipo}, una espera de unos {tiempo} min y una opcion clara como {plato}.', ['recomendacion']),
  t('recommend_general', 3, 'Yo iria a por {restaurante}. Es una recomendacion directa porque {motivo}.', ['recomendacion']),
  t('recommend_general', 4, 'Buena opcion: {restaurante}. Si quieres algo facil de pedir, {plato} sale por {precio} EUR.', ['recomendacion']),
  t('recommend_general', 5, 'Con lo que pides, empezaria por {restaurante}. Tiene {tipo} y una opcion interesante: {plato}.', ['recomendacion']),
  t('recommend_general', 6, 'Mi recomendacion principal es {restaurante}. Combina bien con tu busqueda y el plato destacado es {plato}.', ['recomendacion']),
  t('recommend_general', 7, 'Si quieres decidir sin vueltas, elige {restaurante}. {motivo}.', ['recomendacion']),
  t('recommend_general', 8, 'Para esta ocasion veo fuerte a {restaurante}: {plato}, {precio} EUR y espera aproximada de {tiempo} min.', ['recomendacion']),

  t('recommend_food_type', 1, 'Si buscas {tipo}, miraria primero {restaurante}. Pediria {plato} y mantienes una espera de unos {tiempo} min.', ['tipo_comida']),
  t('recommend_food_type', 2, 'Para comida {tipo}, {restaurante} es la opcion mas clara ahora mismo. {plato} encaja bien.', ['tipo_comida']),
  t('recommend_food_type', 3, 'Tienes antojo de {tipo}: prueba {restaurante}. El plato que mejor entra es {plato}.', ['tipo_comida']),
  t('recommend_food_type', 4, '{restaurante} deberia irte bien si quieres {tipo}. Precio orientativo del plato: {precio} EUR.', ['tipo_comida']),
  t('recommend_food_type', 5, 'Para ese tipo de comida, yo no lo complicaria: {restaurante} y {plato}.', ['tipo_comida']),
  t('recommend_food_type', 6, 'La opcion mas alineada con {tipo} es {restaurante}. {motivo}.', ['tipo_comida']),
  t('recommend_food_type', 7, 'Si quieres algo de {tipo}, {restaurante} tiene buena pinta y una espera razonable: {tiempo} min.', ['tipo_comida']),
  t('recommend_food_type', 8, 'Para resolver el antojo de {tipo}, iria a {restaurante}. Miraria {plato} como primera opcion.', ['tipo_comida']),

  t('recommend_fast', 1, 'Si vas con prisa, priorizaria {restaurante}: espera aproximada de {tiempo} min y {plato} por {precio} EUR.', ['rapidez']),
  t('recommend_fast', 2, 'Para comer rapido, {restaurante} es buena salida. {motivo}.', ['rapidez']),
  t('recommend_fast', 3, 'La respuesta rapida seria {restaurante}. Pide {plato} y evita dar demasiadas vueltas.', ['rapidez']),
  t('recommend_fast', 4, 'Si el tiempo manda, me quedo con {restaurante}. Tiene una espera estimada de {tiempo} min.', ['rapidez']),
  t('recommend_fast', 5, 'Para algo agil, {restaurante} encaja mejor que opciones mas lentas. Plato sugerido: {plato}.', ['rapidez']),
  t('recommend_fast', 6, 'Quieres rapidez: {restaurante} es mi primera opcion porque {motivo}.', ['rapidez']),
  t('recommend_fast', 7, 'Opcion practica y rapida: {restaurante}. {plato} deberia resolverte bien el pedido.', ['rapidez']),

  t('recommend_budget', 1, 'Con presupuesto de {presupuesto} EUR, miraria {restaurante}. {plato} cuesta {precio} EUR.', ['presupuesto']),
  t('recommend_budget', 2, 'Para no pasarte de precio, {restaurante} es buena opcion: {plato} por {precio} EUR.', ['presupuesto']),
  t('recommend_budget', 3, 'Si quieres controlar gasto, iria a {restaurante}. El plato recomendado entra por {precio} EUR.', ['presupuesto']),
  t('recommend_budget', 4, 'Con ese presupuesto, {plato} en {restaurante} es una eleccion razonable.', ['presupuesto']),
  t('recommend_budget', 5, 'Para gastar con cabeza, te propongo {restaurante}. {motivo}.', ['presupuesto']),
  t('recommend_budget', 6, 'Dentro de {presupuesto} EUR, empezaria por {restaurante}; {plato} es una opcion clara.', ['presupuesto']),
  t('recommend_budget', 7, 'Buscando precio ajustado, {restaurante} encaja. Plato sugerido: {plato}, {precio} EUR.', ['presupuesto']),

  t('recommend_budget_low', 1, 'Si quieres algo barato, {restaurante} es una opcion directa. {plato} sale por {precio} EUR.', ['barato']),
  t('recommend_budget_low', 2, 'Para economico y sin complicarte, eligiria {restaurante}.', ['barato']),
  t('recommend_budget_low', 3, 'Opcion de precio contenido: {restaurante}, con {plato} como plato recomendado.', ['barato']),
  t('recommend_budget_low', 4, 'Si buscas gastar poco, prueba {restaurante}. {motivo}.', ['barato']),
  t('recommend_budget_low', 5, 'Para una eleccion economica, {restaurante} deberia funcionarte bien.', ['barato']),

  t('recommend_light', 1, 'Para algo ligero, miraria {restaurante}. {plato} parece una opcion facil de llevar.', ['ligero']),
  t('recommend_light', 2, 'Si no quieres algo pesado, {restaurante} encaja mejor. Plato sugerido: {plato}.', ['ligero']),
  t('recommend_light', 3, 'Opcion ligera: {restaurante}. Mantienes el pedido sencillo y con espera de {tiempo} min.', ['ligero']),
  t('recommend_light', 4, 'Para comer sin quedar demasiado lleno, empezaria por {restaurante}.', ['ligero']),
  t('recommend_light', 5, 'Si buscas algo suave, {plato} en {restaurante} tiene sentido.', ['ligero']),

  t('comfort_food', 1, 'Para algo caliente o de antojo, iria a {restaurante}. {plato} encaja muy bien.', ['comfort']),
  t('comfort_food', 2, 'Si hoy pide comida de confort, {restaurante} es buena opcion. {motivo}.', ['comfort']),
  t('comfort_food', 3, 'Para una cena mas contundente, miraria {restaurante} y pediria {plato}.', ['comfort']),
  t('comfort_food', 4, 'Si hace frio o quieres algo reconfortante, {restaurante} deberia funcionar.', ['comfort']),
  t('comfort_food', 5, 'Comida para disfrutar sin pensar demasiado: {restaurante}, con {plato}.', ['comfort']),

  t('surprise_me', 1, 'Te sorprenderia con {restaurante}. Pediria {plato}; no es la eleccion mas obvia, pero encaja bien.', ['sorpresa']),
  t('surprise_me', 2, 'Si quieres salir de lo habitual, prueba {restaurante}. {plato} puede ser buen descubrimiento.', ['sorpresa']),
  t('surprise_me', 3, 'Mi apuesta diferente seria {restaurante}. Tiene comida {tipo} y una opcion clara: {plato}.', ['sorpresa']),
  t('surprise_me', 4, 'Para variar, iria a {restaurante}. No te quedas en lo de siempre y mantienes buen precio.', ['sorpresa']),
  t('surprise_me', 5, 'Sorpresa controlada: {restaurante}. Espera aproximada de {tiempo} min y plato recomendado {plato}.', ['sorpresa']),

  t('compare', 1, 'Compararia por tiempo, precio y tipo de comida. Ahora mismo {restaurante} destaca por {motivo}.', ['comparar']),
  t('compare', 2, 'Si dudas entre opciones, usa esta regla: rapidez, precio y antojo. Con esos criterios gana {restaurante}.', ['comparar']),
  t('compare', 3, 'La comparacion rapida favorece a {restaurante}: {plato}, {precio} EUR y {tiempo} min.', ['comparar']),
  t('compare', 4, 'Entre varias opciones, yo priorizaria {restaurante} porque resuelve mejor tu peticion actual.', ['comparar']),
  t('compare', 5, 'Para comparar bien, dime si pesa mas precio, rapidez o tipo de comida. De momento elegiria {restaurante}.', ['comparar']),

  t('restaurant_info', 1, '{restaurante} aparece como opcion de comida {tipo}, con espera aproximada de {tiempo} min.', ['restaurante']),
  t('restaurant_info', 2, 'De {restaurante}, lo mas util ahora es mirar {plato} como primer plato recomendado.', ['restaurante']),
  t('restaurant_info', 3, '{restaurante} encaja si buscas {tipo}. El precio del plato sugerido es {precio} EUR.', ['restaurante']),
  t('restaurant_info', 4, 'Si quieres revisar {restaurante}, empezaria por su plato destacado: {plato}.', ['restaurante']),
  t('restaurant_info', 5, '{restaurante} puede ser buena opcion segun tu busqueda. {motivo}.', ['restaurante']),

  t('dish_info', 1, '{plato} en {restaurante} cuesta {precio} EUR y es la opcion que te sugeriria primero.', ['plato']),
  t('dish_info', 2, 'Si preguntas por platos, miraria {plato}. Esta asociado a {restaurante}.', ['plato']),
  t('dish_info', 3, 'Como plato recomendado, {plato} encaja por precio y tipo de comida.', ['plato']),
  t('dish_info', 4, '{plato} es una opcion sencilla para decidir rapido dentro de {restaurante}.', ['plato']),
  t('dish_info', 5, 'Para ese antojo, {plato} puede resolver bien sin subir demasiado el pedido.', ['plato']),

  t('dietary', 1, 'Puedo orientarte, pero revisa siempre ingredientes y alergenos en el restaurante antes de confirmar.', ['dieta']),
  t('dietary', 2, 'Si tienes alergias o restricciones, usa mi recomendacion como filtro inicial y confirma detalles con el local.', ['dieta']),
  t('dietary', 3, 'Para opciones vegetarianas, veganas o sin gluten, dime la restriccion concreta y busco lo mas cercano.', ['dieta']),
  t('dietary', 4, 'Si quieres algo mas ligero o especifico, puedo priorizar platos por tipo, precio y restaurante.', ['dieta']),
  t('dietary', 5, 'Cuando hay restricciones alimentarias, mejor decidir con calma: dime que debes evitar y ajusto la recomendacion.', ['dieta']),

  t('order_help', 1, 'Puedo ayudarte a elegir, pero el pedido se confirma desde la ficha del restaurante o el carrito.', ['pedido']),
  t('order_help', 2, 'Cuando elijas una opcion, entra en el restaurante y revisa los platos antes de anadir al carrito.', ['pedido']),
  t('order_help', 3, 'Si ya tienes claro el restaurante, te puedo ayudar a escoger un plato por precio o rapidez.', ['pedido']),
  t('order_help', 4, 'Para avanzar con el pedido, abre la opcion recomendada y comprueba cantidades y detalles.', ['pedido']),
  t('order_help', 5, 'Te puedo guiar en la decision; la confirmacion final depende de lo que tengas en el carrito.', ['pedido']),

  t('cart_checkout', 1, 'Antes de pagar, revisa cantidades, precio total y restaurante seleccionado.', ['carrito']),
  t('cart_checkout', 2, 'Si el carrito no cuadra, vuelve al restaurante y ajusta platos o cantidades.', ['carrito']),
  t('cart_checkout', 3, 'Para cerrar el pedido, confirma que el plato, precio y direccion son correctos.', ['carrito']),
  t('cart_checkout', 4, 'Mi consejo: no confirmes hasta revisar total, tiempos y cualquier preferencia especial.', ['carrito']),

  t('delivery_time', 1, 'La espera aproximada para {restaurante} es de {tiempo} min, aunque puede variar segun demanda.', ['tiempo']),
  t('delivery_time', 2, 'Si el tiempo es importante, prioriza restaurantes con espera baja. Ahora destacaria {restaurante}.', ['tiempo']),
  t('delivery_time', 3, 'Para ir rapido, mira siempre el tiempo estimado antes del precio. {restaurante}: {tiempo} min.', ['tiempo']),
  t('delivery_time', 4, 'El tiempo mostrado es orientativo; si tienes mucha prisa, elige la opcion con menor espera.', ['tiempo']),

  t('fallback_clarify', 1, 'No lo tengo claro todavia. Dime tipo de comida, presupuesto o si tienes prisa y ajusto la recomendacion.', ['fallback']),
  t('fallback_clarify', 2, 'Puedo afinarlo si me dices una pista: sushi, pizza, barato, rapido, ligero o para compartir.', ['fallback']),
  t('fallback_clarify', 3, 'Necesito un poco mas de contexto. Por ejemplo: "quiero cenar por menos de 15 EUR".', ['fallback']),
  t('fallback_clarify', 4, 'No quiero inventar. Dame una preferencia concreta y busco entre restaurantes reales de Beloz.', ['fallback']),
  t('fallback_clarify', 5, 'Si dudas, dime que pesa mas: precio, rapidez, tipo de comida o valoracion.', ['fallback']),
  t('fallback_clarify', 6, 'Puedo ayudarte mejor si me dices para cuantas personas, presupuesto o antojo principal.', ['fallback']),
  t('fallback_clarify', 7, 'No encuentro una coincidencia fuerte. Prueba con una frase mas directa sobre comida o restaurante.', ['fallback']),
  t('fallback_clarify', 8, 'Te puedo orientar, pero necesito saber si buscas recomendacion, informacion de un plato o ayuda con el pedido.', ['fallback']),

  t('out_of_domain', 1, 'Puedo ayudarte con restaurantes, platos, precios, tiempos de espera y recomendaciones dentro de Beloz.', ['fuera_dominio']),
  t('out_of_domain', 2, 'Esa consulta se sale de Beloz. Si quieres, dime que te apetece comer y te recomiendo algo.', ['fuera_dominio']),
  t('out_of_domain', 3, 'No soy un asistente general: estoy pensado para ayudarte a elegir comida y restaurantes en Beloz.', ['fuera_dominio']),
  t('out_of_domain', 4, 'Para ese tema no tengo datos fiables. Puedo ayudarte con pedidos, platos, precios o restaurantes.', ['fuera_dominio']),
  t('out_of_domain', 5, 'Prefiero no inventar sobre eso. En Beloz puedo recomendarte opciones segun antojo, presupuesto o rapidez.', ['fuera_dominio'])
];

async function main() {
  if (templates.length !== 100) {
    throw new Error(`El seed debe tener exactamente 100 plantillas. Tiene ${templates.length}.`);
  }

  await pool.query('BEGIN');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_response_templates (
        id SERIAL PRIMARY KEY,
        intent VARCHAR(80) NOT NULL,
        variant INTEGER NOT NULL,
        response_text TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        seed_source VARCHAR(80) NOT NULL DEFAULT '${SEED_SOURCE}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chat_response_templates_intent_variant_key UNIQUE (intent, variant)
      )
    `);

    await pool.query('DELETE FROM chat_response_templates');

    for (const item of templates) {
      await pool.query(
        `INSERT INTO chat_response_templates (intent, variant, response_text, tags, active, seed_source)
         VALUES ($1, $2, $3, $4::jsonb, TRUE, $5)`,
        [item.intent, item.variant, item.responseText, JSON.stringify(item.tags), SEED_SOURCE]
      );
    }

    const count = await pool.query('SELECT COUNT(*)::int AS total FROM chat_response_templates');
    if (count.rows[0].total !== 100) {
      throw new Error(`La tabla debe quedar con 100 registros. Tiene ${count.rows[0].total}.`);
    }

    await pool.query('COMMIT');
    console.log('chat_response_templates seeded with exactly 100 records');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
