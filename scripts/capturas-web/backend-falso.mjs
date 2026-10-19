// Backend falso para capturas: responde lo mínimo de la API de Noctiluca con datos de ejemplo.
import http from "node:http";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "Administrador", name: "mana", exp: 4102444800 })}.firma`;

const hoy = new Date();
const iso = (diasAtras) => new Date(hoy.getTime() - diasAtras * 86400000).toISOString();
const clave = (d) => d.toISOString().slice(0, 10);
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const carpetasBase = [
	["diario", 0], ["escritos", 0], ["música", 0], ["conclusiones", 0], ["mandarina", 0], ["privado", 1],
	["proyectos y cosas pendientes del año que viene", 0],
];
const carpetas = carpetasBase.map(([titulo, priv], i) => ({
	id: i + 1, clientId: uid(i + 1), titulo, version: 1, posicion: i, criterioDeOrden: 1,
	requiereAutenticacion: !!priv, esSistema: false, cantidadDeEscritos: 0,
}));

const textos = [
	["Sobre el silencio", "Hay algo en las mañanas temprano que no se puede explicar. El ruido de la ciudad todavía no llegó y uno puede escuchar lo que piensa.\n\nAyer volví a caminar por la costanera. El río estaba quieto, casi espejado."],
	["Ideas para la banda", "- probar el tema nuevo en Re menor\n- grabar las voces con el micrófono prestado\n- pensar el orden del setlist para el sábado"],
	["Conclusiones del mes", "Dormir bien cambia todo. Cuando duermo siete horas, el resto del día se acomoda solo."],
	["Carta que no voy a mandar", "Querido F.: hace mucho que quiero escribirte esto y nunca encuentro el momento."],
	["Lista de libros", "Rayuela, Los detectives salvajes, El entenado, La invención de Morel."],
	["Gimnasio: rutina nueva", "Lunes y jueves: piernas. Martes y viernes: espalda y hombros. Miércoles: descanso activo."],
	["Sueño raro", "Estaba en una casa con infinitas habitaciones y todas daban al mismo patio."],
	["Una idea larga para un cuento sobre el faro abandonado de la costa", "El farero se fue un invierno y nadie volvió a prender la luz. Los barcos aprendieron a guiarse por otra cosa."],
	["Borrador descartado", "Esto quedó en la papelera."],
];
const escritos = textos.map(([titulo, cuerpo], i) => ({
	id: i + 1, clientId: uid(100 + i), titulo, cuerpo, carpetaId: (i % 2) + 1, carpetaClientId: uid((i % 2) + 1),
	version: 1, fechaHoraCreacion: iso(i * 3 + 1), fechaHoraEdicion: iso(i * 2), estaEnPapelera: titulo === "Borrador descartado",
}));
for (const c of carpetas) c.cantidadDeEscritos = escritos.filter((e) => e.carpetaId === c.id).length;

const habitos = [["meditar", 1], ["entrenar", 1], ["cantar", 2, 30], ["leer", 1], ["practicar escalas en el piano antes de cenar", 2, 45]].map(([nombre, tipo, meta], i) => ({
	id: i + 1, clientId: uid(200 + i), nombre, tipo, activo: true, posicion: i, metaMinutos: meta, version: 1,
}));
const registrosHabito = [];
let r = 0;
for (let d = 0; d < 20; d++) for (const h of habitos) if ((d + h.id) % 3 !== 0) {
	const f = new Date(hoy.getTime() - d * 86400000);
	registrosHabito.push({
		id: ++r, clientId: uid(1000 + r), habitoId: h.id, habitoClientId: h.clientId, fecha: clave(f) + "T00:00:00",
		valorBooleano: h.tipo === 1 ? true : undefined, valorNumerico: h.tipo === 2 ? 20 + (d % 4) * 5 : undefined, version: 1,
	});
}

const listaHoy = { id: 1, clientId: uid(300), tipo: 1, clavePeriodo: clave(hoy), fechaInicio: clave(hoy) + "T00:00:00", fechaFin: clave(hoy) + "T00:00:00", fechaCreacion: iso(0), version: 1 };
const itemsObjetivo = ["terminar el capítulo 3", "llamar a mamá", "ensayar 30 minutos", "ordenar el escritorio", "revisar las correcciones del editor y mandar la versión final antes del viernes"].map((texto, i) => ({
	id: i + 1, clientId: uid(400 + i), texto, completado: i < 2, posicion: i, listaTipo: 1, listaClavePeriodo: clave(hoy), version: 1,
	listaObjetivoClientId: listaHoy.clientId, listaObjetivoId: 1,
}));

const pull = { cursor: 999, hayMas: false, carpetas, escritos, habitos, registrosHabito, listasObjetivo: [listaHoy], itemsObjetivo, eliminados: [] };

const send = (res, code, body) => {
	res.writeHead(code, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Allow-Methods": "*",
	});
	res.end(body === undefined ? "" : JSON.stringify(body));
};

http.createServer((req, res) => {
	let data = "";
	req.on("data", (c) => (data += c));
	req.on("end", () => {
		const url = new URL(req.url, "http://x");
		console.log(req.method, url.pathname);
		if (req.method === "OPTIONS") return send(res, 204);
		if (url.pathname === "/api/Auth/login") return send(res, 200, { exito: true, token });
		if (url.pathname === "/api/Sync/cambios") {
			const desde = Number(url.searchParams.get("desde") ?? 0);
			return send(res, 200, desde >= 999 ? { cursor: 999, hayMas: false } : pull);
		}
		if (url.pathname === "/api/Sync/aplicar") {
			const ops = JSON.parse(data || "{}").operaciones ?? [];
			return send(res, 200, { cursor: 999, resultados: ops.map((o, i) => ({ clientOpId: o.clientOpId, clientEntityId: o.clientEntityId, estado: "aplicada", serverId: 5000 + i, version: 2 })) });
		}
		if (url.pathname === "/api/Papelera") return send(res, 200, escritos.filter((e) => e.estaEnPapelera));
		if (url.pathname.startsWith("/api/Carpeta")) return send(res, 200, carpetas);
		if (url.pathname.startsWith("/api/Escrito")) return send(res, 200, escritos);
		return send(res, 200, []);
	});
}).listen(5072, () => console.log("mock en 5072"));
