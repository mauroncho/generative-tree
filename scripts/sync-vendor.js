import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcEsm = path.join(
	rootDir,
	"node_modules",
	"webmidi",
	"dist",
	"esm",
	"webmidi.esm.js",
);
const srcIife = path.join(
	rootDir,
	"node_modules",
	"webmidi",
	"dist",
	"iife",
	"webmidi.iife.js",
);
const vendorDir = path.join(rootDir, "js", "vendor");

export function syncVendor() {
	if (!fs.existsSync(srcEsm)) {
		console.log("[sync-vendor] webmidi aún no está instalado en node_modules.");
		return;
	}

	fs.mkdirSync(vendorDir, { recursive: true });
	fs.copyFileSync(srcEsm, path.join(vendorDir, "webmidi.esm.js"));

	if (fs.existsSync(srcIife)) {
		fs.copyFileSync(srcIife, path.join(vendorDir, "webmidi.iife.js"));
	}

	console.log(
		"[sync-vendor] WebMidi.js sincronizado localmente en js/vendor/ (100% offline).",
	);
}

syncVendor();
