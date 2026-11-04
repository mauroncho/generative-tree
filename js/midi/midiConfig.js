/**
 * midiConfig.js - Configuración declarativa de canales MIDI, catálogo de parámetros
 * del sketch (generado desde js/config.js) y perfiles independientes por controlador
 * (KeyLab Essential 49 / MiniLab MK2).
 */

export const MIDI_CHANNELS = {
	p5js: 1, // Canal exclusivo por defecto para p5.js
	touchDesigner: 2, // Canal reservado para TouchDesigner
	min: 1,
	max: 16,
};

/**
 * Catálogo de parámetros continuos/booleanos y acciones performáticas del sketch
 * derivado automáticamente desde la fuente única de verdad (window.buildMidiSketchTargets).
 */
export const SKETCH_TARGETS =
	typeof window !== "undefined" &&
	typeof window.buildMidiSketchTargets === "function"
		? window.buildMidiSketchTargets()
		: {};

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
				number: 74,
				channel: 1,
				target: "trunkCenterPull",
				behavior: "absolute",
				_comment: "Knob 2: Tendencia al Centro (dirección del tronco)",
			},
			{
				id: "ml_k3_trunkBaseLength",
				type: "cc",
				number: 71,
				channel: 1,
				target: "trunkBaseLength",
				behavior: "absolute",
				_comment: "Knob 3: Largo Base de la rama maestra (Gen 0)",
			},
			{
				id: "ml_k4_trunkBranchRate",
				type: "cc",
				number: 76,
				channel: 1,
				target: "trunkBranchRate",
				behavior: "absolute",
				_comment: "Knob 4: Emisión de brazos principales (Gen 0 -> Gen 1)",
			},
			{
				id: "ml_k5_originSpread",
				type: "cc",
				number: 77,
				channel: 1,
				target: "originSpread",
				behavior: "absolute",
				_comment: "Knob 5: Dispersión del nacimiento a lo largo del borde",
			},
			{
				id: "ml_k6_stepsPerFrame",
				type: "cc",
				number: 93,
				channel: 1,
				target: "stepsPerFrame",
				behavior: "absolute",
				_comment: "Knob 6: Velocidad de crecimiento (pasos por frame)",
			},
			{
				id: "ml_k7_overlapTolerance",
				type: "cc",
				number: 73,
				channel: 1,
				target: "overlapTolerance",
				behavior: "absolute",
				_comment: "Knob 7: Tolerancia de superposición entre ramas",
			},
			{
				id: "ml_k8_repulsionStrength",
				type: "cc",
				number: 75,
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
				number: 18,
				channel: 1,
				target: "subBranchIntensity",
				behavior: "absolute",
				_comment: "Knob 10: Brillo e intensidad lumínica de capilares",
			},
			{
				id: "ml_k11_subBranchRate",
				type: "cc",
				number: 19,
				channel: 1,
				target: "subBranchRate",
				behavior: "absolute",
				_comment: "Knob 11: Cantidad de ramificaciones (densidad capilar)",
			},
			{
				id: "ml_k12_subBranchLength",
				type: "cc",
				number: 16,
				channel: 1,
				target: "subBranchLength",
				behavior: "absolute",
				_comment: "Knob 12: Largo y alcance de sub-ramas secundarias",
			},
			{
				id: "ml_k13_subBranchForkChance",
				type: "cc",
				number: 17,
				channel: 1,
				target: "subBranchForkChance",
				behavior: "absolute",
				_comment: "Knob 13: Probabilidad de bifurcación doble (penachos)",
			},
			{
				id: "ml_k14_angleVariance",
				type: "cc",
				number: 91,
				channel: 1,
				target: "angleVariance",
				behavior: "absolute",
				_comment: "Knob 14: Apertura y quiebre eléctrico (estética Lichtenberg)",
			},
			{
				id: "ml_k15_maxGeneration",
				type: "cc",
				number: 79,
				channel: 1,
				target: "maxGeneration",
				behavior: "absolute",
				_comment: "Knob 15: Profundidad máxima de generaciones",
			},
			{
				id: "ml_k16_saturationThreshold",
				type: "cc",
				number: 72,
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
				number: 36,
				channel: 1,
				target: "nextCorner",
				behavior: "momentary",
				_comment: "Pad 1: Siguiente Esquina (dispara nueva rama)",
			},
			{
				id: "ml_pad2_burst2",
				type: "note",
				number: 37,
				channel: 1,
				target: "burst2",
				behavior: "momentary",
				_comment: "Pad 2: Ráfaga x2 ramas simultáneas",
			},
			{
				id: "ml_pad3_burst3",
				type: "note",
				number: 38,
				channel: 1,
				target: "burst3",
				behavior: "momentary",
				_comment: "Pad 3: Ráfaga x3 ramas simultáneas",
			},
			{
				id: "ml_pad4_burst4",
				type: "note",
				number: 39,
				channel: 1,
				target: "burst4",
				behavior: "momentary",
				_comment: "Pad 4: Ráfaga x4 ramas simultáneas",
			},
			{
				id: "ml_pad5_bloom",
				type: "note",
				number: 40,
				channel: 1,
				target: "bloom",
				behavior: "sustain",
				_comment:
					"Pad 5: Floración capilar explosiva (Sustain al mantener presionado)",
			},
			{
				id: "ml_pad6_shock",
				type: "note",
				number: 41,
				channel: 1,
				target: "shock",
				behavior: "sustain",
				_comment:
					"Pad 6: Sacudida eléctrica continua (Sustain al mantener presionado)",
			},
			{
				id: "ml_pad7_toggleSimultaneous",
				type: "note",
				number: 42,
				channel: 1,
				target: "toggleSimultaneous",
				behavior: "toggle",
				_comment: "Pad 7: Alternar modo simultáneo automático",
			},
			{
				id: "ml_pad8_reset",
				type: "note",
				number: 43,
				channel: 1,
				target: "reset",
				behavior: "momentary",
				_comment: "Pad 8: Reiniciar lienzo y semilla aleatoria",
			},
		],
	},
};

export const DEFAULT_CONTROLLER_PROFILE_ID = "minilab_mk2";
