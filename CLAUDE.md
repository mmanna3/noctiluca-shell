# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Apps activas

| Carpeta | Estado | Qué es |
|---------|--------|--------|
| **`noctiluca-app/`** | ✅ **ACTIVA** | Frontend: Expo (React Native) para iPhone + web. Ver `noctiluca-app/CLAUDE.md` |
| **`noctiluca-be/`** | ✅ **ACTIVA** | Backend: .NET 8 Web API (puerto 5072). Ver `noctiluca-be/README.md` |
| `noctiluca-fe/` | ⛔ **DEPRECADA** | Frontend viejo (React + Vite PWA). Reemplazado por `noctiluca-app`. Solo referencia: **no modificar** |
| `migracion/` | ⛔ Histórico | Material de migraciones pasadas |

Los features nuevos de frontend van **siempre** en `noctiluca-app`. Si un documento (incluido `docs/CONTEXTO-NOCTILUCA.md`) habla de `noctiluca-fe`, esa parte está desactualizada para el frontend.

## 🚧 Trabajo en curso

- **Mejorar la web de `noctiluca-app`** → leer [`PLAN_WEB.md`](PLAN_WEB.md) antes de empezar: diagnóstico, propuesta priorizada y decisiones pendientes. Para verificar cambios visuales con capturas: `scripts/capturas-web/`.

## Estructura del repo

Este repo raíz es un "paraguas": solo contiene docs, scripts y CI (backup). **Cada app es un repo git independiente** (están en `.gitignore`), así que los commits se hacen dentro de cada carpeta:

- `noctiluca-app` → github.com/mmanna3/noctiluca-app
- `noctiluca-be` → repo propio
- Raíz → `CLAUDE.md`, `README.md`, `docs/`, `scripts/`, `.github/workflows/backup.yml`, planes (`PLAN_*.md`)

## Comandos

### App (noctiluca-app)
```bash
cd noctiluca-app
npm start              # Dev server (Expo)
npm run ios            # Simulador iOS
npm run web            # Web en navegador
npm run lint
npm run desplegar:web  # Export web + EAS Hosting
```
Más detalle en `noctiluca-app/CLAUDE.md`.

### Backend (noctiluca-be/Api)
```bash
cd noctiluca-be/Api
dotnet run --watch                          # Dev server with hot reload
dotnet test --configuration Release         # Run tests
dotnet ef migrations add NombreMigracion    # Create migration
dotnet ef database update                   # Apply migrations
```

### Scripts
```bash
./scripts/generar-contrato-be-en-app.sh  # Regenera noctiluca-app/src/api/clients.ts desde el OpenAPI del backend
./scripts/buen-dia.sh                    # Abre el entorno de dev (app + be + docker) en pestañas de iTerm
```

### Base de datos local (Docker)
```bash
docker run --cap-add SYS_PTRACE -e 'ACCEPT_EULA=1' -e 'MSSQL_SA_PASSWORD=Pas$word!39' -p 1433:1433 --name noctiluca-localhost -d mcr.microsoft.com/azure-sql-edge
```

## Arquitectura

### App (noctiluca-app)
- Expo Router (file-based routing en `src/app/`), NativeWind, Zustand, TanStack Query
- Cliente API auto-generado en `src/api/clients.ts` (NSwag, **no editar a mano**: regenerar con el script)
- Offline con expo-sqlite (`src/sync/`), sincroniza contra el `SyncController` del backend

### Backend (Clean Architecture)
- **Api/Controllers/**: REST endpoints. `ABMController` is the generic CRUD base.
- **Core/**: Business logic layer — entities (`Entidades/`), DTOs, service classes suffixed `Core` (e.g., `CarpetaCore`, `EscritoCore`), repository interfaces
- **Persistencia/**: EF Core data access — `AppDbContext`, `RepositorioBase`, repository implementations
- **DI config**: `_Config/InyeccionDeDependenciasConfig.cs`
- **Mapping**: AutoMapper profiles in `_Config/MapperConfig.cs`
- **Swagger**: Available at `/swagger` in development
- Docs offline: `noctiluca-be/docs/modo-offline.md`

### Entity Relationships
- Usuario → Rol (1:N), Usuario → Carpeta (1:N)
- Carpeta → Escrito (1:N), Carpeta → CriterioDeOrden (N:1)

## Code Conventions

- Todo el código y los nombres en **español**

### App
- Tabs (4-space width), double quotes, semicolons required
- Components: PascalCase; hooks: `use-`/`usar-` kebab-case; utilities: kebab-case
- `@/` alias maps to `src/`

### Backend
- PascalCase for classes, methods, properties; camelCase for locals
- DTOs suffixed with `DTO`, services suffixed with `Core`, interfaces prefixed with `I`

## CI/CD
- **Backend**: AppVeyor builds on main, deploys via WebDeploy to Plesk
- **App**: iPhone vía EAS Build (interno); web vía EAS Hosting (`npm run desplegar:web`)
