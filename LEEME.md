# Mi Torno Gestión · 1.0.0-beta.1

Beta para probar y presentar el control de inventario del taller Mi Torno.

## Datos y recuperación

Pruebas e inventario real usan almacenamientos separados. La beta conserva el formato de datos versión 1 para abrir inventarios de versiones anteriores. Si detecta datos corruptos, no los reemplaza por un inventario vacío: muestra un aviso y bloquea las escrituras hasta recuperar una copia.

En Datos y ajustes puedes descargar una copia JSON con productos, fotos e historial. Restaurar valida cantidades, códigos únicos, imágenes y fechas y exige que la copia pertenezca al mismo entorno (pruebas o real). Se muestra un resumen y se confirma el reemplazo. La restauración reemplaza ese inventario; no mezcla archivos.

Se intenta conservar una versión local anterior después de cada guardado. Su disponibilidad depende de la cuota del navegador y no sustituye una copia descargada. Si otra pestaña cambia el inventario, una ficha antigua no puede sobrescribirlo: cierra la ficha para actualizar los datos.

Límites de importación: 16 MB de texto, 10.000 productos, 100.000 movimientos y fotos locales JPEG/PNG/WebP de hasta 1,8 MB de texto base64. El espacio total disponible depende del navegador. Los primeros 250 movimientos se muestran en pantalla; la copia completa incluye todos.

## Flujo diario

Los botones Registrar entrada y Registrar salida abren el lector y luego la ficha con la operación seleccionada. Puedes cambiar a conteo físico, usar los botones de cantidad, revisar el antes/después y confirmar. No se aceptan fracciones, cantidades negativas ni salidas mayores al stock. Los conteos necesitan una nota y se rechazan si cambió la cantidad mientras se estaba contando.

El nombre guardado en Quién registra aparece en los nuevos movimientos; es una etiqueta, no una cuenta autenticada. El motivo puede ser compra, trabajo de taller, venta, devolución, daño u otro.

El stock mínimo dispara Reposición. El objetivo puede indicarse al crear/editar el producto. Si se deja en cero, se calcula un objetivo mayor que el mínimo. La lista sugiere cuántas unidades comprar y se exporta como CSV.

Estante, repisa/nivel y caja/recipiente son opcionales: indican dónde encontrar el producto. Ejemplo: estante A, repisa 2, caja 3.

## Escaneo y fotografías

La cámara requiere HTTPS o localhost y permiso del navegador. La lectura de barras usa BarcodeDetector cuando existe. Se puede escribir el código o fotografiar sus números impresos y confirmar lo leído; no se autocompletan nombres ni marcas.

Los lectores Bluetooth/USB funcionan si se emparejan en el sistema como teclado/HID y terminan con Enter. La web no empareja directamente Bluetooth ni implementa perfiles propietarios. En el campo Código del alta, Enter confirma la lectura sin guardar por sí mismo el producto.

Vincular escáner muestra el QR de la pantalla receptora. Vincular como escáner abre el lector QR integrado en el teléfono. Se acepta automáticamente una invitación válida y temporal; no se pide otra confirmación en la principal. El lector QR usa la API nativa o jsQR 1.4.0 como alternativa. Rechaza QR ajenos y enlaces de otra dirección de la aplicación.

Después de enviar un código, el teléfono puede tomar y enviar una foto. Si el producto ya existe, la portada se guarda en la principal sin tocar cantidades. Si es nuevo, queda en su ficha y hay que completar y crear el producto. Si se está editando otro producto, la foto queda pendiente para no cerrar esa ficha.

La limpieza automática de fotos solo separa fondos lisos con suficiente contraste. No reconoce semánticamente manos ni reconstruye zonas tapadas. Retocar foto permite borrar sobre blanco, deshacer y aplicar o cancelar. Las fotos no se envían a un servicio de análisis de imágenes; el OCR de códigos se procesa en el navegador y descarga sus componentes bajo demanda.

## Inventario conectado

El teléfono vinculado ofrece Ver inventario conectado. Consulta productos y cantidades de la pantalla principal y confirma entradas, salidas y conteos allí. La principal valida y guarda cada solicitud. Los identificadores de solicitud evitan repetir un movimiento cuando se reintenta una confirmación. El entorno real/pruebas y los conteos obsoletos se validan en la principal.

La lista se actualiza cada cinco segundos mientras está abierta y tras confirmar un movimiento. Las consultas incluyen hasta 3.000 productos y 2 MB de texto; no copian fotos. Se muestra cuántos productos se están consultando. Los catálogos mayores deben manejarse desde la principal.

La sesión usa WebRTC, PeerJS 1.5.5 con su servicio público de señalización y Google STUN. Necesita internet para iniciar, ambas páginas abiertas y dispositivos activos. No se configuró TURN: ciertas redes móviles o corporativas pueden impedir la conexión. La misma Wi-Fi es preferible para el ensayo, sin garantizar todas las redes.

La pantalla principal es la autoridad y su navegador guarda los datos. El teléfono no reemplaza su propio inventario local con el catálogo recibido. Cerrar/recargar una página o suspender el teléfono puede terminar la sesión. No hay base de datos propia en la nube, cuentas, permisos por usuario, sincronización permanente ni fusión de trabajo offline.

## Instalación y modo sin conexión

El manifiesto incluye iconos PNG de 192 y 512 px. En navegadores compatibles aparecerá Instalar app; también puedes usar el menú del navegador. La interfaz se guarda después de una primera carga completa. Los datos locales pueden consultarse y editarse sin conexión, pero la vinculación y las descargas iniciales de lectores necesitan internet.

Tras actualizar, cierra y vuelve a abrir las páginas de la aplicación en ambos dispositivos antes de generar una nueva vinculación.

## Verificación de esta versión

- Ocho pruebas incluidas en tests/: movimientos, validación/restauración, separación real/pruebas, fotos en copias, reposición, comandos idempotentes y consulta/movimientos conectados con respuestas fragmentadas en transporte simulado.
- Prueba de interfaz con DOM: arranque completo, alta, entrada, salida, conteo, responsable, restauración, aislamiento entre inventarios, recuperación de corrupción y conflictos de pestañas.
- Regresiones: fotos persistidas y visibles en tarjetas al recargar datos, enlace automático, envío de fotos, HID simulado, cámara, pitido, borrador y deshacer.
- El servidor local devolvió HTTP 200 para la página y los módulos principales. Se comprobaron la sintaxis y la integridad de los recursos de la interfaz.

La automatización visual de navegador no pudo iniciarse por restricciones del entorno de Windows. No se completó revisión de píxeles ni cámara/lector físico en un teléfono, tablet o PC real. Antes de la presentación hay que ensayar GUIA-BETA1.md en los equipos del taller. La beta está preparada para esa prueba; todavía no debe ser el único registro definitivo del inventario.

