// Adaptador puro: no red, no Worker, no modificaciones de inventario.
export function validar(config) {
  if (config.garantias.cobertura_comercial !== 'defectos de fabricación y funcionamiento en condiciones normales de uso') throw Error('Cobertura comercial inconsistente');
  if (config.devolucion_legal.valor !== 15 || config.devolucion_legal.unidad !== 'termino_legal_dias' || config.cambios_voluntarios.restringe_derechos_legales !== false) throw Error('Derechos legales modificados sin revisión');
  const rules = config.garantias.reglas_categoria;
  for (const category of ['celulares', 'tablets']) {
    const rule = rules[category];
    if (!rule || !Number.isInteger(rule.valor) || rule.valor < 1 || rule.unidad !== 'anio') throw Error('Base de garantía inválida: ' + category);
  }
  for (const category of ['accesorios', 'televisores', 'computacion', 'otros']) {
    const rule = rules[category];
    if (!rule || !Number.isInteger(rule.valor) || rule.valor < 30 || rule.unidad !== 'dia') throw Error('Base de garantía inválida: ' + category);
  }
  for (const [sku, exception] of Object.entries(config.garantias.excepciones_sku)) {
    const base = rules[exception.categoria];
    if (!base || !exception.aprobada || !exception.evidencia || !Number.isInteger(exception.valor) || exception.valor < 1) throw Error('Excepción sin evidencia: ' + sku);
    if (base.valor !== null && (exception.unidad !== base.unidad || exception.valor < base.valor)) throw Error('No se permite reducir ni convertir sin revisión el plazo: ' + sku);
    if (!['anio', 'dia'].includes(exception.unidad)) throw Error('Unidad de garantía inválida');
  }
  return true;
}

export function garantia(config, producto = {}) {
  validar(config);
  const override = config.garantias.excepciones_sku[producto.sku];
  const category = override?.categoria || producto.categoriaGarantia || config.garantias.alias_categoria[producto.categoriaCatalogo] || 'otros';
  const rule = override || config.garantias.reglas_categoria[category] || config.garantias.reglas_categoria.otros;
  const label = rule.valor === null ? 'Plazo de garantía indicado para cada artículo' : rule.unidad === 'anio'
    ? `${rule.valor} ${rule.valor === 1 ? 'año' : 'años'} de garantía`
    : `${rule.valor} ${rule.valor === 1 ? 'día' : 'días'} de garantía`;
  return {categoria: category, valor: rule.valor, unidad: rule.unidad, etiqueta: label,
    cobertura: config.garantias.cobertura_comercial, texto: label + ' por ' + config.garantias.cobertura_comercial,
    fuente: override ? 'excepción SKU aprobada' : 'regla categoría',
    derechos_legales: 'Sin limitar los derechos legales del consumidor'};
}

export function respuestaAlex(config, motivo, producto = {}) {
  if (motivo === 'garantia') return garantia(config, producto).texto + '. Si tu artículo tiene un plazo superior registrado, se respeta. Cuéntame qué ocurrió; revisaremos el caso sin limitar tus derechos legales.';
  if (motivo === 'cambio_voluntario') return 'No ofrecemos cambios ni devoluciones voluntarias por preferencias personales. En teléfonos y tablets utilizados o activados no realizamos cambios voluntarios por modelo, color o características. Se conservan el derecho legal de devolución o cambio y las garantías aplicables.';
  if (motivo === 'devolucion_legal') return 'La ley reconoce devolución o cambio dentro del término legal de quince días desde la recepción, si la naturaleza y el estado del bien lo permiten. No se ofrecen plazos voluntarios adicionales ni se limitan los derechos legales. Te derivo a un responsable para revisar tu caso.';
  if (motivo === 'error_tienda') return 'Si recibiste un producto distinto o hubo un error de despacho, vamos a revisarlo y gestionar la solución. No te trasladaremos costos del error cuando no corresponda. Te derivo a un responsable.';
  if (motivo === 'danio_o_exclusion') return 'Necesitamos revisar la causa del daño antes de decidir la cobertura. Una intervención o daño externo no elimina automáticamente todos tus derechos. Te derivo a una persona responsable.';
  return '¿Se trata de garantía, cambio voluntario, devolución legal o un error de despacho? Si no estás seguro, te ayudamos a identificarlo.';
}
