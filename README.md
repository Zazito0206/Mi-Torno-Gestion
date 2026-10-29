# Mi Torno Gestión

Beta de inventario del taller Mi Torno. Interfaz en español, responsive, modo de pruebas separado del inventario real y almacenamiento local por navegador.

## Conectar con Vercel

Importa este repositorio como proyecto. Usa la raíz del repositorio como **Root Directory**, **Other** como framework, sin comando de compilación y **dist** como carpeta de salida. `vercel.json` ya declara estos valores.

Después del despliegue, abre la misma URL HTTPS desde computadora y móvil. La cámara requiere HTTPS y un navegador compatible con BarcodeDetector. Si no es compatible, puedes escribir el código manualmente.

**Los datos de la computadora y del teléfono todavía son independientes.** Vercel sirve la aplicación, pero esta beta no incluye backend ni sincronización. No uses aún esta beta como único registro del taller.

## Ejecutar localmente

Con Node.js instalado:

```sh
node server.mjs
```

Abre http://localhost:4173.

Consulta [LEEME.md](LEEME.md) para los flujos de prueba, límites y arquitectura prevista.
