# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noctiluca is a PWA for managing documents (Escritos) organized in folders (Carpetas). Monorepo with two apps:
- **noctiluca-fe**: React 18 + TypeScript frontend (port 3000)
- **noctiluca-be**: .NET Core 8.0 Web API backend (port 5072)

## Common Commands

### Frontend (noctiluca-fe)
```bash
cd noctiluca-fe
yarn start          # Dev server
yarn build          # Production build
yarn test           # Jest tests
yarn lint           # ESLint check
yarn lint:fix       # Auto-fix lint issues
yarn format         # Prettier formatting
yarn limpiar        # Clean node_modules and reinstall
```

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
./scripts/generar-contrato-be-en-fe.sh   # Generate TS API client from backend OpenAPI
./scripts/deploy-local.sh                # Build frontend → copy to backend wwwroot
./scripts/buen-dia.sh                    # Open full dev environment in iTerm tabs
```

### Local Database (Docker)
```bash
docker run --cap-add SYS_PTRACE -e 'ACCEPT_EULA=1' -e 'MSSQL_SA_PASSWORD=Pas$word!39' -p 1433:1433 --name noctiluca-localhost -d mcr.microsoft.com/azure-sql-edge
```

## Architecture

### Frontend
- **Routing**: React Router v6 with HashRouter, routes defined in `src/rutas.ts`
- **State**: Zustand for global state, TanStack React Query for server state
- **API client**: Auto-generated TypeScript in `src/api/clients.ts` from backend OpenAPI (do not edit manually)
- **Custom hooks**: `src/api/custom-hooks/` wraps React Query (`use-api-query`, `use-api-mutation`)
- **Auth**: JWT with `RequiereAutenticacion` wrapper component, password validation via `AppContext`
- **PWA**: Workbox service workers for offline support
- **Build**: CRACO overrides CRA; `@` alias maps to `src/`
- **Screens**: `src/pantallas/` — carpetas, escritos, login, modo-lectura, tacho (recycle bin)

### Backend (Clean Architecture)
- **Api/Controllers/**: REST endpoints. `ABMController` is the generic CRUD base.
- **Core/**: Business logic layer — entities (`Entidades/`), DTOs, service classes suffixed `Core` (e.g., `CarpetaCore`, `EscritoCore`), repository interfaces
- **Persistencia/**: EF Core data access — `AppDbContext`, `RepositorioBase`, repository implementations
- **DI config**: `_Config/InyeccionDeDependenciasConfig.cs`
- **Mapping**: AutoMapper profiles in `_Config/MapperConfig.cs`
- **Swagger**: Available at `/swagger` in development

### Entity Relationships
- Usuario → Rol (1:N), Usuario → Carpeta (1:N)
- Carpeta → Escrito (1:N), Carpeta → CriterioDeOrden (N:1)

## Code Conventions

### Frontend
- Tabs (4-space width), double quotes, semicolons required
- Components: PascalCase filenames; hooks: `use-` prefix; utilities: kebab-case
- camelCase for functions, UPPER_SNAKE_CASE for constants
- All code and naming in **Spanish**

### Backend
- PascalCase for classes, methods, properties; camelCase for locals
- DTOs suffixed with `DTO`, services suffixed with `Core`, interfaces prefixed with `I`

## CI/CD
- **Backend**: AppVeyor builds on main, deploys via WebDeploy to Plesk
- **Frontend**: Can deploy to GitHub Pages via `yarn deploy`, or served from backend's `wwwroot/`
