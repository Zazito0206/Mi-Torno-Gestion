# Mi Torno Gestión · Beta 0.1

Prototipo local, sin backend ni despliegue. Abre una terminal en esta carpeta y ejecuta `node server.mjs` (requiere Node.js). Visita http://localhost:4173. No abras index.html directamente: los módulos y la PWA requieren un servidor.

## Prueba sugerida

1. Empieza en **Modo de pruebas**. Busca `crema`, `TEST-001`, `M20` o una ubicación.
2. Abre Ketchup, suma 3 unidades y registra una salida de 2. Comprueba el historial.
3. Selecciona conteo físico, escribe el total contado y un motivo. Revisa la diferencia antes de confirmar.
4. Crea un producto con foto, cantidad, mínimo y ubicación. Repite su código: se ofrecerá abrir la ficha existente para sumar, corregir o cambiar ubicación.
5. En Escanear, introduce TEST-001 manualmente. La ficha debe abrirse sin modificar cantidades. Un código desconocido permite crear una ficha.
6. Cambia a Inventario real y crea un producto de prueba reconocible. Desde Datos y ajustes limpia las pruebas. Confirma que ese producto real permanece. Los ejemplos son ficticios y no se mezclan con el real.
7. Exporta una copia JSON desde Datos y ajustes. Guarda el archivo fuera del navegador.

## Móvil y PWA

La interfaz se adapta a móvil, tablet y PC. Para probar la cámara en un teléfono, sirve `dist/` en un alojamiento HTTPS de confianza. `localhost` en el teléfono apunta al propio teléfono, no a la laptop. Este servidor de desarrollo acepta solo conexiones locales. No hay una URL pública ni sincronización entre equipos.

La lectura automática usa BarcodeDetector cuando existe en el navegador (su disponibilidad varía). Requiere permiso de cámara y contexto seguro. Hay entrada manual como alternativa. Identificar significa encontrar un código registrado en el catálogo activo, no consultar una base mundial de productos. OCR aún no implementado.

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

