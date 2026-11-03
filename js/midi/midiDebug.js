/**
 * midiDebug.js - Monitor de diagnóstico MIDI en tiempo real para relevar
 * controles físicos reales (Arturia KeyLab Essential 49 y MiniLab MK2).
 *
 * Registra:
 * - Nombre del dispositivo
 * - Tipo de mensaje (CC / Note On / Note Off)
 * - Número CC o Nota (con nombre de nota cuando aplica)
 * - Canal MIDI (identificando Canal 1: p5.js vs Canal 2: TouchDesigner)
 * - Valor recibido (0-127 crudo y 0.00-1.00 normalizado)
 * - Estado de Note On / Note Off
 * - Catálogo de controles únicos detectados en la sesión para facilitar el armado de midiConfig.js
 */

import { MIDI_CHANNELS } from "./midiConfig.js";

export class MidiDebugMonitor {
	constructor(options = {}) {
		this.enabled = options.enabled ?? true;
		this.maxHistory = options.maxHistory ?? 10;

		this.lastMessage = null;
		this.history = [];
		this.discoveredControls = new Map();

		this._listeners = new Set();
		this._rafPending = false;
	}

	setEnabled(enabled) {
		this.enabled = Boolean(enabled);
		this._scheduleNotify();
	}

	/**
	 * Registra un mensaje entrante desde MidiManager para su visualización diagnóstica.
	 */
	recordMessage(msg) {
		if (!this.enabled || !msg) return;

		const channelRole =
			msg.channel === MIDI_CHANNELS.p5js
				? "p5.js"
				: msg.channel === MIDI_CHANNELS.touchDesigner
					? "TouchDesigner"
					: "Otro";

		const enriched = {
			...msg,
			channelRole,
			formattedTime: new Date().toLocaleTimeString("es-AR", {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			}),
		};

		this.lastMessage = enriched;
		this.history.unshift(enriched);
		if (this.history.length > this.maxHistory) {
			this.history.length = this.maxHistory;
		}

		// Registrar control único detectado para facilitar la configuración posterior
		const controlType = msg.type === "cc" ? "cc" : "note";
		const key = `${msg.deviceName}|ch${msg.channel}|${controlType}|${msg.number}`;
		const prev = this.discoveredControls.get(key);

		this.discoveredControls.set(key, {
			device: msg.deviceName,
			type: controlType,
			number: msg.number,
			noteIdentifier: msg.noteIdentifier || null,
			channel: msg.channel,
			channelRole,
			minObserved: prev
				? Math.min(prev.minObserved, msg.rawValue)
				: msg.rawValue,
			maxObserved: prev
				? Math.max(prev.maxObserved, msg.rawValue)
				: msg.rawValue,
			lastValue: msg.rawValue,
			lastNoteState: msg.noteState,
			hitCount: prev ? prev.hitCount + 1 : 1,
		});

		this._scheduleNotify();
	}

	clear() {
		this.lastMessage = null;
		this.history = [];
		this.discoveredControls.clear();
		this._scheduleNotify();
	}

	/**
	 * Genera una plantilla JSON con todos los controles detectados en la sesión
	 * lista para copiar y pegar dentro de `midiConfig.js`.
	 */
	exportDiscoveredAsConfigTemplate() {
		const entries = Array.from(this.discoveredControls.values());
		const template = entries.map((ctrl, idx) => ({
			id: `ctrl_${idx + 1}_${ctrl.type}_ch${ctrl.channel}_${ctrl.number}`,
			device: ctrl.device,
			type: ctrl.type,
			number: ctrl.number,
			channel: ctrl.channel,
			target:
				ctrl.type === "cc" ? "stepsPerFrame" : "nextCorner",
			min: 1,
			max: 18,
			behavior: ctrl.type === "cc" ? "absolute" : "momentary",
			_comment: `Detectado: ${ctrl.type.toUpperCase()} #${ctrl.number}${ctrl.noteIdentifier ? ` (${ctrl.noteIdentifier})` : ""} | Canal ${ctrl.channel} (${ctrl.channelRole}) | Rango visto: [${ctrl.minObserved}..${ctrl.maxObserved}]`,
		}));

		return JSON.stringify(template, null, 2);
	}

	getSnapshot() {
		return {
			enabled: this.enabled,
			lastMessage: this.lastMessage,
			history: this.history,
			discoveredCount: this.discoveredControls.size,
			discoveredControls: Array.from(this.discoveredControls.values()),
		};
	}

	/**
	 * Agrupa las actualizaciones de UI con requestAnimationFrame para no penalizar
	 * los 60 FPS del canvas cuando se giran múltiples perillas simultáneamente.
	 */
	_scheduleNotify() {
		if (this._rafPending) return;
		this._rafPending = true;

		const flush = () => {
			this._rafPending = false;
			const snapshot = this.getSnapshot();
			for (const cb of this._listeners) {
				cb(snapshot);
			}
		};

		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(flush);
		} else {
			setTimeout(flush, 16);
		}
	}

	onUpdate(callback) {
		this._listeners.add(callback);
		return () => this._listeners.delete(callback);
	}
}
