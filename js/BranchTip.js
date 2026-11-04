/**
 * Constantes compartidas de módulo para evitar alocaciones en el hot-loop.
 */
const EMPTY_CHILDREN = Object.freeze([]);
const REPULSION_SCRATCH = { x: 0, y: 0 };
const COS_PROBE = Math.cos(0.85);
const SIN_PROBE = Math.sin(0.85);

/**
 * Traza un segmento directamente sobre el CanvasRenderingContext2D nativo
 * para evitar la creación de miles de instancias de p5.Color por frame.
 */
function strokeSegmentFast(ctx, x1, y1, x2, y2, r, g, b, alpha255, weight) {
	if (alpha255 <= 0.1) return;
	ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha255 / 255})`;
	ctx.lineWidth = weight;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

/**
 * BranchTip - Agente de crecimiento individual (punta activa).
 * Implementa movimiento quebrado estilo Lichtenberg, escudo de despegue desde esquinas,
 * cascada fractal de sub-ramas parametrizable para Gen 0 y Gen 1+,
 * tolerancia de superposición/apilamiento y renderizado multipasada aditivo.
 */
class BranchTip {
	constructor(pos, dir, generation = 0, energy = 1.0, options = {}) {
		this.pos = pos.copy();
		this.prevPos = pos.copy();
		this.dir = dir.copy().normalize();
		this.initialDir =
			options.initialDir !== undefined
				? options.initialDir.copy().normalize()
				: this.dir.copy();
		this.generation = generation;
		this.energy = energy;

		this.noiseOffset =
			options.noiseOffset !== undefined
				? options.noiseOffset
				: random(0, 10000);

		const subLengthMult = options.subBranchLength ?? 1.0;
		this.energyDecay =
			options.energyDecay !== undefined
				? options.energyDecay
				: this.computeEnergyDecay(subLengthMult);

		this.hasPassedCenter = options.hasPassedCenter ?? false;
		this.treeRecord = options.treeRecord ?? null;
		this.ageSteps = 0;
		this.stepsSinceBranch = 0;
		this.lastBranchSide = random() < 0.5 ? -1 : 1;
		this.thickness = this.computeThickness();
		this.isDead = false;
	}

	/**
	 * Define la tasa de pérdida de energía según la generación y el multiplicador
	 * de largo de sub-ramas (subBranchLength, soportando hasta 6.0x).
	 */
	computeEnergyDecay(subLengthMult = 1.0) {
		if (this.generation === 0) {
			return 0.0032;
		}

		const lengthScale = Math.max(0.15, subLengthMult);
		if (this.generation === 1) {
			return 0.004 / lengthScale;
		}
		if (this.generation === 2) {
			return 0.0068 / lengthScale;
		}
		if (this.generation === 3) {
			return 0.011 / lengthScale;
		}
		return (0.017 * Math.pow(1.28, this.generation - 4)) / lengthScale;
	}

	/**
	 * Calcula el grosor con caída exponencial por generación y energía.
	 */
	computeThickness() {
		const clampedEnergy = Math.max(0, this.energy);

		if (this.generation > 3) {
			return 0.3 + 0.5 * Math.pow(clampedEnergy, 0.7);
		}

		const genDecay = Math.pow(0.57, this.generation);
		const energyCurve = Math.pow(clampedEnergy, 0.65);
		return Math.max(0.35, 3.5 * genDecay * energyCurve);
	}

	/**
	 * Avanza la punta un paso aplicando física de descarga dieléctrica,
	 * escudo de despegue en esquinas, permiso de superposición y sacudida eléctrica opcional.
	 */
	update(grid, config, shockIntensity = 0) {
		if (this.isDead) {
			return;
		}

		this.prevPos.set(this.pos);
		this.ageSteps++;
		this.stepsSinceBranch++;

		const effectiveVariance =
			config.angleVariance * (1.0 + shockIntensity * 2.5);

		// 1. Deriva orgánica continua mediante Perlin noise de alta frecuencia
		const n = noise(
			this.pos.x * config.noiseScale,
			this.pos.y * config.noiseScale,
			this.noiseOffset,
		);
		this.noiseOffset += 0.048 + shockIntensity * 0.14;
		const smoothDrift = (n - 0.5) * 2.0 * effectiveVariance * 0.24;

		// 2. Sacudida dieléctrica (jitter continuo + quiebres angulares súbitos estilo Lichtenberg)
		const genJitterScale = 1.0 + Math.min(this.generation, 5) * 0.14;
		let kinkAngle = random(-0.08, 0.08) * effectiveVariance * genJitterScale;

		const kinkChance = 0.22 + shockIntensity * 0.45;
		if (random() < kinkChance) {
			const sign = random() < 0.5 ? -1 : 1;
			const kinkMin = 0.16 + shockIntensity * 0.18;
			const kinkMax = 0.48 + shockIntensity * 0.35;
			kinkAngle +=
				sign * random(kinkMin, kinkMax) * effectiveVariance * genJitterScale;
		}

		this.dir.rotate(smoothDrift + kinkAngle);

		// 3. Tendencia hacia el centro para las líneas principales (gen 0) sin alocar p5.Vector
		if (
			this.generation === 0 &&
			!this.hasPassedCenter &&
			config.trunkCenterPull > 0
		) {
			const dxCenter = grid.width * 0.5 - this.pos.x;
			const dyCenter = grid.height * 0.5 - this.pos.y;
			const distSqCenter = dxCenter * dxCenter + dyCenter * dyCenter;
			const dotInitial =
				dxCenter * this.initialDir.x + dyCenter * this.initialDir.y;

			if (distSqCenter < 2025 || dotInitial <= 0) {
				this.hasPassedCenter = true;
			} else {
				const distToCenter = Math.sqrt(distSqCenter);
				const launchBoost = this.ageSteps < 25 ? 1.65 : 1.0;
				const proximityFade = constrain(distToCenter / 140, 0.3, 1.0);
				const pullScale =
					(config.trunkCenterPull * proximityFade * launchBoost) / distToCenter;
				this.dir.x += dxCenter * pullScale;
				this.dir.y += dyCenter * pullScale;
			}
		}

		// 4. Evasión suave solo cuando se supera el colchón de superposición libre
		const freeOverlapDensity =
			config.saturationThreshold * config.overlapTolerance;
		const isInLaunchShield = this.generation === 0 && this.ageSteps < 24;
		const baseGrace = config.spawnGraceSteps ?? 22;
		const graceLimit =
			this.generation === 1
				? baseGrace
				: this.generation === 2
					? Math.round(baseGrace * 0.75)
					: Math.max(6, Math.round(baseGrace * 0.45));
		const isInSpawnGrace = this.generation >= 1 && this.ageSteps <= graceLimit;

		if (!isInLaunchShield && !isInSpawnGrace) {
			const repulsionRadius = this.generation <= 1 ? 3 : 2;
			const repulsion = grid.getRepulsionVector(
				this.pos.x,
				this.pos.y,
				repulsionRadius,
				freeOverlapDensity,
				REPULSION_SCRATCH,
			);

			const repMagSq = repulsion.x * repulsion.x + repulsion.y * repulsion.y;
			if (repMagSq > 0.0001) {
				const inertiaFactor =
					this.generation === 0
						? 0.35
						: this.generation === 1
							? 0.65
							: 1.0 + Math.min(this.generation, 4) * 0.15;

				const repScale = config.repulsionStrength * inertiaFactor;
				this.dir.x += repulsion.x * repScale;
				this.dir.y += repulsion.y * repScale;
			}
		}

		this.dir.normalize();

		// 5. Cono de seguridad frontal: impide que un tronco principal gire hacia su propia esquina
		if (this.generation === 0 && !this.hasPassedCenter) {
			const forwardDot =
				this.dir.x * this.initialDir.x + this.dir.y * this.initialDir.y;
			if (forwardDot < 0.38) {
				this.dir.lerp(this.initialDir, 0.45).normalize();
			}
		}

		// 6. Avanzar posición escalarmente (cero alocación de vectores)
		const step = config.stepLength * (this.generation > 2 ? 0.85 : 1.0);
		this.pos.x += this.dir.x * step;
		this.pos.y += this.dir.y * step;

		// 7. Verificar límites del marco contenedor
		if (!grid.isInsideBounds(this.pos.x, this.pos.y)) {
			this.pos.x = constrain(this.pos.x, grid.bounds.left, grid.bounds.right);
			this.pos.y = constrain(this.pos.y, grid.bounds.top, grid.bounds.bottom);
			this.isDead = true;
			return;
		}

		// 8. Control de superposición y saturación (respetando el período de gracia al nacer)
		const localDensity = grid.getDensity(this.pos.x, this.pos.y);
		const satLimit = config.saturationThreshold;

		if (!isInSpawnGrace) {
			if (this.generation >= 3 && localDensity > freeOverlapDensity) {
				const excess =
					(localDensity - freeOverlapDensity) /
					Math.max(1.0, satLimit - freeOverlapDensity);
				this.energy -=
					this.energyDecay *
					(1.8 + this.generation * 0.9) *
					Math.max(0.2, excess);

				if (localDensity >= satLimit * 1.35) {
					this.isDead = true;
					return;
				}
			} else if (
				this.generation === 2 &&
				!config.forceMainBranching &&
				localDensity > satLimit * 1.2
			) {
				this.energy -= this.energyDecay * 1.8;
			}
		}

		// 9. Registrar densidad en la grilla espacial global y en el registro del árbol actual
		const depositWeight = Math.max(0.14, Math.pow(0.68, this.generation));
		grid.addDensity(
			this.pos.x,
			this.pos.y,
			depositWeight,
			this.treeRecord ? this.treeRecord.gridContribution : null,
		);

		// 10. Decaimiento normal de energía y actualización de grosor
		this.energy -= this.energyDecay;
		this.thickness = this.computeThickness();

		if (this.energy <= 0.015) {
			this.isDead = true;
		}
	}

	/**
	 * Evalúa si la punta se bifurca (o trifurca en generaciones medias/altas)
	 * soportando valores extendidos de trunkBranchRate (hasta 65%) y subBranchRate (hasta 6.0x).
	 */
	tryBranch(grid, config) {
		if (this.isDead || this.generation >= config.maxGeneration) {
			return EMPTY_CHILDREN;
		}

		if (this.generation >= 1 && config.subBranchRate <= 0.001) {
			return EMPTY_CHILDREN;
		}

		if (this.generation === 0 && this.ageSteps < 10) {
			return EMPTY_CHILDREN;
		}

		// Enfriamiento dinámico entre bifurcaciones: se reduce hasta 1 paso al subir los sliders
		let minInterval;
		if (this.generation === 0) {
			const rateScale = Math.max(0.25, config.trunkBranchRate / 0.08);
			minInterval = Math.max(1, Math.round(5 / Math.sqrt(rateScale)));
		} else {
			const baseInt = this.generation === 1 ? 4 : 3;
			minInterval = Math.max(
				1,
				Math.round(baseInt / Math.sqrt(Math.max(0.25, config.subBranchRate))),
			);
		}

		if (this.stepsSinceBranch < minInterval || this.energy < 0.06) {
			return EMPTY_CHILDREN;
		}

		const localDensity = grid.getDensity(this.pos.x, this.pos.y);
		const forceMain = Boolean(config.forceMainBranching);
		const isExemptMain = forceMain && this.generation <= 1;
		const densityLimitMult = forceMain && this.generation === 2 ? 1.85 : 1.0;
		const maxBranchDensity =
			config.saturationThreshold *
			(0.85 + config.overlapTolerance * 0.55) *
			densityLimitMult;

		if (!isExemptMain && localDensity > maxBranchDensity) {
			return EMPTY_CHILDREN;
		}

		// Probabilidad diferenciada: trunkBranchRate para gen 0, branchProb * subBranchRate para gen 1+
		let prob;
		if (this.generation === 0) {
			prob = config.trunkBranchRate;
		} else {
			const probIndex = Math.min(this.generation, config.branchProb.length - 1);
			prob = config.branchProb[probIndex] * config.subBranchRate;
		}

		const freeOverlap = config.saturationThreshold * config.overlapTolerance;
		if (localDensity > freeOverlap) {
			const crowding =
				(localDensity - freeOverlap) /
				Math.max(1.0, maxBranchDensity - freeOverlap);
			prob *=
				forceMain && this.generation === 0
					? 1.0
					: forceMain && this.generation === 1
						? constrain(1.0 - crowding * 0.25, 0.75, 1.0)
						: constrain(1.0 - crowding * 0.7, 0.25, 1.0);
		}

		if (random() >= prob) {
			return EMPTY_CHILDREN;
		}

		this.stepsSinceBranch = 0;
		const children = [];

		const primarySide = this.chooseBranchSide(grid);
		this.lastBranchSide = primarySide;

		children.push(this.createChildTip(primarySide, config));

		// Probabilidad configurable (subBranchForkChance) de abrir dos sub-ramas a la vez
		if (this.generation >= 1 && random() < config.subBranchForkChance) {
			children.push(this.createChildTip(-primarySide, config, true));
		}

		const motherRecoil =
			this.generation === 0 ? random(0.03, 0.09) : random(0.06, 0.15);
		this.dir.rotate(-primarySide * motherRecoil);

		if (this.generation === 0) {
			this.energy *= 0.99;
		} else if (this.generation === 1) {
			this.energy *= random(0.9, 0.96);
		} else {
			this.energy *= random(0.86, 0.93);
		}

		this.thickness = this.computeThickness();
		return children;
	}

	/**
	 * Fuerza una floración capilar instantánea (Bloom [4]): abre un abanico
	 * de sub-ramas a ambos lados de la punta activa con energía reforzada.
	 */
	forceBloom(grid, config) {
		if (this.isDead) {
			return EMPTY_CHILDREN;
		}

		this.stepsSinceBranch = 0;
		this.energy = Math.min(1.0, Math.max(this.energy, 0.55));
		this.thickness = this.computeThickness();

		const primarySide = this.chooseBranchSide(grid);
		this.lastBranchSide = primarySide;

		const childA = this.createChildTip(primarySide, config, false);
		const childB = this.createChildTip(-primarySide, config, true);
		childA.energy = Math.min(1.0, Math.max(childA.energy, 0.65));
		childB.energy = Math.min(1.0, Math.max(childB.energy, 0.58));
		childA.thickness = childA.computeThickness();
		childB.thickness = childB.computeThickness();

		const children = [childA, childB];

		// En troncos y ramas primarias, agrega un tercer filamento intermedio para efecto arbusto
		if (this.generation <= 2) {
			const midSide = random() < 0.5 ? -1 : 1;
			const childC = this.createChildTip(midSide * 0.55, config, true);
			childC.energy = Math.min(1.0, Math.max(childC.energy, 0.52));
			childC.thickness = childC.computeThickness();
			children.push(childC);
		}

		this.dir.rotate(random(-0.18, 0.18));
		return children;
	}

	/**
	 * Construye una rama hija lateral con ángulo abierto y energía suficiente
	 * para sostener su propia cascada de sub-ramas.
	 */
	createChildTip(sideSign, config, isSecondaryFork = false) {
		let childGen = this.generation + 1;
		if (
			this.generation === 0 &&
			config.maxGeneration >= 2 &&
			random() < (config.forceMainBranching ? 0.08 : 0.22)
		) {
			childGen = 2;
		}
		childGen = Math.min(childGen, config.maxGeneration);

		const baseOpenAngle =
			random(0.38, 0.96) * (0.75 + config.angleVariance * 0.5);
		const childDir = this.dir.copy().rotate(sideSign * baseOpenAngle);

		let childEnergy;
		if (this.generation === 0) {
			childEnergy =
				childGen === 1
					? this.energy * random(0.75, 0.94)
					: this.energy * random(0.48, 0.72);
		} else if (this.generation === 1) {
			childEnergy = this.energy * random(0.68, 0.88);
		} else {
			childEnergy = this.energy * random(0.58, 0.84);
		}

		if (isSecondaryFork) {
			childEnergy *= 0.84;
		}

		return new BranchTip(this.pos, childDir, childGen, childEnergy, {
			noiseOffset: this.noiseOffset + random(20, 120),
			initialDir: this.initialDir,
			hasPassedCenter: this.hasPassedCenter,
			subBranchLength: config.subBranchLength,
			treeRecord: this.treeRecord,
		});
	}

	/**
	 * Sondea a izquierda y derecha del vector de avance para abrir la bifurcación
	 * preferentemente hacia el lado más despejado (sin instanciar vectores temporales).
	 */
	chooseBranchSide(grid) {
		const probeDist = grid.cellSize * 2.2;
		const dx = this.dir.x;
		const dy = this.dir.y;

		// Rotación por -0.85 rad (izquierda) y +0.85 rad (derecha)
		const leftX = (dx * COS_PROBE + dy * SIN_PROBE) * probeDist;
		const leftY = (dy * COS_PROBE - dx * SIN_PROBE) * probeDist;
		const rightX = (dx * COS_PROBE - dy * SIN_PROBE) * probeDist;
		const rightY = (dy * COS_PROBE + dx * SIN_PROBE) * probeDist;

		const dLeft = grid.getDensity(this.pos.x + leftX, this.pos.y + leftY);
		const dRight = grid.getDensity(this.pos.x + rightX, this.pos.y + rightY);

		if (Math.abs(dLeft - dRight) > 0.35) {
			return dLeft < dRight ? -1 : 1;
		}

		return random() < 0.72 ? -this.lastBranchSide : this.lastBranchSide;
	}

	/**
	 * Renderiza únicamente el segmento nuevo generado en el tick actual sobre el buffer
	 * indicado usando directamente su CanvasRenderingContext2D (asume blendMode(ADD)).
	 */
	render(buffer, config) {
		const x1 = this.prevPos.x;
		const y1 = this.prevPos.y;
		const x2 = this.pos.x;
		const y2 = this.pos.y;
		const ctx = buffer.drawingContext;

		const energyFade = constrain(this.energy, 0.05, 1.0);

		// CASO 0: Tronco principal (Generación 0) -> Halo ancho azulado + núcleo blanco brillante
		if (this.generation === 0) {
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				70,
				135,
				255,
				18 * energyFade,
				this.thickness * 4.2,
			);
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				135,
				190,
				255,
				44 * energyFade,
				this.thickness * 2.0,
			);
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				240,
				248,
				255,
				215 * energyFade,
				Math.max(0.55, this.thickness * 0.85),
			);
			return;
		}

		// Multiplicador de intensidad/brillo para todas las ramas secundarias (Gen 1+)
		const subIntensity = Math.max(0.05, config?.subBranchIntensity ?? 1.0);
		const weightBoost =
			subIntensity <= 1.0
				? lerp(0.75, 1.0, subIntensity)
				: 1.0 + (subIntensity - 1.0) * 0.28;
		const effectiveThickness = this.thickness * weightBoost;

		// CASO 1: Ramas secundarias primarias (Generación 1) -> Halo triple escalado por subBranchIntensity
		if (this.generation === 1) {
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				70,
				135,
				255,
				constrain(11 * energyFade * subIntensity, 0, 150),
				effectiveThickness * 4.2,
			);
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				135,
				190,
				255,
				constrain(26 * energyFade * subIntensity, 0, 200),
				effectiveThickness * 2.0,
			);
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				240,
				248,
				255,
				constrain(165 * energyFade * Math.pow(subIntensity, 0.85), 0, 255),
				Math.max(0.55, effectiveThickness * 0.85),
			);
			return;
		}

		// CASO 2: Sub-ramas intermedias (Generación 2 y 3) -> Halo + vena cian/blanca modulada
		if (this.generation <= 3) {
			if (subIntensity > 1.15) {
				const outerAlpha = constrain(
					(this.generation === 2 ? 8 : 5) * (subIntensity - 1.0) * energyFade,
					0,
					100,
				);
				strokeSegmentFast(
					ctx,
					x1,
					y1,
					x2,
					y2,
					70,
					135,
					255,
					outerAlpha,
					effectiveThickness * 3.6,
				);
			}

			const midHaloAlpha = constrain(
				(this.generation === 2 ? 12 : 8) * subIntensity * energyFade,
				0,
				180,
			);
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				110,
				165,
				255,
				midHaloAlpha,
				effectiveThickness * 2.0,
			);

			const whiteMix = constrain((subIntensity - 1.0) / 2.5, 0, 1);
			const r = lerp(195, 242, whiteMix);
			const g = lerp(222, 249, whiteMix);
			const coreAlpha = constrain(
				(this.generation === 2 ? 115 : 75) * subIntensity * energyFade,
				0,
				255,
			);
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				r,
				g,
				255,
				coreAlpha,
				effectiveThickness,
			);
			return;
		}

		// CASO 3: Capilares finales (Generación > 3) -> Filamentos con brillo y halo opcional en alta intensidad
		if (subIntensity > 1.3) {
			const capHaloAlpha = constrain(
				7 * (subIntensity - 1.2) * energyFade,
				0,
				75,
			);
			strokeSegmentFast(
				ctx,
				x1,
				y1,
				x2,
				y2,
				85,
				145,
				255,
				capHaloAlpha,
				effectiveThickness * 2.3,
			);
		}

		const baseCapAlpha = 15 + 40 * energyFade;
		const capillaryAlpha = constrain(baseCapAlpha * subIntensity, 0, 245);
		const capWhiteMix = constrain((subIntensity - 1.0) / 2.8, 0, 1);
		const capR = lerp(160, 228, capWhiteMix);
		const capG = lerp(195, 244, capWhiteMix);

		strokeSegmentFast(
			ctx,
			x1,
			y1,
			x2,
			y2,
			capR,
			capG,
			255,
			capillaryAlpha,
			effectiveThickness,
		);
	}
}

window.BranchTip = BranchTip;
