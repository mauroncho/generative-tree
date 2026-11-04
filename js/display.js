/**
 * display.js - Motor de renderizado exclusivo para la Pantalla CRT TV / Proyector.
 * Corre a pantalla completa sin UI, con buffer persistente de alto rendimiento,
 * sincronizado en tiempo real con la Base de Control en la PC mediante TVBridge.
 */

const TV_CONFIG = window.createConfig();

const displayState = {
	bridge: null,
	treeBuffer: null,
	grid: null,
	growthManager: null,
	seed: 0,
	telemetryCounter: 0,
	resizeDebounceTimer: null,
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
		if (key === "tvFullScreen") {
			updateDimensions();
		} else if (key === "canvasWidth" || key === "canvasHeight") {
			scheduleDimensionsUpdate();
		}
	});

	displayState.bridge.onAction((action, data) => {
		dispatchTVAction(action, data, false);
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

function dispatchTVAction(action, data = null, notifyPC = true) {
	switch (action) {
		case "reset":
			resetSimulation(data?.seed);
			if (notifyPC && displayState.bridge) {
				displayState.bridge.sendAction("reset", { seed: displayState.seed });
			}
			break;
		case "nextCorner":
			displayState.growthManager.triggerNextCorner();
			if (notifyPC && displayState.bridge) {
				displayState.bridge.sendAction("nextCorner");
			}
			break;
		case "burst": {
			const count = data?.count || 2;
			displayState.growthManager.triggerSimultaneousBurst(count);
			if (notifyPC && displayState.bridge) {
				displayState.bridge.sendAction("burst", { count });
			}
			break;
		}
		case "burst2":
			dispatchTVAction("burst", { count: 2 }, notifyPC);
			break;
		case "burst3":
			dispatchTVAction("burst", { count: 3 }, notifyPC);
			break;
		case "burst4":
			dispatchTVAction("burst", { count: 4 }, notifyPC);
			break;
		case "bloom":
			if (data?.isSustained) {
				displayState.growthManager.setBloomSustained(data.isHeld);
			} else {
				displayState.growthManager.triggerBloom();
			}
			if (notifyPC && displayState.bridge) {
				displayState.bridge.sendAction("bloom", data);
			}
			break;
		case "shock":
			if (data?.isSustained) {
				displayState.growthManager.setShockSustained(data.isHeld);
			} else {
				displayState.growthManager.triggerElectricShock();
			}
			if (notifyPC && displayState.bridge) {
				displayState.bridge.sendAction("shock", data);
			}
			break;
		case "toggleSimultaneous":
			TV_CONFIG.simultaneousMode = !TV_CONFIG.simultaneousMode;
			if (TV_CONFIG.simultaneousMode) {
				displayState.growthManager.triggerSimultaneousBurst(2);
			}
			if (notifyPC && displayState.bridge) {
				displayState.bridge.sendAction("toggleSimultaneous");
			}
			break;
		case "save":
			saveHighResPNG();
			break;
		case "toggleFullScreen":
			toggleTVFullScreen();
			break;
		case "syncAll":
			if (data && data.config) {
				Object.assign(TV_CONFIG, data.config);
				updateDimensions(data.seed);
			}
			break;
	}
}

function toggleTVFullScreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().catch(() => {});
	} else if (document.exitFullscreen) {
		document.exitFullscreen().catch(() => {});
	}
}

function scheduleDimensionsUpdate() {
	if (displayState.resizeDebounceTimer) {
		clearTimeout(displayState.resizeDebounceTimer);
	}
	displayState.resizeDebounceTimer = setTimeout(() => {
		displayState.resizeDebounceTimer = null;
		updateDimensions();
	}, 90);
}

/**
 * Redimensiona el lienzo CRT, su buffer y grilla de ocupación,
 * preservando siempre el marco interno delimitador.
 */
function applyCanvasDimensions(targetW, targetH, forcedSeed = null) {
	if (displayState.resizeDebounceTimer) {
		clearTimeout(displayState.resizeDebounceTimer);
		displayState.resizeDebounceTimer = null;
	}

	const newW = Math.max(300, Math.floor(targetW));
	const newH = Math.max(240, Math.floor(targetH));

	if (
		width === newW &&
		height === newH &&
		displayState.treeBuffer &&
		displayState.grid
	) {
		if (forcedSeed) {
			resetSimulation(forcedSeed);
		}
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

	resetSimulation(forcedSeed);
}

function updateDimensions(forcedSeed = null) {
	const targetW = TV_CONFIG.tvFullScreen
		? windowWidth
		: TV_CONFIG.canvasWidth || 800;
	const targetH = TV_CONFIG.tvFullScreen
		? windowHeight
		: TV_CONFIG.canvasHeight || 600;
	applyCanvasDimensions(targetW, targetH, forcedSeed);
}

function windowResized() {
	if (TV_CONFIG.tvFullScreen) {
		updateDimensions();
	}
}

function resetSimulation(forcedSeed = null) {
	displayState.seed =
		typeof forcedSeed === "number" && forcedSeed > 0
			? forcedSeed
			: Math.floor(Math.random() * 900000) + 100000;
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
	window.drawInnerFrameShared(
		target,
		displayState.grid.bounds,
		TV_CONFIG.frameStrokeColor,
	);
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
	return window.handleSharedKeyPressed(key, {
		onAction: (act, payload) => dispatchTVAction(act, payload, true),
		onToggleFullScreen: () => toggleTVFullScreen(),
	});
}

function keyReleased() {
	window.handleSharedKeyReleased(key, {
		onAction: (act, payload) => dispatchTVAction(act, payload, true),
	});
}

window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
window.keyReleased = keyReleased;
window.windowResized = windowResized;
