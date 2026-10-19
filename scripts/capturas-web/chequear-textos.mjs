// Recorre las pantallas de la web en ancho de celular y detecta textos que no se ven completos:
// se salen de la pantalla, quedan recortados por un contenedor, desbordan su propia caja,
// se pisan con otro texto o (en inputs vacíos) el placeholder no entra.
// Uso: node chequear-textos.mjs <url-base> <salida.json> [carpeta-capturas]
// Para comparar dos versiones: correrlo contra cada una y después `node comparar-textos.mjs antes.json despues.json`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUERTO = 9335;
const BASE = (process.argv[2] ?? "http://localhost:8082").replace(/\/$/, "");
const SALIDA = process.argv[3] ?? "textos.json";
const CAPTURAS = process.argv[4];
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW5pc3RyYWRvciIsIm5hbWUiOiJtYW5hIiwiZXhwIjo0MTAyNDQ0ODAwfQ.firma";
const [ANCHO, ALTO] = [390, 844];

// Cada entrada: nombre, ruta y, opcionalmente, clicks a hacer después de cargar (texto exacto).
const PANTALLAS = [
	{ nombre: "inicio", ruta: "/" },
	{ nombre: "inicio-dia-anterior", ruta: "/", clicks: ["Lun"] },
	{ nombre: "objetivos-hoy", ruta: "/objetivos" },
	{ nombre: "objetivos-semana", ruta: "/objetivos", clicks: ["Semana"] },
	{ nombre: "objetivos-mes", ruta: "/objetivos", clicks: ["Mes"] },
	{ nombre: "objetivos-anio", ruta: "/objetivos", clicks: [String(new Date().getFullYear())] },
	{ nombre: "objetivos-lustro", ruta: "/objetivos", clicks: ["5 años"] },
	{ nombre: "objetivos-planificar", ruta: "/objetivos", clicks: ["Planificar otro día"] },
	{ nombre: "historico-objetivos", ruta: "/historico-objetivos?tipo=1" },
	{ nombre: "lista-objetivos", ruta: "/lista-objetivos/1" },
	{ nombre: "carpeta-diario", ruta: "/1/escritos" },
	{ nombre: "carpeta-escritos", ruta: "/2/escritos" },
	{ nombre: "carpeta-nombre-largo", ruta: "/7/escritos" },
	{ nombre: "carpeta-privada", ruta: "/6/escritos" },
	{ nombre: "escrito", ruta: "/1/escritos/ver/1" },
	{ nombre: "escrito-titulo-largo", ruta: "/1/escritos/ver/8" },
	{ nombre: "nuevo-escrito", ruta: "/1/nuevo" },
	{ nombre: "nueva-subcarpeta", ruta: "/1/nueva-subcarpeta" },
	{ nombre: "nueva-carpeta", ruta: "/nueva-carpeta" },
	{ nombre: "buscar", ruta: "/buscar-escritos" },
	{ nombre: "carpetas-privadas", ruta: "/carpetas-privadas" },
	{ nombre: "modo-lectura", ruta: "/modo-lectura" },
	{ nombre: "papelera", ruta: "/papelera" },
	{ nombre: "papelera-escrito", ruta: "/papelera/ver/9" },
	{ nombre: "habitos", ruta: "/habitos" },
	{ nombre: "resumen-habitos", ruta: "/resumen-habitos" },
	{ nombre: "administrar-habitos", ruta: "/administrar-habitos" },
];

// El ancho se fija en 390: en modo celular, si algo se sale, Chrome agranda el viewport e innerWidth deja de servir.
const DETECTAR = `(() => {
	const vw = ${ANCHO};
	const problemas = [];
	if (document.documentElement.scrollWidth > vw + 1) problemas.push({ texto: "(página)", problema: "la página es más ancha que la pantalla", detalle: String(document.documentElement.scrollWidth) });
	const propio = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
	const textos = [...document.querySelectorAll("[dir=auto], span")].filter((el) => propio(el) && el.offsetParent !== null);
	const visibles = textos.filter((el) => getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0);
	const rectTexto = (el) => {
		const r = document.createRange();
		r.selectNodeContents(el);
		return r.getBoundingClientRect();
	};
	for (const el of visibles) {
		const t = propio(el).slice(0, 60);
		const r = rectTexto(el);
		if (r.width === 0) continue;
		if (r.right > vw + 1 || r.left < -1) problemas.push({ texto: t, problema: "fuera de pantalla", detalle: Math.round(r.left) + ".." + Math.round(r.right) });
		if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible") problemas.push({ texto: t, problema: "desborda su caja (ancho)" });
		if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY !== "visible") problemas.push({ texto: t, problema: "desborda su caja (alto)" });
		for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
			const cs = getComputedStyle(a);
			const ra = a.getBoundingClientRect();
			const scrollX = cs.overflowX === "auto" || cs.overflowX === "scroll";
			const scrollY = cs.overflowY === "auto" || cs.overflowY === "scroll";
			const cortaX = cs.overflowX === "hidden" || cs.overflowX === "clip";
			const cortaY = cs.overflowY === "hidden" || cs.overflowY === "clip";
			if ((cortaX || scrollX) && (r.right > ra.right + 1 || r.left < ra.left - 1)) {
				problemas.push({ texto: t, problema: "recortado por contenedor (ancho)", detalle: a.className.slice(0, 60) });
				break;
			}
			// Pasado un contenedor con scroll vertical, lo que quede fuera es scroll, no texto cortado.
			if (scrollY) break;
			if (cortaY && (r.bottom > ra.bottom + 1 || r.top < ra.top - 1)) {
				problemas.push({ texto: t, problema: "recortado por contenedor (alto)", detalle: a.className.slice(0, 60) });
				break;
			}
		}
	}
	// Textos que se pisan (no anidados).
	/** Parte visible del texto: recortada por los contenedores con scroll u overflow oculto. */
	const visible = (el) => {
		const r = rectTexto(el);
		let [izq, arr, der, aba] = [r.left, r.top, r.right, r.bottom];
		for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
			const cs = getComputedStyle(a);
			if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
			const ra = a.getBoundingClientRect();
			[izq, arr, der, aba] = [Math.max(izq, ra.left), Math.max(arr, ra.top), Math.min(der, ra.right), Math.min(aba, ra.bottom)];
		}
		return { left: izq, top: arr, right: der, bottom: aba, width: der - izq, height: aba - arr };
	};
	const rects = visibles.map((el) => [el, visible(el)]).filter(([, r]) => r.width > 0 && r.height > 0);
	for (let i = 0; i < rects.length; i++) {
		for (let j = i + 1; j < rects.length; j++) {
			const [a, ra] = rects[i];
			const [b, rb] = rects[j];
			if (a.contains(b) || b.contains(a)) continue;
			const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
			const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
			if (x > 2 && y > 2) problemas.push({ texto: propio(a).slice(0, 40) + " / " + propio(b).slice(0, 40), problema: "textos superpuestos" });
		}
	}
	// Placeholders que no entran en su input.
	const lienzo = document.createElement("canvas").getContext("2d");
	for (const inp of document.querySelectorAll("input, textarea")) {
		if (!inp.placeholder || inp.value || inp.offsetParent === null) continue;
		const cs = getComputedStyle(inp);
		lienzo.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
		const disponible = inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
		const ancho = lienzo.measureText(inp.placeholder).width;
		if (inp.tagName === "INPUT" && ancho > disponible + 1) problemas.push({ texto: inp.placeholder, problema: "placeholder no entra", detalle: Math.round(ancho) + " > " + Math.round(disponible) });
	}
	const fuentes = [...new Set(visibles.map((el) => getComputedStyle(el).fontFamily.split(",")[0]))];
	return { problemas, fuentes, cantidadTextos: visibles.length };
})()`;

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "noctiluca-textos-"));
const chrome = spawn(CHROME, [
	"--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
	"--no-first-run", "--hide-scrollbars", `--window-size=${ANCHO},${ALTO}`, "about:blank",
], { stdio: "ignore" });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50 && !targets; i++) {
	try { targets = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json(); } catch { await dormir(200); }
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pendientes = new Map();
ws.addEventListener("message", (ev) => {
	const m = JSON.parse(ev.data);
	if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluar = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const esperarCarga = async () => {
	for (let i = 0; i < 60; i++) {
		const listo = await evaluar(`document.readyState === "complete" && document.fonts.status === "loaded" && !!document.body && document.body.innerText.length > 0 && !document.body.innerText.includes("Guardando")`);
		if (listo) break;
		await dormir(250);
	}
	await dormir(1200);
};
const click = (t) => evaluar(`(() => { const t = ${JSON.stringify(t)}; const el = [...document.querySelectorAll("div,a,button,span")].reverse().find(e => e.innerText && e.innerText.trim() === t && e.offsetParent !== null); if (!el) return false; el.click(); return true; })()`);
const foto = async (nombre) => {
	if (!CAPTURAS) return;
	fs.mkdirSync(CAPTURAS, { recursive: true });
	const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
	fs.writeFileSync(path.join(CAPTURAS, `${nombre}.png`), Buffer.from(r.result.data, "base64"));
};

await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: ALTO, deviceScaleFactor: 2, mobile: true });

const resultado = {};
// Login (sin sesión).
await cdp("Page.navigate", { url: `${BASE}/login` });
await esperarCarga();
resultado.login = await evaluar(DETECTAR);
await foto("login");

if (process.env.AUTOTEST) {
	// Página con un caso de cada problema, para comprobar que el detector los encuentra.
	const html = `<meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;font:16px sans-serif">
		<div style="display:flex;width:390px"><div dir="auto" style="white-space:nowrap">texto que se sale de la pantalla porque no baja de línea nunca jamás</div></div>
		<div style="width:80px;height:20px;overflow:hidden"><div dir="auto">texto recortado por un contenedor chico</div></div>
		<div dir="auto" style="width:60px;height:18px;overflow:hidden">desborda su propia caja</div>
		<div style="position:relative;height:40px"><div dir="auto" style="position:absolute;top:0">pisado uno</div><div dir="auto" style="position:absolute;top:4px;left:10px">pisado dos</div></div>
		<input placeholder="un placeholder larguísimo que no entra en el input" style="width:80px">
		<div style="height:30px;overflow:auto"><div dir="auto">ok uno</div><div dir="auto">ok dos</div><div dir="auto">ok tres, scrolleado</div></div>
	</body>`;
	await cdp("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(html) });
	await dormir(500);
	const r = await evaluar(DETECTAR);
	const esperados = ["fuera de pantalla", "recortado por contenedor (alto)", "desborda su caja (alto)", "textos superpuestos", "placeholder no entra"];
	const encontrados = new Set(r.problemas.map((p) => p.problema));
	const falsos = r.problemas.filter((p) => p.texto.startsWith("ok"));
	for (const e of esperados) console.log(`${encontrados.has(e) ? "✔" : "✘"} detecta: ${e}`);
	console.log(`${falsos.length ? "✘" : "✔"} no marca el contenido scrolleado`);
	ws.close();
	chrome.kill();
	process.exit(esperados.every((e) => encontrados.has(e)) && !falsos.length ? 0 : 1);
}

await evaluar(`localStorage.setItem("auth-token", ${JSON.stringify(TOKEN)}); 1`);
for (const p of PANTALLAS) {
	await cdp("Page.navigate", { url: BASE + p.ruta });
	await esperarCarga();
	for (const c of p.clicks ?? []) {
		if (!(await click(c))) console.log(`   ${p.nombre}: no encontré "${c}"`);
		await dormir(1200);
	}
	resultado[p.nombre] = await evaluar(DETECTAR);
	await foto(p.nombre);
	const { problemas, cantidadTextos, fuentes } = resultado[p.nombre] ?? { problemas: [{ problema: "no se pudo evaluar" }] };
	console.log(`${problemas.length ? "✘" : "✔"} ${p.nombre} (${cantidadTextos} textos, ${fuentes?.join(" / ")})${problemas.length ? ": " + problemas.length + " problema(s)" : ""}`);
}

fs.writeFileSync(SALIDA, JSON.stringify(resultado, null, 2));
ws.close();
chrome.kill();
await dormir(300);
fs.rmSync(perfil, { recursive: true, force: true });
