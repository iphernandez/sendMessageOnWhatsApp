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

## Matriz de roles

La app distingue dos tipos de acceso:

| Rol | Acceso | Requiere PAT de GitHub | Puede editar datos |
|---|---|---:|---:|
| Usuario autenticado no admin | Dashboard y Cuenta | No | No |
| Administrador | Todo el resto (Roster, Captura Semanal, Equipos, Convocatoria, Ajustes, Usuarios) | Sí, para push de GitHub y administración avanzada | Sí |

Enrutamiento real:

- `authGuard` protege las pantallas básicas: `/` y `/cuenta`.
- `adminGuard` protege `/roster`, `/captura`, `/equipos`, `/convocatoria`, `/ajustes` y `/usuarios`.
- La lectura del dataset compartido se intenta automáticamente al primer login si la base local está vacía; no hace falta un PAT para esa lectura pública si el repo es público.
- El PAT sigue siendo necesario para escribir en GitHub y para la sincronización que modifica datos compartidos.

## Auto-sync en primer login

Cuando un usuario autenticado entra por primera vez y la base local de IndexedDB está vacía, la app intenta
hacer un pull del archivo compartido `FFCH_Puntuacion/data/ffch-puntuacion.json` desde GitHub.

Esto tiene dos ventajas importantes:

- un usuario nuevo puede ver los datos sin tener que navegar manualmente a Ajustes;
- un administrador no necesita recrear la base local en cada navegador nuevo.

La lógica es segura por diseño:

- si ya hay datos en la base local, no se sobreescribe automáticamente;
- si la base local está vacía, se rellena desde GitHub;
- los cambios explícitos y los pushes siguen siendo solo para administradores.

En otras palabras, la sincronización automática es una carga inicial de arranque, no un refresh silencioso en cada login.

## Cómo crea equipos el balanceador

El servicio `TeamBalancerService` sigue una estrategia greedy de tipo "snake draft":

1. Ordena los jugadores seleccionados por `rating` descendente.
2. Recorre la lista en ese orden.
3. Si el equipo A tiene menos total acumulado que el equipo B, el jugador va a A; si no, va a B.
4. Acumula el `total` de cada equipo con el valor del `rating` de cada jugador.
5. Devuelve dos equipos con `total` y `promedio` calculados sobre esos ratings.

El algoritmo es intencionalmente simple y rápido: mantiene los equipos lo más parejos posible sin intentar una búsqueda combinatoria completa.

### Cálculo del rating inicial a partir de puntos

Cuando un jugador no tiene un `rating` persistido aún, se genera desde `puntos`:

- se toma el máximo `puntos` del conjunto activo,
- se normaliza cada jugador a escala `1..10`,
- se redondea para mantener un entero,
- y el valor final queda acotado entre `1` y `10`.

Esto hace que el primer balanceo sea razonable sin necesidad de tener un histórico previo.

### Efecto del último partido

Cuando el administrador marca quién ganó el último partido en la pantalla del balanceador:

- jugadores del equipo ganador: `rating = rating + 1`
- jugadores del equipo perdedor: `rating = rating - 1`
- el resultado queda clavado entre `1` y `10`

Esto hace que el rating evolucione con el resultado de las partidas y que los equipos siguientes se generen con una tendencia histórica ligera pero persistente.

## Restricciones de equipo

El balanceador también acepta restricciones de "no pueden ir juntos". Cada restricción es un par de jugadores y se valida por `playerId` interno; el `WA number` solo se usa como etiqueta de visualización.

Ejemplos de restricciones soportadas:

- Jose no puede ir en el mismo equipo que Andrew.
- Jonathan no puede ir en el mismo equipo que Michael G.

En la pantalla de `Equipos`, el administrador puede:

- seleccionar dos jugadores desde el dropdown,
- guardar la restricción,
- ver la lista de restricciones activas,
- eliminar las que ya no aplique.

Las restricciones se guardan en IndexedDB, bajo la clave `team-balancer:restrictions`, para que sean administrables desde la app y no dependan de un archivo estático de config.

## Publicación en GitHub Pages

Ver [DEPLOY.md](./DEPLOY.md) para el checklist completo (única vez) y cómo funciona el despliegue
automático vía GitHub Actions en cada cambio a `webApp/`.
