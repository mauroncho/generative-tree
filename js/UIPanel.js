/**
 * UIPanel - Interfaz flotante ocultable ([H]) para controlar en tiempo real
 * los parámetros de la rama principal (Gen 0), sub-ramas (Gen 1+),
 * superposición espacial, límite de ramas visibles y modo infinito.
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
    this.isTVConnected = false;

    this.buildDOM();
  }

  buildDOM() {
    this.container = document.createElement("aside");
    this.container.className = "ui-panel";

    const stopProp = (e) => e.stopPropagation();
    this.container.addEventListener("mousedown", stopProp);
    this.container.addEventListener("pointerdown", stopProp);
    this.container.addEventListener("wheel", stopProp);

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

    const actionsRow = document.createElement("div");
    actionsRow.className = "ui-actions";

    const btnReset = this.createButton("Reiniciar [R]", () => {
      this.callbacks.onReset();
    });
    const btnNext = this.createButton("Sig. Esquina [SPACE]", () => {
      this.callbacks.onNextCorner();
    });
    this.btnTV = this.createButton("Salida CRT [P]", () => {
      if (this.callbacks.onToggleTV) {
        this.callbacks.onToggleTV();
      }
    });
    this.btnTV.classList.add("tv-btn");

    this.btnFullScreen = this.createButton("Pantalla Completa [F]", () => {
      if (this.callbacks.onToggleFullScreen) {
        this.callbacks.onToggleFullScreen();
      }
    });

    actionsRow.appendChild(btnReset);
    actionsRow.appendChild(btnNext);
    actionsRow.appendChild(this.btnTV);
    actionsRow.appendChild(this.btnFullScreen);

    this.container.appendChild(actionsRow);

    // SECCIÓN PERFORMÁTICA: Acciones Rápidas [1] al [6]
    const secPerf = this.createSection("⚡ Acciones Performáticas [1–6]");
    const perfGrid = document.createElement("div");
    perfGrid.className = "ui-perf-grid";

    this.perfButtons = {};

    const perfActions = [
      {
        num: 1,
        label: "[1] ⚡ Ráfaga x2",
        action: () => {
          if (this.callbacks.onBurst) this.callbacks.onBurst(2, 1);
        },
      },
      {
        num: 2,
        label: "[2] ⚡⚡ Ráfaga x3",
        action: () => {
          if (this.callbacks.onBurst) this.callbacks.onBurst(3, 2);
        },
      },
      {
        num: 3,
        label: "[3] ⚡⚡⚡ Ráfaga x4",
        action: () => {
          if (this.callbacks.onBurst) this.callbacks.onBurst(4, 3);
        },
      },
      {
        num: 4,
        label: "[4] 💥 Floración",
        action: () => {
          if (this.callbacks.onBloom) this.callbacks.onBloom();
        },
      },
      {
        num: 5,
        label: "[5] 🌪️ Sacudida Eléc.",
        action: () => {
          if (this.callbacks.onElectricShock) this.callbacks.onElectricShock();
        },
      },
      {
        num: 6,
        label: "[6] 🔄 Sim. Auto (2-4)",
        isToggle: true,
        action: () => {
          if (this.callbacks.onToggleSimultaneous) {
            this.callbacks.onToggleSimultaneous();
          }
        },
      },
    ];

    perfActions.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "ui-btn ui-perf-btn";
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        item.action();
      });
      this.perfButtons[item.num] = btn;
      perfGrid.appendChild(btn);
    });

    secPerf.appendChild(perfGrid);
    this.container.appendChild(secPerf);

    // SECCIÓN 0: Dimensiones del Canvas y Salida CRT
    const secDim = this.createSection("0. Dimensiones Canvas // Salida CRT");
    this.addSlider(secDim, {
      label: "Ancho Canvas",
      key: "canvasWidth",
      min: 320,
      max: 1920,
      step: 10,
      format: (v) => `${Math.round(v)} px`,
      onChange: () => {
        if (this.callbacks.onResizeCanvas) {
          this.callbacks.onResizeCanvas();
        }
      },
    });
    this.addSlider(secDim, {
      label: "Alto Canvas",
      key: "canvasHeight",
      min: 240,
      max: 1440,
      step: 10,
      format: (v) => `${Math.round(v)} px`,
      onChange: () => {
        if (this.callbacks.onResizeCanvas) {
          this.callbacks.onResizeCanvas();
        }
      },
    });

    const presetRow = document.createElement("div");
    presetRow.className = "ui-presets-row";

    const presets = [
      { label: "640x480 (4:3)", w: 640, h: 480 },
      { label: "800x600 (4:3)", w: 800, h: 600 },
      { label: "1024x768 (4:3)", w: 1024, h: 768 },
      { label: "900x900 (1:1)", w: 900, h: 900 },
    ];

    presets.forEach((p) => {
      const btn = document.createElement("button");
      btn.className = "ui-preset-btn";
      btn.textContent = p.label;
      btn.addEventListener("click", () => {
        this.setDimensions(p.w, p.h);
      });
      presetRow.appendChild(btn);
    });
    secDim.appendChild(presetRow);

    this.addCheckbox(secDim, {
      label: "CRT: Llenar Pantalla Completa",
      key: "tvFullScreen",
      onChange: (checked) => {
        if (this.callbacks.onParamChange) {
          this.callbacks.onParamChange("tvFullScreen", checked);
        }
      },
    });

    this.container.appendChild(secDim);

    // SECCIÓN 1: Rama Principal (Gen 0)
    const secTrunk = this.createSection("1. Rama Principal (Gen 0)");
    this.addSlider(secTrunk, {
      label: "Dispersión en Bordes",
      key: "originSpread",
      min: 0,
      max: 280,
      step: 5,
      format: (v) => `${Math.round(v)} px`,
    });
    this.addSlider(secTrunk, {
      label: "Tendencia al Centro",
      key: "trunkCenterPull",
      min: 0.0,
      max: 0.25,
      step: 0.005,
      format: (v) => v.toFixed(3),
    });
    this.addSlider(secTrunk, {
      label: "Largo Base (0% rand)",
      key: "trunkBaseLength",
      min: 200,
      max: 1200,
      step: 10,
      format: (v) => `${Math.round(v)} px`,
    });
    this.addSlider(secTrunk, {
      label: "Aleatoriedad de Largo",
      key: "trunkLengthRandomness",
      min: 0.0,
      max: 1.0,
      step: 0.01,
      format: (v) => `${Math.round(v * 100)}%`,
    });
    this.addSlider(secTrunk, {
      label: "Largo Mínimo",
      key: "trunkMinLength",
      min: 150,
      max: 900,
      step: 10,
      format: (v) => `${Math.round(v)} px`,
    });
    this.addSlider(secTrunk, {
      label: "Largo Máximo",
      key: "trunkMaxLength",
      min: 400,
      max: 1500,
      step: 10,
      format: (v) => `${Math.round(v)} px`,
    });
    this.addSlider(secTrunk, {
      label: "Emisión de Brazos (Gen 0->1)",
      key: "trunkBranchRate",
      min: 0.0,
      max: 0.65,
      step: 0.005,
      format: (v) => `${Math.round(v * 100)}%`,
    });
    this.container.appendChild(secTrunk);

    // SECCIÓN 2: Sub-ramas y Capilares (Gen 1+)
    const secSub = this.createSection("2. Sub-Ramas (Gen 1 o Sup.)");
    this.addSlider(secSub, {
      label: "Brillo / Intensidad",
      key: "subBranchIntensity",
      min: 0.2,
      max: 4.0,
      step: 0.05,
      format: (v) => `${v.toFixed(2)}x`,
    });
    this.addSlider(secSub, {
      label: "Cantidad Ramificaciones (Gen 1+)",
      key: "subBranchRate",
      min: 0.0,
      max: 6.0,
      step: 0.05,
      format: (v) => `${v.toFixed(2)}x`,
    });
    this.addSlider(secSub, {
      label: "Largo de Sub-Ramas",
      key: "subBranchLength",
      min: 0.25,
      max: 6.0,
      step: 0.05,
      format: (v) => `${v.toFixed(2)}x`,
    });
    this.addSlider(secSub, {
      label: "Bifurcación Doble (Penachos)",
      key: "subBranchForkChance",
      min: 0.0,
      max: 0.85,
      step: 0.02,
      format: (v) => `${Math.round(v * 100)}%`,
    });
    this.addSlider(secSub, {
      label: "Profundidad Máx (Generaciones)",
      key: "maxGeneration",
      min: 1,
      max: 8,
      step: 1,
      format: (v) => `Gen ${Math.round(v)}`,
    });
    this.addSlider(secSub, {
      label: "Apertura y Quiebre Eléctrico",
      key: "angleVariance",
      min: 0.15,
      max: 1.15,
      step: 0.02,
      format: (v) => v.toFixed(2),
    });
    this.container.appendChild(secSub);

    // SECCIÓN 3: Espacio, Superposición y Modo Infinito
    const secSpace = this.createSection("3. Superposición y Secuencia");
    this.addSlider(secSpace, {
      label: "Máx. Ramas Visibles",
      key: "maxVisibleTrees",
      min: 1,
      max: 24,
      step: 1,
      format: (v) => `${Math.round(v)} ramas`,
    });
    this.addSlider(secSpace, {
      label: "Permiso de Superposición",
      key: "overlapTolerance",
      min: 0.0,
      max: 1.0,
      step: 0.02,
      format: (v) => `${Math.round(v * 100)}%`,
    });
    this.addSlider(secSpace, {
      label: "Fuerza de Repulsión",
      key: "repulsionStrength",
      min: 0.0,
      max: 0.75,
      step: 0.02,
      format: (v) => v.toFixed(2),
    });
    this.addSlider(secSpace, {
      label: "Umbral de Saturación",
      key: "saturationThreshold",
      min: 3.0,
      max: 18.0,
      step: 0.5,
      format: (v) => v.toFixed(1),
    });
    this.addSlider(secSpace, {
      label: "Velocidad (Pasos / Frame)",
      key: "stepsPerFrame",
      min: 1,
      max: 18,
      step: 1,
      format: (v) => `${Math.round(v)}`,
    });
    this.addSlider(secSpace, {
      label: "Ramas Simultáneas (Fijo)",
      key: "simultaneousCount",
      min: 1,
      max: 4,
      step: 1,
      format: (v) => `${Math.round(v)} ramas`,
    });

    this.addCheckbox(secSpace, {
      label: "Modo Simultáneo Auto (2-4) [6]",
      key: "simultaneousMode",
      onChange: (checked) => {
        this.syncCheckboxes();
        if (checked && this.callbacks.onSimultaneousEnabled) {
          this.callbacks.onSimultaneousEnabled();
        }
      },
    });
    this.addCheckbox(secSpace, {
      label: "Simultáneo Aleatorio (2 a 4)",
      key: "simultaneousRandom",
    });

    this.addCheckbox(secSpace, {
      label: "Pantalla Completa [F]",
      key: "fullScreen",
      onChange: (checked) => {
        if (this.callbacks.onToggleFullScreen) {
          this.callbacks.onToggleFullScreen(checked);
        }
      },
    });
    this.addCheckbox(secSpace, {
      label: "Modo Infinito (Borra Antiguas)",
      key: "infiniteMode",
    });
    this.addCheckbox(secSpace, {
      label: "Secuencia Automática de Esquinas",
      key: "autoSequence",
    });
    this.addCheckbox(secSpace, {
      label: "Ver Grilla de Densidad [G]",
      key: "showDebugGrid",
    });

    this.container.appendChild(secSpace);
    document.body.appendChild(this.container);
    this.syncCheckboxes();
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

    // Almacenar referencia para sincronizar visualmente
    this[`slider_${key}`] = { input, valSpan, format };

    input.addEventListener("input", () => {
      const num = Number.parseFloat(input.value);
      this.config[key] = num;
      valSpan.textContent = format(num);
      if (onChange) {
        onChange(num);
      }
      if (this.callbacks.onParamChange) {
        this.callbacks.onParamChange(key, num);
      }
    });

    row.appendChild(topLine);
    row.appendChild(input);
    parent.appendChild(row);
  }

  updateSlider(key, val) {
    if (this[`slider_${key}`]) {
      const { input, valSpan, format } = this[`slider_${key}`];
      input.value = val;
      valSpan.textContent = format(val);
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
    if (this.callbacks.onParamChange) {
      this.callbacks.onParamChange("canvasWidth", w);
      this.callbacks.onParamChange("canvasHeight", h);
    }
    if (this.callbacks.onResizeCanvas) {
      this.callbacks.onResizeCanvas();
    }
  }

  addCheckbox(parent, { label, key, onChange }) {
    const row = document.createElement("label");
    row.className = "ui-checkbox-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(this.config[key]);
    input.addEventListener("change", () => {
      this.config[key] = input.checked;
      if (onChange) {
        onChange(input.checked);
      }
      if (this.callbacks.onParamChange) {
        this.callbacks.onParamChange(key, input.checked);
      }
    });

    this[`checkbox_${key}`] = input;

    const text = document.createElement("span");
    text.textContent = label;

    row.appendChild(input);
    row.appendChild(text);
    parent.appendChild(row);
  }

  syncCheckboxes() {
    if (this.checkbox_showDebugGrid) {
      this.checkbox_showDebugGrid.checked = Boolean(this.config.showDebugGrid);
    }
    if (this.checkbox_autoSequence) {
      this.checkbox_autoSequence.checked = Boolean(this.config.autoSequence);
    }
    if (this.checkbox_infiniteMode) {
      this.checkbox_infiniteMode.checked = Boolean(this.config.infiniteMode);
    }
    if (this.checkbox_simultaneousMode) {
      this.checkbox_simultaneousMode.checked = Boolean(
        this.config.simultaneousMode,
      );
    }
    if (this.checkbox_simultaneousRandom) {
      this.checkbox_simultaneousRandom.checked = Boolean(
        this.config.simultaneousRandom,
      );
    }
    if (this.perfButtons && this.perfButtons[6]) {
      const isSim = Boolean(this.config.simultaneousMode);
      this.perfButtons[6].classList.toggle("active", isSim);
      this.perfButtons[6].textContent = isSim
        ? "[6] 🔄 Sim. Auto: ON"
        : "[6] 🔄 Sim. Auto (2-4)";
    }
    if (this.checkbox_tvFullScreen) {
      this.checkbox_tvFullScreen.checked = Boolean(this.config.tvFullScreen);
    }
    if (this.checkbox_fullScreen) {
      this.checkbox_fullScreen.checked = Boolean(this.config.fullScreen);
    }
    if (this.btnFullScreen) {
      this.btnFullScreen.classList.toggle(
        "active",
        Boolean(this.config.fullScreen),
      );
      this.btnFullScreen.textContent = this.config.fullScreen
        ? `Ventana ${this.config.canvasWidth}x${this.config.canvasHeight} [F]`
        : "Pantalla Completa [F]";
    }
  }

  /**
   * Ilumina brevemente un botón performático ([1] a [5]) cuando se dispara por teclado o clic.
   */
  flashPerformativeBtn(num, durationMs = 280) {
    if (!this.perfButtons || !this.perfButtons[num]) {
      return;
    }
    const btn = this.perfButtons[num];
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
    if (this.isVisible) {
      this.container.classList.remove("hidden");
    } else {
      this.container.classList.add("hidden");
    }
  }

  setTVConnected(connected) {
    this.isTVConnected = connected;
    if (this.btnTV) {
      if (connected) {
        this.btnTV.classList.add("tv-active");
        this.btnTV.textContent = "🟢 CRT Conectada";
      } else {
        this.btnTV.classList.remove("tv-active");
        this.btnTV.textContent = "Salida CRT [P]";
      }
    }
  }

  updateTVTelemetry(tvData) {
    if (!this.isVisible || !this.isTVConnected || !tvData) {
      return;
    }
    const { info, activeCount, fps } = tvData;
    if (info) {
      this.badgeEl.textContent = `[TV] ${info.statusBadge}`;
      this.badgeEl.dataset.status = info.statusType;
      this.cornerEl.textContent = info.cornerText;

      const visText =
        info.visibleCount !== undefined
          ? `Visibles: ${info.visibleCount}/${info.maxVis} | `
          : "";
      this.statsEl.textContent = `${visText}Puntas: ${activeCount} | TV FPS: ${fps}`;
    }
  }

  updateTelemetry(telemetryInfo, activeCount, fps, seed) {
    if (!this.isVisible || this.isTVConnected) {
      // Si la TV está conectada, priorizamos la telemetría enviada por la TV
      return;
    }

    if (typeof telemetryInfo === "string") {
      this.badgeEl.textContent = telemetryInfo;
      this.badgeEl.dataset.status = "growing";
      this.cornerEl.textContent = "";
      this.statsEl.textContent = `Puntas: ${activeCount} | FPS: ${Math.round(fps)} | Seed: ${seed}`;
    } else if (telemetryInfo) {
      this.badgeEl.textContent = telemetryInfo.statusBadge;
      this.badgeEl.dataset.status = telemetryInfo.statusType;
      this.cornerEl.textContent = telemetryInfo.cornerText;

      const visText =
        telemetryInfo.visibleCount !== undefined
          ? `Visibles: ${telemetryInfo.visibleCount}/${telemetryInfo.maxVis} | `
          : "";
      this.statsEl.textContent = `${visText}Puntas: ${activeCount} | FPS: ${Math.round(fps)}`;
    }
  }
}

window.UIPanel = UIPanel;
