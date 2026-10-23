# AGENTS.md - Sistema Generativo de Ramificación Orgánica (Lichtenberg / Mycelium en p5.js)

## 1. Contexto y Visión del Proyecto
Este proyecto es una pieza de arte generativo en **p5.js** que simula el crecimiento progresivo de estructuras ramificadas hiper-detalladas (estética de Figuras de Lichtenberg, descargas dieléctricas y raíces miceliales). 
- Las ramas nacen desde las esquinas o bordes del lienzo (dentro de un marco fino delimitado).
- **Crecimiento secuencial ("de a una"):** Una rama maestra nace desde un punto de origen, se expande colonizando el espacio con sub-ramas y capilares hasta agotar su energía o espacio disponible, y recién cuando termina (o entra en fase residual), se dispara la siguiente rama maestra desde otra esquina, acumulándose e interactuando espacialmente con las anteriores.

## 2. Stack Tecnológico y Convenciones
- **Motor:** p5.js (modo instancia o global limpio, ES6+ moderno, modularizado).
- **Formateo y Estilo:** Código limpio compatible con **Biome** (indentación consistente, `const`/`let`, sin variables globales sueltas innecesarias).
- **Rendimiento (Crítico):** El dibujo debe ser acumulativo sobre el buffer principal o mediante un `p5.Graphics` persistente. **PROHIBIDO** redibujar todos los cientos de miles de segmentos desde cero en cada `draw()`. Solo se deben renderizar los segmentos nuevos generados en el tick actual, o actualizar el buffer incrementalmente.

## 3. Arquitectura Algorítmica Requerida
Para lograr la estética de venas principales gruesas y brillantes que se subdividen en miles de filamentos caóticos sin bloquear el navegador, NO usar recursividad síncrona (`function branch() { branch(); }`). Implementar un **Sistema Híbrido de Agentes + Colonización de Espacio / Grid de Ocupación**:

### A. Clase `BranchTip` (Agente de Crecimiento)
Cada punta activa de crecimiento es un agente con:
- `pos`: `p5.Vector` (posición actual) y `prevPos`: `p5.Vector`.
- `dir`: `p5.Vector` (dirección normalizada).
- `generation`: Entero (0 para la arteria principal, incrementando en bifurcaciones).
- `energy`: Flotante (decae con cada paso y se divide al bifurcar).
- `thickness`: Calculado en función de `energy` y `generation` (caída exponencial para que el tronco sea prominente y las puntas sean micro-capilares).
- `noiseOffset`: Semilla propia o lectura de un campo de ruido 2D/3D (`noise()`) de alta frecuencia para darle el quiebre eléctrico/orgánico ("jitter" + curvatura suave).

### B. Gestión del Espacio y "Amontonamiento" (Spatial Hash / Occupancy Grid)
- Implementar una grilla espacial ligera (`SpatialGrid`) que registre la densidad de ramas en cada celda del canvas.
- Los agentes deben consultar la grilla antes de avanzar:
  1. **Evasión / Repulsión suave:** Si una zona ya está muy densa por una rama anterior, el vector de dirección se desvía hacia zonas más vacías.
  2. **Terminación por saturación:** Si los capilares de alta generación entran en una celda saturada, su `energy` cae rápidamente para evitar manchas blancas sólidas y lograr esa textura porosa de red neuronal/raíz.

### C. Máquina de Estados Secuencial (`GrowthManager`)
- El sistema debe gestionar una cola de orígenes (ej. Superior-Izquierda, Inferior-Derecha, Superior-Derecha, Inferior-Izquierda).
- **Estado `GROWING_TREE_N`:** Solo hay un árbol maestro activo a la vez. Se procesan entre `K` y `M` iteraciones por frame (ajustable para controlar la velocidad de crecimiento) de su lista de `activeTips`.
- Cuando `activeTips.length === 0`, el sistema pasa automáticamente al siguiente origen en la esquina opuesta, cuyas ramas crecerán invadiendo y amontonándose contra la estructura ya fosilizada en el canvas.

## 4. Dirección Estética y Renderizado
- **Paleta:** Fondo negro profundo (`#050608`). Ramas en tonos azul eléctrico frío / blanco cian (`rgb(160, 195, 255)` en capilares a `rgb(240, 248, 255)` en el núcleo del tronco).
- **Efecto Glow / Descarga (Imagen 2):** 
  - Usar `blendMode(ADD)` o `SCREEN` de forma controlada.
  - Para las ramas de generación 0 y 1 (troncos principales), renderizar una pasada base ancha con muy baja opacidad (halo azulado) y encima el núcleo fino de alta opacidad (blanco brillante).
  - Para los capilares finales (generación > 3), usar trazos de `0.3px` a `0.8px` con opacidad baja (`alpha` entre 15 y 60) para que la acumulación genere textura sin quemar la imagen.
- **Marco:** Dibujar un borde rectangular interno fino y sutil (gris/azulado oscuro) que contenga exactamente el área de colisión y nacimiento de las ramas.

## 5. Controles y Parámetros (UI / Debug)
Exponer un objeto `CONFIG` en la parte superior del código con parámetros clave listos para ajustar (o conectar a `lil-gui` / teclado):
- `stepsPerFrame`: Velocidad de crecimiento.
- `branchProb`: Probabilidad de bifurcación según generación.
- `angleVariance`: Apertura de las bifurcaciones y fuerza del Perlin noise.
- `repulsionStrength`: Qué tanto esquivan las ramas nuevas a las viejas.
- Teclas rápidas: `[R]` para reiniciar semilla, `[SPACE]` para forzar el nacimiento de la siguiente esquina, `[S]` para guardar PNG en alta resolución.

## 6. Plan de Ejecución para el Agente
1. Crear la estructura base (`index.html`, `sketch.js`, `SpatialGrid.js`, `BranchTip.js`).
2. Implementar primero el `SpatialGrid` y la clase `BranchTip` con movimiento errático quebrado (estilo Lichtenberg: mezcla de Perlin noise + desvíos angulares súbitos).
3. Implementar la lógica de bifurcación asimétrica: cuando una rama se divide, una hija mantiene casi la misma energía y ángulo (continuando la vena principal), mientras que la otra nace con mucha menos energía y un ángulo más abierto (creando los arbustos capilares laterales).
4. Integrar el renderizado multipasada con `blendMode(ADD)` para el brillo del tronco principal y verificar que el framerate se mantenga a 60 FPS constantes.