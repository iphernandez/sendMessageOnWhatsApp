# Publicar webApp en GitHub Pages (checklist)

Estos pasos son **únicos** (solo la primera vez). Después de esto, cada `push` a `main` que toque
`webApp/**` publica automáticamente vía GitHub Actions.

## 1. Activar GitHub Pages con origen "GitHub Actions"

1. Ve a **Settings → Pages** en el repositorio.
2. En **Build and deployment → Source**, selecciona **GitHub Actions** (no "Deploy from a branch").
3. Guarda. No hace falta crear ninguna rama `gh-pages` manualmente.

## 2. Primer despliegue

- Con el origen configurado, simplemente haz `push` a `main` (o dispara manualmente el workflow
  `Deploy webApp to GitHub Pages` desde la pestaña **Actions → Run workflow**).
- El workflow [`../.github/workflows/deploy-webapp.yml`](../.github/workflows/deploy-webapp.yml) compila
  `webApp` con `--base-href=/sendMessageOnWhatsApp/` y publica `dist/webApp/browser`.
- Al terminar, la app queda disponible en:

  ```
  https://iphernandez.github.io/sendMessageOnWhatsApp/
  ```

## 3. Crear el Personal Access Token (PAT) para sincronizar datos

La app en sí es pública y de solo lectura para cualquier visitante hasta que alguien ingresa un PAT en
**Ajustes** para poder guardar cambios. Recomendado: **fine-grained token**, no el token clásico.

1. GitHub → **Settings** (de tu cuenta, no del repo) → **Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. **Resource owner**: tu usuario/organización dueña del repo.
3. **Repository access**: "Only select repositories" → elige únicamente `sendMessageOnWhatsApp`.
4. **Permissions → Repository permissions → Contents**: **Read and write**. Deja todo lo demás en "No access".
5. **Expiration**: pon una fecha (ej. 90 días); tendrás que regenerarlo al vencer.
6. Genera el token y **cópialo una sola vez** (GitHub no lo vuelve a mostrar).
7. En la app, ve a **Ajustes → Token de GitHub** y pégalo. Se guarda solo en IndexedDB de ese navegador.

### Rotar o revocar el token

- Si el token se filtra o ya no lo necesitas: GitHub → **Developer settings → Fine-grained tokens** →
  selecciona el token → **Delete**. Luego en la app, **Ajustes → Olvidar token**.
- Repite el proceso de creación para emitir uno nuevo cuando el actual expire.

## 4. Verificación

1. Abre `https://iphernandez.github.io/sendMessageOnWhatsApp/` y confirma que el Dashboard carga.
2. Navega a otra pantalla (ej. `#/roster`) y **refresca la página** — debe seguir funcionando gracias al
   ruteo por hash (`withHashLocation()`), sin dar 404.
3. En **Ajustes**, ingresa el PAT y prueba "⬇ Sincronizar desde GitHub" y luego "⬆ Guardar cambios en
   GitHub" para confirmar el flujo de lectura/escritura contra `FFCH_Puntuacion/data/ffch-puntuacion.json`.
