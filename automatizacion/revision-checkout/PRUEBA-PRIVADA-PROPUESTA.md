# Comprobación remota privada pendiente de autorización de instalación

El checkout instalado en la ejecución 44160098418 está cerrado tanto al público como a administración. Esta propuesta permite comprobar el motor y SQLite ya instalados mediante la autenticación existente del propietario.

## Delta propuesto

Sólo `checkout-entry.mjs` y `checkout-store.mjs`. Identidades completas en `prueba-privada.json` y cambio reversible en `prueba-privada.patch`. Las identidades anteriores coinciden con el recibo de instalación. Cuatro comprobaciones nuevas específicas aprobaron. Las baterías anteriores no se ejecutaron de nuevo.

- `POST /api/compra/admin/prueba` acepta exclusivamente la autenticación PILOT_TOKEN existente. Ignora cuerpos comerciales suministrados por el cliente. Ejecuta una sola cotización y confirmación de una unidad de ADAP004, con contacto fijo sintético y envío de prueba USD 5. El calendario y código postal 000000 son fixtures privados sin despacho.
- Utiliza `sourceProvider` real sin sustituir SKU, precios, cantidades, identidades, vencimientos ni fuente por fixtures remotos. Una fuente inválida, desactualizada o incongruente bloquea antes de crear tablas o pedidos. ADAP004 debe seguir admitido y disponible.
- Usa el mismo objeto `messenger-development`, cifrado, tablas y `checkoutFetch`. El pedido lleva `syntheticTest:true` y `liveOrder:false`. Se prueba el reintento con la misma clave existente y se cierra el pedido mediante la cancelación administrativa original, también ante un fallo posterior a la inserción. Conserva el registro sintético cancelado y su historial.
- `GET /api/compra/admin/prueba`, también autenticado, verifica en una solicitud separada el pedido persistido y cancelado, lectura administrativa y el mismo recibo al repetir la confirmación. Devuelve únicamente metadatos del ensayo. No invoca notificaciones, pagos ni escrituras 593.
- La configuración pública conserva `enabled:false` y `deliveries:[]`. No modifica Worker, permisos, secretos, bindings, fuente, receptor ni otros módulos. El acceso de prueba caduca el **20/11/2026 a las 23:59:59 de Quito**. Si la autorización llega después, se deberá revisar esa fecha y los hashes antes de instalar.

## Autorización específica propuesta

Instalar sólo los dos módulos identificados, con un PUT acotado sobre el bundle activo capturado mediante el transporte original y comprobación inmediatamente anterior de esos hashes y del resto del bundle/settings. Conservar en memoria el contenido anterior y la fuente privada actual. Un cambio concurrente o identidad desconocida bloquea sin escritura. No usar el instalador completo de ocho módulos ni su permiso consumido.

Realizar un POST de prueba y un GET de verificación utilizando exclusivamente el entorno protegido existente. Comprobar además 503 en compra pública y 401 sin autenticación. Detenerse ante cualquier fallo, sin repetir el POST. Si la cancelación queda pendiente, atender únicamente ese pedido sintético por su clave exacta mediante el mismo acceso.

Al terminar, revertir exclusivamente ambos módulos a sus SHA anteriores mediante un PUT de reversión específica. Exigir antes de revertir que esos dos módulos coincidan con los candidatos y que no exista deriva concurrente. Conservar todos los demás módulos, settings y registros. Verificar el retorno de ambos hashes y cierre de la ruta privada. Si hay deriva, detenerse y presentar el cambio en vez de restaurar globalmente.

Esta propuesta no se ha instalado ni ejecutado remotamente. La aprobación para realizar la prueba ya existe; por instrucción expresa de Dirección General, el delta temporal y su instalación/reversión necesitan autorización específica. Costo adicional USD 0.
