/**
 * midiMapping.js - Capa independiente de mapeo entre mensajes MIDI normalizados
 * y parámetros/acciones del sketch.
 *
 * Soporta:
 * - Escalado y normalización lineal a rangos [min, max] con cuantización (step).
 * - Modos de comportamiento: "absolute", "relative", "momentary", "toggle".
 * - Perfiles independientes por controlador (KeyLab Essential 49 y MiniLab MK2).
 * - Desacoplamiento total respecto de la lógica interna de p5.js mediante adaptadores.
 */

import {
	CONTROLLER_PROFILES,
	DEFAULT_CONTROLLER_PROFILE_ID,
	MIDI_CHANNELS,
	SKETCH_TARGETS,
} from "./midiConfig.js";

export class MidiMappingEngine {
	/**
	 * @param {Object} handlers
	 * @param {(targetKey: string) => any} handlers.getParamValue - Lee el valor actual de un parámetro.
	 * @param {(targetKey: string, value: any, meta: Object) => void} handlers.setParamValue - Aplica un valor escalado.
	 * @param {(actionKey: string, meta: Object) => void} handlers.triggerAction - Ejecuta una acción performática.
	 */
	constructor(handlers = {}) {
		this.getParamValue = handlers.getParamValue || (() => undefined);
		this.setParamValue = handlers.setParamValue || (() => {});
		this.triggerAction = handlers.triggerAction || (() => {});

		this.profiles = structuredClone(CONTROLLER_PROFILES);
		this.activeProfileId = DEFAULT_CONTROLLER_PROFILE_ID;

		// Estado interno por control para detectar flancos en modo toggle/momentary
		this._controlStates = new Map();
		this._mappingApplyListeners = new Set();
	}

	/**
	 * Devuelve todos los perfiles de controlador configurados.
	 */
	getProfiles() {
		return Object.values(this.profiles);
	}

	/**
	 * Devuelve el perfil de controlador activo actualmente.
	 */
	getActiveProfile() {
		return this.profiles[this.activeProfileId] || null;
	}

	/**
	 * Cambia el perfil de controlador activo (ej. "keylab_essential_49" o "minilab_mk2").
	 */
	setActiveProfile(profileId) {
		if (!this.profiles[profileId]) {
			return false;
		}
		this.activeProfileId = profileId;
		this._controlStates.clear();
		return true;
	}

	/**
	 * Sugiere e instala automáticamente el perfil correspondiente si el nombre del
	 * puerto MIDI coincide con alguno de los patrones de KeyLab Essential 49 o MiniLab MK2.
	 */
	matchProfileByDeviceName(deviceName) {
		if (!deviceName) return null;
		const lower = deviceName.toLowerCase();

		for (const profile of Object.values(this.profiles)) {
			if (
				profile.deviceNameMatchers?.some((pattern) =>
					lower.includes(pattern.toLowerCase()),
				)
			) {
				return profile.id;
			}
		}
		return null;
	}

	/**
	 * Devuelve la lista de asignaciones del perfil activo.
	 */
	getActiveMappings() {
		const profile = this.getActiveProfile();
		return profile ? profile.mappings : [];
	}

	/**
	 * Permite registrar o actualizar una asignación en el perfil indicado
	 * sin alterar la lógica visual del sketch.
	 */
	upsertMapping(profileId, mappingDef) {
		const profile = this.profiles[profileId || this.activeProfileId];
		if (!profile) return null;

		const targetMeta = SKETCH_TARGETS[mappingDef.target] || {};
		const normalizedMapping = {
			id:
				mappingDef.id ||
				`${mappingDef.type}_ch${mappingDef.channel ?? MIDI_CHANNELS.p5js}_n${mappingDef.number}_${mappingDef.target}`,
			device: mappingDef.device || profile.name,
			type: mappingDef.type === "note" ? "note" : "cc",
			number: Number(mappingDef.number),
			channel: Number(mappingDef.channel ?? profile.defaultChannel ?? MIDI_CHANNELS.p5js),
			target: mappingDef.target,
			min:
				mappingDef.min !== undefined
					? Number(mappingDef.min)
					: (targetMeta.min ?? 0),
			max:
				mappingDef.max !== undefined
					? Number(mappingDef.max)
					: (targetMeta.max ?? 1),
			step:
				mappingDef.step !== undefined
					? Number(mappingDef.step)
					: (targetMeta.step ?? null),
			behavior:
				mappingDef.behavior || targetMeta.defaultBehavior || "absolute",
			relativeMode: mappingDef.relativeMode || "binaryOffset",
		};

		const existingIdx = profile.mappings.findIndex(
			(m) =>
				m.id === normalizedMapping.id ||
				(m.type === normalizedMapping.type &&
					m.number === normalizedMapping.number &&
					m.channel === normalizedMapping.channel &&
					m.target === normalizedMapping.target),
		);

		if (existingIdx >= 0) {
			profile.mappings[existingIdx] = normalizedMapping;
		} else {
			profile.mappings.push(normalizedMapping);
		}

		return normalizedMapping;
	}

	/**
	 * Procesa un mensaje MIDI normalizado y ejecuta todas las asignaciones coincidentes
	 * dentro del perfil activo.
	 */
	processMessage(msg) {
		const profile = this.getActiveProfile();
		if (!profile || !Array.isArray(profile.mappings) || profile.mappings.length === 0) {
			return [];
		}

		const msgCategory = msg.type === "cc" ? "cc" : "note";
		const appliedResults = [];

		for (const mapping of profile.mappings) {
			if (!this._matchesMapping(mapping, msg, msgCategory)) {
				continue;
			}

			const outcome = this._applyMapping(mapping, msg);
			if (outcome) {
				appliedResults.push(outcome);
				for (const cb of this._mappingApplyListeners) {
					cb(outcome);
				}
			}
		}

		return appliedResults;
	}

	_matchesMapping(mapping, msg, msgCategory) {
		if (mapping.type !== msgCategory) return false;
		if (Number(mapping.number) !== Number(msg.number)) return false;
		if (
			mapping.channel !== undefined &&
			mapping.channel !== "*" &&
			Number(mapping.channel) !== Number(msg.channel)
		) {
			return false;
		}
		if (
			mapping.device &&
			mapping.device !== "*" &&
			msg.deviceName &&
			!msg.deviceName.toLowerCase().includes(mapping.device.toLowerCase()) &&
			!mapping.device.toLowerCase().includes(msg.deviceName.toLowerCase())
		) {
			// Permitir coincidencia flexible cuando se usa el perfil activo seleccionado manualmente
		}
		return true;
	}

	_applyMapping(mapping, msg) {
		const targetMeta = SKETCH_TARGETS[mapping.target] || { kind: "param" };
		const behavior = mapping.behavior || targetMeta.defaultBehavior || "absolute";
		const stateKey = `${this.activeProfileId}:${mapping.type}:${mapping.channel}:${mapping.number}:${mapping.target}`;

		if (behavior === "absolute") {
			if (msg.type === "noteoff") return null;
			const scaled = this.scaleNormalizedValue(
				msg.normalizedValue,
				mapping.min ?? targetMeta.min ?? 0,
				mapping.max ?? targetMeta.max ?? 1,
				mapping.step ?? targetMeta.step ?? null,
			);

			if (targetMeta.kind === "boolean") {
				const boolVal = msg.rawValue >= 64;
				this.setParamValue(mapping.target, boolVal, { mapping, msg });
				return { mapping, msg, value: boolVal };
			}

			this.setParamValue(mapping.target, scaled, { mapping, msg });
			return { mapping, msg, value: scaled };
		}

		if (behavior === "relative") {
			if (msg.type !== "cc") return null;
			const deltaSteps = this.decodeRelativeDelta(
				msg.rawValue,
				mapping.relativeMode || "binaryOffset",
			);
			if (deltaSteps === 0) return null;

			const min = mapping.min ?? targetMeta.min ?? 0;
			const max = mapping.max ?? targetMeta.max ?? 1;
			const step =
				mapping.step ?? targetMeta.step ?? (max - min) / 100;
			const currentVal = Number(this.getParamValue(mapping.target) ?? min);
			const nextVal = this.quantizeAndClamp(
				currentVal + deltaSteps * step,
				min,
				max,
				mapping.step ?? targetMeta.step ?? null,
			);

			this.setParamValue(mapping.target, nextVal, { mapping, msg });
			return { mapping, msg, value: nextVal };
		}

		if (behavior === "momentary") {
			const isPressed =
				msg.type === "noteon"
					? msg.rawValue > 0
					: msg.type === "noteoff"
						? false
						: msg.rawValue >= 64;

			const prevPressed = this._controlStates.get(stateKey) === true;
			this._controlStates.set(stateKey, isPressed);

			if (targetMeta.kind === "action") {
				if (isPressed && !prevPressed) {
					this.triggerAction(mapping.target, { mapping, msg });
					return { mapping, msg, actionTriggered: mapping.target };
				}
				return null;
			}

			if (targetMeta.kind === "boolean") {
				this.setParamValue(mapping.target, isPressed, { mapping, msg });
				return { mapping, msg, value: isPressed };
			}

			const val = isPressed
				? (mapping.max ?? targetMeta.max ?? 1)
				: (mapping.min ?? targetMeta.min ?? 0);
			this.setParamValue(mapping.target, val, { mapping, msg });
			return { mapping, msg, value: val };
		}

		if (behavior === "toggle") {
			const isPressed =
				msg.type === "noteon"
					? msg.rawValue > 0
					: msg.type === "noteoff"
						? false
						: msg.rawValue >= 64;

			const prevPressed = this._controlStates.get(stateKey) === true;
			this._controlStates.set(stateKey, isPressed);

			// Solo disparar en el flanco ascendente (al presionar el pad/botón)
			if (!isPressed || prevPressed) {
				return null;
			}

			if (targetMeta.kind === "action") {
				this.triggerAction(mapping.target, { mapping, msg });
				return { mapping, msg, actionTriggered: mapping.target };
			}

			if (targetMeta.kind === "boolean") {
				const currentBool = Boolean(this.getParamValue(mapping.target));
				const nextBool = !currentBool;
				this.setParamValue(mapping.target, nextBool, { mapping, msg });
				return { mapping, msg, value: nextBool };
			}

			const min = mapping.min ?? targetMeta.min ?? 0;
			const max = mapping.max ?? targetMeta.max ?? 1;
			const currentVal = Number(this.getParamValue(mapping.target) ?? min);
			const mid = (min + max) * 0.5;
			const nextVal = currentVal >= mid ? min : max;
			this.setParamValue(mapping.target, nextVal, { mapping, msg });
			return { mapping, msg, value: nextVal };
		}

		return null;
	}

	/**
	 * Escala un valor normalizado [0.0, 1.0] al rango [min, max] respetando el paso (step).
	 */
	scaleNormalizedValue(normValue, min, max, step = null) {
		const t = Math.max(0, Math.min(1, Number(normValue) || 0));
		const raw = min + t * (max - min);
		return this.quantizeAndClamp(raw, min, max, step);
	}

	/**
	 * Cuantiza al múltiplo de `step` más cercano y limita al rango [min, max].
	 */
	quantizeAndClamp(value, min, max, step = null) {
		const lo = Math.min(min, max);
		const hi = Math.max(min, max);
		let v = Math.max(lo, Math.min(hi, value));

		if (step && step > 0) {
			const steps = Math.round((v - min) / step);
			v = min + steps * step;
			// Redondear decimales flotantes según la precisión de step
			const decimals = (step.toString().split(".")[1] || "").length;
			v = Number(v.toFixed(Math.min(6, decimals)));
		}

		return Math.max(lo, Math.min(hi, v));
	}

	/**
	 * Decodifica encoders relativos (Arturia Relative #1, #2 y #3):
	 * - binaryOffset (Relative #1 en Arturia MCC): 64 es neutro; >64 suma (val - 64); <64 resta (val - 64).
	 * - twosComplement (Relative #2): 1..63 suma (+1..+63); 127..65 resta (-1..-63).
	 * - signMagnitude (Relative #3): bit 6 indica signo.
	 */
	decodeRelativeDelta(rawValue, mode = "binaryOffset") {
		const val = Number(rawValue) & 0x7f;
		if (mode === "twosComplement") {
			if (val === 0) return 0;
			return val < 64 ? val : val - 128;
		}
		if (mode === "signMagnitude") {
			const mag = val & 0x3f;
			return (val & 0x40) !== 0 ? -mag : mag;
		}
		// Por defecto: binaryOffset (Arturia Relative #1, centro en 64)
		return val - 64;
	}

	onMappingApplied(callback) {
		this._mappingApplyListeners.add(callback);
		return () => this._mappingApplyListeners.delete(callback);
	}
}
