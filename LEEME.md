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


## Foto de etiqueta y sonido

En Nuevo producto, pulsa **Tomar foto y sugerir datos**. El OCR experimental Tesseract.js 7.0.0 lee la etiqueta en el navegador; propone nombre, marca, medidas y código cuando puede distinguirlos. Revisa y corrige las sugerencias y pulsa Aplicar. Cantidad, mínimo y ubicación nunca se deducen de una foto. La aplicación no guarda un producto hasta confirmar el formulario. La marca es una sugerencia basada en líneas de texto; no es reconocimiento garantizado del envase ni consulta de un catálogo externo.

La primera lectura descarga código y modelos de idioma desde servicios CDN y necesita conexión. No se envían fotos a un servicio de análisis. El texto puede fallar con reflejos, tipografía de logotipos, envases curvos o mala iluminación. Hay progreso, límite de espera y alternativa manual.

El visor de barras es compacto y procesa la franja visible centrada. Los códigos confirmados por cámara, foto o entrada manual producen un pitido. Usa Probar pitido para comprobar el volumen; el navegador y el modo silencio pueden impedir sonido. La lectura de barras en vivo sigue dependiendo de BarcodeDetector; fotografiar los números es una alternativa OCR, no un decodificador universal de barras.

Verificado: extracción real de una etiqueta sintética (DUCAL, Ketchup, 400 g y código) con Tesseract 7.0.0, reglas de sugerencias y GTIN, retorno del código al formulario, un pitido por lectura aceptada y manejo simulado de permisos/cierre de cámara. Cámara física, sonido audible y aspecto final en tu teléfono pendientes de verificación en el dispositivo.
