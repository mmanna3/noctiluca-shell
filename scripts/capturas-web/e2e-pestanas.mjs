// Test e2e del bloqueo de la base local (OPFS) en web: recargas seguidas y varias pestañas.
// Uso: node e2e-pestanas.mjs [url]   (por defecto http://localhost:8082/; necesita backend-falso.mjs en 5072)
// Sale con código 1 si falla algún paso.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUERTO = 9334;
const URL_APP = process.argv[2] ?? "http://localhost:8082/";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW5pc3RyYWRvciIsIm5hbWUiOiJtYW5hIiwiZXhwIjo0MTAyNDQ0ODAwfQ.firma";
const LISTA = "Sincronizado";
const AVISO = "abierta en otra pestaña";

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "noctiluca-e2e-"));
const chrome = spawn(CHROME, [
	"--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
	"--no-first-run", "--window-size=1280,900", "about:blank",
], { stdio: "ignore" });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let version;
for (let i = 0; i < 50 && !version; i++) {
	try { version = await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json(); } catch { await dormir(200); }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));

let id = 0;
const pendientes = new Map();
ws.addEventListener("message", (ev) => {
	const m = JSON.parse(ev.data);
	if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
});
const cdp = (method, params = {}, sessionId) => new Promise((r) => {
	const i = ++id;
	pendientes.set(i, r);
	ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const abrirPestana = async (nombre) => {
	const { result: { targetId } } = await cdp("Target.createTarget", { url: "about:blank" });
	const { result: { sessionId } } = await cdp("Target.attachToTarget", { targetId, flatten: true });
	await cdp("Runtime.enable", {}, sessionId);
	await cdp("Page.enable", {}, sessionId);
	return { nombre, targetId, sessionId };
};
const evaluar = async (p, expression) => {
	const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, p.sessionId);
	return r.result?.result?.value;
};
const texto = async (p) => (await evaluar(p, "document.body ? document.body.innerText : ''").catch(() => "")) ?? "";
const ir = (p, url) => cdp("Page.navigate", { url }, p.sessionId);
const recargar = (p) => cdp("Page.reload", {}, p.sessionId);
const cerrar = (p) => cdp("Target.closeTarget", { targetId: p.targetId });
const click = (p, t) => evaluar(p, `(() => { const t = ${JSON.stringify(t)}; const el = [...document.querySelectorAll("div,a,button,span")].reverse().find(e => e.innerText && e.innerText.trim() === t && e.offsetParent !== null); if (!el) return false; el.click(); return true; })()`);

/** Espera hasta que el texto de la página contenga `buscado`. Devuelve los ms que tardó, o null. */
const esperarTexto = async (p, buscado, maxMs = 15000) => {
	const inicio = Date.now();
	while (Date.now() - inicio < maxMs) {
		const t = (await texto(p).catch(() => "")) ?? "";
		if (t.includes(buscado)) return Date.now() - inicio;
		await dormir(150);
	}
	return null;
};

let fallas = 0;
const paso = (ok, descripcion, detalle = "") => {
	if (!ok) fallas++;
	console.log(`${ok ? "✔" : "✘"} ${descripcion}${detalle ? ` (${detalle})` : ""}`);
};
const resumen = async (p) => ((await texto(p).catch(() => "")) ?? "").replace(/\s+/g, " ").slice(0, 160);

try {
	const a = await abrirPestana("A");
	await ir(a, URL_APP);
	await dormir(1500);
	await evaluar(a, `localStorage.setItem("auth-token", ${JSON.stringify(TOKEN)}); 1`);
	await ir(a, URL_APP);
	let ms = await esperarTexto(a, LISTA);
	paso(ms != null, "A: primera carga sincroniza", ms != null ? `${ms} ms` : await resumen(a));

	// 1) Recargas seguidas: el documento anterior puede tener todavía abiertos los handles de OPFS.
	let recargasOk = 0;
	const RECARGAS = 8;
	for (let i = 0; i < RECARGAS; i++) {
		await recargar(a);
		await dormir(300);
		ms = await esperarTexto(a, LISTA);
		if (ms != null) recargasOk++;
		else console.log(`   recarga ${i + 1} falló: ${await resumen(a)}`);
	}
	paso(recargasOk === RECARGAS, "A: recargas seguidas", `${recargasOk}/${RECARGAS}`);

	// Recarga apenas termina de cargar (sin dar tiempo a nada).
	let rapidasOk = 0;
	for (let i = 0; i < 4; i++) {
		await recargar(a);
		await dormir(50);
		await recargar(a);
		if ((await esperarTexto(a, LISTA)) != null) rapidasOk++;
		else console.log(`   recarga doble ${i + 1} falló: ${await resumen(a)}`);
	}
	paso(rapidasOk === 4, "A: recargas dobles inmediatas", `${rapidasOk}/4`);

	// 2) Segunda pestaña: tiene que avisar y no romper a la primera.
	const b = await abrirPestana("B");
	await ir(b, URL_APP);
	ms = await esperarTexto(b, AVISO, 10000);
	paso(ms != null, "B: muestra el aviso de otra pestaña", ms != null ? `${ms} ms` : await resumen(b));
	paso((await texto(a)).includes(LISTA) && !(await texto(a)).includes("Error"), "A: sigue funcionando con B abierta", await resumen(a));
	paso(await click(a, "diario") && (await esperarTexto(a, "Sobre el silencio", 5000)) != null, "A: puede navegar y leer de la base");

	// 3) "Usar acá" en B: B pasa a ser la dueña y A queda avisando.
	paso(await click(b, "Usar acá"), "B: botón Usar acá");
	ms = await esperarTexto(b, LISTA, 20000);
	paso(ms != null, "B: toma la base y sincroniza", ms != null ? `${ms} ms` : await resumen(b));
	ms = await esperarTexto(a, AVISO, 10000);
	paso(ms != null, "A: pasa a mostrar el aviso", ms != null ? `${ms} ms` : await resumen(a));
	paso(await click(b, "diario") && (await esperarTexto(b, "Sobre el silencio", 5000)) != null, "B: puede navegar y leer de la base");

	// 4) Cerrar B: A se activa sola.
	await cerrar(b);
	ms = await esperarTexto(a, LISTA, 20000);
	paso(ms != null, "A: se activa sola al cerrar B", ms != null ? `${ms} ms` : await resumen(a));

	// 5) Tres pestañas a la vez: exactamente una dueña.
	const c = await abrirPestana("C");
	const d = await abrirPestana("D");
	await Promise.all([ir(c, URL_APP), ir(d, URL_APP)]);
	await dormir(6000);
	const textos = await Promise.all([a, c, d].map(texto));
	const duenas = textos.filter((t) => t.includes(LISTA)).length;
	const avisos = textos.filter((t) => t.includes(AVISO)).length;
	paso(duenas === 1 && avisos === 2, "A+C+D: una sola dueña, dos avisos", `dueñas=${duenas} avisos=${avisos}`);
} catch (e) {
	fallas++;
	console.log("✘ excepción:", e);
} finally {
	ws.close();
	chrome.kill();
	await dormir(300);
	fs.rmSync(perfil, { recursive: true, force: true });
}
console.log(fallas ? `\n${fallas} falla(s)` : "\nTodo OK");
process.exit(fallas ? 1 : 0);
