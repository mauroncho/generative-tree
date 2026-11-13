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
 * y descuento acotado de densidad cuando se enfrían o borran ramas antiguas.
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
	 * Crea una estructura de contribución por árbol con rango de índices activos [minIdx, maxIdx]
	 * para no tener que iterar las celdas vacías al enfriar o borrar el árbol.
	 */
	createContributionArray() {
		const len = this.cols * this.rows;
		return {
			data: new Float32Array(len),
			minIdx: len,
			maxIdx: -1,
		};
	}

	/**
	 * Limpia únicamente el rango de celdas que fueron utilizadas por la contribución de un árbol.
	 */
	resetContribution(treeContribution) {
		if (!treeContribution) return;
		if (treeContribution.maxIdx >= treeContribution.minIdx) {
			treeContribution.data.fill(
				0,
				treeContribution.minIdx,
				treeContribution.maxIdx + 1,
			);
		}
		treeContribution.minIdx = treeContribution.data.length;
		treeContribution.maxIdx = -1;
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
	 * Registra densidad en la posición (x, y), difunde una fracción ligera a las
	 * 4 celdas vecinas y opcionalmente anota el mismo aporte en treeContribution
	 * acotando su rango [minIdx, maxIdx].
	 */
	addDensity(x, y, amount = 1.0, treeContribution = null) {
		const col = Math.floor(x * this.invCellSize);
		const row = Math.floor(y * this.invCellSize);
		if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
			return;
		}

		const cols = this.cols;
		const centerIdx = row * cols + col;
		const cells = this.cells;
		cells[centerIdx] += amount;

		const neighborWeight = amount * 0.15;
		const hasRight = col + 1 < cols;
		const hasLeft = col - 1 >= 0;
		const hasBottom = row + 1 < this.rows;
		const hasTop = row - 1 >= 0;

		if (hasRight) cells[centerIdx + 1] += neighborWeight;
		if (hasLeft) cells[centerIdx - 1] += neighborWeight;
		if (hasBottom) cells[centerIdx + cols] += neighborWeight;
		if (hasTop) cells[centerIdx - cols] += neighborWeight;

		if (treeContribution) {
			const cData = treeContribution.data;
			cData[centerIdx] += amount;
			if (hasRight) cData[centerIdx + 1] += neighborWeight;
			if (hasLeft) cData[centerIdx - 1] += neighborWeight;
			if (hasBottom) cData[centerIdx + cols] += neighborWeight;
			if (hasTop) cData[centerIdx - cols] += neighborWeight;

			const minTouched = hasTop
				? centerIdx - cols
				: hasLeft
					? centerIdx - 1
					: centerIdx;
			const maxTouched = hasBottom
				? centerIdx + cols
				: hasRight
					? centerIdx + 1
					: centerIdx;

			if (minTouched < treeContribution.minIdx) {
				treeContribution.minIdx = minTouched;
			}
			if (maxTouched > treeContribution.maxIdx) {
				treeContribution.maxIdx = maxTouched;
			}
		}
	}

	/**
	 * Ajusta en la grilla global una fracción con signo (deltaScale) del aporte de un árbol,
	 * recorriendo únicamente el intervalo [minIdx, maxIdx] de celdas realmente tocadas.
	 */
	adjustContribution(treeContribution, deltaScale = 0.0) {
		if (
			!treeContribution ||
			treeContribution.maxIdx < treeContribution.minIdx ||
			Math.abs(deltaScale) <= 0.00001
		) {
			return;
		}
		const cells = this.cells;
		const cData = treeContribution.data;
		const start = treeContribution.minIdx;
		const end = treeContribution.maxIdx;

		for (let i = start; i <= end; i++) {
			const contrib = cData[i];
			if (contrib > 0) {
				const next = cells[i] + contrib * deltaScale;
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
