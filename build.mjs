// Fabrique index.html, le jeu en un seul fichier : le HTML de src/index.html, le style de
// src/style.css, tous les modules de src/ réunis par esbuild (images comprises), et PeerJS.
//   npm run build        une fois
//   npm run dev          ouvre le jeu dans le navigateur (http://localhost:5173), le reconstruit
//                        à chaque modification de src/ ou assets/ et recharge la page tout seul
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';

const OUT = 'index.html';
const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  charset: 'utf8',
  write: false,
  legalComments: 'none',
  loader: { '.webp': 'dataurl', '.jpg': 'dataurl', '.png': 'dataurl' },
  logLevel: 'warning',
};

function page(js) {
  const read = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const peer = read('node_modules/peerjs/dist/peerjs.min.js')
    .split('\n').filter(l => !l.startsWith('//# sourceMappingURL')).join('\n');
  if (peer.includes('</script') || js.includes('</script')) throw new Error('« </script » dans le code : le fichier serait cassé');
  const peerVersion = JSON.parse(read('node_modules/peerjs/package.json')).version;
  const html = read('src/index.html')
    .replace(/^<!-- build\.mjs .*-->\n/gm, '')
    .replace('<style>/* STYLE */</style>', () => '<style>\n' + read('src/style.css') + '</style>')
    .replace('<script>/* JEU */</script>', () => '<script>\n' + js + '</script>')
    .replace('/* PEERJS */', () => `/*! PeerJS ${peerVersion} | MIT License | Copyright (c) 2015 Michelle Bu and Eric Zhang | https://peerjs.com */\n${peer}\n`);
  for (const mark of ['/* STYLE */', '/* JEU */', '/* PEERJS */']) if (html.includes(mark)) throw new Error('marqueur non remplacé : ' + mark);
  return html;
}

async function build() {
  const t = Date.now();
  const r = await esbuild.build(options);
  const html = page(r.outputFiles[0].text);
  writeFileSync(OUT, html);
  console.log(`${OUT} : ${(html.length / 1024 / 1024).toFixed(2)} Mo en ${Date.now() - t} ms`);
  return html;
}

// --- Mode développement : petit serveur local qui sert le jeu et recharge la page à chaque modification ---
async function dev() {
  let current = '<!doctype html><meta charset="utf-8"><p>Construction en cours…</p>';
  const clients = new Set();
  // ajouté seulement à la page servie (pas au fichier index.html) : écoute les reconstructions
  const RELOAD = '<script>new EventSource("/__reload").onmessage = () => location.reload();</script>\n';
  const server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/__reload') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': ok\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
    } else if (url === '/' || url === '/index.html') {
      const at = current.lastIndexOf('</body>');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(at < 0 ? current : current.slice(0, at) + RELOAD + current.slice(at));
    } else { res.writeHead(404); res.end(); }
  });
  const rebuild = async () => {
    try { current = await build(); for (const c of clients) c.write('data: reload\n\n'); }
    catch (e) { console.error('Erreur : ' + e.message + '\n(la page garde la dernière version qui marchait)'); }
  };
  await rebuild();
  let port = Number(process.env.PORT) || 5173;
  await new Promise(function listen(ok) {
    server.once('error', e => { if (e.code === 'EADDRINUSE' && port < 5190) { port++; listen(ok); } else throw e; });
    server.listen(port, '127.0.0.1', ok);
  });
  const url = `http://localhost:${port}/`;
  console.log(`\nLe jeu tourne sur ${url}`);
  console.log('Modifie un fichier de src/ ou assets/ et enregistre : la page se recharge toute seule.');
  console.log('Ctrl+C pour arrêter.\n');
  if (!process.argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});                       // pas de navigateur ? on ouvre l'adresse à la main
  }
  let timer = null;
  const again = () => { clearTimeout(timer); timer = setTimeout(rebuild, 80); };
  watch('src', { recursive: true }, again);
  watch('assets', { recursive: true }, again);
}

if (process.argv.includes('--watch')) await dev();
else await build();
