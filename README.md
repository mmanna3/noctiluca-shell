# Noctiluca

Monorepo de **Noctiluca**: PWA para gestionar escritos organizados en carpetas, con objetivos periódicos y tracker de hábitos.

| App | Estado | Stack | Carpeta |
|-----|--------|-------|---------|
| App (iPhone + web) | ✅ Activa | Expo (React Native) + Expo Router + expo-sqlite | [`noctiluca-app/`](noctiluca-app/) |
| Backend | ✅ Activa | .NET 8 Web API + EF Core | [`noctiluca-be/`](noctiluca-be/) |
| Frontend viejo | ⛔ Deprecada (solo referencia) | React 18 + Vite + Dexie (PWA) | [`noctiluca-fe/`](noctiluca-fe/) |

Cada app es un repo git independiente; este repo raíz solo tiene docs, scripts y el workflow de backup.

## Modo offline-first

La aplicación funciona **offline-first**: los datos viven en el cliente (SQLite en `noctiluca-app`) y se sincronizan con el backend mediante una API dedicada (pull/push, cola de mutaciones, resolución last-write-wins).

Documentación detallada:

- **[Frontend viejo — modo offline](noctiluca-fe/docs/modo-offline.md)** — diseño original con Dexie (deprecado; la app reimplementa lo mismo en `noctiluca-app/src/sync/`)
- **[Backend — modo offline](noctiluca-be/docs/modo-offline.md)** — `EntidadSincronizable`, `SyncController`, `SyncCore`, tombstones, tests

Contexto general del proyecto: [`docs/CONTEXTO-NOCTILUCA.md`](docs/CONTEXTO-NOCTILUCA.md) (la parte de backend está vigente; la de frontend describe `noctiluca-fe`)

## Desarrollo local

```bash
# App (Expo)
cd noctiluca-app && npm start

# Backend (puerto 5072)
cd noctiluca-be/Api && dotnet run --watch

# Regenerar cliente TS de la app desde OpenAPI
./scripts/generar-contrato-be-en-app.sh

# Abrir todo el entorno en iTerm
./scripts/buen-dia.sh
```

Ver también `CLAUDE.md` en la raíz y en cada subproyecto.
