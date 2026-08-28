# FFCH Puntuación — Web App (Angular)

Aplicación web que reemplaza `FFCH_Puntuacion/FFCH - Puntuacion.xlsx`: lleva el registro semanal de
asistencia/pago de los jugadores, calcula sus puntos y TDP, arma equipos balanceados y genera el texto
de convocatoria para WhatsApp. Corre 100% en el navegador (sin servidor) y se publica gratis en GitHub Pages.

## Desarrollo local

```bash
cd webApp
npm install
npm start        # http://localhost:4200
npm test         # unit tests (Vitest)
npm run build    # build de producción en dist/webApp/browser
```

## Arquitectura

- **Angular 22**, componentes standalone, rutas con `withHashLocation()` (necesario para que las rutas
  funcionen en GitHub Pages, que no soporta rewrites del lado del servidor).
- **Base de datos local: [Dexie.js](https://dexie.org/) sobre IndexedDB** — no requiere servidor ni
  configuración; los datos viven en el navegador de quien administra la app.
- **Sincronización entre dispositivos**: un único archivo
  [`FFCH_Puntuacion/data/ffch-puntuacion.json`](../FFCH_Puntuacion/data/ffch-puntuacion.json) leído/escrito
  directamente desde el navegador vía la API de contenidos de GitHub, usando un Personal Access Token (PAT)
  que el admin ingresa en **Ajustes**. Ver [DEPLOY.md](./DEPLOY.md) para cómo crear ese token.

### Servicios principales (`src/app/core/services`)

| Servicio | Responsabilidad |
|---|---|
| `DataStoreService` | Wrapper de Dexie/IndexedDB; también guarda el PAT y hace export/import completo. |
| `ScoringService` | Reproduce las fórmulas de `FFCH_Puntuacion/formulas.txt` (`Pts`, `PtosFecha`, `TDP`, `Puntos`) y las reglas de tarjetas de `reglamento.md`. |
| `GithubSyncService` | Pull/push del JSON de datos vía GitHub Contents API. |
| `TeamBalancerService` | Arma 2 equipos balanceados por promedio de Puntos ("snake draft"). |
| `MessageTemplateService` | Rellena plantillas `{{VAR}}` como `convocatoria.md`. |
| `CsvImportService` | Migración única desde los CSV exportados del Excel original. |

### Mapeo de fórmulas del Excel original

Ver [`FFCH_Puntuacion/README.md`](../FFCH_Puntuacion/README.md) para el detalle completo de cómo se
reconstruyeron las fórmulas del Excel (`Pts`, `PtosFecha`, `TDP`, `Puntos`, pesos TDP) y las decisiones
tomadas para los casos ambiguos (PtsTemporadaAnterior, peso de Team Building, tarjetas por tardanza).

## Primeros pasos como administrador

1. Entra a **Ajustes** y, si es la primera vez, usa "Importar desde los CSV originales" para poblar el
   roster y el historial desde los archivos en `FFCH_Puntuacion/`.
2. Configura tu GitHub PAT (ver [DEPLOY.md](./DEPLOY.md)) para poder sincronizar cambios con el repositorio.
3. Usa **Captura Semanal** cada fecha para marcar RSVP/Jugó/Sede/Pago/Tarde por jugador.
4. Usa **Equipos** para armar los 2 equipos balanceados y **Convocatoria** para generar el texto a copiar
   a WhatsApp.
5. Cuando termines de editar, usa "⬆ Guardar cambios en GitHub" en **Ajustes** para que los demás
   dispositivos puedan sincronizar los cambios.

## Publicación en GitHub Pages

Ver [DEPLOY.md](./DEPLOY.md) para el checklist completo (única vez) y cómo funciona el despliegue
automático vía GitHub Actions en cada cambio a `webApp/`.
