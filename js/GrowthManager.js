/**
 * GrowthManager - Máquina de estados secuencial e infinita para gestionar la cola
 * de orígenes por esquinas, el historial de ramas visibles (maxVisibleTrees) con
 * reciclaje de buffers (pool), enfriamiento/desaturación a gris al finalizar el
 * crecimiento con alivio del SpatialGrid y desvanecimiento suave a 60 FPS.
 */
class GrowthManager {
	constructor(grid, config) {
		this.grid = grid;
		this.config = config;
		this.activeTips = [];
		this.treeRecords = [];
		this.layerPool = [];
		this._spawnBuffer = [];

		this.currentCornerIndex = 0;
		this.treesSpawnedCount = 0;
		this.state = "GROWING"; // "GROWING" | "TRANSITION" | "COMPLETED"
		this.transitionTimer = 0;
		this.lastBatchCount = 1;
		this.shockTimer = 0;
		this.shockDuration = 75;
		this.isShockSustained = false;
		this.isBloomSustained = false;
		this.bloomSustainInterval = 5;
		this.bloomSustainCounter = 0;
		this._lastMatureBrightness = config.matureBrightness ?? 0.75;

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
			pg.blendMode(ADD);
			pg.strokeCap(ROUND);
			record = {
				graphics: pg,
				gridContribution: this.grid.createContributionArray(),
				opacity: 1.0,
				fading: false,
				activeTipCount: 0,
				hasSpawnedTips: false,
				cooling: false,
				coolingProgress: 0.0,
				desatApplied: 0.0,
				appliedGridWeight: 1.0,
			};
		} else {
			record.graphics.clear();
			record.graphics.blendMode(ADD);
			record.graphics.strokeCap(ROUND);
			record.gridContribution.fill(0);
			record.opacity = 1.0;
			record.fading = false;
			record.activeTipCount = 0;
			record.hasSpawnedTips = false;
			record.cooling = false;
			record.coolingProgress = 0.0;
			record.desatApplied = 0.0;
			record.appliedGridWeight = 1.0;
		}
		return record;
	}

	/**
	 * Reinicia la máquina de estados, recicla todas las capas activas y dispara la tanda inicial.
	 */
	reset() {
		this.activeTips.length = 0;
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
		this.activeTips.length = 0;

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

		this.treeRecords.length = 0;
		this.layerPool.length = 0;
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

	setShockSustained(sustained) {
		const next = Boolean(sustained);
		if (this.isShockSustained === next) return;
		this.isShockSustained = next;
		if (this.isShockSustained) {
			this.triggerElectricShock();
		} else {
			this.shockTimer = Math.min(this.shockTimer, 15);
		}
	}

	setBloomSustained(sustained) {
		const next = Boolean(sustained);
		if (this.isBloomSustained === next) return;
		this.isBloomSustained = next;
		if (this.isBloomSustained) {
			this.triggerBloom();
			this.bloomSustainCounter = 0;
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

		for (let i = 0; i < currentLen; i++) {
			const tip = this.activeTips[i];
			if (!tip || tip.isDead) {
				continue;
			}

			const remaining = bloomCap - this.activeTips.length;
			if (remaining <= 0) {
				break;
			}

			const children = tip.forceBloom(this.grid, this.config);
			for (let c = 0; c < children.length && c < remaining; c++) {
				this.activeTips.push(children[c]);
			}
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
		let cornerText = this.lastBatchCount > 1 ? "Simultáneo" : currentCorner;

		if (this.shockTimer > 0 || this.isShockSustained) {
			statusBadge = "⚡ SACUDIDA";
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
		const { pos, dir, initialDir } =
			this.computeOriginAndDirection(cornerIndex);
		const energyDecay = this.computeTrunkDecay();

		const treeRecord = this.acquireTreeRecord();
		treeRecord.hasSpawnedTips = true;
		treeRecord.activeTipCount = 1;
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
	 * Desatura incrementalmente los píxeles de una rama finalizada hacia un tono gris
	 * neutro usando composición 'source-atop' en GPU (preserva el fondo transparente 100%).
	 */
	applyTreeDesaturationStep(rec, alphaStep) {
		if (!rec.graphics || alphaStep <= 0.005) {
			return;
		}
		const ctx = rec.graphics.drawingContext;
		ctx.save();
		ctx.globalCompositeOperation = "source-atop";
		ctx.fillStyle = `rgba(162, 170, 182, ${constrain(alphaStep, 0, 1)})`;
		ctx.fillRect(0, 0, this.grid.width, this.grid.height);
		ctx.restore();
	}

	/**
	 * Gestiona el ciclo de vida de las capas de árboles:
	 * 1. Detecta ramas que completaron su crecimiento (activeTipCount === 0) y las enfría a gris.
	 * 2. Alivia su peso en la SpatialGrid según matureGridRelief para permitir nuevas ramas hijas.
	 * 3. Actualiza la opacidad de las ramas antiguas que están saliendo (fading).
	 * Devuelve true si hubo cambios visuales que requieren recomponer mainBuffer.
	 */
	updateFadingTrees() {
		this.enforceMaxVisibleTrees();

		for (let i = 0; i < this.treeRecords.length; i++) {
			this.treeRecords[i].activeTipCount = 0;
		}
		for (let i = 0; i < this.activeTips.length; i++) {
			const tip = this.activeTips[i];
			if (tip && !tip.isDead && tip.treeRecord) {
				tip.treeRecord.activeTipCount++;
				tip.treeRecord.hasSpawnedTips = true;
			}
		}

		let needsRecomposite = false;
		const fadeStep = 0.032;
		const coolStep = 0.04;
		const targetDesatConfig = constrain(
			this.config.matureDesaturation ?? 0.75,
			0.0,
			1.0,
		);
		const targetReliefConfig = constrain(
			this.config.matureGridRelief ?? 0.7,
			0.0,
			0.95,
		);
		const targetBrightConfig = constrain(
			this.config.matureBrightness ?? 0.75,
			0.25,
			1.0,
		);

		if (Math.abs(this._lastMatureBrightness - targetBrightConfig) > 0.001) {
			this._lastMatureBrightness = targetBrightConfig;
			needsRecomposite = true;
		}

		for (let i = this.treeRecords.length - 1; i >= 0; i--) {
			const rec = this.treeRecords[i];

			if (rec.hasSpawnedTips && rec.activeTipCount === 0) {
				rec.cooling = true;
			}

			if (rec.cooling && rec.coolingProgress < 1.0) {
				rec.coolingProgress = Math.min(1.0, rec.coolingProgress + coolStep);
				needsRecomposite = true;
			}

			if (rec.cooling) {
				const desiredDesat = rec.coolingProgress * targetDesatConfig;
				if (desiredDesat > rec.desatApplied + 0.005) {
					const denom = Math.max(0.02, 1.0 - rec.desatApplied);
					const alphaStep = (desiredDesat - rec.desatApplied) / denom;
					if (alphaStep >= 0.16 || rec.coolingProgress >= 1.0) {
						this.applyTreeDesaturationStep(rec, alphaStep);
						rec.desatApplied = desiredDesat;
						needsRecomposite = true;
					}
				}
			}

			if (rec.fading) {
				needsRecomposite = true;
				rec.opacity = Math.max(0, rec.opacity - fadeStep);
			}

			if (rec.cooling || rec.fading) {
				const targetGridWeight =
					rec.opacity * (1.0 - rec.coolingProgress * targetReliefConfig);
				const weightDelta = targetGridWeight - rec.appliedGridWeight;
				if (Math.abs(weightDelta) > 0.0005) {
					this.grid.adjustContribution(rec.gridContribution, weightDelta);
					rec.appliedGridWeight = targetGridWeight;
				}
			}

			if (rec.fading && rec.opacity <= 0.001) {
				if (rec.appliedGridWeight > 0.00001) {
					this.grid.adjustContribution(
						rec.gridContribution,
						-rec.appliedGridWeight,
					);
					rec.appliedGridWeight = 0;
				}
				this.treeRecords.splice(i, 1);
				this.layerPool.push(rec);
			}
		}

		return needsRecomposite;
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

		const targetBright = constrain(
			this.config.matureBrightness ?? 0.75,
			0.25,
			1.0,
		);
		const ctx = mainBuffer.drawingContext;
		for (let i = 0; i < this.treeRecords.length; i++) {
			const rec = this.treeRecords[i];
			if (rec.opacity <= 0.001) {
				continue;
			}
			const matureDim = 1.0 - rec.coolingProgress * (1.0 - targetBright);
			ctx.globalAlpha = rec.opacity * matureDim;
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
		// 1. Procesar enfriamiento a gris y desvanecimiento de ramas antiguas
		const needsRecomposite = this.updateFadingTrees();

		// 2. Manejo de transición automática cuando el árbol actual termina sus puntas
		if (
			this.activeTips.length === 0 &&
			(this.isBloomSustained || this.isShockSustained)
		) {
			this.triggerNextAutoBatch(false);
		}
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

		const shockIntensity = this.isShockSustained
			? 1.0
			: this.shockTimer > 0
				? this.shockTimer / this.shockDuration
				: 0;
		if (this.shockTimer > 0) {
			this.shockTimer--;
		}

		if (this.isShockSustained) {
			this.shockTimer = this.shockDuration;
			for (let i = 0; i < this.activeTips.length; i++) {
				const tip = this.activeTips[i];
				if (tip && !tip.isDead && random() < 0.35) {
					const sign = random() < 0.5 ? -1 : 1;
					tip.dir.rotate(sign * random(0.15, 0.42));
				}
			}
		}

		if (this.isBloomSustained) {
			this.bloomSustainCounter++;
			if (this.bloomSustainCounter >= this.bloomSustainInterval) {
				this.bloomSustainCounter = 0;
				this.triggerBloom();
			}
		}

		mainBuffer.push();
		mainBuffer.blendMode(ADD);
		mainBuffer.strokeCap(ROUND);

		const spawnedThisStep = this._spawnBuffer;

		for (let step = 0; step < this.config.stepsPerFrame; step++) {
			spawnedThisStep.length = 0;

			for (let i = this.activeTips.length - 1; i >= 0; i--) {
				const tip = this.activeTips[i];
				tip.update(this.grid, this.config, shockIntensity);

				// Dibujar el segmento nuevo en la capa propia del árbol
				if (tip.treeRecord && tip.treeRecord.graphics) {
					tip.render(tip.treeRecord.graphics, this.config);
				}

				// Si no estamos recomponiendo por enfriamiento/fade-out, estampar directo también en mainBuffer
				if (!needsRecomposite) {
					tip.render(mainBuffer, this.config);
				}

				// Eliminación O(1) mediante Swap-and-Pop (seguro al iterar hacia atrás)
				if (tip.isDead) {
					const lastIdx = this.activeTips.length - 1;
					this.activeTips[i] = this.activeTips[lastIdx];
					this.activeTips.pop();
					continue;
				}

				const isPriorityBranch =
					this.config.forceMainBranching && tip.generation <= 1;
				const effectiveCap = isPriorityBranch
					? this.config.maxActiveTips + 250
					: this.config.maxActiveTips;
				const remainingCapacity =
					effectiveCap - (this.activeTips.length + spawnedThisStep.length);

				if (remainingCapacity > 0) {
					const newChildren = tip.tryBranch(this.grid, this.config);
					for (let c = 0; c < newChildren.length && c < remainingCapacity; c++) {
						spawnedThisStep.push(newChildren[c]);
					}
				}
			}

			for (let s = 0; s < spawnedThisStep.length; s++) {
				this.activeTips.push(spawnedThisStep[s]);
			}

			if (this.activeTips.length === 0) {
				break;
			}
		}

		mainBuffer.pop();

		// Si alguna rama se está enfriando a gris o desvaneciendo, recomponer las capas sobre mainBuffer
		if (needsRecomposite) {
			this.recompositeMainBuffer(mainBuffer);
		}
	}
}

window.GrowthManager = GrowthManager;
