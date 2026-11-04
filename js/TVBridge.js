/**
 * TVBridge - Sistema de comunicación bidireccional entre la Base de Control (PC)
 * y la Pantalla de Visualización (Tele de tubo / Proyección).
 *
 * Utiliza BroadcastChannel de forma nativa para latencia cero (0 ms)
 * y fallback con postMessage para compatibilidad total (incluso en file://),
 * con deduplicación estricta de mensajes por ID.
 */
class TVBridge {
	constructor(isDisplayMode = false) {
		this.isDisplay = isDisplayMode;
		this.channelName = "lichtenberg_channel";
		this.instanceId = `${isDisplayMode ? "tv" : "pc"}_${Math.random().toString(36).slice(2, 9)}`;
		this.msgSeq = 0;
		this.lastProcessedMsgId = null;

		this.channel = null;
		this.tvWindow = null;

		this.paramListeners = [];
		this.actionListeners = [];
		this.telemetryListeners = [];
		this.connectionListeners = [];

		this.isConnected = false;
		this.heartbeatTimer = null;
		this.lastHeartbeat = 0;

		this.initChannel();
		this.initWindowListener();
		this.startHeartbeat();
	}

	initChannel() {
		if (typeof BroadcastChannel !== "undefined") {
			try {
				this.channel = new BroadcastChannel(this.channelName);
				this.channel.onmessage = (event) => {
					this.handleMessage(event.data);
				};
			} catch (e) {
				console.warn("BroadcastChannel no disponible, usando postMessage:", e);
			}
		}
	}

	initWindowListener() {
		window.addEventListener("message", (event) => {
			if (event.data && event.data.channel === this.channelName) {
				this.handleMessage(event.data);
			}
		});
	}

	/**
	 * Abre la ventana pop-up dedicada para la tele de tubo.
	 */
	openTVWindow(url = "display.html") {
		if (this.tvWindow && !this.tvWindow.closed) {
			this.tvWindow.focus();
			return this.tvWindow;
		}

		const width = 1024;
		const height = 768;
		const left = window.screen.width ? (window.screen.width - width) / 2 : 50;
		const top = window.screen.height ? (window.screen.height - height) / 2 : 50;

		const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;
		this.tvWindow = window.open(url, "LichtenbergTV", features);

		if (this.tvWindow) {
			this.tvWindow.focus();
			this.notifyConnection(true);
		}

		return this.tvWindow;
	}

	closeTVWindow() {
		if (this.tvWindow && !this.tvWindow.closed) {
			this.tvWindow.close();
		}
		this.tvWindow = null;
		this.notifyConnection(false);
	}

	isTVOpen() {
		return Boolean(this.tvWindow && !this.tvWindow.closed);
	}

	/**
	 * Envía un mensaje con ID único para evitar ejecución duplicada cuando
	 * tanto BroadcastChannel como window.postMessage están activos.
	 */
	post(data) {
		const payload = {
			...data,
			channel: this.channelName,
			_senderId: this.instanceId,
			_msgId: `${this.instanceId}_${++this.msgSeq}`,
		};

		let sentViaChannel = false;
		if (this.channel) {
			try {
				this.channel.postMessage(payload);
				sentViaChannel = true;
			} catch (_) {}
		}

		// Usar postMessage como fallback si BroadcastChannel no está disponible
		if (!sentViaChannel) {
			if (this.tvWindow && !this.tvWindow.closed) {
				try {
					this.tvWindow.postMessage(payload, "*");
				} catch (_) {}
			}
			if (window.opener && !window.opener.closed) {
				try {
					window.opener.postMessage(payload, "*");
				} catch (_) {}
			}
		}
	}

	handleMessage(msg) {
		if (!msg || typeof msg !== "object") return;
		if (msg._senderId && msg._senderId === this.instanceId) return;
		if (msg._msgId && msg._msgId === this.lastProcessedMsgId) return;
		if (msg._msgId) {
			this.lastProcessedMsgId = msg._msgId;
		}

		switch (msg.type) {
			case "PING":
				this.lastHeartbeat = Date.now();
				this.notifyConnection(true);
				this.post({ type: "PONG" });
				break;

			case "PONG":
				this.lastHeartbeat = Date.now();
				this.notifyConnection(true);
				break;

			case "PARAM_CHANGE":
				for (const cb of this.paramListeners) {
					cb(msg.key, msg.value);
				}
				break;

			case "ACTION":
				for (const cb of this.actionListeners) {
					cb(msg.action, msg.data);
				}
				break;

			case "TELEMETRY":
				for (const cb of this.telemetryListeners) {
					cb(msg.data);
				}
				break;

			case "REQUEST_CONFIG":
				if (!this.isDisplay && window.CONFIG) {
					this.post({
						type: "SYNC_ALL",
						config: window.CONFIG,
						seed: window.appState ? window.appState.seed : null,
					});
				}
				break;

			case "SYNC_ALL":
				if (this.isDisplay) {
					for (const cb of this.actionListeners) {
						cb("syncAll", { config: msg.config, seed: msg.seed });
					}
				}
				break;
		}
	}

	startHeartbeat() {
		this.heartbeatTimer = setInterval(() => {
			this.post({ type: "PING" });

			if (Date.now() - this.lastHeartbeat > 3000) {
				if (!this.isTVOpen() && this.isConnected) {
					this.notifyConnection(false);
				}
			}
		}, 1000);
	}

	notifyConnection(connected) {
		if (this.isConnected !== connected) {
			this.isConnected = connected;
			for (const cb of this.connectionListeners) {
				cb(connected);
			}
		}
	}

	sendParam(key, value) {
		this.post({ type: "PARAM_CHANGE", key, value });
	}

	sendAction(action, data = null) {
		this.post({ type: "ACTION", action, data });
	}

	sendTelemetry(data) {
		this.post({ type: "TELEMETRY", data });
	}

	requestConfig() {
		this.post({ type: "REQUEST_CONFIG" });
	}

	onParam(callback) {
		this.paramListeners.push(callback);
	}

	onAction(callback) {
		this.actionListeners.push(callback);
	}

	onTelemetry(callback) {
		this.telemetryListeners.push(callback);
	}

	onConnectionChange(callback) {
		this.connectionListeners.push(callback);
	}
}

window.TVBridge = TVBridge;
