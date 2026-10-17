# Contexto del proyecto Noctiluca

Documento de referencia para sesiones futuras de desarrollo.

> ⚠️ **Desactualizado para el frontend.** Las secciones de frontend describen `noctiluca-fe`, que está **deprecado**. El frontend activo es `noctiluca-app` (Expo): ver `noctiluca-app/CLAUDE.md`. Las secciones de backend siguen vigentes.

## Arquitectura general

Monorepo con dos aplicaciones:

| App | Stack | Puerto dev |
|-----|-------|------------|
| `noctiluca-fe` | React 18 + TypeScript + Vite + Tailwind + Zustand + TanStack Query | 3000 |
| `noctiluca-be` | .NET 8 Web API + EF Core + AutoMapper + JWT | 5072 |

El frontend se sirve como build estático desde `noctiluca-be/Api/wwwroot` en producción.

## Backend — capas

```
Api/Controllers/     → REST endpoints (ABMController base)
Core/Entidades/      → Modelos EF
Core/DTOs/           → Contratos API
Core/Enums/          → Enumeraciones
Core/Repositorios/   → Interfaces de persistencia
Core/Servicios/      → Lógica de negocio (*Core)
Persistencia/        → Repositorios EF + AppDbContext
_Config/             → DI, AutoMapper, excepciones globales
```

### Patrón ABM

1. Entidad hereda de `Entidad` (propiedad `Id`)
2. DTO hereda de `DTO`
3. Repo hereda de `RepositorioABM<T>` e implementa `IRepositorioABM<T>`
4. Core hereda de `ABMCore<TRepo, TEntidad, TDTO>` e implementa `ICoreABM<TDTO>`
5. Controller hereda de `ABMController<TDTO, TCore>`
6. Registrar en `InyeccionDeDependenciasConfig.cs` y mapear en `MapperConfig.cs`

Hooks de ciclo de vida en Core: `AntesDeCrear`, `AntesDeModificar`, `AntesDeEliminar`, `DespuesDeEliminar`.

Errores de negocio: `throw new ExcepcionControlada("mensaje en español")`.

### Roles

- `Administrador`: ABM completo
- `Consulta`: solo lectura en ABMs, pero puede marcar hábitos

## Frontend — estructura

```
src/pantallas/       → Pantallas por módulo
src/components/ui/   → Componentes reutilizables (Encabezado, Cuerpo, Input, Boton)
src/api/             → Cliente generado (clients.ts) + hooks (use-api-query, use-api-mutation)
src/hooks/           → use-auth (JWT + esAdmin())
src/rutas.ts         → Constantes de rutas
src/usar-navegacion.tsx → Helpers de navegación
```

### Patrones FE

- Layout de pantalla: `<Encabezado>` + `<Cuerpo>` + footer opcional
- Datos: `useApiQuery({ key, fn })` / `useApiMutation({ fn, mensajeDeExito })`
- Auth: `RequiereAutenticacion` wrapper + `useAuth().esAdmin()` para UI condicional
- Alias `@` → `src/`

### Regenerar cliente API

```bash
./scripts/generar-contrato-be-en-fe.sh
```

Requiere backend compilado (`dotnet build`).

## Entidades principales

| Entidad | Descripción |
|---------|-------------|
| Usuario | Auth JWT con rol |
| Carpeta | Contenedor de escritos, puede tener subcarpetas |
| Escrito | Documento con título y cuerpo |
| CriterioDeOrden | Ordenamiento de escritos en carpeta |
| **Habito** | Hábito trackeable (Sí/No o numérico) |
| **RegistroHabito** | Registro diario de un hábito |

## Rutas frontend

| Ruta | Pantalla |
|------|----------|
| `/` | Inicio (carpetas + tracker de hábitos) |
| `/nueva-carpeta` | Crear carpeta |
| `/:carpetaId/escritos` | Ver carpeta |
| `/papelera` | Papelera |
| `/modo-lectura` | Modo lectura |
| `/habitos` | ABM de hábitos (solo admin) |
| `/resumen-habitos` | Resumen semanal |

## Módulo: Tracker de Hábitos

### Modelo de datos

**Habito**
- `Nombre` (max 50 chars)
- `Tipo`: `SiNo = 1`, `Numerico = 2`
- `Activo`: bool (máx. 5 activos simultáneos)
- `Posicion`: orden en la grilla
- `MetaMinutos`: meta diaria para hábitos numéricos (default 1)

**RegistroHabito**
- `HabitoId` FK
- `Fecha`: DateTime (solo día, sin hora)
- `ValorBooleano`: bool? (Sí/No)
- `ValorNumerico`: int? (minutos)
- Índice único `(HabitoId, Fecha)`

### Reglas de negocio

| Regla | Comportamiento |
|-------|----------------|
| Máx. 5 activos | Error al crear/activar si ya hay 5 |
| No borrar si trackeado | Error al eliminar; permitir desactivar |
| Cumplimiento Sí/No | `ValorBooleano == true` |
| Cumplimiento numérico | `ValorNumerico >= MetaMinutos` |

### Endpoints

| Método | Ruta | Auth | Propósito |
|--------|------|------|-----------|
| GET/POST/PUT/DELETE | `/api/Habito` | Admin (Consulta en GET) | ABM estándar |
| GET | `/api/Habito/tracker?fecha=` | Admin, Consulta | Hábitos activos + registros del día |
| PUT | `/api/Habito/registro` | Admin, Consulta | Upsert de registro diario |
| GET | `/api/Habito/resumen-semanal?fecha=` | Admin, Consulta | Resumen lun–dom |

### Componentes frontend

```
src/pantallas/habitos/
  habit-tracker.tsx          → Widget en home
  habit-tracker-grid.tsx     → Grilla de columnas
  habit-tracker-celda.tsx    → Celda Sí/No o numérico
  administrar-habitos.tsx    → ABM completo
  resumen-semanal.tsx        → Tablas + gráfico recharts
  utilidades-habitos.ts      → Helpers de fechas/semana
```

### UX

- Tracker arriba del listado de carpetas en home
- Selector de día (lun–dom) con navegación de semana
- Guardado silencioso (sin toast en éxito); debounce 500ms en numéricos
- Engrane → ABM (solo admin)
- Domingos: banner expandible con mini-resumen en home
- Link "Ver resumen" → pantalla dedicada con tablas y gráfico de barras

### Migración

```bash
cd noctiluca-be/Api
dotnet ef migrations add AgregaHabitos
dotnet ef database update
```

## Comandos útiles

```bash
# Dev completo
cd noctiluca-be/Api && dotnet run --watch
cd noctiluca-fe && yarn start

# Build
cd noctiluca-fe && yarn build
cd noctiluca-be/Api && dotnet build

# Deploy local (FE → wwwroot del BE)
./scripts/deploy-local.sh

# Tests
cd noctiluca-fe && yarn test
cd noctiluca-be/Api && dotnet test --configuration Release
```

## Convenciones

- Código y nombres en **español**
- Frontend: tabs, comillas dobles, semicolons
- Backend: PascalCase clases, camelCase locales
- DTOs sufijo `DTO`, servicios sufijo `Core`, interfaces prefijo `I`
