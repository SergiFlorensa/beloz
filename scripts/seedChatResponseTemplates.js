require('dotenv').config();

const pool = require('../models/dbpostgre');

const SEED_SOURCE = 'beloz_chat_templates_v2';
const EXPECTED_TEMPLATE_COUNT = 200;

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
  t('out_of_domain', 5, 'Prefiero no inventar sobre eso. En Beloz puedo recomendarte opciones segun antojo, presupuesto o rapidez.', ['fuera_dominio']),

  t('single_word_hint', 1, 'Con esa pista, miraria {restaurante}. {plato} encaja como primera opcion.', ['palabra_suelta']),
  t('single_word_hint', 2, 'Si solo me dices "{message}", lo interpreto como antojo. Te propongo {restaurante}.', ['palabra_suelta']),
  t('single_word_hint', 3, 'Para una busqueda rapida por "{message}", empezaria por {restaurante}.', ['palabra_suelta']),
  t('single_word_hint', 4, 'Entendido: "{message}". La opcion mas directa que veo es {restaurante}, con {plato}.', ['palabra_suelta']),
  t('single_word_hint', 5, 'Con esa palabra clave, mi recomendacion es {restaurante}. {motivo}.', ['palabra_suelta']),
  t('single_word_hint', 6, 'Puedo trabajar con pistas cortas. Para "{message}", prueba {restaurante}.', ['palabra_suelta']),
  t('single_word_hint', 7, 'Si quieres algo relacionado con "{message}", iria a {restaurante} y miraria {plato}.', ['palabra_suelta']),

  t('dessert', 1, 'Si te apetece postre, revisaria {restaurante}. Puedes empezar mirando {plato}.', ['postre']),
  t('dessert', 2, 'Para cerrar con algo dulce, {restaurante} es una opcion a considerar.', ['postre']),
  t('dessert', 3, 'Buscando postre, te recomendaria revisar {restaurante} y su opcion {plato}.', ['postre']),
  t('dessert', 4, 'Si el plan es algo dulce despues de comer, {restaurante} puede encajar.', ['postre']),
  t('dessert', 5, 'Para antojo dulce, empieza por {restaurante}. Si no encaja, dime "mas dulce" o "mas ligero".', ['postre']),

  t('drink', 1, 'Si buscas bebida, revisa {restaurante}; despues confirma en la carta las opciones disponibles.', ['bebida']),
  t('drink', 2, 'Para acompanar el pedido, miraria primero {restaurante}. El plato base recomendado es {plato}.', ['bebida']),
  t('drink', 3, 'Si quieres bebida y comida, {restaurante} puede ser buen punto de partida.', ['bebida']),
  t('drink', 4, 'Para algo de beber, mejor confirmar disponibilidad en la ficha del restaurante antes de pedir.', ['bebida']),
  t('drink', 5, 'Puedo ayudarte a elegir comida; para bebidas concretas, revisa la carta de {restaurante}.', ['bebida']),

  t('spicy', 1, 'Si quieres picante, buscaria una opcion intensa en {restaurante}. Empieza por {plato}.', ['picante']),
  t('spicy', 2, 'Para algo con chispa, {restaurante} puede encajar. Revisa si {plato} permite nivel de picante.', ['picante']),
  t('spicy', 3, 'Antojo picante detectado. Miraria {restaurante} y confirmaria detalles del plato antes de pedir.', ['picante']),
  t('spicy', 4, 'Si te gusta el picante, priorizaria comida {tipo}. La opcion sugerida es {restaurante}.', ['picante']),
  t('spicy', 5, 'Para picante sin improvisar, dime si lo quieres suave, medio o fuerte y ajusto mejor.', ['picante']),

  t('sweet_salty', 1, 'Si dudas entre dulce y salado, empezaria por salado en {restaurante}: {plato}.', ['dulce_salado']),
  t('sweet_salty', 2, 'Para algo salado, {restaurante} tiene sentido. Plato sugerido: {plato}.', ['dulce_salado']),
  t('sweet_salty', 3, 'Si el cuerpo pide dulce, busca postre; si pide salado, mi opcion es {restaurante}.', ['dulce_salado']),
  t('sweet_salty', 4, 'Con antojo salado, iria a {restaurante}. {motivo}.', ['dulce_salado']),
  t('sweet_salty', 5, 'Para resolver dulce o salado, dime una palabra mas: postre, snack, cena o compartir.', ['dulce_salado']),

  t('group_order', 1, 'Para un grupo, elegiria {restaurante}: comida {tipo}, espera de {tiempo} min y opcion facil como {plato}.', ['grupo']),
  t('group_order', 2, 'Si sois varios, prioriza variedad y precio. {restaurante} parece buena base.', ['grupo']),
  t('group_order', 3, 'Para compartir en grupo, miraria {restaurante} y anadiria platos faciles de repartir.', ['grupo']),
  t('group_order', 4, 'Con mucha gente, mejor evitar opciones raras: {restaurante} es una apuesta segura.', ['grupo']),
  t('group_order', 5, 'Para pedido grupal, dime cuantas personas sois y ajusto cantidad, precio y estilo.', ['grupo']),

  t('family_kids', 1, 'Para familia o ninos, buscaria algo sencillo y reconocible. {restaurante} encaja bien.', ['familia']),
  t('family_kids', 2, 'Si hay ninos, prioriza platos faciles: {plato} en {restaurante} puede funcionar.', ['familia']),
  t('family_kids', 3, 'Para una comida familiar, {restaurante} parece una opcion practica y sin complicaciones.', ['familia']),
  t('family_kids', 4, 'Con ninos, mejor revisar ingredientes y elegir algo poco arriesgado. Miraria {restaurante}.', ['familia']),
  t('family_kids', 5, 'Para familia, dime si buscas barato, rapido o variedad y afino la recomendacion.', ['familia']),

  t('date_night', 1, 'Para una cena tranquila, elegiria {restaurante}. Tiene comida {tipo} y una opcion como {plato}.', ['cita']),
  t('date_night', 2, 'Si es una cita, buscaria algo con buena sensacion y poca complicacion: {restaurante}.', ['cita']),
  t('date_night', 3, 'Para plan en pareja, {restaurante} puede funcionar bien. Espera aproximada: {tiempo} min.', ['cita']),
  t('date_night', 4, 'Si quieres quedar bien, iria a {restaurante} y pediria {plato}.', ['cita']),
  t('date_night', 5, 'Para cena especial sin complicarte, {restaurante} es mi apuesta.', ['cita']),

  t('work_lunch', 1, 'Para comer trabajando, priorizaria rapidez y orden limpio: {restaurante}, con {plato}.', ['trabajo']),
  t('work_lunch', 2, 'Si es comida de oficina, {restaurante} encaja por espera y plato sencillo.', ['trabajo']),
  t('work_lunch', 3, 'Para pausa corta, elige {restaurante}. Espera aproximada: {tiempo} min.', ['trabajo']),
  t('work_lunch', 4, 'Comida de trabajo: mejor algo facil de comer. Miraria {plato} en {restaurante}.', ['trabajo']),
  t('work_lunch', 5, 'Si tienes reunion despues, iria a por una opcion ligera y rapida en {restaurante}.', ['trabajo']),

  t('healthy', 1, 'Para algo saludable, miraria {restaurante}. {plato} parece una opcion razonable.', ['saludable']),
  t('healthy', 2, 'Si buscas sano, prioriza platos ligeros y revisa ingredientes. Empezaria por {restaurante}.', ['saludable']),
  t('healthy', 3, 'Opcion mas cuidada: {restaurante}. Si quieres, puedo filtrar por ligero o vegetariano.', ['saludable']),
  t('healthy', 4, 'Para comer mejor sin complicarte, {plato} en {restaurante} puede encajar.', ['saludable']),
  t('healthy', 5, 'Si quieres algo saludable, dime si prefieres ensalada, poke, sushi o bajo en grasa.', ['saludable']),

  t('high_protein', 1, 'Si buscas proteina, miraria {restaurante} y escogeria un plato principal como {plato}.', ['proteina']),
  t('high_protein', 2, 'Para algo mas saciante, {restaurante} puede encajar. Revisa {plato}.', ['proteina']),
  t('high_protein', 3, 'Con objetivo de proteina, evita postres como base y empieza por {restaurante}.', ['proteina']),
  t('high_protein', 4, 'Si quieres proteina, dime carne, pollo, pescado o vegetal y ajusto mejor.', ['proteina']),

  t('pickup_delivery', 1, 'Para recoger o pedir a domicilio, revisa disponibilidad en la ficha de {restaurante}.', ['recogida_delivery']),
  t('pickup_delivery', 2, 'Si vas a recoger, prioriza espera baja. {restaurante} marca unos {tiempo} min.', ['recogida_delivery']),
  t('pickup_delivery', 3, 'Para delivery, elige algo que viaje bien. {plato} en {restaurante} puede funcionar.', ['recogida_delivery']),
  t('pickup_delivery', 4, 'Si prefieres recoger, abre {restaurante} y confirma opciones antes de pagar.', ['recogida_delivery']),
  t('pickup_delivery', 5, 'Para domicilio, revisa direccion, total y tiempo estimado antes de confirmar.', ['recogida_delivery']),

  t('hours_location', 1, 'Para horarios o ubicacion, revisa la ficha de {restaurante}; ahi deberia estar la informacion actualizada.', ['horario_ubicacion']),
  t('hours_location', 2, 'No quiero inventar horarios. Abre {restaurante} y confirma si esta disponible ahora.', ['horario_ubicacion']),
  t('hours_location', 3, 'Si preguntas por direccion, usa la ficha del restaurante para evitar errores.', ['horario_ubicacion']),
  t('hours_location', 4, 'Para saber si esta abierto, comprueba disponibilidad en {restaurante} antes de hacer pedido.', ['horario_ubicacion']),
  t('hours_location', 5, 'Puedo recomendarte, pero horarios y ubicacion deben confirmarse en la ficha del local.', ['horario_ubicacion']),

  t('favorites_repeat', 1, 'Si quieres repetir algo parecido, {restaurante} encaja con tus patrones recientes.', ['favoritos']),
  t('favorites_repeat', 2, 'Para repetir sin pensar, iria a {restaurante} y pediria {plato}.', ['favoritos']),
  t('favorites_repeat', 3, 'Si buscas algo de tus favoritos, puedo priorizar restaurantes que ya has mirado antes.', ['favoritos']),
  t('favorites_repeat', 4, 'Opcion familiar para ti: {restaurante}. {motivo}.', ['favoritos']),
  t('favorites_repeat', 5, 'Para repetir una buena experiencia, empieza por {restaurante}.', ['favoritos']),

  t('promotions', 1, 'Para ofertas o descuentos, revisa la ficha de {restaurante}; yo puedo ayudarte a elegir dentro del presupuesto.', ['ofertas']),
  t('promotions', 2, 'Si buscas oferta, combina precio bajo y espera corta. Ahora miraria {restaurante}.', ['ofertas']),
  t('promotions', 3, 'No puedo garantizar promociones, pero {plato} por {precio} EUR parece una opcion controlada.', ['ofertas']),
  t('promotions', 4, 'Para ahorrar, te recomiendo empezar por opciones economicas como {restaurante}.', ['ofertas']),

  t('indecisive', 1, 'Si no sabes que pedir, te saco de dudas: {restaurante} y {plato}.', ['indecision']),
  t('indecisive', 2, 'Decision rapida: {restaurante}. Es una opcion equilibrada por precio, tiempo y tipo.', ['indecision']),
  t('indecisive', 3, 'Cuando hay duda, reduce variables: elige {tipo}, espera de {tiempo} min y {plato}.', ['indecision']),
  t('indecisive', 4, 'Si quieres que elija por ti, me quedo con {restaurante}.', ['indecision']),
  t('indecisive', 5, 'Para decidir ya, iria a {restaurante}. Si no te convence, dime "otra opcion".', ['indecision']),

  t('negative_filter', 1, 'Entendido, evito esa preferencia. Con lo disponible, miraria {restaurante}.', ['evitar']),
  t('negative_filter', 2, 'Si no quieres {message}, puedo buscar una alternativa. Primera opcion: {restaurante}.', ['evitar']),
  t('negative_filter', 3, 'Para evitar algo concreto, dime "sin queso", "sin picante" o "sin carne" y ajusto mejor.', ['evitar']),
  t('negative_filter', 4, 'Si quieres excluir ingredientes, confirma siempre alergenos con el restaurante antes de pedir.', ['evitar']),
  t('negative_filter', 5, 'Buscando alternativa, {restaurante} puede funcionar. Revisa {plato}.', ['evitar']),

  t('portion_sharing', 1, 'Para compartir, buscaria platos faciles de repartir. {restaurante} puede ser buena base.', ['compartir']),
  t('portion_sharing', 2, 'Si vais a compartir, {plato} en {restaurante} puede servir como punto de partida.', ['compartir']),
  t('portion_sharing', 3, 'Para dos o mas personas, dime cuantas sois y ajusto cantidad y presupuesto.', ['compartir']),
  t('portion_sharing', 4, 'Pedido para compartir: prioriza variedad. Empezaria por {restaurante}.', ['compartir']),
  t('portion_sharing', 5, 'Si quieres raciones o algo para picar, miraria {restaurante}.', ['compartir']),

  t('thanks', 1, 'De nada. Cuando quieras, dime antojo, presupuesto o prisa y te recomiendo rapido.', ['gracias']),
  t('thanks', 2, 'A ti. Si quieres otra opcion, dime "otra" y busco una alternativa.', ['gracias']),
  t('thanks', 3, 'Perfecto. Si cambias de idea, puedo ajustar por precio, rapidez o tipo de comida.', ['gracias']),
  t('thanks', 4, 'Listo. Estoy aqui para ayudarte a elegir sin perder tiempo.', ['gracias']),
  t('thanks', 5, 'Cuando quieras seguimos. Puedo comparar, recomendar o afinar por presupuesto.', ['gracias']),

  t('complaint_issue', 1, 'Si algo no funciona en el pedido, revisa el carrito y vuelve al restaurante para ajustar.', ['problema']),
  t('complaint_issue', 2, 'Si ves un error de precio o plato, no confirmes todavia; vuelve a revisar la ficha.', ['problema']),
  t('complaint_issue', 3, 'Si la app no carga una opcion, prueba de nuevo en unos segundos o cambia de restaurante.', ['problema']),
  t('complaint_issue', 4, 'Para incidencias de pedido, revisa el resumen y evita confirmar hasta que todo cuadre.', ['problema']),
  t('complaint_issue', 5, 'Si hay un problema, puedo ayudarte a encontrar otra alternativa rapida como {restaurante}.', ['problema'])
];

async function main() {
  if (templates.length !== EXPECTED_TEMPLATE_COUNT) {
    throw new Error(`El seed debe tener exactamente ${EXPECTED_TEMPLATE_COUNT} plantillas. Tiene ${templates.length}.`);
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
    if (count.rows[0].total !== EXPECTED_TEMPLATE_COUNT) {
      throw new Error(`La tabla debe quedar con ${EXPECTED_TEMPLATE_COUNT} registros. Tiene ${count.rows[0].total}.`);
    }

    await pool.query('COMMIT');
    console.log(`chat_response_templates seeded with exactly ${EXPECTED_TEMPLATE_COUNT} records`);
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
