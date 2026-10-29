# Mi Torno Gestión · Beta 1

Aplicación web/PWA responsive para el taller Mi Torno. Inventarios real y de pruebas separados, almacenamiento local y modo conectado con una pantalla principal.

## Qué incluye

- Búsqueda por nombre, código, marca, medidas y ubicación.
- Productos con foto, stock mínimo y deseado, y ubicación opcional.
- Entradas, salidas y conteos con vista previa, motivo y responsable.
- Reposición automática con lista de compra exportable.
- Escaneo por cámara, lector Bluetooth/USB tipo teclado y teléfono vinculado por QR.
- Envío de fotos desde el teléfono; portada persistida por código.
- Inventario conectado: consultar y confirmar movimientos en la principal desde el teléfono.
- Exportación/restauración de copias JSON, recuperación local y protección frente a cambios en otra pestaña.
- Navegación táctil para móvil/tablet, iconos PWA y bip corto con volumen ajustable.

## Publicar en Vercel

Importa este repositorio, raíz del repositorio como Root Directory, framework Other, sin comando de compilación y carpeta de salida **dist**. La configuración está en vercel.json.

## Probar localmente

Con Node.js 22 o posterior:

```sh
node server.mjs
```

Abre http://localhost:4173.

Pruebas sin instalar dependencias:

```sh
node --test tests/core.test.mjs tests/connected.test.mjs tests/sound.test.mjs
```

## Presentación y alcance

Consulta [GUIA-BETA1.md](GUIA-BETA1.md) para el ensayo de presentación y [LEEME.md](LEEME.md) para funcionamiento, límites y verificación.

**El modo conectado requiere que la pantalla principal permanezca abierta. No hay sincronización permanente en la nube ni fusión de cambios offline.** Los datos se guardan en el navegador de la principal; exporta copias y no uses esta beta como único registro definitivo del taller todavía.
