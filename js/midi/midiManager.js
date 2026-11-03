/**
 * midiManager.js - Gestión de comunicación MIDI mediante WebMidi.js (local/offline).
 *
 * Responsabilidades:
 * - Inicializar WebMidi.js verificando soporte del navegador y contexto seguro.
 * - Detectar y listar dispositivos de entrada MIDI en tiempo real (hot-plug).
 * - Permitir seleccionar el dispositivo activo y activar/desactivar la recepción.
 * - Escuchar mensajes Control Change (CC), Note On y Note Off.
 * - Identificar y filtrar por canal MIDI (Canal 1: p5.js | Canal 2: TouchDesigner).
 * - Garantizar que ningún mensaje se procese múltiples veces (deduplicación estricta de listeners).
 */

import { WebMidi } from "webmidi";
import { MIDI_CHANNELS } from "./midiConfig.js";

export class MidiManager {
	constructor(options = {}) {
		this.activeChannel = options.channel ?? MIDI_CHANNELS.p5js;
		this.receptionEnabled = options.receptionEnabled ?? true;
		this.inspectAllChannelsInDebug = options.inspectAllChannelsInDebug ?? true;

		this.isSupported = false;
		this.isReady = false;
		this.errorMessage = null;

		this.activeInput = null;
		this.preferredInputName = null;
		this._attachedInput = null;

		// Referencias únicas de handlers enlazados para remover listeners con exactitud
		this._boundOnCC = (e) => this._handleControlChange(e);
		this._boundOnNoteOn = (e) => this._handleNoteOn(e);
		this._boundOnNoteOff = (e) => this._handleNoteOff(e);
		this._boundOnConnected = (e) => this._handlePortConnected(e);
		this._boundOnDisconnected = (e) => this._handlePortDisconnected(e);

		// Guardia contra eventos duplicados en el mismo tick de WebMIDI
		this._lastEventSignature = "";
		this._lastEventTimestamp = -1;

		// Subscriptores externos (desacoplados)
		this.messageListeners = new Set(); // Reciben solo mensajes válidos para el canal activo
		this.rawDiagnosticListeners = new Set(); // Reciben todos los mensajes para el monitor de diagnóstico
		this.statusListeners = new Set(); // Reciben cambios de conexión/lista de dispositivos
	}

	/**
	 * Inicializa el motor WebMidi.js.
	 */
	async init() {
		if (typeof window !== "undefined" && !window.isSecureContext) {
			this.errorMessage =
				"Web MIDI requiere contexto seguro (http://localhost o https://).";
			this._emitStatusChange();
			return false;
		}

		if (!WebMidi.supported) {
			this.errorMessage =
				"Este navegador no soporta Web MIDI API (usar Chrome/Edge/Brave).";
			this._emitStatusChange();
			return false;
		}

		this.isSupported = true;

		if (WebMidi.enabled) {
			this.isReady = true;
			this._bindGlobalWebMidiListeners();
			this._autoSelectInitialInput();
			this._emitStatusChange();
			return true;
		}

		try {
			await WebMidi.enable({ sysex: false });
			this.isReady = true;
			this.errorMessage = null;
			this._bindGlobalWebMidiListeners();
			this._autoSelectInitialInput();
			this._emitStatusChange();
			return true;
		} catch (err) {
			this.isReady = false;
			this.errorMessage = `Error al habilitar WebMidi: ${err?.message || err}`;
			this._emitStatusChange();
			return false;
		}
	}

	/**
	 * Registra los listeners globales de conexión/desconexión de hardware una única vez.
	 */
	_bindGlobalWebMidiListeners() {
		WebMidi.removeListener("connected", this._boundOnConnected);
		WebMidi.removeListener("disconnected", this._boundOnDisconnected);

		WebMidi.addListener("connected", this._boundOnConnected);
		WebMidi.addListener("disconnected", this._boundOnDisconnected);
	}

	/**
	 * Devuelve la lista de entradas MIDI disponibles actualmente.
	 */
	getInputs() {
		if (!this.isReady || !WebMidi.enabled) {
			return [];
		}
		return WebMidi.inputs.map((input) => ({
			id: input.id,
			name: input.name,
			manufacturer: input.manufacturer || "",
			state: input.state,
			connection: input.connection,
		}));
	}

	/**
	 * Selecciona una entrada MIDI por su ID (o desvincula si es vacío).
	 */
	selectInput(inputId) {
		this._detachInputListeners();

		if (!this.isReady || !inputId) {
			this.activeInput = null;
			this._emitStatusChange();
			return null;
		}

		const found =
			WebMidi.getInputById(inputId) ||
			WebMidi.inputs.find((inp) => inp.name === inputId) ||
			null;

		this.activeInput = found;
		if (found) {
			this.preferredInputName = found.name;
			this._attachInputListeners(found);
		}

		this._emitStatusChange();
		return this.activeInput;
	}

	/**
	 * Intenta seleccionar automáticamente un controlador Arturia conocido o el primer puerto disponible.
	 */
	_autoSelectInitialInput() {
		const inputs = WebMidi.inputs;
		if (!inputs || inputs.length === 0) {
			this._detachInputListeners();
			this.activeInput = null;
			return;
		}

		// Si ya teníamos un dispositivo preferido (ej. reconexión en vivo), priorizarlo
		if (this.preferredInputName) {
			const preferred = inputs.find(
				(inp) => inp.name === this.preferredInputName,
			);
			if (preferred) {
				this.selectInput(preferred.id);
				return;
			}
		}

		// Priorizar controladores Arturia (KeyLab Essential / MiniLab MK2)
		const arturiaInput = inputs.find((inp) =>
			/arturia|keylab|minilab/i.test(inp.name),
		);
		if (arturiaInput) {
			this.selectInput(arturiaInput.id);
			return;
		}

		// De lo contrario, seleccionar la primera entrada disponible
		this.selectInput(inputs[0].id);
	}

	/**
	 * Vincula listeners de CC, Note On y Note Off al puerto activo,
	 * asegurando primero la limpieza total de cualquier listener previo.
	 */
	_attachInputListeners(input) {
		if (!input) return;

		this._detachInputListeners();

		input.addListener("controlchange", this._boundOnCC);
		input.addListener("noteon", this._boundOnNoteOn);
		input.addListener("noteoff", this._boundOnNoteOff);
		this._attachedInput = input;
	}

	/**
	 * Elimina cualquier listener previamente registrado en el puerto de entrada
	 * para evitar procesamiento duplicado de un mismo mensaje MIDI.
	 */
	_detachInputListeners() {
		if (!this._attachedInput) return;

		try {
			this._attachedInput.removeListener("controlchange", this._boundOnCC);
			this._attachedInput.removeListener("noteon", this._boundOnNoteOn);
			this._attachedInput.removeListener("noteoff", this._boundOnNoteOff);
		} catch (_) {
			// El puerto puede haber sido cerrado por el SO tras desconexión física
		}

		this._attachedInput = null;
	}

	_handlePortConnected(event) {
		if (!event || event.port?.type !== "input") return;

		// Si no hay entrada activa, o si se reconectó el dispositivo preferido, revincular
		if (
			!this.activeInput ||
			(this.preferredInputName && event.port.name === this.preferredInputName)
		) {
			this.selectInput(event.port.id);
		} else {
			this._emitStatusChange();
		}
	}

	_handlePortDisconnected(event) {
		if (!event || event.port?.type !== "input") return;

		if (this.activeInput && event.port.id === this.activeInput.id) {
			this._detachInputListeners();
			this.activeInput = null;
			// Si queda otro puerto disponible, intentar re-evaluar
			if (WebMidi.inputs.length > 0) {
				this._autoSelectInitialInput();
			}
		}

		this._emitStatusChange();
	}

	/**
	 * Activa o desactiva la recepción de mensajes MIDI en vivo.
	 */
	setReceptionEnabled(enabled) {
		this.receptionEnabled = Boolean(enabled);
		this._emitStatusChange();
	}

	/**
	 * Define el canal MIDI objetivo para p5.js (1 a 16).
	 * Por defecto Canal 1 (p5.js), dejando Canal 2 libre para TouchDesigner.
	 */
	setActiveChannel(channelNumber) {
		const ch = Number.parseInt(channelNumber, 10);
		if (Number.isFinite(ch) && ch >= MIDI_CHANNELS.min && ch <= MIDI_CHANNELS.max) {
			this.activeChannel = ch;
			this._emitStatusChange();
		}
	}

	/**
	 * Permite que el panel de diagnóstico inspeccione mensajes de cualquier canal
	 * (marcando visualmente si pertenecen al canal de p5.js o al de TouchDesigner)
	 * sin que afecten los parámetros del sketch.
	 */
	setInspectAllChannelsInDebug(inspectAll) {
		this.inspectAllChannelsInDebug = Boolean(inspectAll);
		this._emitStatusChange();
	}

	/**
	 * Verifica que un mismo evento MIDI crudo no sea despachado dos veces.
	 */
	_isDuplicateEvent(e) {
		const dataBytes = e.message?.data ? Array.from(e.message.data).join(",") : "";
		const sig = `${e.type}:${e.message?.channel}:${dataBytes}`;
		const ts = typeof e.timestamp === "number" ? e.timestamp : performance.now();

		if (
			sig === this._lastEventSignature &&
			Math.abs(ts - this._lastEventTimestamp) < 0.05
		) {
			return true;
		}

		this._lastEventSignature = sig;
		this._lastEventTimestamp = ts;
		return false;
	}

	_handleControlChange(e) {
		if (!this.receptionEnabled || !this.activeInput) return;
		if (this._isDuplicateEvent(e)) return;

		const channel = e.message?.channel ?? 1;
		const ccNumber = e.controller?.number ?? e.dataBytes?.[0] ?? 0;
		const rawValue =
			typeof e.rawValue === "number" ? e.rawValue : (e.dataBytes?.[1] ?? 0);
		const normalizedValue =
			typeof e.value === "number" ? e.value : rawValue / 127;

		const normalizedMsg = {
			timestamp: e.timestamp || performance.now(),
			deviceId: this.activeInput.id,
			deviceName: this.activeInput.name,
			type: "cc",
			messageLabel: "CC",
			number: ccNumber,
			noteIdentifier: null,
			channel,
			rawValue,
			normalizedValue,
			noteState: null,
			matchesActiveChannel: channel === this.activeChannel,
		};

		this._dispatchNormalizedMessage(normalizedMsg);
	}

	_handleNoteOn(e) {
		if (!this.receptionEnabled || !this.activeInput) return;
		if (this._isDuplicateEvent(e)) return;

		const channel = e.message?.channel ?? 1;
		const noteNumber = e.note?.number ?? e.dataBytes?.[0] ?? 0;
		const rawValue =
			typeof e.note?.rawAttack === "number"
				? e.note.rawAttack
				: typeof e.rawValue === "number"
					? e.rawValue
					: (e.dataBytes?.[1] ?? 127);
		const normalizedValue =
			typeof e.note?.attack === "number" ? e.note.attack : rawValue / 127;

		const normalizedMsg = {
			timestamp: e.timestamp || performance.now(),
			deviceId: this.activeInput.id,
			deviceName: this.activeInput.name,
			type: "noteon",
			messageLabel: "Note On",
			number: noteNumber,
			noteIdentifier: e.note?.identifier || `N${noteNumber}`,
			channel,
			rawValue,
			normalizedValue,
			noteState: "Note On",
			matchesActiveChannel: channel === this.activeChannel,
		};

		this._dispatchNormalizedMessage(normalizedMsg);
	}

	_handleNoteOff(e) {
		if (!this.receptionEnabled || !this.activeInput) return;
		if (this._isDuplicateEvent(e)) return;

		const channel = e.message?.channel ?? 1;
		const noteNumber = e.note?.number ?? e.dataBytes?.[0] ?? 0;
		const rawValue =
			typeof e.note?.rawRelease === "number"
				? e.note.rawRelease
				: typeof e.rawValue === "number"
					? e.rawValue
					: 0;
		const normalizedValue =
			typeof e.note?.release === "number" ? e.note.release : 0;

		const normalizedMsg = {
			timestamp: e.timestamp || performance.now(),
			deviceId: this.activeInput.id,
			deviceName: this.activeInput.name,
			type: "noteoff",
			messageLabel: "Note Off",
			number: noteNumber,
			noteIdentifier: e.note?.identifier || `N${noteNumber}`,
			channel,
			rawValue,
			normalizedValue,
			noteState: "Note Off",
			matchesActiveChannel: channel === this.activeChannel,
		};

		this._dispatchNormalizedMessage(normalizedMsg);
	}

	/**
	 * Envía el mensaje al monitor de diagnóstico y, únicamente si coincide con
	 * el canal MIDI asignado a p5.js (por defecto Canal 1), lo propaga al motor de mapeo.
	 */
	_dispatchNormalizedMessage(msg) {
		if (msg.matchesActiveChannel || this.inspectAllChannelsInDebug) {
			for (const cb of this.rawDiagnosticListeners) {
				cb(msg);
			}
		}

		// Filtrado estricto de canal para la lógica del sketch (p5.js escucha solo su canal)
		if (!msg.matchesActiveChannel) {
			return;
		}

		for (const cb of this.messageListeners) {
			cb(msg);
		}
	}

	getStatus() {
		return {
			isSupported: this.isSupported,
			isReady: this.isReady,
			receptionEnabled: this.receptionEnabled,
			activeChannel: this.activeChannel,
			inspectAllChannelsInDebug: this.inspectAllChannelsInDebug,
			errorMessage: this.errorMessage,
			inputs: this.getInputs(),
			activeInput: this.activeInput
				? {
						id: this.activeInput.id,
						name: this.activeInput.name,
						manufacturer: this.activeInput.manufacturer || "",
						state: this.activeInput.state,
					}
				: null,
		};
	}

	_emitStatusChange() {
		const status = this.getStatus();
		for (const cb of this.statusListeners) {
			cb(status);
		}
	}

	onMessage(callback) {
		this.messageListeners.add(callback);
		return () => this.messageListeners.delete(callback);
	}

	onDiagnosticMessage(callback) {
		this.rawDiagnosticListeners.add(callback);
		return () => this.rawDiagnosticListeners.delete(callback);
	}

	onStatusChange(callback) {
		this.statusListeners.add(callback);
		return () => this.statusListeners.delete(callback);
	}
}
