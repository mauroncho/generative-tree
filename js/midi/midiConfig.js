/**
 * midiConfig.js - Configuración declarativa de canales MIDI, catálogo de parámetros
 * del sketch y perfiles independientes por controlador (KeyLab Essential 49 / MiniLab MK2).
 *
 * IMPORTANTE: No se asumen ni inventan números CC o Notas. Las listas `mappings`
 * están listas para completarse una vez identificados los mensajes reales de cada
 * controlador mediante el Modo de Diagnóstico MIDI.
 */

export const MIDI_CHANNELS = {
	p5js: 1, // Canal exclusivo por defecto para p5.js
	touchDesigner: 2, // Canal reservado para TouchDesigner
	min: 1,
	max: 16,
};

/**
 * Definición de parámetros continuos/booleanos y acciones performáticas del sketch
 * disponibles para vincular desde `midiMapping.js` sin acoplar la lógica visual.
 */
export const SKETCH_TARGETS = {
	// --- Parámetros de Rama Principal (Gen 0) ---
	originSpread: {
		kind: "param",
		label: "Dispersión en Bordes",
		min: 0,
		max: 280,
		step: 5,
		defaultBehavior: "absolute",
	},
	trunkCenterPull: {
		kind: "param",
		label: "Tendencia al Centro",
		min: 0.0,
		max: 0.25,
		step: 0.005,
		defaultBehavior: "absolute",
	},
	trunkBaseLength: {
		kind: "param",
		label: "Largo Base (Gen 0)",
		min: 200,
		max: 1200,
		step: 10,
		defaultBehavior: "absolute",
	},
	trunkLengthRandomness: {
		kind: "param",
		label: "Aleatoriedad de Largo",
		min: 0.0,
		max: 1.0,
		step: 0.01,
		defaultBehavior: "absolute",
	},
	trunkMinLength: {
		kind: "param",
		label: "Largo Mínimo",
		min: 150,
		max: 900,
		step: 10,
		defaultBehavior: "absolute",
	},
	trunkMaxLength: {
		kind: "param",
		label: "Largo Máximo",
		min: 400,
		max: 1500,
		step: 10,
		defaultBehavior: "absolute",
	},
	trunkBranchRate: {
		kind: "param",
		label: "Emisión de Brazos (Gen 0->1)",
		min: 0.0,
		max: 0.65,
		step: 0.005,
		defaultBehavior: "absolute",
	},

	// --- Parámetros de Sub-Ramas y Capilares (Gen 1+) ---
	subBranchIntensity: {
		kind: "param",
		label: "Brillo / Intensidad Sub-Ramas",
		min: 0.2,
		max: 4.0,
		step: 0.05,
		defaultBehavior: "absolute",
	},
	subBranchRate: {
		kind: "param",
		label: "Cantidad Ramificaciones (Gen 1+)",
		min: 0.0,
		max: 6.0,
		step: 0.05,
		defaultBehavior: "absolute",
	},
	subBranchLength: {
		kind: "param",
		label: "Largo de Sub-Ramas",
		min: 0.25,
		max: 6.0,
		step: 0.05,
		defaultBehavior: "absolute",
	},
	subBranchForkChance: {
		kind: "param",
		label: "Bifurcación Doble (Penachos)",
		min: 0.0,
		max: 0.85,
		step: 0.02,
		defaultBehavior: "absolute",
	},
	maxGeneration: {
		kind: "param",
		label: "Profundidad Máx (Generaciones)",
		min: 1,
		max: 8,
		step: 1,
		defaultBehavior: "absolute",
	},
	angleVariance: {
		kind: "param",
		label: "Apertura y Quiebre Eléctrico",
		min: 0.15,
		max: 1.15,
		step: 0.02,
		defaultBehavior: "absolute",
	},

	// --- Espacio, Superposición y Velocidad ---
	maxVisibleTrees: {
		kind: "param",
		label: "Máx. Ramas Visibles",
		min: 1,
		max: 24,
		step: 1,
		defaultBehavior: "absolute",
	},
	overlapTolerance: {
		kind: "param",
		label: "Permiso de Superposición",
		min: 0.0,
		max: 1.0,
		step: 0.02,
		defaultBehavior: "absolute",
	},
	repulsionStrength: {
		kind: "param",
		label: "Fuerza de Repulsión",
		min: 0.0,
		max: 0.75,
		step: 0.02,
		defaultBehavior: "absolute",
	},
	saturationThreshold: {
		kind: "param",
		label: "Umbral de Saturación",
		min: 3.0,
		max: 18.0,
		step: 0.5,
		defaultBehavior: "absolute",
	},
	stepsPerFrame: {
		kind: "param",
		label: "Velocidad (Pasos / Frame)",
		min: 1,
		max: 18,
		step: 1,
		defaultBehavior: "absolute",
	},
	simultaneousCount: {
		kind: "param",
		label: "Ramas Simultáneas (Fijo)",
		min: 1,
		max: 4,
		step: 1,
		defaultBehavior: "absolute",
	},

	// --- Estados Booleanos / Toggles ---
	simultaneousMode: {
		kind: "boolean",
		label: "Modo Simultáneo Auto (2-4)",
		min: 0,
		max: 1,
		defaultBehavior: "toggle",
	},
	simultaneousRandom: {
		kind: "boolean",
		label: "Simultáneo Aleatorio",
		min: 0,
		max: 1,
		defaultBehavior: "toggle",
	},
	infiniteMode: {
		kind: "boolean",
		label: "Modo Infinito (Borra Antiguas)",
		min: 0,
		max: 1,
		defaultBehavior: "toggle",
	},
	autoSequence: {
		kind: "boolean",
		label: "Secuencia Automática de Esquinas",
		min: 0,
		max: 1,
		defaultBehavior: "toggle",
	},
	showDebugGrid: {
		kind: "boolean",
		label: "Ver Grilla de Densidad",
		min: 0,
		max: 1,
		defaultBehavior: "toggle",
	},

	// --- Acciones Performáticas Discretas ---
	reset: {
		kind: "action",
		label: "Reiniciar Simulación [R]",
		defaultBehavior: "momentary",
	},
	nextCorner: {
		kind: "action",
		label: "Siguiente Esquina [SPACE]",
		defaultBehavior: "momentary",
	},
	burst2: {
		kind: "action",
		label: "Ráfaga x2 [1]",
		defaultBehavior: "momentary",
	},
	burst3: {
		kind: "action",
		label: "Ráfaga x3 [2]",
		defaultBehavior: "momentary",
	},
	burst4: {
		kind: "action",
		label: "Ráfaga x4 [3]",
		defaultBehavior: "momentary",
	},
	bloom: {
		kind: "action",
		label: "Floración Capilar [4]",
		defaultBehavior: "momentary",
	},
	shock: {
		kind: "action",
		label: "Sacudida Eléctrica [5]",
		defaultBehavior: "momentary",
	},
	toggleSimultaneous: {
		kind: "action",
		label: "Alternar Simultáneo Auto [6]",
		defaultBehavior: "toggle",
	},
	save: {
		kind: "action",
		label: "Guardar PNG [S]",
		defaultBehavior: "momentary",
	},
};

/**
 * Estructura de cada entrada de mapeo (documentación de referencia):
 * {
 *   id: "identificador_unico",
 *   device: "Arturia KeyLab Essential 49", // nombre o "*"
 *   type: "cc" | "note",                   // Tipo de mensaje MIDI
 *   number: 0,                             // Número CC (0-127) o Nota MIDI (0-127)
 *   channel: 1,                            // Canal MIDI (1 = p5.js, 2 = TouchDesigner)
 *   target: "stepsPerFrame",               // Clave de SKETCH_TARGETS
 *   min: 1,                                // Valor mínimo del parámetro (opcional: toma de SKETCH_TARGETS)
 *   max: 18,                               // Valor máximo del parámetro (opcional: toma de SKETCH_TARGETS)
 *   step: 1,                               // Cuantización opcional
 *   behavior: "absolute",                  // "absolute" | "relative" | "momentary" | "toggle"
 *   relativeMode: "binaryOffset",          // "binaryOffset" (64=centro) | "twosComplement" | "signMagnitude"
 * }
 */
export const CONTROLLER_PROFILES = {
	keylab_essential_49: {
		id: "keylab_essential_49",
		name: "Arturia KeyLab Essential 49",
		role: "development",
		description:
			"Controlador de desarrollo. Usar Modo Diagnóstico para identificar CC y Notas reales antes de poblar mappings.",
		deviceNameMatchers: [
			"keylab essential 49",
			"keylab essential",
			"kl essential",
		],
		defaultChannel: MIDI_CHANNELS.p5js,
		// Sin asignaciones asumidas hasta relevar con el Modo Diagnóstico:
		mappings: [],
	},

	minilab_mk2: {
		id: "minilab_mk2",
		name: "Arturia MiniLab MK2",
		role: "performance",
		description:
			"Controlador de performance en vivo. Usar Modo Diagnóstico para identificar CC y Notas reales antes de poblar mappings.",
		deviceNameMatchers: ["minilab mkii", "minilab mk2", "arturia minilab"],
		defaultChannel: MIDI_CHANNELS.p5js,
		// Sin asignaciones asumidas hasta relevar con el Modo Diagnóstico:
		mappings: [],
	},
};

export const DEFAULT_CONTROLLER_PROFILE_ID = "keylab_essential_49";
