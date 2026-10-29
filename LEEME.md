# Mi Torno Gestión · Beta 0.1

Beta con almacenamiento local, lista para servir en Vercel; sin backend ni sincronización. Abre una terminal en esta carpeta y ejecuta `node server.mjs` (requiere Node.js). Visita http://localhost:4173. No abras index.html directamente: los módulos y la PWA requieren un servidor.

## Prueba sugerida

1. Empieza en **Modo de pruebas**, vacío por defecto. Crea tu primer producto con foto, cantidad, ubicación y código. Luego búscalo por nombre, marca o código.
2. Abre el producto que creaste, suma 3 unidades y registra una salida de 2. Comprueba el historial.
3. Selecciona conteo físico, escribe el total contado y un motivo. Revisa la diferencia antes de confirmar.
4. Crea un producto con foto, cantidad, mínimo y ubicación. Repite su código: se ofrecerá abrir la ficha existente para sumar, corregir o cambiar ubicación.
5. En Escanear, introduce el código que registraste manualmente. La ficha debe abrirse sin modificar cantidades. Un código desconocido permite crear una ficha.
6. Cambia a Inventario real y crea un producto de prueba reconocible. Desde Datos y ajustes limpia las pruebas. Confirma que ese producto real permanece. Los ejemplos son ficticios y no se mezclan con el real.
7. Exporta una copia JSON desde Datos y ajustes. Guarda el archivo fuera del navegador.

## Móvil y PWA

La interfaz se adapta a móvil, tablet y PC. Para probar la cámara en un teléfono, sirve `dist/` en un alojamiento HTTPS de confianza. `localhost` en el teléfono apunta al propio teléfono, no a la laptop. Este servidor de desarrollo acepta solo conexiones locales. La URL de Vercel depende del despliegue de tu cuenta. No hay sincronización entre equipos.

La lectura automática usa BarcodeDetector cuando existe en el navegador (su disponibilidad varía). Requiere permiso de cámara y contexto seguro. Hay entrada manual como alternativa. Identificar significa encontrar un código registrado en el catálogo activo, no consultar una base mundial de productos. También puedes fotografiar los números de un código impreso y revisar el resultado antes de aceptarlo. Se validan dígitos de control de códigos GTIN; referencias alfanuméricas requieren un rótulo como SKU o Código.

El manifiesto permite instalación en navegadores compatibles; incluye icono SVG y service worker para guardar la interfaz tras la primera carga. Algunos navegadores pueden requerir iconos PNG adicionales para ofrecer instalación. Prueba modo avión después de una primera carga completa. Las fotos se reducen a 800 px para reducir almacenamiento.

## Datos y límites

- Los inventarios real y de pruebas usan claves locales distintas. El historial pertenece a cada inventario.
- Solo cantidades enteras no negativas; una salida no puede superar el stock.
- Un conteo requiere motivo y registra antes, después y diferencia.
- Exportación JSON disponible; importación/restauración aún pendiente. No es un sistema de copias automático.
- El almacenamiento del navegador tiene cuota y puede borrarse. No hay cuentas, permisos, respaldo en servidor ni protección para varias pestañas simultáneas. Usa una sola pestaña para editar.
- No utilizar aún como único registro de inventario real del taller.

## Arquitectura para la siguiente versión

`core.mjs` concentra búsqueda y reglas de movimientos. `app.js` contiene la interfaz y el adaptador local de almacenamiento. Los productos y eventos tienen UUID; los eventos incluyen dispositivo, fecha, tipo, cantidades antes/después y estado local. La versión del formato es 1.

La siguiente etapa debe extraer el adaptador de persistencia a un repositorio asíncrono (IndexedDB), agregar API autenticada y base central, y enviar eventos con idempotencia y versiones por producto. El servidor debe validar cantidades, roles y conflictos, especialmente conteos y dos salidas simultáneas. No basta con copiar localStorage entre dispositivos. La marca `local` no implica una cola de sincronización implementada.

## Verificación realizada

Comprobación de sintaxis de los módulos y pruebas de reglas: búsqueda sin acentos, por código y medidas; entradas; salidas; rechazo de stock negativo y fracciones; conteo a cero con motivo e historial de diferencias. El servidor inició en localhost:4173; la comprobación HTTP fue bloqueada por los permisos de red del entorno.

No se completó verificación visual automatizada: la herramienta de navegador no pudo inicializarse. Cámara física, instalación PWA, comportamiento offline y disposición en dispositivos requieren las pruebas indicadas arriba.


## Foto del producto

Se retiró la lectura de etiquetas para sugerir nombre, marca, medidas y demás datos del producto. Estos campos son manuales. Elegir una foto no ejecuta OCR ni cambia la ficha. La búsqueda y el registro por códigos de barras siguen disponibles con el mismo pitido; la opción separada de fotografiar un código impreso solo propone códigos que debes confirmar.

La foto del catálogo puede tomarse o elegirse del dispositivo. Se intenta limpiar un fondo liso y poner blanco; se conserva la opción original. Esta limpieza no es una segmentación semántica y no identifica manos ni reconstruye partes ocultas del producto.

Para quitar una mano u otros restos, pulsa **Retocar foto / borrar mano**. Pinta sobre las zonas a borrar con el dedo o el mouse, ajusta el tamaño del borrador y usa Deshacer trazo si borras parte del producto. Aplica o cancela el retoque antes de guardar. El retoque usa blanco; es manual y no reconstruye lo que estaba detrás de una mano. El resultado se muestra en la portada y se guarda al confirmar el producto. La imagen original se conserva en el borrador hasta guardar para poder volver a ella.

## Ubicación opcional

- Estante: el mueble o zona, por ejemplo A.
- Repisa / nivel: la altura dentro del estante, por ejemplo 2.
- Caja / recipiente: la caja de esa repisa, por ejemplo 3.

Si no usas repisas ni cajas, deja esos campos vacíos. Tampoco es obligatorio indicar estante.

## Verificación de esta actualización

Pruebas de que elegir foto no ejecuta OCR ni cambia nombre/marca, selección entre original y portada retocada, guardado de la versión elegida, borrador con mouse/tacto simulado, deshacer y aplicación/cancelación explícitas. Pasaron las regresiones de cámara y pitido y la comprobación de sintaxis. La revisión visual y el gesto en un teléfono real siguen pendientes por el fallo de inicialización de la herramienta de navegador.

## Vincular escáner · Tablet, PC y móvil

En la pantalla principal aparece **Vincular escáner**.

### Lector Bluetooth o USB

1. Empareja el lector desde los ajustes Bluetooth del dispositivo, o conecta el USB con el adaptador adecuado.
2. Configúralo como teclado/HID, con Enter como sufijo. La web no empareja Bluetooth ni detecta por sí misma qué modelo está conectado.
3. En Vincular escáner → Lector Bluetooth / USB, activa la entrada y prueba en el campo de código.
4. En el alta puedes enfocar Código y escanear. Enter en ese campo no guarda el producto. Con la entrada activada, las lecturas rápidas fuera de campos también abren fichas o quedan pendientes si hay otra ficha abierta.

SPP/serie, lectores con aplicaciones propietarias y perfiles distintos de HID no están implementados. El emparejamiento del sistema puede persistir, pero la activación de entrada en la web pertenece a esta pestaña y debe reactivarse tras recargar.

### Teléfono como escáner remoto

1. En la tablet o PC receptora, elige el inventario de pruebas o real que usarás.
2. Pulsa Vincular escáner → Usar mi teléfono como escáner.
3. Abre el QR con la cámara normal del teléfono, o copia y abre el enlace en él. El QR se genera en el navegador y no se envía a un generador de imágenes externo.
4. En el teléfono pulsa Vincular con la pantalla receptora. En la tablet autoriza el teléfono mostrado. El diálogo de vinculación se cierra para que puedas recibir fichas.
5. Desde el teléfono pulsa Escanear y enviar. La pantalla receptora abre la ficha; si estás dando de alta un producto, llena su código. Si hay otra ficha abierta, conserva hasta diez lecturas pendientes para no descartarla. El teléfono espera confirmación de recepción. No se modifican cantidades por recibir un código.
6. Usa Desvincular al terminar. La recarga o cierre de una página termina su sesión; el teléfono en segundo plano puede perder conexión. Si falla, vuelve a vincular.

La invitación permite nuevas conexiones durante diez minutos y requiere autorización en la pantalla receptora; se usa un identificador y una clave aleatorios, guardados en el fragmento del enlace. Solo se admite un teléfono autorizado por sesión. La vinculación no copia catálogo, fotos, movimientos ni existencias.

Se utiliza WebRTC con PeerJS 1.5.5 y su servicio público de señalización, y Google STUN para descubrir la conexión. Requiere internet para cargar los componentes y establecer el enlace, sin backend propio de inventario. Ambos navegadores deben permanecer abiertos. No se configuró un servidor TURN: algunas redes móviles, corporativas o con NAT restrictivo pueden impedir la conexión; probar la misma Wi-Fi ayuda, sin garantizarla. La disponibilidad del servicio público no está bajo control del taller.

Verificado: scripts reales de PeerJS y QR, creación local del QR, respuesta OPEN del servidor de señalización, autorización y envío con confirmación en transporte simulado, rechazo antes de autorizar, protección de duplicados, desconexión, entrada HID simulada y registro por código sin guardar automáticamente. Pendiente la prueba WebRTC completa entre dispositivos físicos y con un lector Bluetooth real.
