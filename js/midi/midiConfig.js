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
			"Controlador de performance en vivo. Knobs 1 y 9 omitidos por falla fisica. 14 encoders y 8 pads mapeados.",
		deviceNameMatchers: ["minilab mkii", "minilab mk2", "arturia minilab"],
		defaultChannel: MIDI_CHANNELS.p5js,
		mappings: [
			// ==========================================
			// FILA SUPERIOR: ESTRUCTURA, TRONCO Y ESPACIO
			// (Knob 1 omitido por falla de hardware)
			// ==========================================
			{
				id: "ml_k2_trunkCenterPull",
				type: "cc",
				number: 74, // Knob 2
				channel: 1,
				target: "trunkCenterPull",
				behavior: "absolute",
				_comment: "Knob 2: Tendencia al Centro (dirección del tronco)",
			},
			{
				id: "ml_k3_trunkBaseLength",
				type: "cc",
				number: 71, // Knob 3
				channel: 1,
				target: "trunkBaseLength",
				behavior: "absolute",
				_comment: "Knob 3: Largo Base de la rama maestra (Gen 0)",
			},
			{
				id: "ml_k4_trunkBranchRate",
				type: "cc",
				number: 76, // Knob 4
				channel: 1,
				target: "trunkBranchRate",
				behavior: "absolute",
				_comment: "Knob 4: Emisión de brazos principales (Gen 0 -> Gen 1)",
			},
			{
				id: "ml_k5_originSpread",
				type: "cc",
				number: 77, // Knob 5
				channel: 1,
				target: "originSpread",
				behavior: "absolute",
				_comment: "Knob 5: Dispersión del nacimiento a lo largo del borde",
			},
			{
				id: "ml_k6_stepsPerFrame",
				type: "cc",
				number: 93, // Knob 6
				channel: 1,
				target: "stepsPerFrame",
				behavior: "absolute",
				_comment: "Knob 6: Velocidad de crecimiento (pasos por frame)",
			},
			{
				id: "ml_k7_overlapTolerance",
				type: "cc",
				number: 73, // Knob 7
				channel: 1,
				target: "overlapTolerance",
				behavior: "absolute",
				_comment: "Knob 7: Tolerancia de superposición entre ramas",
			},
			{
				id: "ml_k8_repulsionStrength",
				type: "cc",
				number: 75, // Knob 8
				channel: 1,
				target: "repulsionStrength",
				behavior: "absolute",
				_comment: "Knob 8: Fuerza de repulsión y evasión espacial",
			},

			// ==========================================
			// FILA INFERIOR: SUB-RAMAS, CAPILARES Y DENSIDAD
			// (Knob 9 omitido por falla de hardware)
			// ==========================================
			{
				id: "ml_k10_subBranchIntensity",
				type: "cc",
				number: 18, // Knob 10
				channel: 1,
				target: "subBranchIntensity",
				behavior: "absolute",
				_comment: "Knob 10: Brillo e intensidad lumínica de capilares",
			},
			{
				id: "ml_k11_subBranchRate",
				type: "cc",
				number: 19, // Knob 11
				channel: 1,
				target: "subBranchRate",
				behavior: "absolute",
				_comment: "Knob 11: Cantidad de ramificaciones (densidad capilar)",
			},
			{
				id: "ml_k12_subBranchLength",
				type: "cc",
				number: 16, // Knob 12
				channel: 1,
				target: "subBranchLength",
				behavior: "absolute",
				_comment: "Knob 12: Largo y alcance de sub-ramas secundarias",
			},
			{
				id: "ml_k13_subBranchForkChance",
				type: "cc",
				number: 17, // Knob 13
				channel: 1,
				target: "subBranchForkChance",
				behavior: "absolute",
				_comment: "Knob 13: Probabilidad de bifurcación doble (penachos)",
			},
			{
				id: "ml_k14_angleVariance",
				type: "cc",
				number: 91, // Knob 14
				channel: 1,
				target: "angleVariance",
				behavior: "absolute",
				_comment: "Knob 14: Apertura y quiebre eléctrico (estética Lichtenberg)",
			},
			{
				id: "ml_k15_maxGeneration",
				type: "cc",
				number: 79, // Knob 15
				channel: 1,
				target: "maxGeneration",
				behavior: "absolute",
				_comment: "Knob 15: Profundidad máxima de generaciones",
			},
			{
				id: "ml_k16_saturationThreshold",
				type: "cc",
				number: 72, // Knob 16
				channel: 1,
				target: "saturationThreshold",
				behavior: "absolute",
				_comment: "Knob 16: Umbral de saturación de la grilla espacial",
			},

			// ==========================================
			// PADS 1 AL 8: ACCIONES Y DISPAROS PERFORMÁTICOS
			// ==========================================
			{
				id: "ml_pad1_nextCorner",
				type: "note",
				number: 36, // C2
				channel: 1,
				target: "nextCorner",
				behavior: "momentary",
				_comment: "Pad 1: Siguiente Esquina (dispara nueva rama)",
			},
			{
				id: "ml_pad2_burst2",
				type: "note",
				number: 37, // C#2
				channel: 1,
				target: "burst2",
				behavior: "momentary",
				_comment: "Pad 2: Ráfaga x2 ramas simultáneas",
			},
			{
				id: "ml_pad3_burst3",
				type: "note",
				number: 38, // D2
				channel: 1,
				target: "burst3",
				behavior: "momentary",
				_comment: "Pad 3: Ráfaga x3 ramas simultáneas",
			},
			{
				id: "ml_pad4_burst4",
				type: "note",
				number: 39, // D#2
				channel: 1,
				target: "burst4",
				behavior: "momentary",
				_comment: "Pad 4: Ráfaga x4 ramas simultáneas",
			},
			{
				id: "ml_pad5_bloom",
				type: "note",
				number: 40, // E2
				channel: 1,
				target: "bloom",
				behavior: "sustain",
				_comment: "Pad 5: Floración capilar explosiva (Sustain al mantener presionado)",
			},
			{
				id: "ml_pad6_shock",
				type: "note",
				number: 41, // F2
				channel: 1,
				target: "shock",
				behavior: "sustain",
				_comment: "Pad 6: Sacudida eléctrica continua (Sustain al mantener presionado)",
			},
			{
				id: "ml_pad7_toggleSimultaneous",
				type: "note",
				number: 42, // F#2
				channel: 1,
				target: "toggleSimultaneous",
				behavior: "toggle",
				_comment: "Pad 7: Alternar modo simultáneo automático",
			},
			{
				id: "ml_pad8_reset",
				type: "note",
				number: 43, // G2
				channel: 1,
				target: "reset",
				behavior: "momentary",
				_comment: "Pad 8: Reiniciar lienzo y semilla aleatoria",
			},
		],
	},
};

export const DEFAULT_CONTROLLER_PROFILE_ID = "minilab_mk2";
