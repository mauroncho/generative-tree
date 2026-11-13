/**
 * UIPanel - Interfaz flotante compacta ocultable ([H]) orientada a performance en vivo.
 * Muestra el estado activo/pendiente ([Q]/[W]/[E]), las acciones performáticas ([1]-[6], [SPACE])
 * y un menú desplegable colapsado por defecto con botones de sistema, copiar parámetros (JSON)
 * y todos los controles editables de PARAM_SCHEMA.
 */
class UIPanel {
	constructor(config, callbacks) {
		this.config = config;
		this.callbacks = callbacks;
		this.isVisible = true;
		this.isParamsOpen = false;
		this.container = null;
		this.badgeEl = null;
		this.cornerEl = null;
		this.statsEl = null;
		this.btnFullScreen = null;
		this.btnCopyParams = null;
		this.drawerToggleBtn = null;
		this.drawerEl = null;
		this.stateStatusEl = null;
		this.stateButtons = {};
		this.activeStateId = "Q";
		this.pendingStateId = null;

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

		// Cabecera compacta
		const header = document.createElement("div");
		header.className = "ui-header";

		const title = document.createElement("span");
		title.className = "ui-title";
		title.textContent = "LICHTENBERG // LIVE";

		const hideBtn = document.createElement("button");
		hideBtn.className = "ui-hide-btn";
		hideBtn.textContent = "[H]";
		hideBtn.title = "Ocultar / Mostrar UI [H]";
		hideBtn.addEventListener("click", () => {
			hideBtn.blur();
			this.toggle();
		});

		header.appendChild(title);
		header.appendChild(hideBtn);
		this.container.appendChild(header);

		// Telemetría compacta
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

		// Bloque 1: Selector de Estado Performático [Q / W / E]
		this.buildStateSection();

		// Bloque 2: Acciones Performáticas [1–6] + [SPACE]
		this.buildPerformativeSection();

		// Bloque 3: Menú desplegable colapsado (Sistema, Copiar Params, Parámetros editables)
		this.buildCollapsibleDrawer();

		document.body.appendChild(this.container);
		this.setPerformanceState(this.activeStateId, this.pendingStateId);
		this.syncCheckboxes();
	}

	buildStateSection() {
		const sec = document.createElement("div");
		sec.className = "ui-section ui-section-tight";

		const titleRow = document.createElement("div");
		titleRow.className = "ui-section-header-row";

		const title = document.createElement("span");
		title.className = "ui-section-title";
		title.textContent = "Estado [Q / W / E]";

		this.stateStatusEl = document.createElement("span");
		this.stateStatusEl.className = "ui-state-status";
		this.stateStatusEl.textContent = "Activo: Q";

		titleRow.appendChild(title);
		titleRow.appendChild(this.stateStatusEl);
		sec.appendChild(titleRow);

		const stateGrid = document.createElement("div");
		stateGrid.className = "ui-state-grid";

		const states = window.PERFORMANCE_STATES || {
			Q: { id: "Q", key: "Q", label: "Estado Q", params: {} },
			W: { id: "W", key: "W", label: "Estado W", params: {} },
			E: { id: "E", key: "E", label: "Estado E", params: {} },
		};

		for (const id of ["Q", "W", "E"]) {
			const def = states[id] || {
				id,
				key: id,
				label: `Estado ${id}`,
				params: {},
			};
			const btn = document.createElement("button");
			btn.className = "ui-btn ui-state-btn";
			const hasParams = def.params && Object.keys(def.params).length > 0;
			btn.title = hasParams
				? `${def.label} (al iniciar próxima rama)`
				: `${def.label} (sin parámetros asignados aún)`;

			const keySpan = document.createElement("span");
			keySpan.className = "ui-state-key";
			keySpan.textContent = `[${def.key}]`;

			const tagSpan = document.createElement("span");
			tagSpan.className = "ui-state-tag";
			tagSpan.textContent = hasParams ? "LISTO" : "VACÍO";

			btn.appendChild(keySpan);
			btn.appendChild(tagSpan);

			btn.addEventListener("click", () => {
				btn.blur();
				this.callbacks.onSelectState?.(id);
			});

			this.stateButtons[id] = { btn, tagSpan };
			stateGrid.appendChild(btn);
		}

		sec.appendChild(stateGrid);
		this.container.appendChild(sec);
	}

	setPerformanceState(activeId, pendingId = null) {
		this.activeStateId = activeId || "Q";
		this.pendingStateId = pendingId || null;

		const states = window.PERFORMANCE_STATES || {};

		for (const id of ["Q", "W", "E"]) {
			const entry = this.stateButtons[id];
			if (!entry) continue;
			const { btn, tagSpan } = entry;
			const isActive = id === this.activeStateId;
			const isPending = id === this.pendingStateId;
			const def = states[id];
			const hasParams = Boolean(
				def?.params && Object.keys(def.params).length > 0,
			);

			btn.classList.toggle("state-active", isActive);
			btn.classList.toggle("state-pending", isPending);

			if (isPending) {
				tagSpan.textContent = "PRÓX.";
			} else if (isActive) {
				tagSpan.textContent = "ACTIVO";
			} else {
				tagSpan.textContent = hasParams ? "LISTO" : "VACÍO";
			}
		}

		if (this.stateStatusEl) {
			if (this.pendingStateId) {
				this.stateStatusEl.textContent = `${this.activeStateId} → ${this.pendingStateId} (próx. rama)`;
				this.stateStatusEl.classList.add("is-pending");
			} else {
				this.stateStatusEl.textContent = `Activo: ${this.activeStateId}`;
				this.stateStatusEl.classList.remove("is-pending");
			}
		}
	}

	buildPerformativeSection() {
		const secPerf = document.createElement("div");
		secPerf.className = "ui-section ui-section-tight";

		const h = document.createElement("div");
		h.className = "ui-section-title";
		h.textContent = "⚡ Acciones Performáticas";
		secPerf.appendChild(h);

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
				label: "[2] ⚡ Ráfaga x3",
				action: () => this.callbacks.onBurst?.(3, 2),
			},
			{
				num: 3,
				label: "[3] ⚡ Ráfaga x4",
				action: () => this.callbacks.onBurst?.(4, 3),
			},
			{
				num: 4,
				label: "[4] 💥 Floración",
				action: () => this.callbacks.onBloom?.(),
			},
			{
				num: 5,
				label: "[5] 🌪️ Sacudida",
				action: () => this.callbacks.onElectricShock?.(),
			},
			{
				num: 6,
				label: "[6] 🔄 Sim. Auto",
				action: () => this.callbacks.onToggleSimultaneous?.(),
			},
		];

		for (const item of perfActions) {
			const btn = document.createElement("button");
			btn.className = "ui-btn ui-perf-btn";
			btn.textContent = item.label;
			btn.addEventListener("click", () => {
				btn.blur();
				item.action();
			});
			this.perfButtons[item.num] = btn;
			perfGrid.appendChild(btn);
		}

		secPerf.appendChild(perfGrid);

		const btnNext = this.createButton("[SPACE] Sig. Esquina", () =>
			this.callbacks.onNextCorner?.(),
		);
		btnNext.classList.add("ui-perf-btn", "ui-perf-space-btn");
		secPerf.appendChild(btnNext);

		this.container.appendChild(secPerf);
	}

	buildCollapsibleDrawer() {
		const wrapper = document.createElement("div");
		wrapper.className = "ui-section ui-section-tight ui-drawer-wrapper";

		this.drawerToggleBtn = document.createElement("button");
		this.drawerToggleBtn.className = "ui-drawer-toggle";
		this.drawerToggleBtn.textContent = "▸ Parámetros y Sistema";
		this.drawerToggleBtn.addEventListener("click", () => {
			this.drawerToggleBtn.blur();
			this.toggleParamsDrawer();
		});
		wrapper.appendChild(this.drawerToggleBtn);

		this.drawerEl = document.createElement("div");
		this.drawerEl.className = "ui-drawer hidden";

		// 1. Botón para copiar snapshot de parámetros actuales
		this.btnCopyParams = this.createButton("📋 Copiar Parámetros (JSON)", () =>
			this.copyCurrentParams(),
		);
		this.btnCopyParams.classList.add("ui-copy-params-btn");
		this.drawerEl.appendChild(this.btnCopyParams);

		// 2. Botones de utilidad / sistema dentro del desplegable
		const sysGrid = document.createElement("div");
		sysGrid.className = "ui-actions";

		const btnReset = this.createButton("Reiniciar [R]", () =>
			this.callbacks.onReset?.(),
		);
		const btnSave = this.createButton("Guardar PNG [S]", () =>
			this.callbacks.onSave?.(),
		);
		this.btnFullScreen = this.createButton("Full Screen [F]", () =>
			this.callbacks.onToggleFullScreen?.(),
		);
		this.btnFullScreen.classList.add("ui-btn-span2");

		sysGrid.appendChild(btnReset);
		sysGrid.appendChild(btnSave);
		sysGrid.appendChild(this.btnFullScreen);
		this.drawerEl.appendChild(sysGrid);

		// 3. Todos los parámetros actuales editables (PARAM_SCHEMA)
		this.buildSchemaSections(this.drawerEl);

		wrapper.appendChild(this.drawerEl);
		this.container.appendChild(wrapper);
	}

	toggleParamsDrawer(forceOpen) {
		this.isParamsOpen =
			typeof forceOpen === "boolean" ? forceOpen : !this.isParamsOpen;
		if (this.drawerEl) {
			this.drawerEl.classList.toggle("hidden", !this.isParamsOpen);
		}
		if (this.drawerToggleBtn) {
			this.drawerToggleBtn.textContent = this.isParamsOpen
				? "▾ Parámetros y Sistema"
				: "▸ Parámetros y Sistema";
			this.drawerToggleBtn.classList.toggle("open", this.isParamsOpen);
		}
	}

	copyCurrentParams() {
		const snapshot = window.getExportableConfigSnapshot
			? window.getExportableConfigSnapshot(this.config)
			: { ...this.config };
		const jsonText = JSON.stringify(snapshot, null, 2);

		const showCopiedFeedback = () => {
			if (!this.btnCopyParams) return;
			const prev = "📋 Copiar Parámetros (JSON)";
			this.btnCopyParams.textContent = "✓ ¡Parámetros copiados!";
			this.btnCopyParams.classList.add("copied");
			clearTimeout(this.btnCopyParams._copyTimeout);
			this.btnCopyParams._copyTimeout = setTimeout(() => {
				this.btnCopyParams.textContent = prev;
				this.btnCopyParams.classList.remove("copied");
			}, 1500);
		};

		const fallbackCopy = () => {
			const ta = document.createElement("textarea");
			ta.value = jsonText;
			ta.style.position = "fixed";
			ta.style.opacity = "0";
			document.body.appendChild(ta);
			ta.select();
			try {
				document.execCommand("copy");
				showCopiedFeedback();
			} catch (_) {}
			document.body.removeChild(ta);
		};

		if (navigator.clipboard?.writeText) {
			navigator.clipboard
				.writeText(jsonText)
				.then(showCopiedFeedback)
				.catch(fallbackCopy);
		} else {
			fallbackCopy();
		}

		console.info(
			`[Estado ${this.activeStateId}] Parámetros actuales:\n`,
			jsonText,
		);
	}

	/**
	 * Genera las secciones 0, 1, 2 y 3 iterando sobre window.UI_SECTIONS y window.PARAM_SCHEMA.
	 */
	buildSchemaSections(targetParent = this.container) {
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
						btn.addEventListener("click", () => {
							btn.blur();
							this.setDimensions(p.w, p.h);
						});
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
			targetParent.appendChild(secEl);
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
		btn.addEventListener("click", () => {
			btn.blur();
			onClick?.();
		});
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

	syncAllControls() {
		for (const [key, sliderRef] of this.sliders.entries()) {
			const val = this.config[key];
			if (val !== undefined) {
				sliderRef.input.value = val;
				sliderRef.valSpan.textContent = sliderRef.format(val);
			}
		}
		this.syncCheckboxes();
	}

	setDimensions(w, h) {
		this.config.canvasWidth = w;
		this.config.canvasHeight = h;
		this.updateSlider("canvasWidth", w);
		this.updateSlider("canvasHeight", h);
		if (this.btnFullScreen && !this.config.fullScreen) {
			this.btnFullScreen.textContent = "Full Screen [F]";
		}
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
				? "[6] 🔄 Sim: ON"
				: "[6] 🔄 Sim. Auto";
		}

		if (this.btnFullScreen) {
			const isFS = Boolean(this.config.fullScreen);
			this.btnFullScreen.classList.toggle("active", isFS);
			this.btnFullScreen.textContent = isFS
				? `Ventana ${this.config.canvasWidth}x${this.config.canvasHeight} [F]`
				: "Full Screen [F]";
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

	updateTelemetry(telemetryInfo, activeCount, fps) {
		if (!this.isVisible || !telemetryInfo) {
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
}

window.UIPanel = UIPanel;
