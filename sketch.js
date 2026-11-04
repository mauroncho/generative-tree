/**
 * CONFIG - Instancia global de configuración creada desde el esquema único (js/config.js).
 */
const CONFIG = window.createConfig();

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
	telemetryCounter: 0,
	resizeDebounceTimer: null,
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
		dispatchAction(action, data, false);
	});

	// Inicializar interfaz de controles ocultable ([H])
	appState.uiPanel = new UIPanel(CONFIG, {
		onReset: () => dispatchAction("reset", null, true),
		onNextCorner: () => dispatchAction("nextCorner", null, true),
		onBurst: (count, btnNum) =>
			dispatchAction("burst", { count, btnNum }, true),
		onBloom: () =>
			dispatchAction("bloom", { isSustained: false, isHeld: false }, true),
		onElectricShock: () =>
			dispatchAction("shock", { isSustained: false, isHeld: false }, true),
		onToggleSimultaneous: () =>
			dispatchAction("toggleSimultaneous", null, true),
		onSimultaneousEnabled: () =>
			dispatchAction("burst", { count: 2, btnNum: 1 }, true),
		onSave: () => dispatchAction("save", null, true),
		onToggleFullScreen: (forceState) => toggleFullScreen(forceState),
		onToggleTV: () => toggleTVWindow(),
		onResizeCanvas: () => {
			if (!CONFIG.fullScreen) {
				scheduleCanvasResize(CONFIG.canvasWidth, CONFIG.canvasHeight);
			}
		},
		onParamChange: (key, val) => {
			if (appState.tvBridge) appState.tvBridge.sendParam(key, val);
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
 * Despachador centralizado de acciones performáticas y de sistema para evitar
 * duplicar lógica entre UIPanel, TVBridge, WebMIDI y atajos de teclado.
 */
function dispatchAction(action, data = null, notifyTV = true) {
	switch (action) {
		case "reset": {
			const forcedSeed = data?.seed;
			resetSimulation(forcedSeed);
			if (notifyTV && appState.tvBridge) {
				appState.tvBridge.sendAction("reset", { seed: appState.seed });
			}
			break;
		}
		case "nextCorner":
			appState.growthManager.triggerNextCorner();
			if (notifyTV && appState.tvBridge) {
				appState.tvBridge.sendAction("nextCorner");
			}
			break;
		case "burst": {
			const count = data?.count || 2;
			const btnNum = data?.btnNum ?? (count >= 2 && count <= 4 ? count - 1 : 0);
			triggerBurstAction(count, btnNum, notifyTV);
			break;
		}
		case "burst2":
			triggerBurstAction(2, 1, notifyTV);
			break;
		case "burst3":
			triggerBurstAction(3, 2, notifyTV);
			break;
		case "burst4":
			triggerBurstAction(4, 3, notifyTV);
			break;
		case "bloom":
			triggerBloomAction(
				Boolean(data?.isSustained),
				Boolean(data?.isHeld),
				notifyTV,
			);
			break;
		case "shock":
			triggerElectricShockAction(
				Boolean(data?.isSustained),
				Boolean(data?.isHeld),
				notifyTV,
			);
			break;
		case "toggleSimultaneous":
			toggleSimultaneousMode(notifyTV);
			break;
		case "save":
			saveHighResPNG();
			if (notifyTV && appState.tvBridge) {
				appState.tvBridge.sendAction("save");
			}
			break;
	}
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
				scheduleCanvasResize(CONFIG.canvasWidth, CONFIG.canvasHeight);
			}
		},
		triggerAction: (actionKey, meta) => {
			if (actionKey === "bloom" || actionKey === "shock") {
				dispatchAction(
					actionKey,
					{ isSustained: true, isHeld: meta?.isPressed ?? true },
					true,
				);
			} else {
				dispatchAction(actionKey, meta, true);
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
 * Alterna entre el recuadro fijo y el modo de pantalla completa adaptable,
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
 * Debounce para cambios continuos de resolución desde sliders/MIDI, evitando
 * destruir y recrear buffers de GPU en cada píxel de arrastre.
 */
function scheduleCanvasResize(targetW, targetH) {
	if (appState.resizeDebounceTimer) {
		clearTimeout(appState.resizeDebounceTimer);
	}
	appState.resizeDebounceTimer = setTimeout(() => {
		appState.resizeDebounceTimer = null;
		applyCanvasDimensions(targetW, targetH);
	}, 90);
}

/**
 * Redimensiona el lienzo, el buffer acumulativo y la grilla espacial,
 * manteniendo el marco interno adaptado a las nuevas dimensiones.
 */
function applyCanvasDimensions(targetW, targetH) {
	if (appState.resizeDebounceTimer) {
		clearTimeout(appState.resizeDebounceTimer);
		appState.resizeDebounceTimer = null;
	}

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
	if (appState.tvBridge) {
		appState.tvBridge.sendAction("reset", { seed: appState.seed });
	}
}

function windowResized() {
	if (CONFIG.fullScreen) {
		applyCanvasDimensions(windowWidth, windowHeight);
	}
}

/**
 * Reinicia la semilla aleatoria, limpia la grilla de ocupación y el buffer persistente.
 */
function resetSimulation(forcedSeed = null) {
	appState.seed =
		typeof forcedSeed === "number" && forcedSeed > 0
			? forcedSeed
			: Math.floor(Math.random() * 900000) + 100000;
	randomSeed(appState.seed);
	noiseSeed(appState.seed);

	appState.grid.clear();

	// Inicializar fondo profundo en el buffer acumulativo
	appState.treeBuffer.blendMode(BLEND);
	appState.treeBuffer.background(CONFIG.bgColor);
	drawInnerFrame(appState.treeBuffer);

	// Iniciar el primer agente maestro desde la esquina inicial
	appState.growthManager.reset();
	updateLocalTelemetry();
}

/**
 * Exporta el buffer acumulativo en alta resolución como PNG (asegurando el marco interno).
 */
function saveHighResPNG() {
	drawInnerFrame(appState.treeBuffer);
	saveCanvas(appState.treeBuffer, `lichtenberg_${appState.seed}`, "png");
}

function drawInnerFrame(target) {
	window.drawInnerFrameShared(
		target,
		appState.grid.bounds,
		CONFIG.frameStrokeColor,
	);
}

function updateLocalTelemetry() {
	if (!appState.uiPanel) return;
	appState.uiPanel.updateTelemetry(
		appState.growthManager.getTelemetryInfo(),
		appState.growthManager.activeTips.length,
		frameRate(),
		appState.seed,
	);
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

	// 5. Actualizar telemetría en el panel UI con throttle (cada 6 frames)
	appState.telemetryCounter++;
	if (appState.telemetryCounter % 6 === 0) {
		updateLocalTelemetry();
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
function triggerBurstAction(count, btnNum, notifyTV = true) {
	appState.growthManager.triggerSimultaneousBurst(count);
	if (appState.uiPanel && btnNum) {
		appState.uiPanel.flashPerformativeBtn(btnNum);
	}
	if (notifyTV && appState.tvBridge) {
		appState.tvBridge.sendAction("burst", { count });
	}
}

function triggerBloomAction(
	isSustained = false,
	isHeld = false,
	notifyTV = true,
) {
	if (isSustained) {
		appState.growthManager.setBloomSustained(isHeld);
		if (appState.uiPanel) {
			appState.uiPanel.setPerformativeBtnState(4, isHeld);
		}
		if (notifyTV && appState.tvBridge) {
			appState.tvBridge.sendAction("bloom", { isSustained: true, isHeld });
		}
	} else {
		appState.growthManager.triggerBloom();
		if (appState.uiPanel) {
			appState.uiPanel.flashPerformativeBtn(4);
		}
		if (notifyTV && appState.tvBridge) {
			appState.tvBridge.sendAction("bloom", { isSustained: false });
		}
	}
}

function triggerElectricShockAction(
	isSustained = false,
	isHeld = false,
	notifyTV = true,
) {
	if (isSustained) {
		appState.growthManager.setShockSustained(isHeld);
		if (appState.uiPanel) {
			appState.uiPanel.setPerformativeBtnState(5, isHeld);
		}
		if (notifyTV && appState.tvBridge) {
			appState.tvBridge.sendAction("shock", { isSustained: true, isHeld });
		}
	} else {
		appState.growthManager.triggerElectricShock();
		if (appState.uiPanel) {
			appState.uiPanel.flashPerformativeBtn(5, 900);
		}
		if (notifyTV && appState.tvBridge) {
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
	if (CONFIG.simultaneousMode) {
		appState.growthManager.triggerSimultaneousBurst(2);
		if (notifyTV && appState.tvBridge) {
			appState.tvBridge.sendAction("burst", { count: 2 });
		}
	}
}

function keyPressed() {
	return window.handleSharedKeyPressed(key, {
		onAction: (act, payload) => dispatchAction(act, payload, true),
		onToggleFullScreen: () => toggleFullScreen(),
		onToggleTV: () => toggleTVWindow(),
		onToggleDebugGrid: () => {
			CONFIG.showDebugGrid = !CONFIG.showDebugGrid;
			if (appState.tvBridge) {
				appState.tvBridge.sendParam("showDebugGrid", CONFIG.showDebugGrid);
			}
			if (appState.uiPanel) {
				appState.uiPanel.syncCheckboxes();
			}
		},
		onToggleUI: () => {
			if (appState.uiPanel) {
				appState.uiPanel.toggle();
			}
		},
	});
}

function keyReleased() {
	window.handleSharedKeyReleased(key, {
		onAction: (act, payload) => dispatchAction(act, payload, true),
	});
}

window.CONFIG = CONFIG;
window.appState = appState;
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
window.keyReleased = keyReleased;
window.windowResized = windowResized;
