# Revision de seguridad del servidor Node

Fecha: 9 de noviembre de 2026. Alcance: copia local del repositorio Node,
incluidos los cambios locales que ya existian antes de esta revision. No se
han revisado la configuracion real de Render, la base de datos ni macOS.

## Dependencias

La auditoria inicial de npm encontro cinco paquetes transitivos afectados.
Sin forzar cambios de version principal, se han actualizado en el lockfile:

- `body-parser` 1.20.8 a 1.20.9: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), alta, denegacion de servicio con determinados cuerpos comprimidos.
- `proxy-addr` 2.0.7 a 2.0.8: [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), critica, suplantacion de IP bajo configuraciones concretas de subredes de proxy. La configuracion local examinada usa un numero de saltos, no se ha demostrado la configuracion afectada.
- `ip-address` 10.7.2 a 10.7.6: [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5), media, procesamiento costoso de entradas especificas.
- `qs` 6.16.0 a 6.16.2: [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), media, excepcion bajo condiciones especificas de serializacion.
- `undici` 7.29.1 a 7.30.2: multiples avisos altos y medios, incluidas condiciones de TLS y denegacion de servicio; consulta [los avisos del proyecto](https://github.com/nodejs/undici/security/advisories). No se ha demostrado que todas sus vias sean alcanzables en Beloz.

Tras actualizar el lockfile, `npm audit` no devolvio avisos y una consulta
OSV sobre 196 entradas tampoco devolvio coincidencias, incluidos identificadores
de paquetes maliciosos conocidos. Esto no es prueba de que los paquetes, el
repositorio o el ordenador esten libres de malware o problemas desconocidos.

El directorio `node_modules` original no se ha modificado. Puede contener las
versiones anteriores: para trabajar con las nuevas debe actualizarse en un
entorno controlado. `npm ci` elimina y reconstruye `node_modules`, asi que no
debe ejecutarse sobre una instalacion que contenga cambios manuales a conservar.
Los modulos `bcrypt` y `fsevents` declaran scripts de instalacion; `fsevents`
es opcional y especifico de macOS. En una copia de prueba de Windows se ejecuto
`npm ci --ignore-scripts`, no una instalacion nativa en macOS.

## Protecciones y limites

- El codigo local ya contenia comprobaciones de token, propiedad de cuenta,
  limites de solicitudes, configuracion CORS y comprobaciones de TLS. Se han
  revisado sus pruebas, pero no se ha verificado su despliegue real ni su
  funcionamiento contra una base real.
- El almacenamiento de tarjetas esta desactivado en el codigo local. No se ha
  comprobado el comportamiento del servicio desplegado.
- El inicio de desarrollo local ahora escucha en `127.0.0.1` por defecto. Se
  puede escoger otra interfaz mediante `HOST`; hacerlo expone el servicio a
  otras maquinas y requiere una revision previa.
- Se ha documentado Node 22 LTS y se ha agregado `.nvmrc`. El entorno usado
  para las pruebas era Windows con Node 22.18.0; `.nvmrc` propone 22.23.4,
  version que no se ha instalado ni probado aqui. Conviene utilizar la ultima
  revision compatible de Node LTS y repetir las pruebas en macOS.
- Los paquetes directos revisados tienen uso en servidor o scripts. No se han
  eliminado dependencias ni archivos de utilidad incierta; las definiciones
  `@types/*` son candidatas a revisar si no se usan para el editor, pero no se
  ha demostrado que sobren.
- Los cambios preexistentes del repositorio se han preservado. No se ha hecho
  commit, push, despliegue ni cambio de credenciales en Render.

## Verificacion

En una copia aislada, las 25 pruebas existentes pasaron en Windows y el
servidor de desarrollo arranco escuchando en la interfaz local. Las pruebas
no sustituyen una prueba de integracion con PostgreSQL ni validan iOS, macOS,
el servicio publico o su configuracion de produccion.
