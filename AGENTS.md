# SmartTraffic Web — Skills y Reglas del Proyecto

Estas 4 skills están activas para todo el desarrollo en este repositorio (`smarttraffic-web`). Cualquier código nuevo o refactorización debe cumplirlas estrictamente.

---

## 1. Skill — Retro Pixel-Art Neon UI

- **Paleta de colores obligatoria:**
  - Fondo oscuro base: `#090a14`
  - Superficies y paneles: `#111428`
  - Acentos y brillo neón:
    - Cian: `#00f0ff`
    - Verde: `#39ff14`
    - Ámbar: `#ffb800`
    - Rojo / Rosa: `#ff0055`
- **Bordes y geometría:**
  - Usar bordes nítidos de `2px` o `4px` con brillo neón acorde al estado o categoría del panel.
  - Mantener estética pixel-art/arcade con esquinas rectas (evitar `border-radius` grandes o sombras difusas genéricas).
- **Renderizado nítido (`pixelated`):**
  - Aplicar `image-rendering: pixelated` en el elemento `<canvas>` y en todos los sprites e imágenes pixel-art en CSS.
- **Botones estilo arcade:**
  - Implementar botones con sombra sólida pixelada (desplazamiento discreto sin `blur`) y estados `:hover` y `:active` claramente diferenciados (ej. cambio de brillo/color neón en hover y desplazamiento hacia la sombra al presionar).

---

## 2. Skill — React + TypeScript + Vite Performance

- **Motor desacoplado (`src/engine/`):**
  - Todo el motor de simulación debe residir en `src/engine/` en TypeScript puro, 100% desacoplado de React (prohibido importar `react`, `react-dom`, hooks o librerías de UI dentro de `src/engine/`).
- **Cero re-renders a 60 FPS:**
  - Usar `useRef` para el estado mutable del loop de animación, instancias del motor y referencias al `<canvas>`.
  - Nunca disparar `setState` en cada frame de `requestAnimationFrame`.
  - Sincronizar el estado de React y los datos de Recharts únicamente al cambiar de ciclo/fase de simulación o mediante intervalos controlados.
- **Tipado estricto:**
  - Prohibido usar `any` en TypeScript. Utilizar interfaces explícitas, uniones discriminadas, `unknown` con type guards o genéricos estrictos.

---

## 3. Skill — HTML5 Canvas 2D & Sprites

- **Loop de animación independiente de Hz:**
  - Usar `requestAnimationFrame` calculando `deltaTime` entre frames (con un límite superior seguro ante cambios de pestaña) para que velocidades, físicas y temporizadores sean fluidos e independientes de la tasa de refresco.
  - Desactivar el suavizado en el contexto 2D (`ctx.imageSmoothingEnabled = false`) para conservar los píxeles nítidos.
- **Carga dinámica de sprites con fallback automático:**
  - Cargar los sprites dinámicamente desde `src/assets/sprites/` mediante `import.meta.glob` de Vite.
  - Mantener siempre un renderizado pixel-art procedural por código en Canvas 2D como fallback automático cuando un sprite no exista, falle su carga o aún esté cargando.

---

## 4. Skill — Documentación actualizada con Context7 (`ctx7`)

- **Uso obligatorio de `ctx7` CLI:**
  - Consultar documentación actualizada mediante `ctx7` siempre que se trabaje con APIs, configuración, sintaxis, migraciones o debugging de librerías/frameworks del proyecto (ej. `React`, `Vite`, `Tailwind CSS`, `Recharts`, `Framer Motion`, `Lucide React`, `TypeScript`), en lugar de depender de memoria o búsqueda web genérica.
  - No es necesario para refactorizaciones o lógica pura que no dependa de una librería o API externa.
- **Flujo de trabajo en 2 pasos:**
  1. Resolver el ID de la librería (`/org/project`):
     `npx ctx7@latest library <nombre-oficial> "<consulta específica>"`
  2. Obtener la documentación puntual (máximo 3 comandos por consulta y un concepto por comando):
     `npx ctx7@latest docs <libraryId> "<qué consultar>"`
- **Buenas prácticas:**
  - Usar el nombre oficial de la librería y versión si aplica (`/org/project/version`).
  - Nunca incluir claves, contraseñas o credenciales en las consultas.
  - Si ocurre un error de cuota, informar al usuario para ejecutar `npx ctx7@latest login` o configurar `CONTEXT7_API_KEY`.

