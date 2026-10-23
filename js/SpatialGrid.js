/**
 * SpatialGrid - Grilla espacial ligera para gestionar densidad de ocupación,
 * tolerancia de superposición (apilamiento libre), vectores de evasión suave
 * y descuento exacto de densidad cuando se borran ramas antiguas.
 */
class SpatialGrid {
  constructor(width, height, cellSize = 12, margin = 36) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.margin = margin;

    // Límites exactos del marco contenedor interno
    this.bounds = {
      left: margin,
      top: margin,
      right: width - margin,
      bottom: height - margin,
    };

    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);

    // Arreglo plano tipado para máximo rendimiento y cero GC al limpiar
    this.cells = new Float32Array(this.cols * this.rows);
  }

  /**
   * Reinicia toda la grilla de ocupación a cero.
   */
  clear() {
    this.cells.fill(0);
  }

  /**
   * Crea un arreglo Float32Array vacío del mismo tamaño que la grilla
   * para registrar el aporte individual de un árbol.
   */
  createContributionArray() {
    return new Float32Array(this.cols * this.rows);
  }

  /**
   * Convierte coordenadas de píxeles (x, y) a índices de celda (col, row).
   */
  getCellCoords(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    return { col, row };
  }

  /**
   * Verifica si una celda (col, row) está dentro de las dimensiones de la matriz.
   */
  isValidCell(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  /**
   * Verifica si el centro de una celda (col, row) cae dentro del marco interno.
   */
  isCellInsideBounds(col, row) {
    const cx = (col + 0.5) * this.cellSize;
    const cy = (row + 0.5) * this.cellSize;
    return this.isInsideBounds(cx, cy);
  }

  /**
   * Verifica si una coordenada en píxeles (x, y) se encuentra dentro del marco interno.
   */
  isInsideBounds(x, y) {
    return (
      x >= this.bounds.left &&
      x <= this.bounds.right &&
      y >= this.bounds.top &&
      y <= this.bounds.bottom
    );
  }

  /**
   * Índice lineal en el Float32Array para (col, row).
   */
  getIndex(col, row) {
    return row * this.cols + col;
  }

  /**
   * Registra densidad en la posición (x, y), difunde una fracción ligera a las
   * 4 celdas vecinas y opcionalmente anota el mismo aporte en treeContribution
   * para poder restarlo cuando ese árbol antiguo se desvanezca.
   */
  addDensity(x, y, amount = 1.0, treeContribution = null) {
    const { col, row } = this.getCellCoords(x, y);
    if (!this.isValidCell(col, row)) {
      return;
    }

    const centerIdx = this.getIndex(col, row);
    this.cells[centerIdx] += amount;
    if (treeContribution) {
      treeContribution[centerIdx] += amount;
    }

    const neighborWeight = amount * 0.15;
    const offsets = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const [dx, dy] of offsets) {
      const nCol = col + dx;
      const nRow = row + dy;
      if (this.isValidCell(nCol, nRow)) {
        const nIdx = this.getIndex(nCol, nRow);
        this.cells[nIdx] += neighborWeight;
        if (treeContribution) {
          treeContribution[nIdx] += neighborWeight;
        }
      }
    }
  }

  /**
   * Resta de la grilla global una fracción (scale) del aporte de un árbol antiguo
   * cuando se va desvaneciendo al superar maxVisibleTrees.
   */
  subtractContribution(treeContribution, scale = 1.0) {
    if (!treeContribution) {
      return;
    }
    const len = this.cells.length;
    for (let i = 0; i < len; i++) {
      const sub = treeContribution[i] * scale;
      if (sub > 0) {
        this.cells[i] = Math.max(0, this.cells[i] - sub);
      }
    }
  }

  /**
   * Devuelve la densidad acumulada en la coordenada (x, y).
   * Si está fuera del marco interno, devuelve Infinity (pared dura).
   */
  getDensity(x, y) {
    if (!this.isInsideBounds(x, y)) {
      return Number.POSITIVE_INFINITY;
    }

    const { col, row } = this.getCellCoords(x, y);
    if (!this.isValidCell(col, row)) {
      return Number.POSITIVE_INFINITY;
    }

    return this.cells[this.getIndex(col, row)];
  }

  /**
   * Consulta si la celda en (x, y) superó el umbral de saturación permitido.
   */
  isSaturated(x, y, maxDensity) {
    return this.getDensity(x, y) >= maxDensity;
  }

  /**
   * Calcula un vector de repulsión suave proporcional al exceso de densidad
   * por encima del colchón de superposición libre (freeOverlapDensity).
   */
  getRepulsionVector(x, y, radiusCells = 2, freeOverlapDensity = 2.5) {
    const { col, row } = this.getCellCoords(x, y);
    let steerX = 0;
    let steerY = 0;

    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }

        const nCol = col + dx;
        const nRow = row + dy;
        if (!this.isValidCell(nCol, nRow)) {
          continue;
        }

        if (!this.isCellInsideBounds(nCol, nRow)) {
          const distSq = dx * dx + dy * dy;
          const invDist = 1 / Math.sqrt(distSq);
          steerX -= dx * invDist * (2.5 / distSq);
          steerY -= dy * invDist * (2.5 / distSq);
          continue;
        }

        const rawDensity = this.cells[this.getIndex(nCol, nRow)];
        const excessDensity = Math.max(0, rawDensity - freeOverlapDensity);

        if (excessDensity > 0) {
          const distSq = dx * dx + dy * dy;
          const invDist = 1 / Math.sqrt(distSq);
          steerX -= dx * invDist * (excessDensity / distSq);
          steerY -= dy * invDist * (excessDensity / distSq);
        }
      }
    }

    const borderMargin = this.cellSize * 2.5;
    if (x - this.bounds.left < borderMargin) {
      const t = 1.0 - (x - this.bounds.left) / borderMargin;
      steerX += t * t * 3.0;
    } else if (this.bounds.right - x < borderMargin) {
      const t = 1.0 - (this.bounds.right - x) / borderMargin;
      steerX -= t * t * 3.0;
    }

    if (y - this.bounds.top < borderMargin) {
      const t = 1.0 - (y - this.bounds.top) / borderMargin;
      steerY += t * t * 3.0;
    } else if (this.bounds.bottom - y < borderMargin) {
      const t = 1.0 - (this.bounds.bottom - y) / borderMargin;
      steerY -= t * t * 3.0;
    }

    const vec = createVector(steerX * 0.28, steerY * 0.28);
    vec.limit(1.0);
    return vec;
  }

  /**
   * Renderizado opcional de depuración para visualizar las celdas ocupadas.
   */
  renderDebug(target, saturationThreshold = 8.0) {
    target.push();
    target.noStroke();

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const density = this.cells[this.getIndex(col, row)];
        if (density <= 0.01) {
          continue;
        }

        const norm = Math.min(density / saturationThreshold, 1.0);
        target.fill(60, 140, 255, norm * 90);
        target.rect(
          col * this.cellSize,
          row * this.cellSize,
          this.cellSize - 1,
          this.cellSize - 1,
        );
      }
    }

    target.pop();
  }
}

window.SpatialGrid = SpatialGrid;
