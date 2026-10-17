# Plan: mejorar la web de noctiluca-app

> Estado: **análisis hecho, nada implementado todavía**. Relevado el 2026-10-17.
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

1. **Arreglar el bloqueo de OPFS**: reintento al abrir, Web Locks y/o una sola pestaña dueña de la base con aviso en las demás.
2. **Cambios rápidos solo para web**, sin afectar al iPhone (usar `web:`/`md:` de NativeWind o `Platform.OS === "web"`):
   - columna a `max-w-4xl` + `md:px-8`;
   - base de letra a 16px y subir los textos de 10 a 12px;
   - hover y cursor en `ListaItem`, `Boton` y `BotonIcono`, pasando a `Pressable` con `hover:`.
3. **Tipografía**: decisión pendiente (ver abajo).
4. **En escritorio, sacar la barra de pestañas de abajo** y poner la navegación arriba (encabezado), por ejemplo con `tabBarPosition`/un layout `.web.tsx` o mostrando los tabs como links en el header en pantallas anchas.
5. **Escrito**: volver a mostrar el breadcrumb y pasar a scroll de página en web.

## Decisiones pendientes

- [ ] **Tipografía**: ¿hacer que Merriweather se aplique de verdad en web (igual que el iPhone), o usar la fuente del sistema como el fe?
- [ ] Confirmar el orden: arrancar por 1 y 2.

## Ya hecho en la misma sesión

- Ícono y favicon de la app reemplazados por el barquito de papel del fe (original de 1254px, recuperado del commit `6edcec1` del fe). También el splash, que mostraba el logo de Expo (`imageWidth` 200). En iOS se ve recién con un build nuevo de EAS.
