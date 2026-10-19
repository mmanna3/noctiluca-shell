// Uso: node servidor-estatico.mjs <carpeta-dist> <puerto>. Sirve el export web con fallback SPA y los headers COOP/COEP que necesita expo-sqlite.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const raiz = process.argv[2], puerto = Number(process.argv[3]);
const tipos = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".wasm":"application/wasm", ".ttf":"font/ttf", ".png":"image/png", ".ico":"image/x-icon", ".json":"application/json" };
http.createServer((req, res) => {
	// try/catch: si se re-exporta mientras está corriendo, un archivo puede desaparecer entre el chequeo y la lectura.
	try {
		let f = path.join(raiz, decodeURIComponent(new URL(req.url, "http://x").pathname));
		if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(raiz, "index.html");
		res.writeHead(200, { "Content-Type": tipos[path.extname(f)] ?? "application/octet-stream", "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp", "Cross-Origin-Resource-Policy": "cross-origin" });
		fs.createReadStream(f).on("error", () => res.end()).pipe(res);
	} catch {
		res.writeHead(503); res.end();
	}
}).listen(puerto);
