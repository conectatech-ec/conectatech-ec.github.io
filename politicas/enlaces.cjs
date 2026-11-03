const url = '/cambios-devoluciones-garantias/';
const fragment = '<p data-ct-policy-link><a href="' + url + '">Cambios, devoluciones y garantías</a></p>';
module.exports = function enlazar(html) {
  if (html.includes('data-ct-policy-link')) return html;
  if (html.includes('</footer>')) return html.replace('</footer>', fragment + '</footer>');
  if (!html.includes('</body>')) throw Error('Documento sin cierre body; no se altera');
  return html.replace('</body>', '<footer>' + fragment + '</footer></body>');
};
module.exports.fragment = fragment;
