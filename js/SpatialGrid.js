/**
 * Pre-calcula los pesos geométricos de repulsión para un radio de celdas dado,
 * evitando ejecutar Math.sqrt() y divisiones miles de veces por frame en el hot-loop.
 */
const REPULSION_KERNEL_CACHE = new Map();

function getRepulsionKernel(radiusCells) {
	let kernel = REPULSION_KERNEL_CACHE.get(radiusCells);
	if (kernel) {
		return kernel;
	}

	kernel = [];
	for (let dy = -radiusCells; dy <= radiusCells; dy++) {
		for (let dx = -radiusCells; dx <= radiusCells; dx++) {
			if (dx === 0 && dy === 0) {
				continue;
			}
			const distSq = dx * dx + dy * dy;
			const invDist = 1 / Math.sqrt(distSq);
			const factor = invDist / distSq;
			const wx = -dx * factor;
			const wy = -dy * factor;
			kernel.push({
				dx,
				dy,
				wx,
				wy,
				outWx: wx * 2.5,
				outWy: wy * 2.5,
			});
		}
	}

	REPULSION_KERNEL_CACHE.set(radiusCells, kernel);
	return kernel;
}

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
		this.invCellSize = 1 / cellSize;
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

		// Rango precalculado de celdas cuyo centro cae dentro de bounds
		this.minInnerCol = Math.ceil(this.bounds.left * this.invCellSize - 0.5);
		this.maxInnerCol = Math.floor(this.bounds.right * this.invCellSize - 0.5);
		this.minInnerRow = Math.ceil(this.bounds.top * this.invCellSize - 0.5);
		this.maxInnerRow = Math.floor(this.bounds.bottom * this.invCellSize - 0.5);

		// Arreglo plano tipado para máximo rendimiento y cero GC al limpiar
		this.cells = new Float32Array(this.cols * this.rows);

		// Pre-calentar kernels habituales (radios 2 y 3)
		getRepulsionKernel(2);
		getRepulsionKernel(3);
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
		const col = Math.floor(x * this.invCellSize);
		const row = Math.floor(y * this.invCellSize);
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
		return (
			col >= this.minInnerCol &&
			col <= this.maxInnerCol &&
			row >= this.minInnerRow &&
			row <= this.maxInnerRow
		);
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
		const col = Math.floor(x * this.invCellSize);
		const row = Math.floor(y * this.invCellSize);
		if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
			return;
		}

		const cols = this.cols;
		const centerIdx = row * cols + col;
		this.cells[centerIdx] += amount;
		if (treeContribution) {
			treeContribution[centerIdx] += amount;
		}

		const neighborWeight = amount * 0.15;

		// Vecino derecho (col + 1, row)
		if (col + 1 < cols) {
			const idx = centerIdx + 1;
			this.cells[idx] += neighborWeight;
			if (treeContribution) treeContribution[idx] += neighborWeight;
		}
		// Vecino izquierdo (col - 1, row)
		if (col - 1 >= 0) {
			const idx = centerIdx - 1;
			this.cells[idx] += neighborWeight;
			if (treeContribution) treeContribution[idx] += neighborWeight;
		}
		// Vecino inferior (col, row + 1)
		if (row + 1 < this.rows) {
			const idx = centerIdx + cols;
			this.cells[idx] += neighborWeight;
			if (treeContribution) treeContribution[idx] += neighborWeight;
		}
		// Vecino superior (col, row - 1)
		if (row - 1 >= 0) {
			const idx = centerIdx - cols;
			this.cells[idx] += neighborWeight;
			if (treeContribution) treeContribution[idx] += neighborWeight;
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
		const cells = this.cells;
		const len = cells.length;
		for (let i = 0; i < len; i++) {
			const contrib = treeContribution[i];
			if (contrib > 0) {
				const next = cells[i] - contrib * scale;
				cells[i] = next > 0 ? next : 0;
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

		const col = Math.floor(x * this.invCellSize);
		const row = Math.floor(y * this.invCellSize);
		if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
			return Number.POSITIVE_INFINITY;
		}

		return this.cells[row * this.cols + col];
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
	 * Si se pasa `outVec`, escribe en él sin alocar memoria; de lo contrario crea un p5.Vector.
	 */
	getRepulsionVector(
		x,
		y,
		radiusCells = 2,
		freeOverlapDensity = 2.5,
		outVec = null,
	) {
		const col = Math.floor(x * this.invCellSize);
		const row = Math.floor(y * this.invCellSize);
		const cols = this.cols;
		const rows = this.rows;
		const cells = this.cells;
		const minCol = this.minInnerCol;
		const maxCol = this.maxInnerCol;
		const minRow = this.minInnerRow;
		const maxRow = this.maxInnerRow;

		const kernel = getRepulsionKernel(radiusCells);
		const kLen = kernel.length;

		let steerX = 0;
		let steerY = 0;

		for (let i = 0; i < kLen; i++) {
			const k = kernel[i];
			const nCol = col + k.dx;
			const nRow = row + k.dy;

			if (nCol < 0 || nCol >= cols || nRow < 0 || nRow >= rows) {
				continue;
			}

			if (nCol < minCol || nCol > maxCol || nRow < minRow || nRow > maxRow) {
				steerX += k.outWx;
				steerY += k.outWy;
				continue;
			}

			const excessDensity = cells[nRow * cols + nCol] - freeOverlapDensity;
			if (excessDensity > 0) {
				steerX += k.wx * excessDensity;
				steerY += k.wy * excessDensity;
			}
		}

		const borderMargin = this.cellSize * 2.5;
		const invBorderMargin = 1.0 / borderMargin;
		const { left, right, top, bottom } = this.bounds;

		if (x - left < borderMargin) {
			const t = 1.0 - (x - left) * invBorderMargin;
			steerX += t * t * 3.0;
		} else if (right - x < borderMargin) {
			const t = 1.0 - (right - x) * invBorderMargin;
			steerX -= t * t * 3.0;
		}

		if (y - top < borderMargin) {
			const t = 1.0 - (y - top) * invBorderMargin;
			steerY += t * t * 3.0;
		} else if (bottom - y < borderMargin) {
			const t = 1.0 - (bottom - y) * invBorderMargin;
			steerY -= t * t * 3.0;
		}

		let vx = steerX * 0.28;
		let vy = steerY * 0.28;
		const magSq = vx * vx + vy * vy;
		if (magSq > 1.0) {
			const invMag = 1.0 / Math.sqrt(magSq);
			vx *= invMag;
			vy *= invMag;
		}

		if (outVec) {
			outVec.x = vx;
			outVec.y = vy;
			return outVec;
		}

		return createVector(vx, vy);
	}

	/**
	 * Renderizado opcional de depuración para visualizar las celdas ocupadas.
	 */
	renderDebug(target, saturationThreshold = 8.0) {
		target.push();
		target.noStroke();

		for (let row = 0; row < this.rows; row++) {
			for (let col = 0; col < this.cols; col++) {
				const density = this.cells[row * this.cols + col];
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
