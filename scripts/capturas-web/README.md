# Capturas de la web (sin tocar producción)

Herramientas para ver la web de `noctiluca-app` con datos de ejemplo y sacar capturas con Chrome headless. Sirven para verificar cambios visuales.

- `backend-falso.mjs` — imita lo mínimo de la API (login, `/api/Sync/cambios`, `/api/Sync/aplicar`) en el puerto **5072** con carpetas, escritos, hábitos y objetivos de ejemplo. Acepta cualquier token.
- `servidor-estatico.mjs` — sirve un export web con fallback SPA y headers COOP/COEP (expo-sqlite los necesita).
- `capturar.mjs` — maneja Chrome por CDP siguiendo una lista de pasos JSON (`ir`, `js`, `click`, `esperar`, `foto`, `tam`). Ver `ejemplo-app.json`.

## Uso

```bash
cd scripts/capturas-web
node backend-falso.mjs &

# Export de producción de la web apuntando al backend falso
(cd ../../noctiluca-app && EXPO_PUBLIC_API_URL=http://localhost:5072 npx expo export --platform web --output-dir /tmp/noctiluca-dist)
node servidor-estatico.mjs /tmp/noctiluca-dist 8082 &

node capturar.mjs ejemplo-app.json   # deja PNGs en /tmp
```

Notas:
- El modo dev (`expo start --web`) muestra un overlay de error de NativeWind ("Cannot manually set color scheme…"), por eso se usa el export.
- Para navegar conviene `click` (navegación interna) en vez de `ir`: una recarga completa a veces dispara el bloqueo de OPFS descrito en `PLAN_WEB.md`.
- El fe viejo se puede comparar con `git archive HEAD` de `noctiluca-fe` a una carpeta temporal + `npx vite --port 3000` (su proxy apunta a 5072). Token en localStorage `auth-storage`: `{"state":{"token":"…","isAuthenticated":true},"version":0}`.
- Al terminar, matar los procesos en 5072 y 8082.
