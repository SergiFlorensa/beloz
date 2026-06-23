exports.generarRecomendaciones = async (req, res) => {
  const contexto = req.body || {};
  const recomendaciones = [];
  const momento = String(contexto.momento_del_dia || '').toLowerCase();
  const tipoDia = String(contexto.tipo_de_dia || '').toLowerCase();
  const estadoClima = String(contexto.clima?.estado || contexto.clima || '').toLowerCase();

  if (momento === 'noche' && tipoDia === 'fin_de_semana') {
    recomendaciones.push({
      titulo: 'Plan nocturno sin estrés',
      descripcion: 'Comparte pizzas y postres con tu grupo. Añade bebidas frías.',
      etiquetas: ['compartir', 'confort'],
      motivo: 'Es fin de semana por la noche, ideal para desconectar.'
    });
  }

  if (momento === 'mediodia' && tipoDia === 'laborable') {
    recomendaciones.push({
      titulo: 'Energía en pausa corta',
      descripcion: 'Elige opciones rápidas y nutritivas para continuar el día.',
      etiquetas: ['rápido', 'nutritivo'],
      motivo: 'Es mediodía laborable y conviene priorizar una comida ágil.'
    });
  }

  if (estadoClima.includes('lluv') || estadoClima.includes('frio')) {
    recomendaciones.push({
      titulo: 'Algo caliente y reconfortante',
      descripcion: 'Ramen, sopas o platos especiados encajan bien con este clima.',
      etiquetas: ['calor', 'confort'],
      motivo: 'El clima invita a platos calientes.'
    });
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push({
      titulo: 'Explora algo nuevo',
      descripcion: 'Prueba restaurantes con alta valoración cerca de ti.',
      etiquetas: ['explorar'],
      motivo: 'Siempre es buen momento para descubrir nuevos sabores.'
    });
  }

  res.status(200).json(recomendaciones);
};
