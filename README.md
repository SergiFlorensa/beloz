# Beloz Node API

Servidor del catalogo, cuentas, pedidos y chat de Beloz. La aplicacion Android
e iOS esta en el repositorio separado `SergiFlorensa/Beloz-App`.

## Preparacion en macOS

1. Instala una version mantenida de Node.js 22 LTS. Con `nvm`, ejecuta
   `nvm install` y `nvm use` desde esta carpeta: `.nvmrc` selecciona 22.23.4.
   No se necesita copiar `node_modules` desde otro ordenador.
2. Revisa `package.json` y `package-lock.json`, y ejecuta `npm ci` para instalar
   las versiones fijadas. Algunos modulos nativos pueden usar instaladores;
   `bcrypt` y el modulo opcional de macOS `fsevents` declaran scripts de
   instalacion. Instala unicamente desde una fuente de confianza.
3. Ejecuta `npm test` y `npm audit`. La revision se probo en Windows con
   Node 22.18.0, no en macOS; verifica el resultado en tu Mac.

## Desarrollo local

Copia `.env.example` a `.env.local` y configura tu propia `DATABASE_URL` y
un `JWT_SECRET` aleatorio. No compartas ni subas el archivo de configuracion.
Utiliza una base de pruebas: importar un backup o arrancar otros procesos puede
modificar datos, y este repositorio no incluye una base de datos ni un backup.

Ejecuta `npm run dev:local`. Por defecto solo escucha en `127.0.0.1:3000`.
El simulador iOS del mismo Mac puede alcanzar el servidor a nivel de red, pero
la app iOS exige HTTPS tambien en el simulador: configura un endpoint HTTPS
valido antes de conectarla al servidor local. Un telefono fisico necesita
ademas una direccion accesible por red. Exponer el servidor a la red requiere
evaluar antes sus riesgos. Para escuchar en otra interfaz se puede configurar
`HOST` en `.env.local`.

Las cuentas y la API deben probarse con datos ficticios. La funcionalidad de
almacenamiento de tarjetas esta desactivada; no introduzcas tarjetas reales.
Sin `JWT_SECRET` persistente en desarrollo se utiliza una clave temporal y las
sesiones dejan de ser validas al reiniciar. Produccion necesita un secreto
aleatorio persistente y configuracion de base de datos y HTTPS adecuadas.

El servidor en Render utiliza su propia configuracion y despliegue. No se
actualiza simplemente modificando una copia local. No se han comprobado aqui
las credenciales, la base de datos ni la configuracion actual de Render.
