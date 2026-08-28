# FFCH_Puntuacion

Datos y migración del sistema de puntuación de la FFCH, originalmente llevado en
`FFCH - Puntuacion.xlsx`. La app Angular en [`../webApp/`](../webApp/) reemplaza este Excel; esta carpeta
guarda las fuentes originales (para referencia) y los datos versionados que usa la app.

## Archivos

- `FFCH - Puntuacion.xlsx` — Excel original (referencia histórica, ya no se edita).
- `FFCH - Puntuacion - 2026 Puntos.csv` / `FFCH - Puntuacion - TDP.csv` — exportes CSV usados para la
  migración inicial (ver `webApp` → Ajustes → "Importar desde los CSV originales").
- `formulas.txt` — fórmulas originales de Excel documentadas manualmente (base de la migración).
- `data/ffch-puntuacion.json` — **fuente de verdad actual**, leída/escrita por la app vía GitHub API.
  No editar a mano salvo para corregir un dato puntual; usa la app siempre que sea posible.

## Fórmulas migradas (`webApp`'s `ScoringService`)

Verificadas contra la tabla de leyenda al final de `FFCH - Puntuacion - TDP.csv`
(columnas `Convocado,Jugo,Sede,...,Pts,Casta`):

- `Pts` = árbol de decisión sobre `(RSVP, Jugo, Sede)`:

  | RSVP | Jugó | Sede | Pts |
  |---|---|---|---|
  | 1 | 1 | 1 | 5 |
  | 1 | 1 | 0 | 3 |
  | 1 | 0 | 1 | 1 |
  | 1 | 0 | 0 | -3 |
  | 0 | 1 | 1 | -1 |
  | 0 | 1 | 0 | -2 |
  | 0 | 0 | 1 | 7 |
  | 0 | 0 | 0 | 0 |

- `PtosFecha` = si no jugó, `Pts` se mantiene; si jugó, se pone en `0` cuando hay sanción esa fecha
  (tarjeta roja por tardanza o por no pago). Ver reglas de tarjetas abajo.
- `Puntos` (total) = `(1 + TDP%) * SUMA(PtosFecha de todas las fechas [+ PtsTemporadaAnterior])`.
- `PtsTemporadaAnterior` = `7` si el jugador fue sede la temporada anterior, si no `0`. **Se incluye**
  dentro de la suma que alimenta `Puntos` (decisión confirmada).
- `TDP%` = suma ponderada de participación histórica por categoría/año: Año (2%), Pre temporada (1%),
  Galas (1%), Socios Fundadores (2%), Partido del Pavo (1%), Anfitrión Gala (1%), Team Building (1%,
  **peso independiente** del de Anfitrión Gala aunque el Excel original reusaba esa misma celda). Los
  pesos son editables en la app (Roster → Pesos TDP).

## Reglas de tarjetas (`reglamento.md`)

- 1ª tardanza (5+ min) en la temporada → Tarjeta Amarilla (solo advertencia, sin penalización de puntos).
- 2ª tardanza (o más) → Tarjeta Roja **esa fecha** → `PtosFecha = 0` esa fecha únicamente.
- No pagar la renta antes de la convocatoria → Tarjeta Roja → `PtosFecha = 0` esa fecha.

> Nota de migración: los CSV originales combinaban pago y tardanza en una sola columna
> (`Pago`/`Pago/Tarde`), por lo que el historial migrado no distingue cuál regla aplicó en el pasado
> (`tarde` queda `null` para fechas migradas). Desde la fecha de migración en adelante, la app captura
> `Pago` y `Tarde` por separado y aplica la lógica de arriba automáticamente.

## Campos nuevos (no existían en el Excel)

- `cupoExPat` (por jugador) — marcador de cupo de extranjero; hoy es solo informativo en la UI, sin
  lógica especial de balanceo de equipos.
- `tarde` (por jugador/fecha) — booleano capturado semana a semana para automatizar las tarjetas
  amarilla/roja por tardanza (antes solo había contadores agregados por temporada en `config.json`).

## Re-ejecutar la migración

Si necesitas volver a importar desde cero: `webApp` → **Ajustes → Importar desde los CSV originales**,
selecciona ambos archivos CSV de esta carpeta. Esto **reemplaza** todos los datos locales (IndexedDB) —
revisa las advertencias que muestra el importador (jugadores no encontrados, fechas no reconocidas, etc.)
antes de sincronizar los cambios a GitHub.
