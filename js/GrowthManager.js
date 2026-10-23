/**
 * GrowthManager - Máquina de estados secuencial e infinita para gestionar la cola
 * de orígenes por esquinas, el historial de ramas visibles (maxVisibleTrees) con
 * reciclaje de buffers (pool) y desvanecimiento suave a 60 FPS sin redibujar segmentos.
 */
class GrowthManager {
  constructor(grid, config) {
    this.grid = grid;
    this.config = config;
    this.activeTips = [];
    this.treeRecords = [];
    this.layerPool = [];

    this.currentCornerIndex = 0;
    this.treesSpawnedCount = 0;
    this.state = "GROWING"; // "GROWING" | "TRANSITION" | "COMPLETED"
    this.transitionTimer = 0;
    this.lastBatchCount = 1;
    this.shockTimer = 0;
    this.shockDuration = 75;

    this.cornerNames = [
      "Sup-Izquierda",
      "Inf-Derecha",
      "Sup-Derecha",
      "Inf-Izquierda",
    ];
  }

  /**
   * Obtiene un registro de capa del pool o crea uno nuevo si el pool está vacío.
   */
  acquireTreeRecord() {
    let record = this.layerPool.pop();
    if (!record) {
      const pg = createGraphics(this.grid.width, this.grid.height);
      const density = Math.min(window.devicePixelRatio || 1, 2);
      pg.pixelDensity(density);
      record = {
        graphics: pg,
        gridContribution: this.grid.createContributionArray(),
        opacity: 1.0,
         SubtractedSoFar: 0.0,
        fading: false,
      };
    } else {
      record.graphics.clear();
      record.gridContribution.fill(0);
      record.opacity = 1.0;
      record.SubtractedSoFar = 0.0;
      record.fading = false;
    }
    return record;
  }

  /**
   * Reinicia la máquina de estados, recicla todas las capas activas y dispara la tanda inicial.
   */
  reset() {
    this.activeTips = [];
    while (this.treeRecords.length > 0) {
      this.layerPool.push(this.treeRecords.pop());
    }

    this.currentCornerIndex = 0;
    this.treesSpawnedCount = 0;
    this.transitionTimer = 0;
    this.shockTimer = 0;
    this.state = "GROWING";
    this.triggerNextAutoBatch(true);
  }

  /**
   * Actualiza la grilla espacial tras redimensionar el canvas y libera los buffers
   * de capas anteriores para que se regeneren con la nueva resolución.
   */
  handleResize(newGrid) {
    this.grid = newGrid;
    this.activeTips = [];

    for (let i = 0; i < this.treeRecords.length; i++) {
      if (this.treeRecords[i].graphics) {
        this.treeRecords[i].graphics.remove();
      }
    }
    for (let i = 0; i < this.layerPool.length; i++) {
      if (this.layerPool[i].graphics) {
        this.layerPool[i].graphics.remove();
      }
    }

    this.treeRecords = [];
    this.layerPool = [];
  }

  /**
   * Factor de escala proporcional a la diagonal del lienzo respecto a la base 900x900,
   * para que largos y dispersiones mantengan su proporción en pantalla completa.
   */
  getCanvasScaleFactor() {
    const refDiagonal = Math.hypot(900, 900);
    const currentDiagonal = Math.hypot(this.grid.width, this.grid.height);
    return currentDiagonal / refDiagonal;
  }

  /**
   * Calcula cuántas ramas deben nacer en simultáneo en el próximo turno automático.
   */
  computeAutoBatchCount() {
    if (this.config.simultaneousMode) {
      if (this.config.simultaneousRandom !== false) {
        return Math.floor(random(2, 5)); // 2, 3 o 4 ramas simultáneas
      }
      return constrain(Math.round(this.config.simultaneousCount ?? 2), 2, 4);
    }
    return constrain(Math.round(this.config.simultaneousCount ?? 1), 1, 4);
  }

  /**
   * Dispara la siguiente tanda automática (1 o entre 2 y 4 esquinas simultáneas).
   */
  triggerNextAutoBatch(isInitial = false) {
    const count = this.computeAutoBatchCount();
    this.triggerSimultaneousBurst(count, isInitial);
  }

  /**
   * Fuerza el disparo inmediato del siguiente origen en la cola de esquinas ([SPACE]).
   */
  triggerNextCorner() {
    this.triggerSimultaneousBurst(1, false);
  }

  /**
   * Dispara entre 1 y 4 ramas maestras al mismo tiempo desde esquinas distintas ([1], [2], [3]).
   */
  triggerSimultaneousBurst(count = 2, startFromZero = false) {
    const burstCount = constrain(Math.round(count), 1, 4);
    this.lastBatchCount = burstCount;
    this.state = "GROWING";
    this.transitionTimer = 0;

    for (let i = 0; i < burstCount; i++) {
      if (startFromZero && i === 0) {
        this.currentCornerIndex = 0;
      } else {
        this.currentCornerIndex = (this.currentCornerIndex + 1) % 4;
      }
      this.spawnMasterTrunkFromCorner(this.currentCornerIndex);
    }
  }

  /**
   * Acción Performática [4] — Floración Capilar (Bloom):
   * Obliga a todas las puntas activas a ramificarse simultáneamente en abanico.
   */
  triggerBloom() {
    if (this.activeTips.length === 0) {
      this.triggerNextCorner();
    }

    const bloomCap = Math.max(this.config.maxActiveTips + 450, 1800);
    const currentLen = this.activeTips.length;
    const spawnedBloom = [];

    for (let i = 0; i < currentLen; i++) {
      const tip = this.activeTips[i];
      if (!tip || tip.isDead) {
        continue;
      }

      const remaining = bloomCap - (this.activeTips.length + spawnedBloom.length);
      if (remaining <= 0) {
        break;
      }

      const children = tip.forceBloom(this.grid, this.config);
      for (let c = 0; c < children.length && c < remaining; c++) {
        spawnedBloom.push(children[c]);
      }
    }

    if (spawnedBloom.length > 0) {
      this.activeTips.push(...spawnedBloom);
    }
  }

  /**
   * Acción Performática [5] — Sacudida Eléctrica (Jitter):
   * Multiplica temporalmente el quiebre angular y aplica un desvío súbito tipo relámpago.
   */
  triggerElectricShock() {
    if (this.activeTips.length === 0) {
      this.triggerNextCorner();
    }

    this.shockTimer = this.shockDuration;

    for (let i = 0; i < this.activeTips.length; i++) {
      const tip = this.activeTips[i];
      if (!tip || tip.isDead) {
        continue;
      }
      const sign = random() < 0.5 ? -1 : 1;
      const jolt = sign * random(0.35, 0.78);
      tip.dir.rotate(jolt);
    }
  }

  /**
   * Cantidad actual de ramas maestras visibles en el lienzo (sin contar las que ya están saliendo).
   */
  getVisibleTreeCount() {
    let count = 0;
    for (let i = 0; i < this.treeRecords.length; i++) {
      if (!this.treeRecords[i].fading) {
        count++;
      }
    }
    return count;
  }

  /**
   * Devuelve una descripción legible del estado actual para la UI.
   */
  getStatusLabel() {
    const cornerName = this.cornerNames[this.currentCornerIndex % 4];
    const visibleCount = this.treeRecords.length;
    const maxVis = this.config.maxVisibleTrees;

    if (this.state === "COMPLETED" && this.activeTips.length === 0) {
      return `Pausado (${visibleCount}/${maxVis} visibles)`;
    }
    if (this.state === "TRANSITION") {
      return `Siguiente esquina (#${this.treesSpawnedCount + 1})...`;
    }
    return `Rama #${this.treesSpawnedCount} (${cornerName}) | Visibles: ${visibleCount}/${maxVis}`;
  }

  /**
   * Devuelve un objeto estructurado con la telemetría para desacoplar el layout de la UI
   * y evitar saltos visuales o reescalados por cambios de longitud de texto.
   */
  getTelemetryInfo() {
    const currentCorner = this.cornerNames[this.currentCornerIndex % 4];
    const nextCorner = this.cornerNames[(this.currentCornerIndex + 1) % 4];
    const visibleCount = this.treeRecords.length;
    const maxVis = this.config.maxVisibleTrees;

    let statusType = "growing";
    let statusBadge =
      this.lastBatchCount > 1
        ? `Ráfaga x${this.lastBatchCount} (#${this.treesSpawnedCount})`
        : `Rama #${this.treesSpawnedCount}`;
    let cornerText =
      this.lastBatchCount > 1 ? `Simultáneo` : currentCorner;

    if (this.shockTimer > 0) {
      statusBadge = `⚡ SACUDIDA`;
    }

    if (this.state === "COMPLETED" && this.activeTips.length === 0) {
      statusType = "paused";
      statusBadge = "PAUSADO";
      cornerText = "Límite";
    } else if (this.state === "TRANSITION") {
      statusType = "transition";
      statusBadge = "SIGUIENTE...";
      cornerText = `Próx: ${nextCorner}`;
    }

    return {
      statusType,
      statusBadge,
      cornerText,
      visibleCount,
      maxVis,
    };
  }

  /**
   * Calcula el largo objetivo de la rama maestra interpolando entre el largo base
   * y un largo aleatorio [trunkMinLength, trunkMaxLength] según trunkLengthRandomness (0.0 a 1.0).
   */
  computeTrunkDecay() {
    const baseLen = this.config.trunkBaseLength;
    const minLen = Math.min(
      this.config.trunkMinLength,
      this.config.trunkMaxLength,
    );
    const maxLen = Math.max(
      this.config.trunkMinLength,
      this.config.trunkMaxLength,
    );
    const randomness = constrain(this.config.trunkLengthRandomness, 0.0, 1.0);

    const randomLen = random(minLen, maxLen);
    const scaleFactor = this.getCanvasScaleFactor();
    const targetLength = lerp(baseLen, randomLen, randomness) * scaleFactor;

    const totalSteps = Math.max(10, targetLength / this.config.stepLength);
    return 1.0 / totalSteps;
  }

  /**
   * Calcula la posición de origen y dirección inicial para una esquina dada,
   * permitiendo dispersión a lo largo del borde horizontal o vertical contiguo.
   */
  computeOriginAndDirection(cornerIndex = 0) {
    const { left, top, right, bottom } = this.grid.bounds;
    const pad = 8;
    const scaleFactor = this.getCanvasScaleFactor();
    const maxSpread = Math.max(
      0,
      (this.config.originSpread ?? 0) * scaleFactor,
    );

    // Limitar la dispersión a no más del 45% del ancho/alto para no invadir la esquina adyacente
    const usableWidth = (right - left - pad * 2) * 0.45;
    const usableHeight = (bottom - top - pad * 2) * 0.45;
    const effectiveSpread = Math.min(maxSpread, usableWidth, usableHeight);

    const corner = cornerIndex % 4;
    // 50% de probabilidad de nacer sobre el borde horizontal (superior/inferior)
    // o sobre el borde vertical (izquierdo/derecho)
    const onHorizontalEdge = random() < 0.5;
    const offset = random(0, effectiveSpread);

    let pos;
    if (corner === 0) {
      // Sup-Izquierda (Borde Superior o Izquierdo)
      pos = onHorizontalEdge
        ? createVector(left + pad + offset, top + pad)
        : createVector(left + pad, top + pad + offset);
    } else if (corner === 1) {
      // Inf-Derecha (Borde Inferior o Derecho)
      pos = onHorizontalEdge
        ? createVector(right - pad - offset, bottom - pad)
        : createVector(right - pad, bottom - pad - offset);
    } else if (corner === 2) {
      // Sup-Derecha (Borde Superior o Derecho)
      pos = onHorizontalEdge
        ? createVector(right - pad - offset, top + pad)
        : createVector(right - pad, top + pad + offset);
    } else {
      // Inf-Izquierda (Borde Inferior o Izquierdo)
      pos = onHorizontalEdge
        ? createVector(left + pad + offset, bottom - pad)
        : createVector(left + pad, bottom - pad - offset);
    }

    // Dirección orientada hacia el centro del canvas con sutil variación angular
    const center = createVector(this.grid.width * 0.5, this.grid.height * 0.5);
    const initialDir = p5.Vector.sub(center, pos).normalize();
    const dir = initialDir.copy().rotate(random(-0.06, 0.06)).normalize();

    return { pos, dir, initialDir };
  }

  /**
   * Crea una rama maestra (generación 0, energía 1.0) desde una de las 4 esquinas
   * asociada a su propio buffer de capa y registro de densidad.
   */
  spawnMasterTrunkFromCorner(cornerIndex = 0) {
    const { pos, dir, initialDir } = this.computeOriginAndDirection(cornerIndex);
    const energyDecay = this.computeTrunkDecay();

    const treeRecord = this.acquireTreeRecord();
    this.treeRecords.push(treeRecord);

    const trunkTip = new BranchTip(pos, dir, 0, 1.0, {
      energyDecay,
      initialDir,
      subBranchLength: this.config.subBranchLength,
      treeRecord,
    });

    this.activeTips.push(trunkTip);
    this.treesSpawnedCount++;

    // Marcar ramas antiguas para desvanecimiento si superamos maxVisibleTrees
    this.enforceMaxVisibleTrees();
  }

  /**
   * Verifica si la cantidad de ramas activas/visibles supera maxVisibleTrees
   * y marca las más antiguas para que se desvanezcan suavemente.
   */
  enforceMaxVisibleTrees() {
    const maxAllowed = Math.max(1, Math.round(this.config.maxVisibleTrees));
    let nonFadingCount = this.getVisibleTreeCount();

    for (
      let i = 0;
      i < this.treeRecords.length && nonFadingCount > maxAllowed;
      i++
    ) {
      if (!this.treeRecords[i].fading) {
        this.treeRecords[i].fading = true;
        nonFadingCount--;
      }
    }
  }

  /**
   * Actualiza la opacidad de las ramas antiguas que están saliendo y libera
   * su densidad en la SpatialGrid. Devuelve true si hubo cambios de opacidad.
   */
  updateFadingTrees() {
    this.enforceMaxVisibleTrees();

    let anyFading = false;
    const fadeStep = 0.032;

    for (let i = this.treeRecords.length - 1; i >= 0; i--) {
      const rec = this.treeRecords[i];
      if (!rec.fading) {
        continue;
      }

      anyFading = true;
      const prevOpacity = rec.opacity;
      rec.opacity = Math.max(0, rec.opacity - fadeStep);
      const delta = prevOpacity - rec.opacity;

      if (delta > 0) {
        this.grid.subtractContribution(rec.gridContribution, delta);
      }

      if (rec.opacity <= 0.001) {
        this.treeRecords.splice(i, 1);
        this.layerPool.push(rec);
      }
    }

    return anyFading;
  }

  /**
   * Recompone el buffer principal en O(1) usando las texturas congeladas de las
   * ramas visibles (con alpha nativo de GPU en drawingContext, sin redibujar segmentos).
   */
  recompositeMainBuffer(mainBuffer) {
    mainBuffer.push();
    mainBuffer.blendMode(BLEND);
    mainBuffer.background(this.config.bgColor);
    mainBuffer.blendMode(ADD);

    const ctx = mainBuffer.drawingContext;
    for (let i = 0; i < this.treeRecords.length; i++) {
      const rec = this.treeRecords[i];
      if (rec.opacity <= 0.001) {
        continue;
      }
      ctx.globalAlpha = rec.opacity;
      mainBuffer.image(rec.graphics, 0, 0);
    }

    ctx.globalAlpha = 1.0;
    mainBuffer.pop();
  }

  /**
   * Ejecuta K pasos de simulación en el frame actual, gestiona el modo infinito /
   * límite de ramas visibles y actualiza los buffers acumulativos.
   */
  stepAndRender(mainBuffer) {
    // 1. Procesar desvanecimiento de ramas antiguas si superan maxVisibleTrees
    const needsRecomposite = this.updateFadingTrees();

    // 2. Manejo de transición automática cuando el árbol actual termina sus puntas
    if (this.activeTips.length === 0) {
      const canContinue =
        this.config.infiniteMode ||
        this.treesSpawnedCount < this.config.maxVisibleTrees;

      if (this.config.autoSequence && canContinue) {
        if (this.state !== "TRANSITION") {
          this.state = "TRANSITION";
          this.transitionTimer = 15;
        } else {
          this.transitionTimer--;
          if (this.transitionTimer <= 0) {
            this.triggerNextAutoBatch(false);
          }
        }
      } else {
        this.state = "COMPLETED";
      }

      if (needsRecomposite) {
        this.recompositeMainBuffer(mainBuffer);
      }
      return;
    }

    this.state = "GROWING";

    const shockIntensity =
      this.shockTimer > 0 ? this.shockTimer / this.shockDuration : 0;
    if (this.shockTimer > 0) {
      this.shockTimer--;
    }

    // Preparar los buffers individuales en blendMode(ADD)
    for (let i = 0; i < this.treeRecords.length; i++) {
      const pg = this.treeRecords[i].graphics;
      pg.blendMode(ADD);
      pg.strokeCap(ROUND);
    }

    mainBuffer.push();
    mainBuffer.blendMode(ADD);
    mainBuffer.strokeCap(ROUND);

    for (let step = 0; step < this.config.stepsPerFrame; step++) {
      const spawnedThisStep = [];

      for (let i = this.activeTips.length - 1; i >= 0; i--) {
        const tip = this.activeTips[i];
        tip.update(this.grid, this.config, shockIntensity);

        // Dibujar el segmento nuevo en la capa propia del árbol
        if (tip.treeRecord && tip.treeRecord.graphics) {
          tip.render(tip.treeRecord.graphics, this.config);
        }

        // Si no estamos recomponiendo por fade-out, estampar directo también en mainBuffer
        if (!needsRecomposite) {
          tip.render(mainBuffer, this.config);
        }

        if (tip.isDead) {
          this.activeTips.splice(i, 1);
          continue;
        }

        const remainingCapacity =
          this.config.maxActiveTips -
          (this.activeTips.length + spawnedThisStep.length);

        if (remainingCapacity > 0) {
          const newChildren = tip.tryBranch(this.grid, this.config);
          for (let c = 0; c < newChildren.length && c < remainingCapacity; c++) {
            spawnedThisStep.push(newChildren[c]);
          }
        }
      }

      if (spawnedThisStep.length > 0) {
        this.activeTips.push(...spawnedThisStep);
      }

      if (this.activeTips.length === 0) {
        break;
      }
    }

    mainBuffer.pop();

    // Si alguna rama antigua se está desvaneciendo, recomponer las capas sobre mainBuffer
    if (needsRecomposite) {
      this.recompositeMainBuffer(mainBuffer);
    }
  }
}

window.GrowthManager = GrowthManager;
