/**
 * CONFIG - Parámetros globales del sistema generativo (Lichtenberg / Mycelium)
 */
const CONFIG = {
	canvasWidth: 800,
	canvasHeight: 600,
	fullScreen: false,
	tvFullScreen: false,
	bgColor: "#050608",
	frameMargin: 36,
	frameStrokeColor: [55, 78, 115, 150],
	gridCellSize: 12,
	saturationThreshold: 8.5,

	// Tolerancia de superposición (0.0 = se esquivan de inmediato; 0.6 = permite apilar y cruzar varias ramas)
	overlapTolerance: 0.6,

	// Dispersión del origen a lo largo de los bordes contiguos a cada esquina (en píxeles)
	originSpread: 140,

	// Secuencia, modo infinito y máximo de ramas visibles simultáneamente
	stepsPerFrame: 5,
	stepLength: 2.2,
	maxVisibleTrees: 12,
	infiniteMode: true,
	autoSequence: true,
	simultaneousMode: false,
	simultaneousRandom: true,
	simultaneousCount: 1,
	maxActiveTips: 1400,

	// Dirección, largo y ramificación de la rama maestra (Generación 0)
	trunkCenterPull: 0.095,
	trunkBaseLength: 680,
	trunkLengthRandomness: 0.65,
	trunkMinLength: 350,
	trunkMaxLength: 1100,
	trunkBranchRate: 0.33, // Hasta 0.65 (65%) desde la UI

	// Control específico de sub-ramas y capilares (Generación 1 o superiores)
	subBranchIntensity: 2.0, // Multiplicador de brillo/visibilidad de sub-ramas (0.2x a 4.0x)
	subBranchRate: 3.0, // Hasta 6.0x desde la UI
	subBranchLength: 2.0, // Hasta 6.0x desde la UI
	subBranchForkChance: 0.5,
	maxGeneration: 6,
	branchProb: [0.08, 0.11, 0.13, 0.145, 0.155, 0.16],
	angleVariance: 0.5,
	noiseScale: 0.018,
	repulsionStrength: 0.24,

	// Depuración visual de la grilla espacial ([G] para alternar)
	showDebugGrid: false,
};

/**
 * Estado encapsulado de la aplicación para evitar variables globales sueltas.
 */
const appState = {
	treeBuffer: null,
	grid: null,
	growthManager: null,
	uiPanel: null,
	tvBridge: null,
	seed: 0,
};

function setup() {
	const initialW = CONFIG.fullScreen ? windowWidth : CONFIG.canvasWidth;
	const initialH = CONFIG.fullScreen ? windowHeight : CONFIG.canvasHeight;
	createCanvas(initialW, initialH);

	const density = Math.min(window.devicePixelRatio || 1, 2);
	pixelDensity(density);
	frameRate(60);

	// Buffer persistente acumulativo (prohibido redibujar segmentos desde cero en cada frame)
	appState.treeBuffer = createGraphics(width, height);
	appState.treeBuffer.pixelDensity(density);

	// Inicializar grilla de ocupación y gestor secuencial
	appState.grid = new SpatialGrid(
		width,
		height,
		CONFIG.gridCellSize,
		CONFIG.frameMargin,
	);
	appState.growthManager = new GrowthManager(appState.grid, CONFIG);

	// Inicializar puente de sincronización con la pantalla TV
	appState.tvBridge = new TVBridge(false);
	appState.tvBridge.onConnectionChange((connected) => {
		if (appState.uiPanel) {
			appState.uiPanel.setTVConnected(connected);
		}
	});
	appState.tvBridge.onTelemetry((tvData) => {
		if (appState.uiPanel) {
			appState.uiPanel.updateTVTelemetry(tvData);
		}
	});
	appState.tvBridge.onAction((action, data) => {
		if (action === "reset") {
			resetSimulation();
		} else if (action === "nextCorner") {
			appState.growthManager.triggerNextCorner();
		} else if (action === "burst") {
			appState.growthManager.triggerSimultaneousBurst(data?.count || 2);
		} else if (action === "bloom") {
			if (data?.isSustained) {
				appState.growthManager.setBloomSustained(data.isHeld);
				if (appState.uiPanel) appState.uiPanel.setPerformativeBtnState(4, data.isHeld);
			} else {
				appState.growthManager.triggerBloom();
			}
		} else if (action === "shock") {
			if (data?.isSustained) {
				appState.growthManager.setShockSustained(data.isHeld);
				if (appState.uiPanel) appState.uiPanel.setPerformativeBtnState(5, data.isHeld);
			} else {
				appState.growthManager.triggerElectricShock();
			}
		} else if (action === "toggleSimultaneous") {
			toggleSimultaneousMode(false);
		}
	});

	// Inicializar interfaz de controles ocultable ([H])
	appState.uiPanel = new UIPanel(CONFIG, {
		onReset: () => {
			resetSimulation();
			if (appState.tvBridge) appState.tvBridge.sendAction("reset");
		},
		onNextCorner: () => {
			appState.growthManager.triggerNextCorner();
			if (appState.tvBridge) appState.tvBridge.sendAction("nextCorner");
		},
		onBurst: (count, btnNum) => triggerBurstAction(count, btnNum),
		onBloom: () => triggerBloomAction(),
		onElectricShock: () => triggerElectricShockAction(),
		onToggleSimultaneous: () => toggleSimultaneousMode(true),
		onSimultaneousEnabled: () => triggerBurstAction(2, 1),
		onSave: () => {
			saveHighResPNG();
			if (appState.tvBridge) appState.tvBridge.sendAction("save");
		},
		onToggleFullScreen: (forceState) => toggleFullScreen(forceState),
		onToggleTV: () => toggleTVWindow(),
		onResizeCanvas: () => {
			if (!CONFIG.fullScreen) {
				applyCanvasDimensions(CONFIG.canvasWidth, CONFIG.canvasHeight);
			}
		},
		onParamChange: (key, val) => {
			if (appState.tvBridge) appState.tvBridge.sendParam(key, val);
			if (key === "canvasWidth" || key === "canvasHeight") {
				if (!CONFIG.fullScreen) {
					applyCanvasDimensions(CONFIG.canvasWidth, CONFIG.canvasHeight);
				}
			}
		},
	});

	// Sincronizar si el usuario sale de pantalla completa nativa con [ESC]
	document.addEventListener("fullscreenchange", () => {
		if (!document.fullscreenElement && CONFIG.fullScreen) {
			CONFIG.fullScreen = false;
			applyCanvasDimensions(CONFIG.canvasWidth, CONFIG.canvasHeight);
			if (appState.uiPanel) {
				appState.uiPanel.syncCheckboxes();
			}
		}
	});

	resetSimulation();
	initMidiIntegration();
}

/**
 * Crea un adaptador desacoplado para que el subsistema MIDI pueda leer/modificar
 * parámetros y disparar acciones performáticas sincronizando UI y salida CRT (TVBridge).
 */
function initMidiIntegration() {
	const midiAdapter = {
		uiPanel: appState.uiPanel,
		getParamValue: (key) => CONFIG[key],
		setParamValue: (key, val) => {
			if (!(key in CONFIG)) return;
			CONFIG[key] = val;

			if (appState.uiPanel) {
				if (typeof val === "boolean") {
					appState.uiPanel.syncCheckboxes();
				} else {
					appState.uiPanel.updateSlider(key, val);
				}
			}

			if (appState.tvBridge) {
				appState.tvBridge.sendParam(key, val);
			}

			if (
				(key === "canvasWidth" || key === "canvasHeight") &&
				!CONFIG.fullScreen
			) {
				applyCanvasDimensions(CONFIG.canvasWidth, CONFIG.canvasHeight);
			}
		},
		triggerAction: (actionKey, meta) => {
			switch (actionKey) {
				case "reset":
					resetSimulation();
					if (appState.tvBridge) appState.tvBridge.sendAction("reset");
					break;
				case "nextCorner":
					appState.growthManager.triggerNextCorner();
					if (appState.tvBridge) appState.tvBridge.sendAction("nextCorner");
					break;
				case "burst2":
					triggerBurstAction(2, 1);
					break;
				case "burst3":
					triggerBurstAction(3, 2);
					break;
				case "burst4":
					triggerBurstAction(4, 3);
					break;
				case "bloom":
					triggerBloomAction(true, meta?.isPressed ?? true);
					break;
				case "shock":
					triggerElectricShockAction(true, meta?.isPressed ?? true);
					break;
				case "toggleSimultaneous":
					toggleSimultaneousMode(true);
					break;
				case "save":
					saveHighResPNG();
					if (appState.tvBridge) appState.tvBridge.sendAction("save");
					break;
			}
		},
	};

	if (window.MidiSystem) {
		window.MidiSystem.connectSketch(midiAdapter);
	} else {
		window.pendingSketchMidiAdapter = midiAdapter;
	}
}

/**
 * Abre o enfoca la ventana pop-up dedicada para la tele de tubo.
 */
function toggleTVWindow() {
	if (!appState.tvBridge) return;
	if (appState.tvBridge.isTVOpen()) {
		if (appState.tvBridge.tvWindow) {
			appState.tvBridge.tvWindow.focus();
		}
	} else {
		appState.tvBridge.openTVWindow("display.html");
	}
}

/**
 * Alterna entre el recuadro fijo (900x900) y el modo de pantalla completa adaptable,
 * conservando siempre el marco interno delimitador.
 */
function toggleFullScreen(forceState) {
	const nextState =
		typeof forceState === "boolean" ? forceState : !CONFIG.fullScreen;
	CONFIG.fullScreen = nextState;

	if (nextState) {
		if (
			!document.fullscreenElement &&
			document.documentElement.requestFullscreen
		) {
			document.documentElement.requestFullscreen().catch(() => {});
		}
		applyCanvasDimensions(windowWidth, windowHeight);
	} else {
		if (document.fullscreenElement && document.exitFullscreen) {
			document.exitFullscreen().catch(() => {});
		}
		applyCanvasDimensions(CONFIG.canvasWidth, CONFIG.canvasHeight);
	}

	if (appState.uiPanel) {
		appState.uiPanel.syncCheckboxes();
	}
}

/**
 * Redimensiona el lienzo, el buffer acumulativo y la grilla espacial,
 * manteniendo el marco interno adaptado a las nuevas dimensiones.
 */
function applyCanvasDimensions(targetW, targetH) {
	const newW = Math.max(300, Math.floor(targetW));
	const newH = Math.max(300, Math.floor(targetH));

	if (
		width === newW &&
		height === newH &&
		appState.treeBuffer &&
		appState.grid
	) {
		return;
	}

	resizeCanvas(newW, newH);
	const density = Math.min(window.devicePixelRatio || 1, 2);

	if (appState.treeBuffer) {
		appState.treeBuffer.remove();
	}
	appState.treeBuffer = createGraphics(width, height);
	appState.treeBuffer.pixelDensity(density);

	appState.grid = new SpatialGrid(
		width,
		height,
		CONFIG.gridCellSize,
		CONFIG.frameMargin,
	);

	if (appState.growthManager) {
		appState.growthManager.handleResize(appState.grid);
	}

	resetSimulation();
}

function windowResized() {
	if (CONFIG.fullScreen) {
		applyCanvasDimensions(windowWidth, windowHeight);
	}
}

/**
 * Reinicia la semilla aleatoria, limpia la grilla de ocupación y el buffer persistente.
 */
function resetSimulation() {
	appState.seed = Math.floor(Math.random() * 900000) + 100000;
	randomSeed(appState.seed);
	noiseSeed(appState.seed);

	appState.grid.clear();

	// Inicializar fondo profundo en el buffer acumulativo
	appState.treeBuffer.blendMode(BLEND);
	appState.treeBuffer.background(CONFIG.bgColor);
	drawInnerFrame(appState.treeBuffer);

	// Iniciar el primer agente maestro desde la esquina inicial
	appState.growthManager.reset();
}

/**
 * Exporta el buffer acumulativo en alta resolución como PNG (asegurando el marco interno).
 */
function saveHighResPNG() {
	drawInnerFrame(appState.treeBuffer);
	saveCanvas(appState.treeBuffer, `lichtenberg_${appState.seed}`, "png");
}

/**
 * Dibuja el marco rectangular interno fino y sutil que delimita el área de colisión.
 */
function drawInnerFrame(target) {
	const { left, top, right, bottom } = appState.grid.bounds;
	const [r, g, b, a] = CONFIG.frameStrokeColor;

	target.push();
	target.blendMode(BLEND);
	target.noFill();
	target.stroke(r, g, b, a);
	target.strokeWeight(1);
	target.rect(left, top, right - left, bottom - top);
	target.pop();
}

function draw() {
	// 1. Avanzar simulación e inyectar únicamente los segmentos nuevos en el buffer persistente
	appState.growthManager.stepAndRender(appState.treeBuffer);

	// 2. Volcar el buffer acumulativo persistente al lienzo en O(1)
	image(appState.treeBuffer, 0, 0);

	// 3. Modo de inspección opcional de la SpatialGrid ([G])
	if (CONFIG.showDebugGrid) {
		if (mouseIsPressed && appState.grid.isInsideBounds(mouseX, mouseY)) {
			appState.grid.addDensity(mouseX, mouseY, 0.8);
		}
		appState.grid.renderDebug(this, CONFIG.saturationThreshold);
		drawDebugRepulsionProbe();
	}

	// 4. Mantener el marco contenedor nítido por encima
	drawInnerFrame(this);

	// 5. Actualizar telemetría en el panel UI
	if (appState.uiPanel) {
		appState.uiPanel.updateTelemetry(
			appState.growthManager.getTelemetryInfo(),
			appState.growthManager.activeTips.length,
			frameRate(),
			appState.seed,
		);
	}
}

/**
 * Sonda visual en modo debug ([G]) para verificar el vector de repulsión del SpatialGrid.
 */
function drawDebugRepulsionProbe() {
	if (!appState.grid.isInsideBounds(mouseX, mouseY)) {
		return;
	}

	const freeOverlap = CONFIG.saturationThreshold * CONFIG.overlapTolerance;
	const repulsion = appState.grid.getRepulsionVector(
		mouseX,
		mouseY,
		3,
		freeOverlap,
	);
	if (repulsion.magSq() <= 0.0001) {
		return;
	}

	push();
	stroke(160, 220, 255, 200);
	strokeWeight(1.5);
	line(mouseX, mouseY, mouseX + repulsion.x * 28, mouseY + repulsion.y * 28);
	pop();
}

/**
 * Acciones performáticas rápidas ([1] a [6]) sincronizadas con UI y salida CRT.
 */
function triggerBurstAction(count, btnNum) {
	appState.growthManager.triggerSimultaneousBurst(count);
	if (appState.uiPanel && btnNum) {
		appState.uiPanel.flashPerformativeBtn(btnNum);
	}
	if (appState.tvBridge) {
		appState.tvBridge.sendAction("burst", { count });
	}
}

function triggerBloomAction(isSustained = false, isHeld = false) {
	if (isSustained) {
		appState.growthManager.setBloomSustained(isHeld);
		if (appState.uiPanel) {
			appState.uiPanel.setPerformativeBtnState(4, isHeld);
		}
		if (appState.tvBridge) {
			appState.tvBridge.sendAction("bloom", { isSustained: true, isHeld });
		}
	} else {
		appState.growthManager.triggerBloom();
		if (appState.uiPanel) {
			appState.uiPanel.flashPerformativeBtn(4);
		}
		if (appState.tvBridge) {
			appState.tvBridge.sendAction("bloom", { isSustained: false });
		}
	}
}

function triggerElectricShockAction(isSustained = false, isHeld = false) {
	if (isSustained) {
		appState.growthManager.setShockSustained(isHeld);
		if (appState.uiPanel) {
			appState.uiPanel.setPerformativeBtnState(5, isHeld);
		}
		if (appState.tvBridge) {
			appState.tvBridge.sendAction("shock", { isSustained: true, isHeld });
		}
	} else {
		appState.growthManager.triggerElectricShock();
		if (appState.uiPanel) {
			appState.uiPanel.flashPerformativeBtn(5, 900);
		}
		if (appState.tvBridge) {
			appState.tvBridge.sendAction("shock", { isSustained: false });
		}
	}
}

function toggleSimultaneousMode(notifyTV = true) {
	CONFIG.simultaneousMode = !CONFIG.simultaneousMode;
	if (appState.uiPanel) {
		appState.uiPanel.syncCheckboxes();
	}
	if (notifyTV && appState.tvBridge) {
		appState.tvBridge.sendParam("simultaneousMode", CONFIG.simultaneousMode);
	}
	// Si se acaba de activar el modo simultáneo, lanzar una ráfaga inmediata para verlo en acción
	if (CONFIG.simultaneousMode) {
		appState.growthManager.triggerSimultaneousBurst(2);
		if (notifyTV && appState.tvBridge) {
			appState.tvBridge.sendAction("burst", { count: 2 });
		}
	}
}

function keyPressed() {
	if (key === "1") {
		triggerBurstAction(2, 1);
	} else if (key === "2") {
		triggerBurstAction(3, 2);
	} else if (key === "3") {
		triggerBurstAction(4, 3);
	} else if (key === "4") {
		triggerBloomAction(true, true);
	} else if (key === "5") {
		triggerElectricShockAction(true, true);
	} else if (key === "6") {
		toggleSimultaneousMode(true);
	} else if (key === "r" || key === "R") {
		resetSimulation();
		if (appState.tvBridge) appState.tvBridge.sendAction("reset");
	} else if (key === "s" || key === "S") {
		saveHighResPNG();
		if (appState.tvBridge) appState.tvBridge.sendAction("save");
	} else if (key === "p" || key === "P") {
		toggleTVWindow();
	} else if (key === "f" || key === "F") {
		toggleFullScreen();
	} else if (key === "g" || key === "G") {
		CONFIG.showDebugGrid = !CONFIG.showDebugGrid;
		if (appState.tvBridge) {
			appState.tvBridge.sendParam("showDebugGrid", CONFIG.showDebugGrid);
		}
		if (appState.uiPanel) {
			appState.uiPanel.syncCheckboxes();
		}
	} else if (key === "h" || key === "H") {
		if (appState.uiPanel) {
			appState.uiPanel.toggle();
		}
	} else if (key === " ") {
		appState.growthManager.triggerNextCorner();
		if (appState.tvBridge) appState.tvBridge.sendAction("nextCorner");
		return false;
	}
}

function keyReleased() {
	if (key === "4") {
		triggerBloomAction(true, false);
	} else if (key === "5") {
		triggerElectricShockAction(true, false);
	}
}

window.CONFIG = CONFIG;
window.appState = appState;
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
window.keyReleased = keyReleased;
window.windowResized = windowResized;
