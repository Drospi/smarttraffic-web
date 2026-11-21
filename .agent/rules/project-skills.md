---
trigger: always_on
description: Skills activas del proyecto SmartTraffic Web (Retro Pixel-Art Neon UI, React+TS+Vite Performance, HTML5 Canvas 2D & Sprites, Context7 ctx7).
---

# Reglas y Skills Activas del Proyecto

Aplica estas 4 skills de forma obligatoria en todas las tareas dentro de `smarttraffic-web`:

## 1. Skill — Retro Pixel-Art Neon UI
- **Paleta oscura y neón:** fondo principal `#090a14`, paneles `#111428`, acentos neón `#00f0ff` (cian), `#39ff14` (verde), `#ffb800` (ámbar) y `#ff0055` (rojo/rosa).
- **Bordes:** nítidos de `2px` o `4px` con brillo neón, evitando bordes suavizados o estilos modernos redondeados que rompan la estética pixel-art.
- **Nitidez pixelada:** aplicar `image-rendering: pixelated` en `<canvas>` y sprites.
- **Botones arcade:** sombra sólida pixelada (sin difuminado) y estados `hover` / `active` claramente visibles.

## 2. Skill — React + TypeScript + Vite Performance
- **Desacoplamiento:** `src/engine/` debe ser TypeScript puro, 100% independiente de React.
- **Renderizado eficiente:** usar `useRef` para el loop de animación y estado del Canvas; actualizar el estado de React y las gráficas de Recharts únicamente al cambiar de ciclo o por intervalos controlados (nunca a 60 FPS).
- **TypeScript estricto:** prohibido usar `any`.

## 3. Skill — HTML5 Canvas 2D & Sprites
- **Delta time:** usar `requestAnimationFrame` con `deltaTime` (acotado ante pausas de pestaña) para movimiento fluido independiente de la tasa de refresco, junto con `ctx.imageSmoothingEnabled = false`.
- **Sprites y fallback:** cargar sprites dinámicamente desde `src/assets/sprites/` con `import.meta.glob` y mantener siempre un renderizado pixel-art por código como fallback automático si no existen imágenes o aún no cargan.

## 4. Skill — Context7 (`ctx7`)
- **Documentación actualizada:** usar el CLI `npx ctx7@latest` siempre que se consulten APIs, configuración o errores de librerías del proyecto (`React`, `Vite`, `Tailwind CSS`, `Recharts`, `Framer Motion`, `Lucide React`, etc.), en lugar de depender de datos de entrenamiento o búsqueda web.
- **Pasos:** primero resolver la librería con `npx ctx7@latest library <nombre> "<consulta>"` y luego consultar con `npx ctx7@latest docs <libraryId> "<tema específico>"` (máx. 3 comandos por consulta, sin credenciales; ante error de cuota, sugerir `npx ctx7@latest login` o `CONTEXT7_API_KEY`).

