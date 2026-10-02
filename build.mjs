// Fabrique index.html, le jeu en un seul fichier : le HTML de src/index.html, le style de
// src/style.css, tous les modules de src/ réunis par esbuild (images comprises), et PeerJS.
//   npm run build        une fois
//   npm run dev          reconstruit à chaque modification (recharge la page pour voir)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, watch } from 'node:fs';

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
}

if (process.argv.includes('--watch')) {
  let timer = null;
  const again = () => { clearTimeout(timer); timer = setTimeout(() => build().catch(e => console.error(e.message)), 80); };
  await build().catch(e => console.error(e.message));
  watch('src', { recursive: true }, again);
  watch('assets', { recursive: true }, again);
  console.log('En attente de modifications dans src/ et assets/ (Ctrl+C pour arrêter)…');
} else {
  await build();
}
