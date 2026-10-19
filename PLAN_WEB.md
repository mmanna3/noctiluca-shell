# Plan: mejorar la web de noctiluca-app

> Estado: **puntos 1, 2 y 3 hechos** (2026-10-18). Relevado el 2026-10-17.
> La web se usa mucho y se percibe "bastante fea" comparada con `noctiluca-fe`. Este documento junta el diagnóstico, la propuesta y lo que falta decidir.

## Cómo se hizo el análisis

Se levantaron las dos webs (export de producción de `noctiluca-app` y `noctiluca-fe`) contra un backend falso con datos de ejemplo, y se compararon con capturas en escritorio (1440px) y celular (390px). Las herramientas quedaron en `scripts/capturas-web/` para repetir la comparación y verificar cada cambio.

## Diagnóstico

En celular se parecen bastante. **El problema es en escritorio: la app se ve como un celular puesto en el medio de la pantalla.**

1. **Columna angosta**: 553px de ancho (`max-w-2xl` en `src/app/(app)/_layout.tsx`). El fe usaba `max-w-4xl` con `md:px-8` (832px).
2. **Tipografía más chica y distinta a la elegida**:
   - En `src/global.css`, el `html` está en 14px, así que el texto del cuerpo queda en 15.75px. En el fe era 16px.
   - Hay textos de 10 a 12px: los días de la semana del tracker de hábitos y "Sincronizado".
   - **Merriweather no se aplica en web.** La regla `*` del `@layer base` pierde contra las clases de react-native-web, la web cae a la fuente del sistema y las fuentes ni se descargan (`document.fonts` las muestra `unloaded`). En consecuencia, la web y el iPhone no se ven iguales.
   - Los títulos tienen peso 600; en el fe eran 500.
3. **Barra de pestañas de celular** (`src/app/(app)/(tabs)/_layout.tsx`): va abajo, con labels diminutos ("/" y "objetivos"), sin íconos y pegada al pie de la columna. El fe no tenía barra de pestañas.
4. **Cero estados hover/cursor**. El fe tenía `hover:bg-gray-100` en filas, hover en botones, etc. La app usa `TouchableOpacity` sin variantes `hover:`, así que con mouse se siente "muerta".
5. **Scroll interno** (`FlatList`/`ScrollView` dentro de la columna) en vez del scroll de la página como en el fe.
6. **Detalles**:
   - El escrito perdió el breadcrumb "carpeta/título" en el encabezado; solo hay un botón "<".
   - Los botones "/" y de búsqueda son cajas grandes con borde; en el fe eran íconos livianos.
   - El fe justificaba el texto del escrito.

### Bug importante (no visual): bloqueo de la base local en web

La base local (expo-sqlite sobre OPFS) a veces falla al abrir con `NoModificationAllowedError: … Access Handles cannot be created if there is another open Access Handle`. Pasa cuando la carga anterior todavía tiene el handle abierto: al recargar, o al pasar del login a la app con una carga completa. La app queda en "Error al sincronizar" con un spinner infinito, y otra recarga lo arregla. **Con dos pestañas abiertas casi seguro falla siempre.** El fe resolvía esto con Web Locks. Ver `src/sync/db.ts`.

### Menor

En modo dev web aparece un overlay de error de NativeWind: "Cannot manually set color scheme, as dark mode is type 'media'". El export de producción no lo muestra.

## Propuesta (en orden)

1. ✅ **Arreglar el bloqueo de OPFS**: hecho. Una sola pestaña es dueña de la base (Web Lock `noctiluca-db`). Las demás muestran un aviso con "Usar acá" y se activan solas cuando se cierra la dueña. Antes de abrir, se espera a que OPFS esté libre. Ver `src/sync/candado-base-core.ts` y `apertura-base.web.ts`. Tests: `src/sync/__tests__/candado-base-core.test.ts`, `db-apertura.test.ts` y el e2e `scripts/capturas-web/e2e-pestanas.mjs`.
2. ✅ **Cambios rápidos solo para web**, sin afectar al iPhone (`web:`/`md:` de NativeWind): hecho.
   - columna `md:max-w-4xl md:px-8` (~740px útiles en escritorio);
   - `html` a 14.2222px, así el cuerpo (`text-base`) queda en 16px como en el fe; los textos de 10px pasan a `web:text-xs`, y "Sincronizado" y las fechas de la lista a `web:text-sm`;
   - `ListaItem`, `Boton` y `BotonIcono` pasaron a `Pressable` con `hover:` (filas gris claro, botón negro a `slate-700`), `web:cursor-pointer` y `active:opacity-20` (el mismo feedback que tenía `TouchableOpacity`). Probado en el simulador de iPhone: se ve y responde igual que antes.
3. ✅ **Tipografía, igual en web y en iPhone: Instrument Sans para la interfaz y Source Serif 4 para los escritos** (la idea es parecerse a Claude). Se probó primero Merriweather en todo, pero no gustó.
   - Hallazgo: la tipografía no se aplicaba **en ningún lado**. La regla `*` de `global.css` no llega a los textos en nativo (NativeWind no aplica `*`) y en web pierde contra react-native-web. El iPhone también usaba la fuente del sistema.
   - Todos los textos usan ahora `Text`/`TextInput` de `src/components/ui/texto.tsx`, que traduce las clases `font-*` (peso) y `font-serif` (familia) a la familia exacta (`InstrumentSans_600SemiBold`, `SourceSerif4_400Regular`…) y saca esas clases. Un `fontWeight` encima de la familia la rompe: en web la engrosa de más y en iOS React Native busca "la cara más cercana". Los textos anidados heredan la fuente del padre. Serif hay en el título y el cuerpo del escrito (ver/editar, nuevo y papelera); todo lo demás es sans. También llevan la fuente las pestañas (con `lineHeight` 14 y sin encogerse) y los toasts.
   - Verificación: chequeo automático de textos cortados en 28 pantallas a 390px (`scripts/capturas-web/chequear-textos.mjs`), con 0 problemas nuevos frente a la fuente del sistema, y capturas antes/después de 22 pantallas en el simulador de iPhone, sin textos cortados nuevos.
   - Problemas que ya existían y siguen igual: con un nombre de carpeta largo, el encabezado empuja el "+" fuera de la pantalla, y el título largo de un escrito se corta porque es un input de una línea.
4. **En escritorio, sacar la barra de pestañas de abajo** y poner la navegación arriba (encabezado), por ejemplo con `tabBarPosition`/un layout `.web.tsx` o mostrando los tabs como links en el header en pantallas anchas.
5. **Escrito**: volver a mostrar el breadcrumb y pasar a scroll de página en web.

## Decisiones pendientes

- [x] **Tipografía**: Instrument Sans (interfaz) + Source Serif 4 (escritos), en las dos plataformas.
- [x] Confirmar el orden: arrancar por 1 y 2.

## Ya hecho en la misma sesión

- Ícono y favicon de la app reemplazados por el barquito de papel del fe (original de 1254px, recuperado del commit `6edcec1` del fe). También el splash, que mostraba el logo de Expo (`imageWidth` 200). En iOS se ve recién con un build nuevo de EAS.
