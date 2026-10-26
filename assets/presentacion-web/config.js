/* PRESENTACIÓN WEB. Una sola opción cambia el ambiente de toda la portada.
   tema: automatico | identidad | halloween | black-month | black-friday | navidad.
   No contiene precios ni inventario. Lee los productos publicados en la tienda. */
window.CONECTATECH_PRESENTACION = {
  version: 2,
  tema: 'automatico',
  zonaHoraria: 'America/Guayaquil',
  intervaloMs: 3000,
  efectoTecnologico: true,
  rotacionDiaria: {
    activa: true,
    cantidadVitrina: 5,
    cantidadDestacados: 5,
    evitarRepetirDias: 7,
    categoriasApertura: ['Celulares y Smartphones', 'Tablets', 'Smartwatches y Wearables', 'Audio y Audífonos', 'Computación y Periféricos', 'TV y Entretenimiento'],
    fijadosVitrina: [],
    fijadosDestacados: []
  },
  productosPortada: ['TELF036', 'PALA001', 'REL042', 'PARL001', 'TECL032'],
  marca: '/assets/presentacion-web/marca-trazos-originales.svg',
  banner: '/assets/presentacion-web/banner-regalos-original.png',
  calendario: [
    { desde: '10-01', hasta: '10-31', tema: 'halloween' },
    { desde: '11-01', hasta: '11-30', tema: 'black-month' },
    { desde: '12-01', hasta: '12-31', tema: 'navidad' }
  ],
  blackFridayAutomatico: true,
  temas: {
    identidad: { nombre: 'Selección CONECTATECH', acento: '#8bd12f', secundario: '#29b5ed' },
    halloween: { nombre: 'Edición Halloween', acento: '#ffae43', secundario: '#ac87ff' },
    'black-month': { nombre: 'Edición Black Month', acento: '#d7bd7c', secundario: '#7ab6eb' },
    'black-friday': { nombre: 'Edición Black Friday', acento: '#b7f343', secundario: '#69deff' },
    navidad: { nombre: 'Edición Navidad', acento: '#ffce7b', secundario: '#db536c' }
  }
};
