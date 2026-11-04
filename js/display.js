/**
 * display.js - Motor de renderizado exclusivo para la Pantalla CRT TV / Proyector.
 * Corre a pantalla completa sin UI, con buffer persistente de alto rendimiento,
 * sincronizado en tiempo real con la Base de Control en la PC mediante TVBridge.
 */

const TV_CONFIG = {
	canvasWidth: 800,
	canvasHeight: 600,
	tvFullScreen: false,
	bgColor: "#050608",
	frameMargin: 36,
	frameStrokeColor: [55, 78, 115, 150],
	gridCellSize: 12,
	saturationThreshold: 8.5,
	overlapTolerance: 0.6,
	originSpread: 140,
	stepsPerFrame: 5,
	stepLength: 2.2,
	maxVisibleTrees: 12,
	infiniteMode: true,
	autoSequence: true,
	simultaneousMode: false,
	simultaneousRandom: true,
	simultaneousCount: 1,
	maxActiveTips: 1400,
	trunkCenterPull: 0.095,
	trunkBaseLength: 680,
	trunkLengthRandomness: 0.65,
	trunkMinLength: 350,
	trunkMaxLength: 1100,
	trunkBranchRate: 0.33,
	subBranchIntensity: 2.0,
	subBranchRate: 3.0,
	subBranchLength: 2.0,
	subBranchForkChance: 0.5,
	maxGeneration: 6,
	branchProb: [0.08, 0.11, 0.13, 0.145, 0.155, 0.16],
	angleVariance: 0.5,
	noiseScale: 0.018,
	repulsionStrength: 0.24,
	showDebugGrid: false,
};

const displayState = {
	bridge: null,
	treeBuffer: null,
	grid: null,
	growthManager: null,
	seed: 0,
	telemetryCounter: 0,
};

function setup() {
	const initialW = TV_CONFIG.tvFullScreen
		? windowWidth
		: TV_CONFIG.canvasWidth || 800;
	const initialH = TV_CONFIG.tvFullScreen
		? windowHeight
		: TV_CONFIG.canvasHeight || 600;
	createCanvas(initialW, initialH);

	const density = Math.min(window.devicePixelRatio || 1, 2);
	pixelDensity(density);
	frameRate(60);

	// Buffer persistente acumulativo
	displayState.treeBuffer = createGraphics(width, height);
	displayState.treeBuffer.pixelDensity(density);

	// Inicializar grilla espacial y gestor de crecimiento
	displayState.grid = new SpatialGrid(
		width,
		height,
		TV_CONFIG.gridCellSize,
		TV_CONFIG.frameMargin,
	);
	displayState.growthManager = new GrowthManager(displayState.grid, TV_CONFIG);

	// Inicializar puente de sincronización con la PC
	displayState.bridge = new TVBridge(true);

	displayState.bridge.onParam((key, value) => {
		TV_CONFIG[key] = value;
		if (
			key === "canvasWidth" ||
			key === "canvasHeight" ||
			key === "tvFullScreen"
		) {
			updateDimensions();
		}
	});

	displayState.bridge.onAction((action, data) => {
		if (action === "reset") {
			resetSimulation();
		} else if (action === "nextCorner") {
			displayState.growthManager.triggerNextCorner();
		} else if (action === "burst") {
			displayState.growthManager.triggerSimultaneousBurst(data?.count || 2);
		} else if (action === "bloom") {
			if (data?.isSustained) {
				displayState.growthManager.setBloomSustained(data.isHeld);
			} else {
				displayState.growthManager.triggerBloom();
			}
		} else if (action === "shock") {
			if (data?.isSustained) {
				displayState.growthManager.setShockSustained(data.isHeld);
			} else {
				displayState.growthManager.triggerElectricShock();
			}
		} else if (action === "save") {
			saveHighResPNG();
		} else if (action === "toggleFullScreen") {
			toggleTVFullScreen();
		} else if (action === "syncAll" && data && data.config) {
			Object.assign(TV_CONFIG, data.config);
			if (data.seed) {
				displayState.seed = data.seed;
			}
			updateDimensions();
		}
	});

	// Solicitar configuración inicial a la PC
	displayState.bridge.requestConfig();

	resetSimulation();

	// Desvanecer pista inicial
	setTimeout(() => {
		const hint = document.getElementById("tv-hint");
		if (hint) hint.classList.add("fade-out");
	}, 3500);

	// Doble click para pantalla completa instantánea
	window.addEventListener("dblclick", () => {
		toggleTVFullScreen();
	});

	// Ocultar cursor tras inactividad
	let cursorTimeout;
	window.addEventListener("mousemove", () => {
		document.body.style.cursor = "default";
		clearTimeout(cursorTimeout);
		cursorTimeout = setTimeout(() => {
			document.body.style.cursor = "none";
		}, 2000);
	});
}

function toggleTVFullScreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().catch(() => {});
	} else if (document.exitFullscreen) {
		document.exitFullscreen().catch(() => {});
	}
}

/**
 * Redimensiona el lienzo CRT, su buffer y grilla de ocupación,
 * preservando siempre el marco interno delimitador.
 */
function applyCanvasDimensions(targetW, targetH) {
	const newW = Math.max(300, Math.floor(targetW));
	const newH = Math.max(240, Math.floor(targetH));

	if (
		width === newW &&
		height === newH &&
		displayState.treeBuffer &&
		displayState.grid
	) {
		return;
	}

	resizeCanvas(newW, newH);
	const density = Math.min(window.devicePixelRatio || 1, 2);

	if (displayState.treeBuffer) {
		displayState.treeBuffer.remove();
	}
	displayState.treeBuffer = createGraphics(width, height);
	displayState.treeBuffer.pixelDensity(density);

	displayState.grid = new SpatialGrid(
		width,
		height,
		TV_CONFIG.gridCellSize,
		TV_CONFIG.frameMargin,
	);

	if (displayState.growthManager) {
		displayState.growthManager.handleResize(displayState.grid);
	}

	resetSimulation();
}

function updateDimensions() {
	const targetW = TV_CONFIG.tvFullScreen
		? windowWidth
		: TV_CONFIG.canvasWidth || 800;
	const targetH = TV_CONFIG.tvFullScreen
		? windowHeight
		: TV_CONFIG.canvasHeight || 600;
	applyCanvasDimensions(targetW, targetH);
}

function windowResized() {
	if (TV_CONFIG.tvFullScreen) {
		updateDimensions();
	}
}

function resetSimulation() {
	displayState.seed = Math.floor(Math.random() * 900000) + 100000;
	randomSeed(displayState.seed);
	noiseSeed(displayState.seed);

	displayState.grid.clear();

	displayState.treeBuffer.blendMode(BLEND);
	displayState.treeBuffer.background(TV_CONFIG.bgColor);
	drawInnerFrame(displayState.treeBuffer);

	displayState.growthManager.reset();
}

function saveHighResPNG() {
	drawInnerFrame(displayState.treeBuffer);
	saveCanvas(
		displayState.treeBuffer,
		`lichtenberg_crt_${displayState.seed}`,
		"png",
	);
}

function drawInnerFrame(target) {
	const { left, top, right, bottom } = displayState.grid.bounds;
	const [r, g, b, a] = TV_CONFIG.frameStrokeColor;

	target.push();
	target.blendMode(BLEND);
	target.noFill();
	target.stroke(r, g, b, a);
	target.strokeWeight(1);
	target.rect(left, top, right - left, bottom - top);
	target.pop();
}

function draw() {
	// 1. Avanzar ramas activas y dibujar en el buffer persistente
	displayState.growthManager.stepAndRender(displayState.treeBuffer);

	// 2. Volcado O(1) a pantalla
	image(displayState.treeBuffer, 0, 0);

	// 3. Marco nítido
	drawInnerFrame(this);

	// 4. Enviar telemetría a la Base de Control (cada 6 frames para máxima eficiencia)
	displayState.telemetryCounter++;
	if (displayState.telemetryCounter % 6 === 0 && displayState.bridge) {
		const info = displayState.growthManager.getTelemetryInfo();
		displayState.bridge.sendTelemetry({
			info,
			activeCount: displayState.growthManager.activeTips.length,
			fps: Math.round(frameRate()),
			seed: displayState.seed,
		});
	}
}

function keyPressed() {
	if (key === "1") {
		displayState.growthManager.triggerSimultaneousBurst(2);
		if (displayState.bridge)
			displayState.bridge.sendAction("burst", { count: 2 });
	} else if (key === "2") {
		displayState.growthManager.triggerSimultaneousBurst(3);
		if (displayState.bridge)
			displayState.bridge.sendAction("burst", { count: 3 });
	} else if (key === "3") {
		displayState.growthManager.triggerSimultaneousBurst(4);
		if (displayState.bridge)
			displayState.bridge.sendAction("burst", { count: 4 });
	} else if (key === "4") {
		displayState.growthManager.setBloomSustained(true);
		if (displayState.bridge) displayState.bridge.sendAction("bloom", { isSustained: true, isHeld: true });
	} else if (key === "5") {
		displayState.growthManager.setShockSustained(true);
		if (displayState.bridge) displayState.bridge.sendAction("shock", { isSustained: true, isHeld: true });
	} else if (key === "6") {
		TV_CONFIG.simultaneousMode = !TV_CONFIG.simultaneousMode;
		if (TV_CONFIG.simultaneousMode) {
			displayState.growthManager.triggerSimultaneousBurst(2);
		}
		if (displayState.bridge) {
			displayState.bridge.sendAction("toggleSimultaneous");
		}
	} else if (key === "f" || key === "F") {
		toggleTVFullScreen();
	} else if (key === "r" || key === "R") {
		resetSimulation();
		if (displayState.bridge) displayState.bridge.sendAction("reset");
	} else if (key === "s" || key === "S") {
		saveHighResPNG();
	} else if (key === " ") {
		displayState.growthManager.triggerNextCorner();
		if (displayState.bridge) displayState.bridge.sendAction("nextCorner");
		return false;
	}
}

function keyReleased() {
	if (key === "4") {
		displayState.growthManager.setBloomSustained(false);
		if (displayState.bridge) displayState.bridge.sendAction("bloom", { isSustained: true, isHeld: false });
	} else if (key === "5") {
		displayState.growthManager.setShockSustained(false);
		if (displayState.bridge) displayState.bridge.sendAction("shock", { isSustained: true, isHeld: false });
	}
}

window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
window.keyReleased = keyReleased;
window.windowResized = windowResized;
