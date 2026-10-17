// Uso: node capturar.mjs pasos.json [directorio-perfil-chrome]
// pasos: [{ "ir": url, "espera": ms } | { "js": código } | { "click": "texto exacto" } | { "esperar": ms } | { "foto": ruta } | { "tam": [ancho, alto] }]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUERTO = 9333;
const pasos = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const perfil = process.argv[3] ?? path.join(os.tmpdir(), "noctiluca-chrome-perfil");

const chrome = spawn(CHROME, [
	"--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
	"--no-first-run", "--hide-scrollbars", "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
	try { targets = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json(); break; } catch { await dormir(200); }
}
const pagina = targets.find((t) => t.type === "page");
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pendientes = new Map();
ws.addEventListener("message", (ev) => {
	const m = JSON.parse(ev.data);
	if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
	if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") console.log("console.error:", m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
	if (m.method === "Runtime.exceptionThrown") console.log("excepción:", m.params.exceptionDetails.exception?.description?.slice(0, 300));
});
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await cdp("Runtime.enable");
await cdp("Page.enable");
let tam = [1440, 900];
await cdp("Emulation.setDeviceMetricsOverride", { width: tam[0], height: tam[1], deviceScaleFactor: 1, mobile: false });

for (const p of pasos) {
	if (p.tam) { tam = p.tam; await cdp("Emulation.setDeviceMetricsOverride", { width: tam[0], height: tam[1], deviceScaleFactor: 1, mobile: tam[0] < 600 }); }
	if (p.ir) { await cdp("Page.navigate", { url: p.ir }); await dormir(p.espera ?? 4000); }
	if (p.js) { const r = await cdp("Runtime.evaluate", { expression: p.js, awaitPromise: true, returnByValue: true }); if (r.result?.result?.value !== undefined) console.log("js →", JSON.stringify(r.result.result.value).slice(0, 2000)); }
	if (p.click) {
		const js = `(() => { const t = ${JSON.stringify(p.click)}; const el = [...document.querySelectorAll("div,a,button,span")].reverse().find(e => e.innerText && e.innerText.trim() === t && e.offsetParent !== null); if (!el) return "no encontrado: " + t; el.click(); return "click: " + t; })()`;
		const r = await cdp("Runtime.evaluate", { expression: js, returnByValue: true });
		console.log(r.result?.result?.value);
		await dormir(p.espera ?? 2500);
	}
	if (p.esperar) await dormir(p.esperar);
	if (p.foto) {
		const r = await cdp("Page.captureScreenshot", { format: "png" });
		fs.writeFileSync(p.foto, Buffer.from(r.result.data, "base64"));
		console.log("foto:", p.foto);
	}
}
ws.close();
chrome.kill();
