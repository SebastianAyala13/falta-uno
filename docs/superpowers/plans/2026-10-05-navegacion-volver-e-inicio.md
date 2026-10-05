# Plan: volver e inicio en toda la app

> **Para quien lo ejecute:** las tareas van en orden; cada una termina con una
> verificación que debe pasar antes de seguir. Especificación:
> `docs/superpowers/specs/2026-10-05-navegacion-volver-e-inicio-design.md`.

**Objetivo:** que desde cualquier pantalla se pueda volver atrás y saltar a la raíz
de la sección en un solo toque.

**Arquitectura:** un componente `HomeButton` resuelve su destino desde la ruta actual
con una función pura `destinoInicio()`. `ScreenHeader` lo monta por defecto, con lo que
las 28 pantallas que ya usan el header lo heredan sin editarlas. Las dos pantallas que
no usan `ScreenHeader` lo adoptan.

**Stack:** Expo 57, expo-router (typedRoutes **desactivado**, las rutas son texto plano),
NativeWind, TypeScript.

## Restricciones globales

- Sin pruebas automáticas en el proyecto: se verifica con `tsc --noEmit`, `pnpm lint` y
  recorrido manual. No inventar un framework de pruebas.
- Comentarios y textos de interfaz **en español**, como el resto del código.
- El háptico de navegación es `haptics.tap()`, igual que `BackButton`.
- No tocar las 5 pestañas, `welcome.tsx` ni `index.tsx`: tienen barra de pestañas o son entrada.

---

### Tarea 1: `HomeButton` y la decisión de destino

**Archivos:**
- Crear: `components/HomeButton.tsx`

**Produce:** `destinoInicio(pathname: string): DestinoInicio` y el componente `HomeButton`
(export default). `DestinoInicio = { ruta: string; icon: IconName; nombre: string }`.

- [ ] **Paso 1: crear el componente**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Pantallas de dueño de cancha: su raíz es el panel, no Inicio. */
const RUTAS_DUENO = [
  '/cancha/panel',
  '/cancha/agenda',
  '/cancha/finanzas',
  '/cancha/editar',
  '/cancha/registrar',
];

export interface DestinoInicio {
  ruta: string;
  icon: IconName;
  /** Se usa en el accessibilityLabel: "Ir a Inicio". */
  nombre: string;
}

const INICIO: DestinoInicio = { ruta: '/(tabs)', icon: 'home-outline', nombre: 'Inicio' };
const ADMIN: DestinoInicio = {
  ruta: '/admin',
  icon: 'shield-checkmark-outline',
  nombre: 'la Plataforma Madre',
};
const PANEL: DestinoInicio = { ruta: '/cancha/panel', icon: 'football-outline', nombre: 'Mi cancha' };

/**
 * A dónde lleva el botón de inicio desde `pathname`. Pura a propósito: toda la
 * decisión vive acá y se puede razonar sin montar una pantalla.
 *
 * Estando YA en la raíz de una sección lleva a Inicio: apuntar a uno mismo sería
 * un botón muerto.
 */
export function destinoInicio(pathname: string): DestinoInicio {
  if (pathname === ADMIN.ruta || pathname === PANEL.ruta) return INICIO;
  if (pathname.startsWith('/admin')) return ADMIN;
  if (RUTAS_DUENO.some((r) => pathname.startsWith(r))) return PANEL;
  // Ojo: `/cancha/[id]` NO cae acá. Es la ficha pública que ve un jugador
  // buscando dónde jugar, así que su inicio es Inicio.
  return INICIO;
}

type HomeButtonProps = {
  /** Clases externas (márgenes) — el componente NO gestiona layout externo. */
  className?: string;
  /** Tamaño del ícono. Default: 22. */
  size?: number;
  /** Color del ícono. Default: `cream` del tema activo. */
  color?: string;
  /** Área táctil extra. Default: 12. */
  hitSlop?: number;
};

/** Botón circular que salta a la raíz de la sección actual. Hermano de `BackButton`. */
export default function HomeButton({
  className = '',
  size = 22,
  color,
  hitSlop = 12,
}: HomeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const destino = destinoInicio(pathname);

  const handlePress = () => {
    haptics.tap();
    // navigate (no push): si la raíz ya está en la pila, vuelve a ella en vez de
    // apilar un duplicado.
    router.navigate(destino.ruta);
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={`Ir a ${destino.nombre}`}
      className={cx('h-10 w-10 items-center justify-center rounded-full bg-card', className)}>
      <Ionicons name={destino.icon} size={size} color={color ?? theme.cream} />
    </Pressable>
  );
}
```

- [ ] **Paso 2: comprobar que `router.navigate` existe en esta versión**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json`

Esperado: sin errores. Si marca que `navigate` no existe en el router, cambiarlo por
`router.replace(destino.ruta)` y anotarlo acá.

---

### Tarea 2: `ScreenHeader` monta el botón por defecto

**Archivos:**
- Modificar: `components/BackButton.tsx` (tipo `ScreenHeaderProps` y el `return` final)

**Consume:** `HomeButton` de la Tarea 1.

- [ ] **Paso 1: importar y agregar la prop**

En los imports: `import HomeButton from '@/components/HomeButton';`

En `ScreenHeaderProps`:

```tsx
  /** Muestra el botón de ir al inicio de la sección. Default: `true`. */
  home?: boolean;
```

Y en la desestructuración de la firma, `home = true,`.

- [ ] **Paso 2: reemplazar el cálculo de `rowClass`, `rightNode` y el `return`**

```tsx
  const homeNode = home ? <HomeButton /> : null;

  // El inicio y las acciones propias de la pantalla viajan juntos a la derecha.
  // Con solo el inicio, ese lado mide lo mismo que el botón de volver (w-10), así
  // que los títulos centrados siguen centrados de verdad.
  const rightGroup =
    homeNode != null || right != null ? (
      <View className="flex-row items-center gap-2">
        {homeNode}
        {right}
      </View>
    ) : titleAlign === 'center' ? (
      <View className="w-10" />
    ) : null;

  const rowClass = cx(
    'flex-row items-center',
    rightGroup != null && 'justify-between',
    borderBottom && 'border-b border-border',
    className,
  );

  return (
    <View className={rowClass}>
      {titleAlign === 'center' ? (
        <>
          {back}
          {titleNode}
        </>
      ) : (
        // Agrupados: con `justify-between`, back y título deben viajar juntos a la
        // izquierda o el título quedaría flotando en el centro.
        <View className="min-w-0 flex-1 flex-row items-center">
          {back}
          {titleNode}
        </View>
      )}
      {rightGroup}
    </View>
  );
```

Borrar el `const rightNode = ...` anterior, que queda sin uso.

- [ ] **Paso 3: verificar**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json` y `pnpm lint`

Esperado: ambos en verde, sin variables sin usar.

---

### Tarea 3: las dos pantallas sin header

**Archivos:**
- Modificar: `app/cancha/panel.tsx`
- Modificar: `app/reset.tsx`

- [ ] **Paso 1: `cancha/panel.tsx`**

Importar `import { ScreenHeader } from '@/components/BackButton';` y reemplazar el
`<Text className="font-display text-3xl uppercase text-cream" ...>MI CANCHA</Text>`
por `<ScreenHeader title="Mi cancha" />`, conservando el padding del contenedor.
`ScreenHeader` ya hornea el `lineHeight`/`paddingTop` anti-clipping, así que el
`style` manual sobra.

- [ ] **Paso 2: `reset.tsx`**

Misma importación. El título pasa a `<ScreenHeader title="..." showBack={false} />`.

**`showBack={false}` es deliberado:** a esta pantalla se llega desde el enlace del correo
(`faltauno://reset`), así que no hay pantalla anterior a la que volver — pero el botón de
inicio sí tiene sentido como salida.

- [ ] **Paso 3: verificar**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json` y `pnpm lint`

Esperado: verde.

---

### Tarea 4: comprobar antes de tocar

**Archivos:** ninguno, salvo que la comprobación falle.

- [ ] **Paso 1: revisar las pantallas con `right` o título centrado**

Run: `grep -rn 'titleAlign=' app --include="*.tsx"` y `grep -rn 'right={' app --include="*.tsx"`

Revisar una por una que el botón de inicio no amontone ni descuadre.

- [ ] **Paso 2: comprobar los filtros**

En la web desplegada: poner un filtro en Buscar, entrar a un partido, volver con el botón
de atrás y mirar si el filtro sigue puesto. Igual en `canchas.tsx`. Si sobreviven (lo
esperable, porque el Stack mantiene viva la pantalla de atrás), **no se toca nada** y se
anota acá. Si se pierden, subir `query`/`zona`/`nivel`/`formato` a `lib/store.ts`.

---

### Tarea 5: verificación final

- [ ] **Paso 1:** `node_modules/.bin/tsc --noEmit -p tsconfig.json` en verde.
- [ ] **Paso 2:** `pnpm lint` en verde.
- [ ] **Paso 3:** recorrido manual en la web:
  - Checkout → un toque vuelve a Inicio con las pestañas visibles.
  - Finanzas → el inicio lleva al panel Mi Cancha, no a Inicio.
  - `/admin/usuarios` → lleva al resumen de admin.
  - Estando en `/admin` → lleva a Inicio, no se queda quieto.
  - Ningún título centrado quedó corrido.

---

## Registro de ejecución (5 de octubre de 2026)

Tareas 1, 2 y 3 hechas. Verificado: `tsc --noEmit` en verde, `eslint` en verde sobre los
cuatro archivos tocados, `expo export --platform web` exitoso y el guardarraíl del
Dockerfile (que el bundle parsee como script clásico) en verde.

**Dos desviaciones respecto al plan, ambas deliberadas:**

1. `reset.tsx` no adopta el título dentro de `ScreenHeader`. Su título es `text-4xl` a dos
   líneas ("Nueva / contraseña") y `ScreenHeader` solo llega a `3xl`, así que meterlo
   habría encogido el diseño. Se montó el header **sin título y sin volver**
   (`<ScreenHeader showBack={false} />`), que aporta la salida al inicio y deja el título
   grande intacto.
2. La auditoría de la Tarea 4 salió mejor de lo previsto y **el riesgo de los títulos
   centrados no se materializó**: solo `crear-post.tsx` usa `titleAlign="center"`, y
   ninguna pantalla pasa `right={...}`. Con solo el botón de inicio, el lado derecho mide
   `w-10`, lo mismo que el de volver, así que el centrado se conserva solo. No hizo falta
   recalcular nada.

**Pendiente:** el recorrido manual de la Tarea 5 y la comprobación de los filtros exigen
la web desplegada, y Dokploy construye desde git. Hasta que estos cambios no estén
commiteados y subidos, lo publicado sigue siendo la versión anterior.
