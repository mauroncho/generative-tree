/**
 * scripts/build.js - Empaqueta el proyecto completo en ./dist para producción offline
 * y verifica que no exista ninguna dependencia remota (CDN) en el código ejecutable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncVendor } from "./sync-vendor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

function copyRecursive(src, dest) {
	if (!fs.existsSync(src)) return;
	const stat = fs.statSync(src);
	if (stat.isDirectory()) {
		fs.mkdirSync(dest, { recursive: true });
		for (const item of fs.readdirSync(src)) {
			copyRecursive(path.join(src, item), path.join(dest, item));
		}
	} else {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(src, dest);
	}
}

// 1. Asegurar sincronización de WebMidi.js desde node_modules hacia js/vendor
syncVendor();

// 2. Limpiar y recrear directorio dist/
if (fs.existsSync(distDir)) {
	fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 3. Copiar archivos estáticos y módulos locales necesarios para la ejecución offline
const entriesToCopy = [
	"index.html",
	"display.html",
	"sketch.js",
	"css",
	"js",
	"assets",
];

for (const entry of entriesToCopy) {
	copyRecursive(path.join(rootDir, entry), path.join(distDir, entry));
}

// 4. Auditar HTML y CSS para verificar ausencia total de CDNs o imports remotos
const htmlAndCssFiles = [
	path.join(distDir, "index.html"),
	path.join(distDir, "display.html"),
	path.join(distDir, "css", "style.css"),
];

let remoteFound = false;
for (const file of htmlAndCssFiles) {
	if (!fs.existsSync(file)) continue;
	const content = fs.readFileSync(file, "utf8");
	if (/https?:\/\//i.test(content)) {
		console.error(
			`[build] ERROR: Se detectó referencia remota en ${path.relative(rootDir, file)}`,
		);
		remoteFound = true;
	}
}

// 5. Verificar que WebMidi.js y p5.js existan localmente en dist/
const requiredLocalAssets = [
	path.join(distDir, "js", "p5.min.js"),
	path.join(distDir, "js", "vendor", "webmidi.esm.js"),
	path.join(distDir, "js", "midi", "midiManager.js"),
	path.join(distDir, "js", "midi", "midiMapping.js"),
	path.join(distDir, "js", "midi", "midiConfig.js"),
	path.join(distDir, "js", "midi", "midiDebug.js"),
];

for (const reqFile of requiredLocalAssets) {
	if (!fs.existsSync(reqFile)) {
		console.error(
			`[build] ERROR: Falta recurso local requerido: ${path.relative(rootDir, reqFile)}`,
		);
		process.exit(1);
	}
}

if (remoteFound) {
	process.exit(1);
}

console.log(
	"[build] Build de producción generado exitosamente en ./dist (100% offline, 0 CDNs).",
);
