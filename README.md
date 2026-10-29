# Mi Torno Gestión · Beta 1P

Inventario compartido para Mi Torno. Conserva el diseño, el escaneo vinculado, las fotos del catálogo y el pitido anterior.

## Uso

1. Abre https://mi-torno-gestion.vercel.app y actualiza la página.
2. Ingresa la clave del taller entregada por separado. Usa la misma dirección y clave en teléfono, tablet y PC.
3. Comienza en **Pruebas**. Crea un producto con 5 unidades y una foto.
4. Abre el otro dispositivo: el producto debe aparecer automáticamente en unos cinco segundos, fuera de formularios abiertos.
5. Registra una entrada de 3 y una salida de 6: deben quedar 2 unidades. Revisa Movimientos y Reposición.
6. Cierra ambas páginas y vuelve a abrirlas: el producto, foto y movimientos deben conservarse.
7. En Datos y ajustes descarga una copia completa; incluye fotos y todo el historial. Limpiar pruebas conserva el inventario real.

## Inventario de la versión anterior

La Beta 1 guardaba una copia distinta en cada navegador. Esos datos no pueden subirse desde otro equipo automáticamente.

En el navegador que contiene la copia correcta, abre Datos y ajustes → **Subir inventario anterior de este dispositivo**. Revisa productos y cantidades; confirma solamente si deseas reemplazar el inventario activo compartido. Pruebas y Real siguen separados. La copia antigua del navegador se conserva; no se mezclan copias distintas sin revisión.

## Guardado

Los productos, cantidades, ubicaciones, fotos e historial se guardan en Supabase Postgres. Vercel sirve la aplicación y una API con sesión firmada en cookie HttpOnly. La clave compartida del taller se verifica en el servidor; no está en los archivos públicos ni en GitHub. Las tablas no tienen acceso público. Una función privada de servidor usa las credenciales de Supabase que el proveedor inyecta automáticamente.

Las escrituras usan revisión y transacción: si otro dispositivo cambió el inventario, se rechaza la ficha desactualizada y se pide revisar antes de guardar. Los reintentos inmediatos usan una solicitud identificada para no duplicar una operación. La restauración carga partes temporales y reemplaza el inventario solo al confirmar todas las partes en una transacción.

## Límites de esta beta

- Necesita internet para consultar y confirmar movimientos. No hay cola de movimientos sin conexión ni inventario local alternativo. La PWA puede abrir su interfaz sin conexión, pero no confirma operaciones.
- La clave es compartida; no hay cuentas individuales ni permisos por persona. El nombre del encargado identifica movimientos, no autentica al usuario. La sesión dura siete días.
- Las pantallas abiertas se actualizan por consulta periódica; un formulario abierto conserva el borrador y verifica la revisión al guardar.
- El historial visible muestra los últimos 250 movimientos; la copia completa descarga todos. Límite validado: 10.000 productos y copias de 100.000 movimientos / 16 MB al restaurar.
- Las fotos se guardan como imagen comprimida en la base de datos, con entrega autenticada. Máximo validado por foto: 1,8 millones de caracteres. Para catálogos grandes conviene migrar las imágenes a almacenamiento de objetos.
- La cámara del teléfono vinculado necesita ambas páginas abiertas y depende del servicio de enlace PeerJS. El inventario compartido funciona sin esa vinculación.
- No se extraen nombres o marcas de las fotos. La limpieza de fondo conserva las limitaciones de la Beta 1.
- Las copias descargables son manuales; no se ha contratado retención adicional ni recuperación a un instante específico.

## Desarrollo y despliegue

Repositorio preparado para Vercel con archivos estáticos en `dist/` y API Node en `api/cloud.mjs`. Variables privadas de producción: `MT_CLOUD_URL`, `MT_CLOUD_BRIDGE_TOKEN`, `MT_SESSION_SECRET`, `MT_ACCESS_CODE`. Nunca colocar sus valores en el repositorio ni en `dist/`.

La función Supabase `mi-torno-cloud` contiene autenticación propia por token privado; su hash está en el código. Los módulos `server/cloud-domain.mjs`, `dist/beta.mjs` y `dist/core.mjs` se empaquetan junto al punto de entrada al desplegarla. Los SQL de `supabase/migrations/` documentan el esquema aplicado; no ejecutar de nuevo la migración inicial sobre una base existente.

Ejecuta `npm test` para las pruebas automáticas. `node server.mjs` sirve únicamente los archivos de la interfaz para desarrollo; el flujo completo requiere la API configurada, como en Vercel.

La revisión de Supabase informa RLS sin políticas porque estas tablas son deliberadamente privadas para los clientes públicos. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. También informa un índice opcional en la relación de sesiones de importación: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys.
