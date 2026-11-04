/**
 * UIPanel - Interfaz flotante ocultable ([H]) para controlar en tiempo real
 * los parámetros de la rama principal (Gen 0), sub-ramas (Gen 1+),
 * superposición espacial, límite de ramas visibles, modo infinito y WebMIDI.
 *
 * Construye todas las secciones de sliders y checkboxes de forma declarativa
 * a partir de window.PARAM_SCHEMA y window.UI_SECTIONS (js/config.js).
 */
class UIPanel {
	constructor(config, callbacks) {
		this.config = config;
		this.callbacks = callbacks;
		this.isVisible = true;
		this.container = null;
		this.badgeEl = null;
		this.cornerEl = null;
		this.statsEl = null;
		this.btnTV = null;
		this.btnFullScreen = null;
		this.isTVConnected = false;

		this.sliders = new Map();
		this.checkboxes = new Map();
		this.perfButtons = {};

		this.buildDOM();
	}

	buildDOM() {
		this.container = document.createElement("aside");
		this.container.className = "ui-panel";

		const stopProp = (e) => e.stopPropagation();
		this.container.addEventListener("mousedown", stopProp);
		this.container.addEventListener("pointerdown", stopProp);
		this.container.addEventListener("wheel", stopProp);

		// Cabecera
		const header = document.createElement("div");
		header.className = "ui-header";

		const title = document.createElement("span");
		title.className = "ui-title";
		title.textContent = "LICHTENBERG // CONTROLES";

		const hideBtn = document.createElement("button");
		hideBtn.className = "ui-hide-btn";
		hideBtn.textContent = "[H] Ocultar";
		hideBtn.addEventListener("click", () => this.toggle());

		header.appendChild(title);
		header.appendChild(hideBtn);
		this.container.appendChild(header);

		// Telemetría
		const telemetry = document.createElement("div");
		telemetry.className = "ui-telemetry";

		const topRow = document.createElement("div");
		topRow.className = "ui-telemetry-row ui-telemetry-top";

		this.badgeEl = document.createElement("span");
		this.badgeEl.className = "ui-telemetry-badge";

		this.cornerEl = document.createElement("span");
		this.cornerEl.className = "ui-telemetry-corner";

		topRow.appendChild(this.badgeEl);
		topRow.appendChild(this.cornerEl);

		this.statsEl = document.createElement("div");
		this.statsEl.className = "ui-telemetry-row ui-stats-line";

		telemetry.appendChild(topRow);
		telemetry.appendChild(this.statsEl);
		this.container.appendChild(telemetry);

		// Botones principales de acción
		const actionsRow = document.createElement("div");
		actionsRow.className = "ui-actions";

		const btnReset = this.createButton("Reiniciar [R]", () =>
			this.callbacks.onReset?.(),
		);
		const btnNext = this.createButton("Sig. Esquina [SPACE]", () =>
			this.callbacks.onNextCorner?.(),
		);
		this.btnTV = this.createButton("Salida CRT [P]", () =>
			this.callbacks.onToggleTV?.(),
		);
		this.btnTV.classList.add("tv-btn");

		this.btnFullScreen = this.createButton("Pantalla Completa [F]", () =>
			this.callbacks.onToggleFullScreen?.(),
		);

		actionsRow.appendChild(btnReset);
		actionsRow.appendChild(btnNext);
		actionsRow.appendChild(this.btnTV);
		actionsRow.appendChild(this.btnFullScreen);
		this.container.appendChild(actionsRow);

		// SECCIÓN PERFORMÁTICA: Acciones Rápidas [1] al [6]
		this.buildPerformativeSection();

		// SECCIÓN MIDI: Controlador WebMidi.js y Modo Diagnóstico
		this.buildMidiSection();

		// SECCIONES 0 a 3: Construidas declarativamente desde PARAM_SCHEMA
		this.buildSchemaSections();

		document.body.appendChild(this.container);
		this.syncCheckboxes();
	}

	buildPerformativeSection() {
		const secPerf = this.createSection("⚡ Acciones Performáticas [1–6]");
		const perfGrid = document.createElement("div");
		perfGrid.className = "ui-perf-grid";

		const perfActions = [
			{
				num: 1,
				label: "[1] ⚡ Ráfaga x2",
				action: () => this.callbacks.onBurst?.(2, 1),
			},
			{
				num: 2,
				label: "[2] ⚡⚡ Ráfaga x3",
				action: () => this.callbacks.onBurst?.(3, 2),
			},
			{
				num: 3,
				label: "[3] ⚡⚡⚡ Ráfaga x4",
				action: () => this.callbacks.onBurst?.(4, 3),
			},
			{
				num: 4,
				label: "[4] 💥 Floración",
				action: () => this.callbacks.onBloom?.(),
			},
			{
				num: 5,
				label: "[5] 🌪️ Sacudida Eléc.",
				action: () => this.callbacks.onElectricShock?.(),
			},
			{
				num: 6,
				label: "[6] 🔄 Sim. Auto (2-4)",
				action: () => this.callbacks.onToggleSimultaneous?.(),
			},
		];

		for (const item of perfActions) {
			const btn = document.createElement("button");
			btn.className = "ui-btn ui-perf-btn";
			btn.textContent = item.label;
			btn.addEventListener("click", item.action);
			this.perfButtons[item.num] = btn;
			perfGrid.appendChild(btn);
		}

		secPerf.appendChild(perfGrid);
		this.container.appendChild(secPerf);
	}

	/**
	 * Genera las secciones 0, 1, 2 y 3 iterando sobre window.UI_SECTIONS y window.PARAM_SCHEMA.
	 */
	buildSchemaSections() {
		const sectionsMeta = window.UI_SECTIONS || {};
		const schema = window.PARAM_SCHEMA || {};
		const presets = window.CANVAS_PRESETS || [];

		const sectionElements = {};
		for (const [secKey, secTitle] of Object.entries(sectionsMeta)) {
			sectionElements[secKey] = this.createSection(secTitle);
		}

		for (const [key, meta] of Object.entries(schema)) {
			const parentSec = sectionElements[meta.section];
			if (!parentSec) continue;

			if (meta.kind === "param") {
				const isDimension = key === "canvasWidth" || key === "canvasHeight";
				this.addSlider(parentSec, {
					label: meta.label,
					key,
					min: meta.min,
					max: meta.max,
					step: meta.step,
					format: meta.format || ((v) => String(v)),
					onChange: isDimension
						? () => this.callbacks.onResizeCanvas?.()
						: undefined,
				});

				// Insertar fila de presets justo después de canvasHeight en la sección 0
				if (key === "canvasHeight" && presets.length > 0) {
					const presetRow = document.createElement("div");
					presetRow.className = "ui-presets-row";
					for (const p of presets) {
						const btn = document.createElement("button");
						btn.className = "ui-preset-btn";
						btn.textContent = p.label;
						btn.addEventListener("click", () => this.setDimensions(p.w, p.h));
						presetRow.appendChild(btn);
					}
					parentSec.appendChild(presetRow);
				}
			} else if (meta.kind === "boolean") {
				let onChange;
				if (key === "simultaneousMode") {
					onChange = (checked) => {
						this.syncCheckboxes();
						if (checked) {
							this.callbacks.onSimultaneousEnabled?.();
						}
					};
				} else if (key === "fullScreen") {
					onChange = (checked) => {
						this.callbacks.onToggleFullScreen?.(checked);
					};
				}

				this.addCheckbox(parentSec, {
					label: meta.label,
					key,
					onChange,
				});
			}
		}

		for (const secEl of Object.values(sectionElements)) {
			this.container.appendChild(secEl);
		}
	}

	createSection(titleText) {
		const sec = document.createElement("div");
		sec.className = "ui-section";
		const h = document.createElement("div");
		h.className = "ui-section-title";
		h.textContent = titleText;
		sec.appendChild(h);
		return sec;
	}

	createButton(label, onClick) {
		const btn = document.createElement("button");
		btn.className = "ui-btn";
		btn.textContent = label;
		btn.addEventListener("click", onClick);
		return btn;
	}

	addSlider(parent, { label, key, min, max, step, format, onChange }) {
		const row = document.createElement("div");
		row.className = "ui-control-row";

		const topLine = document.createElement("div");
		topLine.className = "ui-label-line";

		const nameSpan = document.createElement("span");
		nameSpan.textContent = label;

		const valSpan = document.createElement("span");
		valSpan.className = "ui-val";
		valSpan.textContent = format(this.config[key]);

		topLine.appendChild(nameSpan);
		topLine.appendChild(valSpan);

		const input = document.createElement("input");
		input.type = "range";
		input.className = "ui-slider";
		input.min = min;
		input.max = max;
		input.step = step;
		input.value = this.config[key];

		this.sliders.set(key, { input, valSpan, format });

		input.addEventListener("input", () => {
			const num = Number.parseFloat(input.value);
			this.config[key] = num;
			valSpan.textContent = format(num);
			onChange?.(num);
			this.callbacks.onParamChange?.(key, num);
		});

		row.appendChild(topLine);
		row.appendChild(input);
		parent.appendChild(row);
	}

	updateSlider(key, val) {
		const sliderRef = this.sliders.get(key);
		if (sliderRef) {
			sliderRef.input.value = val;
			sliderRef.valSpan.textContent = sliderRef.format(val);
		}
	}

	setDimensions(w, h) {
		this.config.canvasWidth = w;
		this.config.canvasHeight = h;
		this.updateSlider("canvasWidth", w);
		this.updateSlider("canvasHeight", h);
		if (this.btnFullScreen && !this.config.fullScreen) {
			this.btnFullScreen.textContent = "Pantalla Completa [F]";
		}
		this.callbacks.onParamChange?.("canvasWidth", w);
		this.callbacks.onParamChange?.("canvasHeight", h);
		this.callbacks.onResizeCanvas?.();
	}

	addCheckbox(parent, { label, key, onChange }) {
		const row = document.createElement("label");
		row.className = "ui-checkbox-row";

		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = Boolean(this.config[key]);
		input.addEventListener("change", () => {
			this.config[key] = input.checked;
			onChange?.(input.checked);
			this.callbacks.onParamChange?.(key, input.checked);
		});

		this.checkboxes.set(key, input);

		const text = document.createElement("span");
		text.textContent = label;

		row.appendChild(input);
		row.appendChild(text);
		parent.appendChild(row);
	}

	syncCheckboxes() {
		for (const [key, input] of this.checkboxes.entries()) {
			input.checked = Boolean(this.config[key]);
		}

		if (this.perfButtons[6]) {
			const isSim = Boolean(this.config.simultaneousMode);
			this.perfButtons[6].classList.toggle("active", isSim);
			this.perfButtons[6].textContent = isSim
				? "[6] 🔄 Sim. Auto: ON"
				: "[6] 🔄 Sim. Auto (2-4)";
		}

		if (this.btnFullScreen) {
			const isFS = Boolean(this.config.fullScreen);
			this.btnFullScreen.classList.toggle("active", isFS);
			this.btnFullScreen.textContent = isFS
				? `Ventana ${this.config.canvasWidth}x${this.config.canvasHeight} [F]`
				: "Pantalla Completa [F]";
		}
	}

	setPerformativeBtnState(num, isHeld) {
		const btn = this.perfButtons?.[num];
		if (!btn) return;

		if (isHeld) {
			if (btn._flashTimeout) clearTimeout(btn._flashTimeout);
			btn.classList.add("perf-flash");
		} else {
			btn.classList.remove("perf-flash");
		}
	}

	/**
	 * Ilumina brevemente un botón performático ([1] a [5]) cuando se dispara por teclado o clic.
	 */
	flashPerformativeBtn(num, durationMs = 280) {
		const btn = this.perfButtons?.[num];
		if (!btn) return;

		btn.classList.add("perf-flash");
		if (btn._flashTimeout) {
			clearTimeout(btn._flashTimeout);
		}
		btn._flashTimeout = setTimeout(() => {
			btn.classList.remove("perf-flash");
		}, durationMs);
	}

	toggle() {
		this.isVisible = !this.isVisible;
		this.container.classList.toggle("hidden", !this.isVisible);
	}

	setTVConnected(connected) {
		this.isTVConnected = connected;
		if (this.btnTV) {
			this.btnTV.classList.toggle("tv-active", connected);
			this.btnTV.textContent = connected
				? "🟢 CRT Conectada"
				: "Salida CRT [P]";
		}
	}

	_applyTelemetryDOM(badgeText, statusType, cornerText, statsText) {
		if (this.badgeEl.textContent !== badgeText) {
			this.badgeEl.textContent = badgeText;
		}
		if (this.badgeEl.dataset.status !== statusType) {
			this.badgeEl.dataset.status = statusType;
		}
		if (this.cornerEl.textContent !== cornerText) {
			this.cornerEl.textContent = cornerText;
		}
		if (this.statsEl.textContent !== statsText) {
			this.statsEl.textContent = statsText;
		}
	}

	updateTVTelemetry(tvData) {
		if (!this.isVisible || !this.isTVConnected || !tvData?.info) {
			return;
		}
		const { info, activeCount, fps } = tvData;
		const visText =
			info.visibleCount !== undefined
				? `Visibles: ${info.visibleCount}/${info.maxVis} | `
				: "";
		this._applyTelemetryDOM(
			`[TV] ${info.statusBadge}`,
			info.statusType,
			info.cornerText,
			`${visText}Puntas: ${activeCount} | TV FPS: ${fps}`,
		);
	}

	updateTelemetry(telemetryInfo, activeCount, fps, seed) {
		if (!this.isVisible || this.isTVConnected || !telemetryInfo) {
			return;
		}

		if (typeof telemetryInfo === "string") {
			this._applyTelemetryDOM(
				telemetryInfo,
				"growing",
				"",
				`Puntas: ${activeCount} | FPS: ${Math.round(fps)} | Seed: ${seed}`,
			);
			return;
		}

		const visText =
			telemetryInfo.visibleCount !== undefined
				? `Visibles: ${telemetryInfo.visibleCount}/${telemetryInfo.maxVis} | `
				: "";
		this._applyTelemetryDOM(
			telemetryInfo.statusBadge,
			telemetryInfo.statusType,
			telemetryInfo.cornerText,
			`${visText}Puntas: ${activeCount} | FPS: ${Math.round(fps)}`,
		);
	}

	/**
	 * Construye la sección de interfaz para control MIDI y diagnóstico en vivo.
	 */
	buildMidiSection() {
		this.midiSectionEl = this.createSection("🎹 Control MIDI // WebMidi.js");

		// 1. Fila de estado de conexión y toggle de recepción
		const statusRow = document.createElement("div");
		statusRow.className = "ui-midi-status-row";

		this.midiStatusBadge = document.createElement("span");
		this.midiStatusBadge.className = "ui-midi-badge";
		this.midiStatusBadge.dataset.state = "init";
		this.midiStatusBadge.textContent = "INICIANDO MIDI...";

		const receptionLabel = document.createElement("label");
		receptionLabel.className = "ui-midi-toggle-inline";

		this.midiReceptionCheckbox = document.createElement("input");
		this.midiReceptionCheckbox.type = "checkbox";
		this.midiReceptionCheckbox.checked = true;

		const receptionSpan = document.createElement("span");
		receptionSpan.textContent = "Recepción ON";
		this.midiReceptionSpan = receptionSpan;

		receptionLabel.appendChild(this.midiReceptionCheckbox);
		receptionLabel.appendChild(receptionSpan);

		statusRow.appendChild(this.midiStatusBadge);
		statusRow.appendChild(receptionLabel);
		this.midiSectionEl.appendChild(statusRow);

		// Mensaje de error/advertencia si el navegador o contexto no soporta WebMIDI
		this.midiErrorEl = document.createElement("div");
		this.midiErrorEl.className = "ui-midi-error hidden";
		this.midiSectionEl.appendChild(this.midiErrorEl);

		// 2. Selector de Dispositivo de Entrada MIDI
		const devGroup = document.createElement("div");
		devGroup.className = "ui-control-row";
		const devLabel = document.createElement("div");
		devLabel.className = "ui-label-line";
		devLabel.innerHTML = "<span>Entrada MIDI</span>";

		this.midiInputSelect = document.createElement("select");
		this.midiInputSelect.className = "ui-select";
		const emptyOpt = document.createElement("option");
		emptyOpt.value = "";
		emptyOpt.textContent = "— Sin dispositivos MIDI detectados —";
		this.midiInputSelect.appendChild(emptyOpt);

		devGroup.appendChild(devLabel);
		devGroup.appendChild(this.midiInputSelect);
		this.midiSectionEl.appendChild(devGroup);

		// 3. Selector de Perfil de Controlador (KeyLab Essential 49 vs MiniLab MK2)
		const profGroup = document.createElement("div");
		profGroup.className = "ui-control-row";
		const profLabel = document.createElement("div");
		profLabel.className = "ui-label-line";
		profLabel.innerHTML = "<span>Perfil de Controlador</span>";

		this.midiProfileSelect = document.createElement("select");
		this.midiProfileSelect.className = "ui-select";

		profGroup.appendChild(profLabel);
		profGroup.appendChild(this.midiProfileSelect);
		this.midiSectionEl.appendChild(profGroup);

		// 4. Selector de Canal MIDI (Canal 1: p5.js | Canal 2: TouchDesigner)
		const chanGroup = document.createElement("div");
		chanGroup.className = "ui-control-row";
		const chanLabel = document.createElement("div");
		chanLabel.className = "ui-label-line";
		chanLabel.innerHTML =
			"<span>Canal p5.js</span><span class='ui-midi-chan-hint'>CH1: p5.js | CH2: TD</span>";

		this.midiChannelSelect = document.createElement("select");
		this.midiChannelSelect.className = "ui-select";
		for (let ch = 1; ch <= 16; ch++) {
			const opt = document.createElement("option");
			opt.value = String(ch);
			if (ch === 1) {
				opt.textContent = "Canal 1 — p5.js (Exclusivo)";
			} else if (ch === 2) {
				opt.textContent = "Canal 2 — (Reservado TouchDesigner)";
			} else {
				opt.textContent = `Canal ${ch}`;
			}
			this.midiChannelSelect.appendChild(opt);
		}

		chanGroup.appendChild(chanLabel);
		chanGroup.appendChild(this.midiChannelSelect);
		this.midiSectionEl.appendChild(chanGroup);

		// 5. Controles de Modo Diagnóstico
		const diagToggleRow = document.createElement("label");
		diagToggleRow.className = "ui-checkbox-row";
		this.midiDiagCheckbox = document.createElement("input");
		this.midiDiagCheckbox.type = "checkbox";
		this.midiDiagCheckbox.checked = true;
		const diagToggleText = document.createElement("span");
		diagToggleText.textContent = "Modo Diagnóstico MIDI (Monitor en vivo)";
		diagToggleRow.appendChild(this.midiDiagCheckbox);
		diagToggleRow.appendChild(diagToggleText);
		this.midiSectionEl.appendChild(diagToggleRow);

		const inspectAllRow = document.createElement("label");
		inspectAllRow.className = "ui-checkbox-row";
		this.midiInspectAllCheckbox = document.createElement("input");
		this.midiInspectAllCheckbox.type = "checkbox";
		this.midiInspectAllCheckbox.checked = true;
		const inspectAllText = document.createElement("span");
		inspectAllText.textContent = "Diagnóstico: inspeccionar todos los canales";
		inspectAllRow.appendChild(this.midiInspectAllCheckbox);
		inspectAllRow.appendChild(inspectAllText);
		this.midiSectionEl.appendChild(inspectAllRow);

		// 6. Monitor de Diagnóstico (Tarjeta de último mensaje + historial + exportar)
		this.midiDiagContainer = document.createElement("div");
		this.midiDiagContainer.className = "ui-midi-diag-box";

		this.midiLastMsgEl = document.createElement("div");
		this.midiLastMsgEl.className = "ui-midi-last-msg";
		this.midiLastMsgEl.innerHTML = `
      <div class="ui-midi-empty">Esperando mensajes MIDI (CC / Note On / Note Off)...</div>
    `;

		this.midiHistoryEl = document.createElement("div");
		this.midiHistoryEl.className = "ui-midi-history";

		const diagBtns = document.createElement("div");
		diagBtns.className = "ui-midi-diag-actions";

		this.midiClearBtn = document.createElement("button");
		this.midiClearBtn.className = "ui-btn";
		this.midiClearBtn.textContent = "Limpiar Log";

		this.midiCopyBtn = document.createElement("button");
		this.midiCopyBtn.className = "ui-btn";
		this.midiCopyBtn.textContent = "Copiar Plantilla (0)";

		diagBtns.appendChild(this.midiClearBtn);
		diagBtns.appendChild(this.midiCopyBtn);

		this.midiDiagContainer.appendChild(this.midiLastMsgEl);
		this.midiDiagContainer.appendChild(this.midiHistoryEl);
		this.midiDiagContainer.appendChild(diagBtns);

		this.midiSectionEl.appendChild(this.midiDiagContainer);
		this.container.appendChild(this.midiSectionEl);
	}

	/**
	 * Vincula el sistema MIDI (MidiControllerSystem) con los controles del UIPanel.
	 */
	attachMidiSystem(midiSystem) {
		this.midiSystem = midiSystem;
		if (!midiSystem) return;

		const profiles = midiSystem.mapping.getProfiles();
		this.midiProfileSelect.innerHTML = "";
		for (const prof of profiles) {
			const opt = document.createElement("option");
			opt.value = prof.id;
			const roleTag = prof.role === "development" ? "Desarrollo" : "Performance";
			opt.textContent = `${prof.name} (${roleTag})`;
			this.midiProfileSelect.appendChild(opt);
		}
		this.midiProfileSelect.value = midiSystem.mapping.activeProfileId;

		this.midiReceptionCheckbox.addEventListener("change", () => {
			const enabled = this.midiReceptionCheckbox.checked;
			this.midiReceptionSpan.textContent = enabled
				? "Recepción ON"
				: "Recepción OFF";
			midiSystem.manager.setReceptionEnabled(enabled);
		});

		this.midiInputSelect.addEventListener("change", () => {
			midiSystem.manager.selectInput(this.midiInputSelect.value);
		});

		this.midiProfileSelect.addEventListener("change", () => {
			midiSystem.mapping.setActiveProfile(this.midiProfileSelect.value);
		});

		this.midiChannelSelect.addEventListener("change", () => {
			midiSystem.manager.setActiveChannel(
				Number.parseInt(this.midiChannelSelect.value, 10),
			);
		});

		this.midiDiagCheckbox.addEventListener("change", () => {
			const enabled = this.midiDiagCheckbox.checked;
			midiSystem.debug.setEnabled(enabled);
			this.midiDiagContainer.classList.toggle("hidden", !enabled);
		});

		this.midiInspectAllCheckbox.addEventListener("change", () => {
			midiSystem.manager.setInspectAllChannelsInDebug(
				this.midiInspectAllCheckbox.checked,
			);
		});

		this.midiClearBtn.addEventListener("click", () => {
			midiSystem.debug.clear();
		});

		this.midiCopyBtn.addEventListener("click", () => {
			const jsonTemplate = midiSystem.debug.exportDiscoveredAsConfigTemplate();
			if (navigator.clipboard?.writeText) {
				navigator.clipboard.writeText(jsonTemplate).then(() => {
					const prev = this.midiCopyBtn.textContent;
					this.midiCopyBtn.textContent = "✓ Copiado al portapapeles";
					setTimeout(() => {
						this.midiCopyBtn.textContent = prev;
					}, 1400);
				});
			}
			console.info(
				"[MIDI Diagnóstico] Plantilla de controles detectados:\n",
				jsonTemplate,
			);
		});

		midiSystem.manager.onStatusChange((status) => {
			this._renderMidiStatus(status);
		});

		midiSystem.debug.onUpdate((snapshot) => {
			this._renderMidiDiagnostic(snapshot);
		});

		this._renderMidiStatus(midiSystem.manager.getStatus());
		this._renderMidiDiagnostic(midiSystem.debug.getSnapshot());
	}

	_renderMidiStatus(status) {
		if (!status) return;

		this.midiReceptionCheckbox.checked = Boolean(status.receptionEnabled);
		this.midiReceptionSpan.textContent = status.receptionEnabled
			? "Recepción ON"
			: "Recepción OFF";
		this.midiChannelSelect.value = String(status.activeChannel);
		this.midiInspectAllCheckbox.checked = Boolean(
			status.inspectAllChannelsInDebug,
		);

		if (this.midiSystem) {
			this.midiProfileSelect.value = this.midiSystem.mapping.activeProfileId;
		}

		if (status.errorMessage) {
			this.midiErrorEl.textContent = status.errorMessage;
			this.midiErrorEl.classList.remove("hidden");
		} else {
			this.midiErrorEl.classList.add("hidden");
		}

		if (!status.isSupported && status.errorMessage) {
			this.midiStatusBadge.dataset.state = "error";
			this.midiStatusBadge.textContent = "🔴 SIN SOPORTE";
		} else if (!status.receptionEnabled) {
			this.midiStatusBadge.dataset.state = "paused";
			this.midiStatusBadge.textContent = "⚪ PAUSADO";
		} else if (status.activeInput) {
			this.midiStatusBadge.dataset.state = "connected";
			this.midiStatusBadge.textContent = "🟢 CONECTADO";
		} else {
			this.midiStatusBadge.dataset.state = "waiting";
			this.midiStatusBadge.textContent = "🟡 SIN DISPOSITIVO";
		}

		this.midiInputSelect.innerHTML = "";
		if (!status.inputs || status.inputs.length === 0) {
			const opt = document.createElement("option");
			opt.value = "";
			opt.textContent = "— Sin entradas MIDI conectadas —";
			this.midiInputSelect.appendChild(opt);
		} else {
			for (const inp of status.inputs) {
				const opt = document.createElement("option");
				opt.value = inp.id;
				opt.textContent = inp.name;
				this.midiInputSelect.appendChild(opt);
			}
			if (status.activeInput) {
				this.midiInputSelect.value = status.activeInput.id;
			}
		}
	}

	_renderMidiDiagnostic(snapshot) {
		if (!snapshot) return;

		this.midiCopyBtn.textContent = `Copiar Plantilla (${snapshot.discoveredCount || 0})`;

		const msg = snapshot.lastMessage;
		if (!msg) {
			this.midiLastMsgEl.innerHTML = `
        <div class="ui-midi-empty">Esperando mensajes MIDI (CC / Note On / Note Off)...</div>
      `;
			this.midiHistoryEl.innerHTML = "";
			return;
		}

		const pct = Math.round(
			Math.max(0, Math.min(100, (msg.rawValue / 127) * 100)),
		);
		const numberText =
			msg.type === "cc"
				? `CC #${msg.number}`
				: `Nota #${msg.number} (${msg.noteIdentifier || ""})`;
		const noteStateText = msg.noteState ? msg.noteState : "— (Continuo)";
		const chanBadgeClass = msg.matchesActiveChannel
			? "chan-p5"
			: msg.channel === 2
				? "chan-td"
				: "chan-other";
		const chanRoleText = msg.matchesActiveChannel
			? "p5.js Activo"
			: msg.channel === 2
				? "TouchDesigner (Ignorado en p5)"
				: "Ignorado en p5";

		this.midiLastMsgEl.innerHTML = `
      <div class="ui-midi-grid">
        <div><span class="k">Dispositivo:</span> <span class="v">${this._escapeHtml(msg.deviceName)}</span></div>
        <div><span class="k">Tipo:</span> <span class="v type-${msg.type}">${msg.messageLabel}</span></div>
        <div><span class="k">Número:</span> <span class="v">${numberText}</span></div>
        <div><span class="k">Canal MIDI:</span> <span class="v ${chanBadgeClass}">Canal ${msg.channel} (${chanRoleText})</span></div>
        <div><span class="k">Valor:</span> <span class="v">${msg.rawValue} / 127 (${msg.normalizedValue.toFixed(2)})</span></div>
        <div><span class="k">Estado Note:</span> <span class="v">${noteStateText}</span></div>
      </div>
      <div class="ui-midi-bar-bg"><div class="ui-midi-bar-fill" style="width:${pct}%"></div></div>
    `;

		this.midiHistoryEl.innerHTML = snapshot.history
			.map((item) => {
				const numLabel =
					item.type === "cc"
						? `CC#${item.number}`
						: `${item.noteIdentifier || `N#${item.number}`}`;
				const cClass = item.matchesActiveChannel
					? "chan-p5"
					: item.channel === 2
						? "chan-td"
						: "chan-other";
				return `<div class="ui-midi-hist-row">
          <span class="h-ch ${cClass}">CH${item.channel}</span>
          <span class="h-type">${item.messageLabel}</span>
          <span class="h-num">${numLabel}</span>
          <span class="h-val">val: ${item.rawValue}</span>
        </div>`;
			})
			.join("");
	}

	_escapeHtml(str) {
		return String(str || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}
}

window.UIPanel = UIPanel;
