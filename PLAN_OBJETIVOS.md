# Plan: objetivos de mes, año y lustro

## TL;DR

La estructura de datos actual **ya está bien diseñada para esto** y ya guarda histórico
por diseño. No hace falta ningún rewrite ni migración destructiva. Agregar Mes (que
técnicamente ya existe a medias), Año y Lustro es, en el backend, un cambio chico y
aditivo: dos valores de enum nuevos + las funciones de período correspondientes. Todo
lo demás (controller, servicio, repos, motor de sync) ya es genérico sobre `Tipo` y no
necesita tocarse.

El trabajo grande de este pedido está del lado de la app (activar las pestañas, más los
widgets nativos de iOS), no del backend.

Antes de escribir código dejo abajo un relevamiento de cómo está armado hoy, la
propuesta concreta, y una lista de decisiones de diseño que te quiero consultar porque
no son obvias por el código.

---

## 1. Cómo está armado hoy (relevamiento)

### 1.1 El modelo ya es genérico y ya guarda histórico

```
ListaObjetivo (EntidadSincronizable)
  Tipo: TipoListaObjetivoEnum   (Dia=1, Semana=2, Mes=3)
  ClavePeriodo: string          (clave natural del período: "2026-06-24", "2026-W26", "2026-06")
  FechaInicio / FechaFin
  FechaCreacion
  Items: ItemObjetivo[]

ItemObjetivo (EntidadSincronizable)
  ListaObjetivoId
  Texto, Completado, Posicion, FechaCompletado
```

- Índice único `(Tipo, ClavePeriodo)`: nunca se pisa una lista de un período pasado, se
  crea una fila nueva por período. **Esto ya es el histórico** — no hay una tabla
  "actual" que se sobreescriba. La lista de junio 2025 sigue ahí para siempre, con sus
  ítems, mientras no se borre.
- `ObjetivoPeriodoUtil` centraliza toda la lógica de "clave de período" y "rango de
  fechas del período" en 3 switch sobre `TipoListaObjetivoEnum`. Agregar un tipo nuevo
  es agregar un case en cada uno.
- El controller/servicio (`ObjetivoController`, `ObjetivoCore`) ya reciben `Tipo` como
  parámetro genérico (`ObtenerLista(tipo, clave)`, `ObtenerHistorico(tipo, ...)`,
  `CrearItem(dto)` con `dto.Tipo`), no tienen ningún `if (tipo == Dia)` hardcodeado
  salvo la advertencia de "más de 7 objetivos" que es intencionalmente solo para Día.

Conclusión: **no vale la pena tirar esto y rehacerlo**. Ya tiene la forma que pedís
(entidad propia, no "escritos", histórico por diseño). Rehacerlo sería puro riesgo sin
beneficio.

### 1.2 El path real de datos no es el REST controller — es el motor de sync

Esto es el hallazgo más importante y cambia el foco del trabajo:

- Ni `noctiluca-app` ni `noctiluca-fe` llaman a los endpoints REST de
  `ObjetivoController` (`GET /api/Objetivo/lista`, `POST /api/Objetivo/item`, etc.).
  Los busqué explícitamente y no hay ningún uso en ninguna de las dos apps.
- Las dos apps son **offline-first**: todo objetivo se crea/edita en SQLite local y se
  manda al servidor como una operación genérica de `POST /api/Sync/push`
  (`entityType: "itemObjetivo"`), y se lee todo lo del servidor con
  `GET /api/Sync/pull` (que trae *todas* las `ListaObjetivo`/`ItemObjetivo` cuya
  `Version` sea mayor al cursor, sin importar el `Tipo`). La UI arma las pantallas
  (lista actual, histórico, día/semana) 100% a partir de lo que ya está en SQLite
  local (`lecturas-core.ts`), no pide nada "on demand" al backend.
- `SyncCore.Pull`/`Push` y `ObtenerOCrearLista` (dentro de `SyncCore`) ya son
  completamente genéricos sobre `Tipo` — no hay nada que tocar ahí tampoco.

Consecuencia práctica: **agregar Año y Lustro no requiere ni un solo cambio en
`SyncCore`, `SyncPullDTO`/`SyncPushDTO`, ni en el `ObjetivoController`.** Con que el
enum y `ObjetivoPeriodoUtil` sepan calcular la clave/rango del nuevo período, el motor
de sync los sincroniza solos (son datos, no lógica).

Esto también quiere decir que `ObjetivoController` + `IObjetivoCore`/`ObjetivoCore` +
`IListaObjetivoRepo`/`IItemObjetivoRepo` (y sus DTOs de request/response) están, hoy,
**sin ningún consumidor real** — solo los ejercitan los tests de integración
(`ObjetivoTests.cs`). Es código muerto en producción, herencia de cuando el feature se
diseñó como REST puro (migración `AgregaObjetivos`, 24/06) antes de que existiera el
motor de sync (migración `AgregaSincronizacionObjetivosHabitos`, 01/07, una semana
después). Ver pregunta 2 más abajo.

### 1.3 La otra pata: `Carpeta` + `PropositoCarpeta`

Hay un mecanismo separado y más viejo: `Carpeta.PropositoCarpeta`
(`ObjetivosRaiz=1, ObjetivosDia=2, ObjetivosSemana=3, ObjetivosMes=4`). Son carpetas
"de sistema" invisibles en el árbol normal (`esCarpetaObjetivos` las filtra de Inicio)
que hoy sirven para una sola cosa: darle un `carpetaId` a la navegación de "Ver
histórico →" (`irAHistoricoObjetivos(carpetaId)`) y a la ruta vieja
`[carpetaId]/escritos.tsx`, que todavía tiene una rama que detecta
`propositoATipo(carpeta.propositoCarpeta)` y redibuja la pantalla de objetivos si la
carpeta tiene un propósito.

Esto es un remanente de cuando "objetivos" vivían adentro de una carpeta como
escritos especiales. Hoy, la tab `objetivos.tsx` ya no depende de carpetas para nada
funcional — solo usa `useCarpetaPorProposito` para conseguir el `carpetaId` que le pide
la ruta de histórico. No hay código que *cree* estas carpetas de sistema en el cliente
actual (`noctiluca-app`), así que asumo que las 3 que existen (Raíz/Día/Semana, y
quizás Mes) ya están en la base de datos de producción desde antes.

Para Año y Lustro esto obliga a decidir algo (pregunta 4 abajo): ¿sumamos 2 valores
más a `PropositoCarpetaEnum` y creamos 2 carpetas de sistema más para sostener el
mismo mecanismo, o aprovechamos para sacar esta indirección y navegar al histórico
directamente por `tipo` (sin pasar por carpetas)?

---

## 2. Propuesta concreta (backend)

### 2.1 Cambios aditivos, sin migración de datos

**`TipoListaObjetivoEnum`** — agregar:
```csharp
public enum TipoListaObjetivoEnum
{
    Dia = 1,
    Semana = 2,
    Mes = 3,
    Anio = 4,
    Lustro = 5,
}
```

**`ObjetivoPeriodoUtil`** — agregar a los 3 switch (`ObtenerClavePeriodo`,
`ObtenerRangoPeriodo`, `ObtenerRangoDesdeClave`) más `ClaveAnio`/`ClaveLustro` y sus
parsers:

- Año: clave `"yyyy"` (ej. `"2026"`), rango = 1/1 al 31/12 de ese año.
- Lustro: clave propuesta `"yyyy-yyyy"` (ej. `"2025-2029"`), bloques fijos de
  calendario anclados en años múltiplos de 5 (`año - año % 5`). Ver pregunta 1: es la
  única decisión de diseño real de todo el backend.

No hace falta migración de EF Core: `Tipo` ya es una columna `int` (por el enum) y
`ClavePeriodo` ya es `nvarchar(20)`, donde `"2025-2029"` entra sin problema. Agregar
valores al enum no cambia el esquema.

### 2.2 Nada que tocar en Controller / Core / Repos / SyncCore

Todo lo que recibe `TipoListaObjetivoEnum` como parámetro (`CrearItemObjetivoDTO.Tipo`,
`ObtenerLista(tipo, clave)`, `SyncCore.ObtenerOCrearLista`, etc.) ya soporta cualquier
valor del enum sin cambios de código. Al ser la app 100% consumidora vía `/api/Sync`,
alcanza con que el enum y `ObjetivoPeriodoUtil` conozcan el período nuevo.

### 2.3 Tests

- `ObjetivoPeriodoUtilTests`: agregar casos para `ClaveAnio`/`ClaveLustro`,
  `ObtenerRangoPeriodo`/`ObtenerRangoDesdeClave` con `Anio` y `Lustro`, siguiendo el
  mismo estilo que los de Semana.
- `ObjetivoTests.cs` (integración): si se decide mantener el controller REST
  (pregunta 2), agregar un caso análogo a `CrearItem_EnListaDia_...` pero con
  `Tipo.Anio`/`Tipo.Lustro` para dejar registrado que el período nuevo funciona
  end-to-end.

### 2.4 Regenerar el cliente TS

Correr `./scripts/generar-contrato-be-en-fe.sh` para que `TipoListaObjetivoEnum` en
`noctiluca-app/src/api/clients.ts` (y en `noctiluca-fe` si corresponde, ver pregunta 3)
tenga `_4`/`_5`.

---

## 3. Lo que falta del lado de la app (fuera del pedido explícito de "backend", pero
   necesario para que se vea algo)

Lo dejo anotado para que el alcance quede claro, no lo voy a implementar ahora salvo
que me lo pidas:

1. **`src/utils/objetivos.ts`**: agregar los casos de `Anio`/`Lustro` en
   `clavePeriodoActual`, `etiquetaPeriodo`, `tituloPeriodoActual` (mismo patrón que
   Mes, que ya está resuelto ahí aunque la tab no lo use todavía).
2. **`objetivos.tsx`** (la tab): reemplazar el bloque "Próximamente" por
   `PantallaObjetivos` con `tipo={TipoListaObjetivoEnum._3/_4/_5}` para mes/año/lustro,
   igual que ya está hecho para hoy/semana.
3. **Widgets nativos (iOS)**: hoy existen `widget-objetivos-hoy.ts` y
   `widget-objetivos-semana.ts`, que recalculan un snapshot desde SQLite y se lo pasan
   al widget vía App Group (módulo nativo `modules/widget-objetivos`). Para mes/año/
   lustro el patrón de la parte "datos" es una copia mecánica de esos dos archivos.
   La parte no mecánica es nueva superficie de UI nativa en Swift/WidgetKit (nuevo
   widget o nueva entrada de configuración), que es trabajo de plataforma aparte —
   candidato a un plan propio usando la skill `apple-targets` cuando quieras encararlo.
4. Si se decide sacar la indirección de `PropositoCarpeta` (pregunta 4), hay que tocar
   la navegación de histórico para que reciba `tipo` en vez de `carpetaId`.

---

## 4. Decisiones tomadas

1. **Lustro**: bloques fijos de calendario anclados en múltiplos de 5
   (2025–2029, 2030–2034, ...), clave `"yyyy-yyyy"`. Igual criterio que Semana/Mes/Año:
   período fijo, no ventana móvil.
2. **`ObjetivoController`/`ObjetivoCore` REST**: se elimina. Es código muerto (sin
   consumidor real, solo lo ejercitaban los tests de integración) y mantenerlo solo
   suma superficie a extender cuando agreguemos Año/Lustro sin ningún beneficio.
3. **`noctiluca-fe`**: en vías de retirarse. No se toca nada de sus pantallas de
   objetivos; el trabajo de frontend (tabs + widgets) se concentra en `noctiluca-app`.
4. **Navegación al histórico**: se saca la indirección de `PropositoCarpeta`. "Ver
   histórico" pasa a navegar directo por `tipo`, sin depender de un `carpetaId` de una
   carpeta de sistema. No se agregan `ObjetivosAnio`/`ObjetivosLustro` al enum de
   carpetas.

## 5. Alcance concreto de la limpieza (backend)

**Eliminar** (sin reemplazo — nada de esto lo llama ningún cliente):
- `Api/Api/Controllers/ObjetivoController.cs`
- `Api/Core/Servicios/Interfaces/IObjetivoCore.cs`, `Api/Core/Servicios/ObjetivoCore.cs`
- `Api/Core/Repositorios/IListaObjetivoRepo.cs`, `IItemObjetivoRepo.cs`
- `Api/Persistencia/Repositorios/ListaObjetivoRepo.cs`, `ItemObjetivoRepo.cs`
- DTOs solo-REST: `CrearItemObjetivoDTO`, `EditarItemObjetivoDTO`, `HistoricoObjetivoDTO`,
  `HistoricoObjetivoPaginadoDTO`, `ActualizarPosicionesItemObjetivoDTO`
- Registros en `InyeccionDeDependenciasConfig.cs` (líneas 30–32: los tres `AddScoped`
  de arriba)
- `Api.TestsDeIntegracion/ObjetivoTests.cs` (probaba el controller que desaparece)

**Mantener** (los usa `SyncCore`/el motor de sync, que es el path real):
- `ListaObjetivoDTO`, `ItemObjetivoDTO` (viajan en `SyncPullDTO`)
- Los `CreateMap<ListaObjetivo, ListaObjetivoDTO>()` / `CreateMap<ItemObjetivo, ItemObjetivoDTO>()`
  en `MapperConfig.cs`
- Las entidades `ListaObjetivo`/`ItemObjetivo`, su configuración en `AppDbContext`, y
  toda la lógica de objetivos dentro de `SyncCore.cs`

**Agregar**:
- `TipoListaObjetivoEnum.Anio = 4`, `Lustro = 5`
- `ObjetivoPeriodoUtil`: `ClaveAnio`/`ClaveLustro` + entradas en los 3 switch
  (`ObtenerClavePeriodo`, `ObtenerRangoPeriodo`, `ObtenerRangoDesdeClave`) +
  parsers privados análogos a `ParsearClaveMes`
- Casos nuevos en `ObjetivoPeriodoUtilTests.cs` para Año y Lustro

Sin migración de EF Core: no cambia el esquema (agregar valores de enum no toca la
columna `Tipo`, y `ClavePeriodo` ya es `nvarchar(20)`, donde entra `"2025-2029"`).

## 6. Alcance concreto del frontend (noctiluca-app) — para un paso siguiente

No lo implemento en este pase (el pedido era backend), pero queda planificado:

1. `src/utils/objetivos.ts`: casos de `Anio`/`Lustro` en `clavePeriodoActual`,
   `etiquetaPeriodo`, `tituloPeriodoActual`.
2. `objetivos.tsx` (tab): reemplazar "Próximamente" por `PantallaObjetivos` con los
   tipos nuevos para mes/año/lustro.
3. Navegación al histórico: sacar `irAHistoricoObjetivos(carpetaId)` /
   `useCarpetaPorProposito` de `PantallaObjetivos` y de `[carpetaId]/escritos.tsx`;
   la ruta de histórico pasa a tomar `tipo` como parámetro en vez de `carpetaId`.
   Como parte de esto, evaluar si conviene borrar las carpetas de sistema
   (`PropositoCarpeta`) ya existentes en producción o dejarlas huérfanas sin uso.
4. Widgets nuevos (`widget-objetivos-mes.ts`, `-anio.ts`, `-lustro.ts`): copia mecánica
   del patrón de `widget-objetivos-hoy.ts`/`-semana.ts` para la parte de datos. La UI
   nativa en Swift/WidgetKit es trabajo de plataforma aparte — buen candidato a un
   plan propio con la skill `apple-targets` cuando quieras encararlo.
