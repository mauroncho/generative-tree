/**
 * js/config.js - Fuente única de verdad para la configuración por defecto,
 * metadatos de parámetros (rangos, pasos, etiquetas y secciones de UI),
 * presets de resolución y utilidades de la ventana principal.
 */

const UI_SECTIONS = {
	dimensions: "0. Dimensiones Canvas",
	trunk: "1. Rama Principal (Gen 0)",
	subBranches: "2. Sub-Ramas (Gen 1 o Sup.)",
	space: "3. Superposición y Secuencia",
};

const CANVAS_PRESETS = [
	{ label: "640x480 (4:3)", w: 640, h: 480 },
	{ label: "800x600 (4:3)", w: 800, h: 600 },
	{ label: "1024x768 (4:3)", w: 1024, h: 768 },
	{ label: "900x900 (1:1)", w: 900, h: 900 },
];

/**
 * Esquema declarativo unificado de todos los parámetros ajustables.
 */
const PARAM_SCHEMA = {
	// --- SECCIÓN 0: Dimensiones del Canvas ---
	canvasWidth: {
		kind: "param",
		section: "dimensions",
		label: "Ancho Canvas",
		min: 320,
		max: 1920,
		step: 10,
		defaultValue: 800,
		format: (v) => `${Math.round(v)} px`,
	},
	canvasHeight: {
		kind: "param",
		section: "dimensions",
		label: "Alto Canvas",
		min: 240,
		max: 1440,
		step: 10,
		defaultValue: 600,
		format: (v) => `${Math.round(v)} px`,
	},

	// --- SECCIÓN 1: Rama Principal (Gen 0) ---
	originSpread: {
		kind: "param",
		section: "trunk",
		label: "Dispersión en Bordes",
		min: 0,
		max: 280,
		step: 5,
		defaultValue: 140,
		format: (v) => `${Math.round(v)} px`,
	},
	trunkCenterPull: {
		kind: "param",
		section: "trunk",
		label: "Tendencia al Centro",
		min: 0.0,
		max: 0.25,
		step: 0.005,
		defaultValue: 0.095,
		format: (v) => v.toFixed(3),
	},
	trunkBaseLength: {
		kind: "param",
		section: "trunk",
		label: "Largo Base (0% rand)",
		min: 200,
		max: 1200,
		step: 10,
		defaultValue: 680,
		format: (v) => `${Math.round(v)} px`,
	},
	trunkLengthRandomness: {
		kind: "param",
		section: "trunk",
		label: "Aleatoriedad de Largo",
		min: 0.0,
		max: 1.0,
		step: 0.01,
		defaultValue: 0.65,
		format: (v) => `${Math.round(v * 100)}%`,
	},
	trunkMinLength: {
		kind: "param",
		section: "trunk",
		label: "Largo Mínimo",
		min: 150,
		max: 900,
		step: 10,
		defaultValue: 350,
		format: (v) => `${Math.round(v)} px`,
	},
	trunkMaxLength: {
		kind: "param",
		section: "trunk",
		label: "Largo Máximo",
		min: 400,
		max: 1500,
		step: 10,
		defaultValue: 1100,
		format: (v) => `${Math.round(v)} px`,
	},
	trunkBranchRate: {
		kind: "param",
		section: "trunk",
		label: "Emisión de Brazos (Gen 0->1)",
		min: 0.0,
		max: 0.65,
		step: 0.005,
		defaultValue: 0.33,
		format: (v) => `${Math.round(v * 100)}%`,
	},

	// --- SECCIÓN 2: Sub-Ramas y Capilares (Gen 1+) ---
	subBranchIntensity: {
		kind: "param",
		section: "subBranches",
		label: "Brillo / Intensidad",
		min: 0.2,
		max: 4.0,
		step: 0.05,
		defaultValue: 2.0,
		format: (v) => `${v.toFixed(2)}x`,
	},
	subBranchRate: {
		kind: "param",
		section: "subBranches",
		label: "Cantidad Ramificaciones (Gen 1+)",
		min: 0.0,
		max: 6.0,
		step: 0.05,
		defaultValue: 3.0,
		format: (v) => `${v.toFixed(2)}x`,
	},
	subBranchLength: {
		kind: "param",
		section: "subBranches",
		label: "Largo de Sub-Ramas",
		min: 0.25,
		max: 6.0,
		step: 0.05,
		defaultValue: 2.0,
		format: (v) => `${v.toFixed(2)}x`,
	},
	subBranchForkChance: {
		kind: "param",
		section: "subBranches",
		label: "Bifurcación Doble (Penachos)",
		min: 0.0,
		max: 0.85,
		step: 0.02,
		defaultValue: 0.5,
		format: (v) => `${Math.round(v * 100)}%`,
	},
	maxGeneration: {
		kind: "param",
		section: "subBranches",
		label: "Profundidad Máx (Generaciones)",
		min: 1,
		max: 8,
		step: 1,
		defaultValue: 6,
		format: (v) => `Gen ${Math.round(v)}`,
	},
	angleVariance: {
		kind: "param",
		section: "subBranches",
		label: "Apertura y Quiebre Eléctrico",
		min: 0.15,
		max: 1.15,
		step: 0.02,
		defaultValue: 0.5,
		format: (v) => v.toFixed(2),
	},

	// --- SECCIÓN 3: Espacio, Superposición y Secuencia ---
	maxVisibleTrees: {
		kind: "param",
		section: "space",
		label: "Máx. Ramas Visibles",
		min: 1,
		max: 24,
		step: 1,
		defaultValue: 12,
		format: (v) => `${Math.round(v)} ramas`,
	},
	overlapTolerance: {
		kind: "param",
		section: "space",
		label: "Permiso de Superposición",
		min: 0.0,
		max: 1.0,
		step: 0.02,
		defaultValue: 0.6,
		format: (v) => `${Math.round(v * 100)}%`,
	},
	spawnGraceSteps: {
		kind: "param",
		section: "space",
		label: "Escudo Nacimiento (Gen 1+)",
		min: 4,
		max: 48,
		step: 2,
		defaultValue: 22,
		format: (v) => `${Math.round(v)} pasos`,
	},
	matureDesaturation: {
		kind: "param",
		section: "space",
		label: "Gris al Terminar (Desaturar)",
		min: 0.0,
		max: 1.0,
		step: 0.05,
		defaultValue: 0.75,
		format: (v) => `${Math.round(v * 100)}%`,
	},
	matureBrightness: {
		kind: "param",
		section: "space",
		label: "Brillo Ramas Finalizadas",
		min: 0.25,
		max: 1.0,
		step: 0.05,
		defaultValue: 0.75,
		format: (v) => `${Math.round(v * 100)}%`,
	},
	matureGridRelief: {
		kind: "param",
		section: "space",
		label: "Alivio Heat Map al Enfriar",
		min: 0.0,
		max: 0.95,
		step: 0.05,
		defaultValue: 0.7,
		format: (v) => `-${Math.round(v * 100)}%`,
	},
	repulsionStrength: {
		kind: "param",
		section: "space",
		label: "Fuerza de Repulsión",
		min: 0.0,
		max: 0.75,
		step: 0.02,
		defaultValue: 0.24,
		format: (v) => v.toFixed(2),
	},
	saturationThreshold: {
		kind: "param",
		section: "space",
		label: "Umbral de Saturación",
		min: 3.0,
		max: 18.0,
		step: 0.5,
		defaultValue: 8.5,
		format: (v) => v.toFixed(1),
	},
	stepsPerFrame: {
		kind: "param",
		section: "space",
		label: "Velocidad (Pasos / Frame)",
		min: 1,
		max: 18,
		step: 1,
		defaultValue: 5,
		format: (v) => `${Math.round(v)}`,
	},
	simultaneousCount: {
		kind: "param",
		section: "space",
		label: "Ramas Simultáneas (Fijo)",
		min: 1,
		max: 4,
		step: 1,
		defaultValue: 1,
		format: (v) => `${Math.round(v)} ramas`,
	},

	// --- Checkboxes / Estados Booleanos ---
	forceMainBranching: {
		kind: "boolean",
		section: "space",
		label: "Garantizar Ramas Hijas (Gen 0-1)",
		defaultValue: true,
	},
	simultaneousMode: {
		kind: "boolean",
		section: "space",
		label: "Modo Simultáneo Auto (2-4) [6]",
		defaultValue: false,
	},
	simultaneousRandom: {
		kind: "boolean",
		section: "space",
		label: "Simultáneo Aleatorio (2 a 4)",
		defaultValue: true,
	},
	fullScreen: {
		kind: "boolean",
		section: "space",
		label: "Pantalla Completa [F]",
		defaultValue: false,
	},
	infiniteMode: {
		kind: "boolean",
		section: "space",
		label: "Modo Infinito (Borra Antiguas)",
		defaultValue: true,
	},
	autoSequence: {
		kind: "boolean",
		section: "space",
		label: "Secuencia Automática de Esquinas",
		defaultValue: true,
	},
	showDebugGrid: {
		kind: "boolean",
		section: "space",
		label: "Ver Grilla de Densidad [G]",
		defaultValue: false,
	},
};

const NON_STATE_PARAM_KEYS = new Set([
	"canvasWidth",
	"canvasHeight",
	"fullScreen",
	"showDebugGrid",
]);

/**
 * Definición declarativa de los 3 estados performáticos en vivo ([Q], [W], [E]).
 * Cada estado guarda los overrides de parámetros generativos que se aplican
 * apenas comienza una nueva rama.
 */
const PERFORMANCE_STATES = {
	Q: {
		id: "Q",
		key: "Q",
		label: "Estado Q",
		params: {
			originSpread: 280,
			trunkCenterPull: 0.095,
			trunkBaseLength: 680,
			trunkLengthRandomness: 0.34,
			trunkMinLength: 350,
			trunkMaxLength: 900,
			trunkBranchRate: 0,
			subBranchIntensity: 2,
			subBranchRate: 3,
			subBranchLength: 2,
			subBranchForkChance: 0.5,
			maxGeneration: 6,
			angleVariance: 0.51,
			maxVisibleTrees: 5,
			overlapTolerance: 0.7,
			spawnGraceSteps: 22,
			matureDesaturation: 0.8,
			matureBrightness: 0.5,
			matureGridRelief: 0.6,
			repulsionStrength: 0.24,
			saturationThreshold: 8.5,
			stepsPerFrame: 3,
			simultaneousCount: 1,
			forceMainBranching: true,
			simultaneousMode: false,
			simultaneousRandom: true,
			infiniteMode: true,
			autoSequence: true,
		},
	},
	W: {
		id: "W",
		key: "W",
		label: "Estado W",
		params: {
			originSpread: 280,
			trunkCenterPull: 0.095,
			trunkBaseLength: 800,
			trunkLengthRandomness: 0.34,
			trunkMinLength: 600,
			trunkMaxLength: 1320,
			trunkBranchRate: 0,
			subBranchIntensity: 2,
			subBranchRate: 3,
			subBranchLength: 2,
			subBranchForkChance: 0.5,
			maxGeneration: 6,
			angleVariance: 1.15,
			maxVisibleTrees: 16,
			overlapTolerance: 0.7,
			spawnGraceSteps: 22,
			matureDesaturation: 0.8,
			matureBrightness: 0.5,
			matureGridRelief: 0.6,
			repulsionStrength: 0.24,
			saturationThreshold: 8.5,
			stepsPerFrame: 5,
			simultaneousCount: 1,
			forceMainBranching: true,
			simultaneousMode: false,
			simultaneousRandom: true,
			infiniteMode: true,
			autoSequence: true,
		},
	},
	E: {
		id: "E",
		key: "E",
		label: "Estado E",
		params: {
			originSpread: 280,
			trunkCenterPull: 0.095,
			trunkBaseLength: 840,
			trunkLengthRandomness: 0.45,
			trunkMinLength: 400,
			trunkMaxLength: 1100,
			trunkBranchRate: 0.24,
			subBranchIntensity: 2,
			subBranchRate: 1.25,
			subBranchLength: 1.95,
			subBranchForkChance: 0.3,
			maxGeneration: 5,
			angleVariance: 0.49,
			maxVisibleTrees: 7,
			overlapTolerance: 0.7,
			spawnGraceSteps: 22,
			matureDesaturation: 0.9,
			matureBrightness: 0.35,
			matureGridRelief: 0.6,
			repulsionStrength: 0.24,
			saturationThreshold: 8.5,
			stepsPerFrame: 3,
			simultaneousCount: 1,
			forceMainBranching: true,
			simultaneousMode: false,
			simultaneousRandom: true,
			infiniteMode: true,
			autoSequence: true,
		},
	},
};

/**
 * Extrae una instantánea limpia de los parámetros generativos actuales de CONFIG
 * (excluyendo resolución de ventana y flags de depuración) lista para copiar como preset.
 */
function getExportableConfigSnapshot(config) {
	const snapshot = {};
	for (const key of Object.keys(PARAM_SCHEMA)) {
		if (NON_STATE_PARAM_KEYS.has(key)) continue;
		if (key in config) {
			snapshot[key] = config[key];
		}
	}
	return snapshot;
}

/**
 * Aplica los parámetros de un estado performático (Q/W/E) sobre la instancia de config.
 * Devuelve la lista de claves efectivamente actualizadas.
 */
function applyPerformanceStateParams(config, stateId) {
	const stateDef = PERFORMANCE_STATES[stateId];
	if (!stateDef || !stateDef.params) return [];

	const changedKeys = [];
	for (const [key, val] of Object.entries(stateDef.params)) {
		if (NON_STATE_PARAM_KEYS.has(key)) continue;
		if (!(key in config)) continue;
		config[key] = val;
		changedKeys.push(key);
	}
	return changedKeys;
}

/**
 * Construye una instancia fresca de configuración combinando constantes base
 * y los valores por defecto declarados en PARAM_SCHEMA.
 */
function createConfig(overrides = {}) {
	const cfg = {
		bgColor: "#050608",
		frameMargin: 36,
		frameStrokeColor: [55, 78, 115, 150],
		gridCellSize: 12,
		stepLength: 2.2,
		maxActiveTips: 1400,
		branchProb: [0.08, 0.11, 0.13, 0.145, 0.155, 0.16],
		noiseScale: 0.018,
	};

	for (const [key, meta] of Object.entries(PARAM_SCHEMA)) {
		cfg[key] = meta.defaultValue;
	}

	applyPerformanceStateParams(cfg, "Q");

	return Object.assign(cfg, overrides);
}

/**
 * Dibuja el marco rectangular interno fino directamente sobre el contexto 2D nativo
 * para evitar el costo de push()/pop() y cambios de estado en p5.js en cada frame.
 */
function drawInnerFrameShared(target, bounds, strokeColor) {
	const { left, top, right, bottom } = bounds;
	const [r, g, b, a] = strokeColor;
	const ctx = target.drawingContext;

	ctx.save();
	ctx.globalCompositeOperation = "source-over";
	ctx.strokeStyle = `rgba(${r},${g},${b},${a / 255})`;
	ctx.lineWidth = 1;
	ctx.strokeRect(left, top, right - left, bottom - top);
	ctx.restore();
}

/**
 * Manejador de atajos de teclado ([Q]/[W]/[E], [1]-[6], [R], [S], [F], [G], [H], [SPACE]).
 */
function handleSharedKeyPressed(keyStr, handlers) {
	switch (keyStr) {
		case "q":
		case "Q":
			handlers.onAction?.("setState", { stateId: "Q" });
			break;
		case "w":
		case "W":
			handlers.onAction?.("setState", { stateId: "W" });
			break;
		case "e":
		case "E":
			handlers.onAction?.("setState", { stateId: "E" });
			break;
		case "1":
			handlers.onAction?.("burst2");
			break;
		case "2":
			handlers.onAction?.("burst3");
			break;
		case "3":
			handlers.onAction?.("burst4");
			break;
		case "4":
			handlers.onAction?.("bloom", { isSustained: true, isHeld: true });
			break;
		case "5":
			handlers.onAction?.("shock", { isSustained: true, isHeld: true });
			break;
		case "6":
			handlers.onAction?.("toggleSimultaneous");
			break;
		case "r":
		case "R":
			handlers.onAction?.("reset");
			break;
		case "s":
		case "S":
			handlers.onAction?.("save");
			break;
		case "f":
		case "F":
			handlers.onToggleFullScreen?.();
			break;
		case "g":
		case "G":
			handlers.onToggleDebugGrid?.();
			break;
		case "h":
		case "H":
			handlers.onToggleUI?.();
			break;
		case " ":
			handlers.onAction?.("nextCorner");
			return false;
	}
	return undefined;
}

function handleSharedKeyReleased(keyStr, handlers) {
	if (keyStr === "4") {
		handlers.onAction?.("bloom", { isSustained: true, isHeld: false });
	} else if (keyStr === "5") {
		handlers.onAction?.("shock", { isSustained: true, isHeld: false });
	}
}

window.UI_SECTIONS = UI_SECTIONS;
window.CANVAS_PRESETS = CANVAS_PRESETS;
window.PARAM_SCHEMA = PARAM_SCHEMA;
window.PERFORMANCE_STATES = PERFORMANCE_STATES;
window.createConfig = createConfig;
window.getExportableConfigSnapshot = getExportableConfigSnapshot;
window.applyPerformanceStateParams = applyPerformanceStateParams;
window.drawInnerFrameShared = drawInnerFrameShared;
window.handleSharedKeyPressed = handleSharedKeyPressed;
window.handleSharedKeyReleased = handleSharedKeyReleased;
