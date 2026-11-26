// LevelLab の書き出し JSON を公開ステージにする。
//   node tools/levellab-publish.js <書き出した.json> [公開名]
// maps/levellab/<公開名>.js（JSON をそのまま包んだもの）を作り、maps/manifest.js の一覧に足す。
// 同じ公開名なら上書き（＝マップの更新）。JSON の中身は書き換えない。
'use strict';
const fs = require('fs');
const path = require('path');
const src = process.argv[2];
if (!src) { console.error('使い方: node tools/levellab-publish.js <書き出した.json> [公開名]'); process.exit(1); }
const text = fs.readFileSync(src, 'utf8');
const json = JSON.parse(text);               // 壊れた JSON はここで止める
if (typeof json.version !== 'number' || !Array.isArray(json.floors)) { console.error('LevelLab の書き出しではないようです（version / floors が無い）'); process.exit(1); }
const name = (process.argv[3] || path.basename(src).replace(/\.json$/i, '')).replace(/[^A-Za-z0-9_.-]+/g, '-');
const root = path.join(__dirname, '..');
const rel = 'levellab/' + name + '.js';
fs.writeFileSync(path.join(root, 'maps', rel),
  '// LevelLab の書き出し（' + (json.title || name) + '）。中身は書き出した JSON のまま。tools/levellab-publish.js で作る\n' +
  'BK_publishLevelLab(' + JSON.stringify(rel) + ', ' + text.trim() + ');\n');
const mf = path.join(root, 'maps', 'manifest.js');
const cur = fs.readFileSync(mf, 'utf8');
const m = cur.match(/window\.BK_PUBLIC_MAPS = (\[[\s\S]*?\]);/);
const list = m ? JSON.parse(m[1].replace(/'/g, '"').replace(/,\s*\]/, ']')) : [];
if (!list.includes(rel)) list.push(rel);
fs.writeFileSync(mf, cur.replace(/window\.BK_PUBLIC_MAPS = \[[\s\S]*?\];/,
  'window.BK_PUBLIC_MAPS = [\n' + list.map((f) => '  ' + JSON.stringify(f) + ',').join('\n') + '\n];'));
console.log('公開しました: maps/' + rel + '（一覧 ' + list.length + ' 件）');
