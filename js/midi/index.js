/**
 * js/midi/index.js - Orquestador del subsistema MIDI (WebMidi.js offline).
 *
 * Coordina MidiManager, MidiMappingEngine y MidiDebugMonitor manteniendo
 * una separación estricta respecto de la lógica visual de p5.js.
 */

import {
	CONTROLLER_PROFILES,
	DEFAULT_CONTROLLER_PROFILE_ID,
	MIDI_CHANNELS,
	SKETCH_TARGETS,
} from "./midiConfig.js";
import { MidiDebugMonitor } from "./midiDebug.js";
import { MidiManager } from "./midiManager.js";
import { MidiMappingEngine } from "./midiMapping.js";

export class MidiControllerSystem {
	constructor() {
		this.sketchAdapter = null;

		this.manager = new MidiManager({
			channel: MIDI_CHANNELS.p5js,
			receptionEnabled: true,
			inspectAllChannelsInDebug: true,
		});

		this.mapping = new MidiMappingEngine({
			getParamValue: (key) => this.sketchAdapter?.getParamValue?.(key),
			setParamValue: (key, val, meta) =>
				this.sketchAdapter?.setParamValue?.(key, val, meta),
			triggerAction: (actionKey, meta) =>
				this.sketchAdapter?.triggerAction?.(actionKey, meta),
		});

		this.debug = new MidiDebugMonitor({
			enabled: true,
			maxHistory: 8,
		});

		this._bindInternalPipeline();
	}

	_bindInternalPipeline() {
		// 1. Todos los mensajes pasan al monitor de diagnóstico cuando está activo
		this.manager.onDiagnosticMessage((msg) => {
			this.debug.recordMessage(msg);
		});

		// 2. Solo los mensajes del canal activo de p5.js (Canal 1 por defecto) van al motor de mapeo
		this.manager.onMessage((msg) => {
			this.mapping.processMessage(msg);
		});

		// 3. Auto-seleccionar perfil (KeyLab Essential 49 vs MiniLab MK2) al detectar hardware
		this.manager.onStatusChange((status) => {
			if (status.activeInput?.name) {
				const matchedProfileId = this.mapping.matchProfileByDeviceName(
					status.activeInput.name,
				);
				if (
					matchedProfileId &&
					matchedProfileId !== this.mapping.activeProfileId
				) {
					this.mapping.setActiveProfile(matchedProfileId);
				}
			}
		});
	}

	/**
	 * Conecta el adaptador del sketch de p5.js e inicializa WebMidi.js.
	 */
	async connectSketch(adapter) {
		this.sketchAdapter = adapter;

		if (adapter?.uiPanel && typeof adapter.uiPanel.attachMidiSystem === "function") {
			adapter.uiPanel.attachMidiSystem(this);
		}

		await this.manager.init();
	}

	getConfigMetadata() {
		return {
			channels: MIDI_CHANNELS,
			targets: SKETCH_TARGETS,
			profiles: CONTROLLER_PROFILES,
			defaultProfileId: DEFAULT_CONTROLLER_PROFILE_ID,
		};
	}
}

// Instancia global limpia para vincular con sketch.js sin acoplar módulos internos
const midiSystem = new MidiControllerSystem();
window.MidiSystem = midiSystem;

if (window.pendingSketchMidiAdapter) {
	midiSystem.connectSketch(window.pendingSketchMidiAdapter);
	delete window.pendingSketchMidiAdapter;
}

export default midiSystem;
