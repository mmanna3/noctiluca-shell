// Compara dos salidas de chequear-textos.mjs y muestra los problemas que aparecen en la segunda y no en la primera.
// Uso: node comparar-textos.mjs antes.json despues.json   (sale con código 1 si hay problemas nuevos)
import fs from "node:fs";

const [antes, despues] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const clave = (p) => `${p.problema} | ${p.texto}`;
let nuevos = 0;
for (const [pantalla, d] of Object.entries(despues)) {
	const previos = new Set((antes[pantalla]?.problemas ?? []).map(clave));
	const agregados = (d?.problemas ?? []).filter((p) => !previos.has(clave(p)));
	if (!d) console.log(`✘ ${pantalla}: no se pudo evaluar`);
	if (d && antes[pantalla] && antes[pantalla].cantidadTextos !== d.cantidadTextos) {
		console.log(`  ${pantalla}: cambió la cantidad de textos (${antes[pantalla].cantidadTextos} → ${d.cantidadTextos})`);
	}
	for (const p of agregados) {
		nuevos++;
		console.log(`✘ ${pantalla}: ${p.problema}: "${p.texto}"${p.detalle ? ` (${p.detalle})` : ""}`);
	}
}
const previosTotal = Object.values(antes).reduce((n, d) => n + (d?.problemas?.length ?? 0), 0);
console.log(nuevos ? `\n${nuevos} problema(s) nuevo(s)` : `\nSin problemas nuevos (había ${previosTotal} antes, se mantienen o desaparecieron)`);
process.exit(nuevos ? 1 : 0);
