'use strict';
/* =========================================================
   ステージシステム（セーフルーム／DEMO STAGE 1-1）

   main.js のあとに読む。main.js の関数・変数（scene / player / state / createEnemy …）を
   そのまま使い、main.js 側には「ステージ中ならこちらを呼ぶ」小さな入口だけを置いてある。
     H                  セーフルームへ移動（どのモードからでも。暗転して移動する）
     F                  会話・バルブ・照合装置・台座・扉など（照準と距離でいちばん手前の1つだけ）
     Space              搬送中の死体から離脱して頭モードへ（固定されている間だけ）
     Tab                目標（既存）。ステージ中はミッションの目標になる
     G / B / V / T      既存どおり（ハブ／ボス／デモ／検証室へ。ステージは片付けて出る）

   レベルの中身（部屋・通路・扉・敵・死体・ギミックの配置）は stages/*.js のデータ。
   ここにはそれを組み立てる処理と、ギミックの動きだけを書く。
     建てる   : buildLevel()     … 空間から床・壁・天井・窓・扉・照明・置き物を作る（1回だけ）
     歩ける所 : stageWalkable()  … 空間の矩形の和。扉が閉じている所と solid な置き物は除く
     進行     : STG.prog         … ミッション・バルブ・扉・倒した戦闘。死んでも消えない
     作り直し : spawnDynamic()   … 敵・死体・床の腕を配置どおりに作る（入るとき／死んで戻るとき）

   ミッション（1-1）
     A  3つのバルブ   人間の体・両腕が壊れていない拳（FIST）のときだけ回せる。
                      バルブを回すと中央の扉のランプが1つ点き、3つで扉が開く
     B  指定番号の腕  番号の付いた腕（tag）を付けて照合装置へ。腕は粉砕されて扉が開く。
                      番号の腕が壊れて世界のどこにも無くなったら、台座に1本だけ補充される
     C  搬送コンベア  ベルトの死体に乗り移る＝固定されて運ばれる（S.STRAPPED）。
                      Space で頭だけになって次のベルトの死体へ。端の粉砕機に入ると死ぬ
     D  身体の組み立て 台座に 左腕→右腕→胴体 の順で自分の部位を置く。胴体を置くと頭になるので、
                      完成した身体に乗り移ると扉が開く
   ========================================================= */

const BK_STAGES = window.BK_STAGES || {};

/* ---------- 色と調整値 ---------- */
const STAGE_CFG = {
  fadeTime: 0.45,          // 暗転・明転にかける時間(s)
  fadeHold: 0.25,          // 真っ暗のまま待つ時間(s)
  deathWait: 1.6,          // 死んでから暗転し始めるまで(s)
  interactAngle: 0.62,     // 照準からこれ（rad）より外れた物には反応しない（近くの物は緩める）
  valveTime: 3.0,          // バルブを回す時間(s)
  corridorWall: 2.6,       // 通路の垂直な壁の高さ(m)。その上がかまぼこ天井
  doorSpeed: 1.6,          // 扉が開く速さ(1/s)
  lightPool: 8,            // 実際に光る点光源の数。照明器具は多いので、近い順にこの数だけ灯す
  lightRange: 15,
  playerR: 0.35,           // 壁との当たりの半径（人間）
  headR: 0.26,             // 同（頭）
  armRespawnDelay: 2.5,    // 指定の腕がなくなってから補充されるまで(s)
};
const TONE = {
  cold: 0xcfdcff, warm: 0xffd2a0, red: 0xff3a2a, green: 0xc8ffd2, amber: 0xffbf6a,
  dim: 0x9aaac4, spot: 0xfff0d6, fire: 0xff7428, dark: 0x445060,
};
const TONE_POWER = { cold: 1.1, warm: 1.1, red: 1.25, green: 1.0, amber: 1.0, dim: 0.75, spot: 1.5, fire: 1.6, dark: 0.4 };

/* ---------- 状態 ---------- */
const STG = {
  area: null,            // null（ステージ外）/ 'safe' / ステージID
  def: null,             // 今のエリアのデータ
  L: null,               // 今のエリアの建物（buildLevel の結果）
  levels: {},            // 建てた建物のキャッシュ
  prog: null,            // 進行（ミッション・扉・倒した戦闘）。死んでも消えない
  selected: null,        // セーフルームで選んだステージ
  fade: null,            // { t, phase:'out'|'hold'|'in', onBlack }
  dialog: null,          // 会話UI { lines, choices, idx }
  busy: null,            // 操作中（バルブ・提出・台座）。移動と攻撃を止める
  dead: 0,               // 死んでからの時間(s)
  pick: null,            // 今 F で反応する対象
  strap: null,           // 搬送中の死体に固定されている { corpse, lane }
  lights: [],            // 点光源のプール
  lightsAdded: false,
  enemies: [],           // このステージで湧かせた敵
  parts: [],             // このステージで置いた床の腕
  t: 0,
  msgT: 0,
  base: null,            // 入る前の霧・明るさ
};

/* ---------- 小さな道具 ---------- */
const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sv3 = new THREE.Vector3();
const _sm4 = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _se = new THREE.Euler();
const FACE_YAW = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 };   // 正面（ローカル+Z）をその向きへ
function faceVec(f) {
  return f === 'n' ? [0, -1] : f === 's' ? [0, 1] : f === 'e' ? [1, 0] : [-1, 0];
}
function rectOf(a) { return { x0: a[0], x1: a[1], z0: a[2], z1: a[3] }; }
function inR(r, x, z, m) { m = m || 0; return x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m; }
function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
function stageMsg(text, dur) { say(text, dur || 2.6); }

/* ---------- 文字や絵を描いたテクスチャ ---------- */
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.userData = { cv, ctx, draw };
  return tex;
}
function redrawTex(tex, draw) {
  const u = tex.userData;
  if (!u.ctx) return;
  u.ctx.clearRect(0, 0, u.cv.width, u.cv.height);
  draw(u.ctx, u.cv.width, u.cv.height);
  tex.needsUpdate = true;
}
const JP_FONT = '"Hiragino Mincho ProN","Yu Mincho","MS Mincho","Noto Serif JP",serif';
const JP_GOTH = '"Hiragino Kaku Gothic ProN","Yu Gothic","MS Gothic","Noto Sans JP",sans-serif';

// 看板。style: plate（金属の銘板）/ stencil（壁に吹き付けた文字）/ warn（黄黒の警告）/
//              notice（紙の貼り紙）/ big01（指定の腕の番号）
function signTexture(lines, style, aspect) {
  const W = 512, H = Math.max(64, Math.round(512 / aspect));
  return canvasTex(W, H, (c) => {
    let fg = '#e8e2cf', font = JP_GOTH, weight = 'bold';
    if (style === 'plate') {
      c.fillStyle = '#2b2f2a'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#8c8a78'; c.lineWidth = 6; c.strokeRect(5, 5, W - 10, H - 10);
      fg = '#e6dfc4';
    } else if (style === 'warn') {
      c.fillStyle = '#d8b020'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#181818';
      for (let x = -H; x < W; x += 44) {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 22, 0); c.lineTo(x + 22 + H * 0.25, H * 0.25);
        c.lineTo(x + H * 0.25, H * 0.25); c.fill();
        c.beginPath(); c.moveTo(x, H * 0.75); c.lineTo(x + 22, H * 0.75); c.lineTo(x + 22 + H * 0.25, H);
        c.lineTo(x + H * 0.25, H); c.fill();
      }
      c.fillStyle = '#d8b020'; c.fillRect(0, H * 0.26, W, H * 0.48);
      fg = '#141414';
    } else if (style === 'notice') {
      c.fillStyle = '#cfc6ad'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(90,70,40,0.25)';
      for (let i = 0; i < 40; i++) c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 20, 1 + Math.random() * 3);
      c.strokeStyle = '#7a1e18'; c.lineWidth = 4; c.strokeRect(10, 10, W - 20, H - 20);
      fg = '#2a2420'; font = JP_FONT;
    } else if (style === 'big01') {
      c.fillStyle = 'rgba(0,0,0,0)'; c.fillRect(0, 0, W, H);
      fg = '#e2b62a';
    } else {   // stencil
      fg = 'rgba(214,206,170,0.78)';
    }
    c.fillStyle = fg;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const n = lines.length;
    for (let i = 0; i < n; i++) {
      let size = Math.min(H / n * 0.66, W / Math.max(2, lines[i].length) * 1.05);
      if (style === 'big01' && i === 1) size = H * 0.62;
      if (style === 'big01' && i === 0) size = H * 0.2;
      c.font = weight + ' ' + Math.round(size) + 'px ' + font;
      const y = (style === 'big01') ? (i === 0 ? H * 0.16 : H * 0.62) : H * (i + 0.5) / n;
      c.fillText(lines[i], W / 2, y);
    }
    if (style === 'stencil') {
      // 吹き付けのかすれ
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) {
        c.fillStyle = 'rgba(0,0,0,' + (0.2 + Math.random() * 0.6) + ')';
        c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 2 + Math.random() * 6);
      }
      c.globalCompositeOperation = 'source-over';
    }
  });
}

// 「検体補助保管」の黄色い記号（ハーフライフ2のラムダマークに当たるもの）。
// この記号の近くには隠し通路と報酬がある、という約束にしてある
let _markTex = null;
function markTexture() {
  if (_markTex) return _markTex;
  _markTex = canvasTex(256, 256, (c, W, H) => {
    c.strokeStyle = 'rgba(232,186,40,0.9)'; c.fillStyle = 'rgba(232,186,40,0.9)';
    c.lineWidth = 16;
    c.beginPath(); c.arc(W / 2, H * 0.42, 70, 0, Math.PI * 2); c.stroke();
    // 中の記号：首から下のない頭（丸）と、下へ伸びる脊柱
    c.beginPath(); c.arc(W / 2, H * 0.34, 22, 0, Math.PI * 2); c.fill();
    c.fillRect(W / 2 - 6, H * 0.42, 12, 48);
    for (let i = 0; i < 3; i++) c.fillRect(W / 2 - 18, H * 0.45 + i * 14, 36, 6);
    c.font = 'bold 34px ' + JP_GOTH; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('検体補助保管', W / 2, H * 0.86);
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 180; i++) {
      c.fillStyle = 'rgba(0,0,0,' + (0.2 + Math.random() * 0.6) + ')';
      c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 7, 2 + Math.random() * 7);
    }
  });
  return _markTex;
}

// ガスの濃淡（タイルして流す）
let _gasTex = null;
function gasTexture() {
  if (_gasTex) return _gasTex;
  _gasTex = canvasTex(256, 256, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 18 + Math.random() * 46;
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  });
  _gasTex.wrapS = _gasTex.wrapT = THREE.RepeatWrapping;
  return _gasTex;
}

// ベルトの縞（流して動いて見せる）
let _beltTex = null;
function beltTexture() {
  if (_beltTex) return _beltTex;
  _beltTex = canvasTex(64, 256, (c, W, H) => {
    c.fillStyle = '#1b1c1e'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2c2e31';
    for (let y = 0; y < H; y += 32) c.fillRect(0, y, W, 10);
    c.fillStyle = 'rgba(120,30,24,0.35)';
    for (let i = 0; i < 12; i++) c.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 10, 3 + Math.random() * 14);
  });
  _beltTex.wrapS = _beltTex.wrapT = THREE.RepeatWrapping;
  return _beltTex;
}

/* ---------- 静的な形をまとめて1つのメッシュにする ----------
   壁・床・配管・ケーブルは数が多いので、材質ごとに1つの BufferGeometry にまとめる。
   頂点色に少しむらを入れて、湿ったコンクリートの汚れに見せる                       */
class Batch {
  constructor(mat) { this.mat = mat; this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  add(geo, m4, color, opts) {
    const o = opts || {};
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m4);
    const c = new THREE.Color(color === undefined ? 0xffffff : color);
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const grime = o.grime === undefined ? 0.22 : o.grime;
    const count = p.count;
    for (let i = 0; i < count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const j = o.flip ? i + (2 - k) : i + k;
        v.fromBufferAttribute(p, j).applyMatrix4(m4);
        nn.fromBufferAttribute(n, j).applyMatrix3(nm).normalize();
        if (o.flip) nn.negate();
        this.pos.push(v.x, v.y, v.z);
        this.nor.push(nn.x, nn.y, nn.z);
        // 汚れ：下ほど暗く、ところどころ濃いしみ
        let k2 = 1 - grime * 0.5 + grime * hash3(Math.floor(v.x * 0.7), Math.floor(v.y * 0.9), Math.floor(v.z * 0.7));
        if (o.lowDark && v.y < 1.0) k2 *= 0.72 + v.y * 0.28;
        this.col.push(c.r * k2, c.g * k2, c.b * k2);
        if (uv) this.uv.push(uv.getX(j), uv.getY(j)); else this.uv.push(0, 0);
      }
    }
    if (g !== geo) g.dispose();
  }
  mesh() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.mat);
    m.matrixAutoUpdate = false;
    return m;
  }
}

// 位置で 20m 四方のマスに分けて Batch を作る。マスごとに1メッシュなので、
// 画面の外・遠くのマスは描かれない（全部を1つにまとめると毎回レベル全体を描いてしまう）
class CellBatch {
  constructor(mat) { this.mat = mat; this.cells = new Map(); }
  add(geo, m4, color, opts) {
    const e = m4.elements;
    const key = Math.floor(e[12] / 20) + ',' + Math.floor(e[14] / 20);
    let b = this.cells.get(key);
    if (!b) { b = new Batch(this.mat); this.cells.set(key, b); }
    b.add(geo, m4, color, opts);
  }
  meshes() { const out = []; for (const b of this.cells.values()) { const m = b.mesh(); if (m) out.push(m); } return out; }
}

const STAGE_MAT = {};
function stageMats() {
  if (STAGE_MAT.concrete) return STAGE_MAT;
  const vc = (o) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o || {}));
  STAGE_MAT.concrete = vc();
  STAGE_MAT.floor = vc();
  STAGE_MAT.metal = vc();
  STAGE_MAT.dark = vc();
  STAGE_MAT.cable = vc();
  STAGE_MAT.wood = vc();
  STAGE_MAT.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  STAGE_MAT.glass = new THREE.MeshLambertMaterial({
    color: 0x8fb4c4, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  STAGE_MAT.grille = new THREE.MeshLambertMaterial({ color: 0x23262a, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    map: canvasTex(64, 64, (c, W, H) => {
      c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, W, H);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < W; i += 16) { c.fillRect(i, 0, 4, H); c.fillRect(0, i, W, 4); }
    }), alphaTest: 0.3 });
  STAGE_MAT.grille.map.wrapS = STAGE_MAT.grille.map.wrapT = THREE.RepeatWrapping;
  return STAGE_MAT;
}

// 箱（細かく割って頂点ライティングの光のむらが出るようにする）
function boxGeo(w, h, d, seg) {
  const s = seg || 2.6;
  return new THREE.BoxGeometry(w, h, d,
    Math.max(1, Math.ceil(w / s)), Math.max(1, Math.ceil(h / s)), Math.max(1, Math.ceil(d / s)));
}
function m4At(x, y, z, ry, rx, rz) {
  _se.set(rx || 0, ry || 0, rz || 0, 'YXZ');
  _sq.setFromEuler(_se);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _sq, new THREE.Vector3(1, 1, 1));
}
function addBox(b, x0, x1, y0, y1, z0, z1, color, opts) {
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01) return;
  b.add(boxGeo(x1 - x0, y1 - y0, z1 - z0, opts && opts.seg),
    m4At((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), color, opts);
}
// 床（上の面だけ。下は見えないので作らない）
function addFloor(b, x0, x1, z0, z1, y, color) {
  const w = x1 - x0, d = z1 - z0;
  if (w < 0.01 || d < 0.01) return;
  // 大きな床はマスごとに分ける（描かない範囲を作るため）
  const step = 20;
  for (let xa = x0; xa < x1 - 0.01; xa += step) for (let za = z0; za < z1 - 0.01; za += step) {
    const xb = Math.min(x1, xa + step), zb = Math.min(z1, za + step);
    const g = new THREE.PlaneGeometry(xb - xa, zb - za, Math.max(1, Math.ceil((xb - xa) / 2.6)), Math.max(1, Math.ceil((zb - za) / 2.6)));
    b.add(g, m4At((xa + xb) / 2, y, (za + zb) / 2, 0, -Math.PI / 2), color, { grime: 0.3 });
    g.dispose();
  }
}
// 2点を結ぶ円柱（配管・ケーブル）
function addRod(b, a, c, r, color, seg) {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return;
  const g = new THREE.CylinderGeometry(r, r, len, seg || 6, Math.max(1, Math.ceil(len / 5)));
  _sv1.set(dx, dy, dz).normalize();
  _sq.setFromUnitVectors(_sv2.set(0, 1, 0), _sv1);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), _sq, new THREE.Vector3(1, 1, 1));
  b.add(g, m, color, { grime: 0.1 });
  g.dispose();
}

/* =========================================================
   建てる（buildLevel）
   データの空間から床・壁・天井を作り、歩ける範囲・照明・扉・置き物を登録する。
   1つのエリアにつき1回だけ建て、出入りのたびに scene へ足し引きする
   ========================================================= */
const COL = {
  wall: 0x4b4842, wallCold: 0x464a4c, floor: 0x2f2d29, ceil: 0x2a2826, rib: 0x3a3833,
  pipe: 0x5b5f5c, pipeRust: 0x6a4a36, cable: 0x1a1a1c, cableRed: 0x5a1e1a, metal: 0x5d6064,
  darkMetal: 0x2c2e31, wood: 0x5a4632, white: 0xd8d4c8,
};

function buildLevel(def) {
  if (STG.levels[def.id]) return STG.levels[def.id];
  const M = stageMats();
  const ox = def.origin[0], oz = def.origin[2];
  const L = {
    def, ox, oz,
    group: new THREE.Group(),
    walk: [], solids: [], doors: {}, fixtures: [], gas: [], spaces: [],
    anim: [],                 // 毎フレーム動かす物 { update(dt) }
    researchers: [],
    batches: {
      concrete: new CellBatch(M.concrete), floor: new CellBatch(M.floor), metal: new CellBatch(M.metal),
      dark: new CellBatch(M.dark), cable: new CellBatch(M.cable), wood: new CellBatch(M.wood), glow: new CellBatch(M.glow),
    },
    X: (x) => x + ox, Z: (z) => z + oz,
  };
  L.group.name = 'stage-' + def.id;

  // --- 空間（ワールド座標に直す） ---
  def.spaces.forEach((s, i) => {
    const r = rectOf(s.r);
    const sp = Object.assign({}, s, {
      idx: i, x0: r.x0 + ox, x1: r.x1 + ox, z0: r.z0 + oz, z1: r.z1 + oz,
      fy: s.floorY || 0,
    });
    if (sp.type === 'corridor') {
      sp.alongX = (sp.x1 - sp.x0) > (sp.z1 - sp.z0);
      sp.w = sp.alongX ? sp.z1 - sp.z0 : sp.x1 - sp.x0;
      sp.r = sp.w / 2;
      sp.h = STAGE_CFG.corridorWall + sp.r;
    }
    if (sp.type === 'duct') sp.h = 1.5;
    if (sp.type === 'doorway') sp.h = 2.4;
    L.spaces.push(sp);
    const walk = (sp.walk !== false) && sp.type !== 'view';
    if (walk) L.walk.push({ x0: sp.x0, x1: sp.x1, z0: sp.z0, z1: sp.z1, head: sp.type === 'duct', id: sp.id, sp });
  });
  for (const w of (def.walks || [])) {
    const r = rectOf(w.r);
    L.walk.push({ x0: r.x0 + ox, x1: r.x1 + ox, z0: r.z0 + oz, z1: r.z1 + oz, head: !!w.head, id: w.id });
  }
  for (const g of (def.gas || [])) {
    const r = rectOf(g);
    L.gas.push({ x0: r.x0 + ox, x1: r.x1 + ox, z0: r.z0 + oz, z1: r.z1 + oz });
  }

  for (const sp of L.spaces) buildSpace(L, sp);
  for (const w of (def.windows || [])) buildWindow(L, w);
  for (const d of (def.doors || [])) buildDoor(L, d);
  for (const p of (def.props || [])) buildProp(L, p);
  for (const r of (def.researchers || [])) buildResearcher(L, r);
  for (const l of (def.lights || [])) {
    L.fixtures.push({ pos: new THREE.Vector3(l.x + ox, l.y, l.z + oz), tone: l.tone || 'cold' });
    if (l.tone === 'red' || l.tone === 'spot' || l.tone === 'fire') {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: TONE[l.tone] }));
      c.position.set(l.x + ox, l.y, l.z + oz);
      L.group.add(c);
    }
  }
  for (const g of L.gas) buildGas(L, g);
  buildGimmicks(L);

  for (const key of Object.keys(L.batches)) for (const m of L.batches[key].meshes()) L.group.add(m);
  L.batches = null;   // 頂点の配列はもう要らない
  STG.levels[def.id] = L;
  return L;
}

// 空間 sp の点 (x,z) を、ほかの空間が覆っているか
function otherSpaceAt(L, sp, x, z, strict) {
  for (const o of L.spaces) {
    if (o === sp || o.type === 'view') continue;
    if (strict) { if (x > o.x0 + 0.01 && x < o.x1 - 0.01 && z > o.z0 + 0.01 && z < o.z1 - 0.01) return o; }
    else if (x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1) return o;
  }
  return null;
}

// 通路の軸方向で、ほかの空間に入り込んでいない区間 [s0, s1]
function corridorSpan(L, sp, a0, a1, at) {
  const step = 0.25;
  let s0 = a0, s1 = a1;
  const P = (s) => sp.alongX ? [s, at] : [at, s];
  while (s0 < a1 && otherSpaceAt(L, sp, ...P(s0 + 0.01), true)) s0 += step;
  while (s1 > a0 && otherSpaceAt(L, sp, ...P(s1 - 0.01), true)) s1 -= step;
  return [s0, s1];
}

function buildSpace(L, sp) {
  const B = L.batches;
  const fy = sp.fy;
  const wallCol = sp.tone === 'cold' ? COL.wallCold : COL.wall;
  const W = sp.x1 - sp.x0, D = sp.z1 - sp.z0;
  const cx = (sp.x0 + sp.x1) / 2, cz = (sp.z0 + sp.z1) / 2;

  if (sp.type === 'duct') { buildDuct(L, sp); return; }
  if (sp.type === 'doorway') { buildDoorway(L, sp); return; }

  // --- 床 ---
  if (sp.type === 'corridor') {
    const [a0, a1] = sp.alongX ? corridorSpan(L, sp, sp.x0, sp.x1, cz) : corridorSpan(L, sp, sp.z0, sp.z1, cx);
    sp.span = [a0, a1];
    if (sp.alongX) addFloor(B.floor, a0, a1, sp.z0, sp.z1, fy, COL.floor);
    else addFloor(B.floor, sp.x0, sp.x1, a0, a1, fy, COL.floor);
    // 中央の排水溝
    if (sp.alongX) addBox(B.dark, a0, a1, fy, fy + 0.01, cz - 0.12, cz + 0.12, 0x151514, { grime: 0 });
    else addBox(B.dark, cx - 0.12, cx + 0.12, fy, fy + 0.01, a0, a1, 0x151514, { grime: 0 });
  } else {
    addFloor(B.floor, sp.x0, sp.x1, sp.z0, sp.z1, fy, COL.floor);
  }

  // --- 壁（辺ごとに、ほかの空間とつながっている所は抜く） ---
  const T = 0.4;
  const edges = [
    { axis: 'x', at: sp.z0, out: -1, a0: sp.x0, a1: sp.x1 },
    { axis: 'x', at: sp.z1, out: 1, a0: sp.x0, a1: sp.x1 },
    { axis: 'z', at: sp.x0, out: -1, a0: sp.z0, a1: sp.z1 },
    { axis: 'z', at: sp.x1, out: 1, a0: sp.z0, a1: sp.z1 },
  ];
  for (const e of edges) {
    const isShort = sp.type === 'corridor' && ((e.axis === 'x') === !sp.alongX);
    const H = sp.type === 'corridor' ? (isShort ? sp.h + 0.25 : STAGE_CFG.corridorWall) : sp.h;
    // 0.2m ごとに外側を調べ、同じ種類が続く区間にまとめる
    const segs = [];
    const step = 0.2;
    for (let a = e.a0; a < e.a1 - 0.001; a += step) {
      const b = Math.min(e.a1, a + step), m = (a + b) / 2;
      const px = e.axis === 'x' ? m : e.at, pz = e.axis === 'x' ? e.at : m;
      // 辺がほかの空間の内側にある（重なった部分）なら、その空間の壁に任せる
      const inside = otherSpaceAt(L, sp, px, pz, true);
      let kind;
      if (inside) kind = 'skip';
      else {
        const dup = otherSpaceAt(L, sp, px, pz, false);
        // 同じ線に先の空間の壁がある。通路の突き当たり（天井まで）は、低い壁の上だけを足す
        if (dup && dup.idx < sp.idx && dup.type !== 'duct') kind = (isShort && dup.type === 'corridor') ? 'upper' : 'skip';
        else {
          const ox2 = e.axis === 'x' ? px : px + e.out * 0.06;
          const oz2 = e.axis === 'x' ? pz + e.out * 0.06 : pz;
          const o = otherSpaceAt(L, sp, ox2, oz2, false);
          kind = !o ? 'wall' : o.type === 'duct' ? 'duct' : o.type === 'doorway' ? 'door' : 'open';
        }
      }
      const last = segs[segs.length - 1];
      if (last && last.kind === kind && Math.abs(last.b - a) < 0.002) last.b = b;
      else segs.push({ kind, a, b });
    }
    for (const s of segs) {
      if (s.kind === 'skip') continue;
      let y0 = fy;
      if (s.kind === 'open') y0 = (sp.type === 'corridor') ? (isShort ? 99 : 99) : 2.6;
      if (s.kind === 'door') y0 = 2.4;
      if (s.kind === 'upper') y0 = STAGE_CFG.corridorWall;
      if (s.kind === 'duct') y0 = 1.5;
      // 床が下がっている部屋（搬送ライン室）は、つながっている所でも床の高さまでは壁
      if (fy < 0 && s.kind !== 'wall') wallPiece(L, e, s.a, s.b, fy, 0, T, wallCol, sp);
      if (y0 < H) wallPiece(L, e, s.a, s.b, y0, H, T, wallCol, sp);
    }
  }

  // --- 天井 ---
  if (sp.type === 'corridor') buildArch(L, sp);
  else {
    // 天井（下向きの面だけ）
    {
      const w2 = sp.x1 - sp.x0 + 0.8, d2 = sp.z1 - sp.z0 + 0.8;
      for (let xa = sp.x0 - 0.4; xa < sp.x1 + 0.39; xa += 20) for (let za = sp.z0 - 0.4; za < sp.z1 + 0.39; za += 20) {
        const xb = Math.min(sp.x1 + 0.4, xa + 20), zb = Math.min(sp.z1 + 0.4, za + 20);
        const g = new THREE.PlaneGeometry(xb - xa, zb - za, Math.max(1, Math.ceil((xb - xa) / 3)), Math.max(1, Math.ceil((zb - za) / 3)));
        B.concrete.add(g, m4At((xa + xb) / 2, sp.h, (za + zb) / 2, 0, Math.PI / 2), COL.ceil, { grime: 0.3 });
        g.dispose();
      }
      void w2; void d2;
    }
    // 梁。短い方向に渡す
    const along = W > D;
    const n = Math.floor((along ? W : D) / 3.6);
    for (let i = 1; i < n; i++) {
      const t = (along ? sp.x0 : sp.z0) + (along ? W : D) * i / n;
      if (along) addBox(B.concrete, t - 0.18, t + 0.18, sp.h - 0.45, sp.h, sp.z0, sp.z1, COL.rib);
      else addBox(B.concrete, sp.x0, sp.x1, sp.h - 0.45, sp.h, t - 0.18, t + 0.18, COL.rib);
    }
    // 壁の上を這う配管とケーブル
    if (sp.type !== 'view' || sp.h > 4) {
      const y = sp.h - 0.75;
      if (along) {
        addRod(B.metal, [sp.x0, y, sp.z0 + 0.25], [sp.x1, y, sp.z0 + 0.25], 0.09, COL.pipe);
        addRod(B.cable, [sp.x0, y + 0.22, sp.z0 + 0.35], [sp.x1, y + 0.22, sp.z0 + 0.35], 0.035, COL.cable, 5);
        addRod(B.cable, [sp.x0, y + 0.3, sp.z0 + 0.42], [sp.x1, y + 0.3, sp.z0 + 0.42], 0.03, COL.cableRed, 5);
      } else {
        addRod(B.metal, [sp.x0 + 0.25, y, sp.z0], [sp.x0 + 0.25, y, sp.z1], 0.09, COL.pipe);
        addRod(B.cable, [sp.x0 + 0.35, y + 0.22, sp.z0], [sp.x0 + 0.35, y + 0.22, sp.z1], 0.035, COL.cable, 5);
        addRod(B.cable, [sp.x0 + 0.42, y + 0.3, sp.z0], [sp.x0 + 0.42, y + 0.3, sp.z1], 0.03, COL.cableRed, 5);
      }
    }
    // 照明（吊り下げの工業用）
    if (sp.lights !== false) {
      const nx = Math.max(1, Math.round(W / 8)), nz = Math.max(1, Math.round(D / 8));
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const x = sp.x0 + W * (i + 0.5) / nx, z = sp.z0 + D * (k + 0.5) / nz;
        const y = sp.h - 0.9;
        addRod(B.cable, [x, sp.h, z], [x, y + 0.2, z], 0.012, COL.cable, 4);
        const shade = new THREE.ConeGeometry(0.36, 0.26, 12, 1, true);
        B.metal.add(shade, m4At(x, y + 0.12, z), 0x3d4a3c, { grime: 0.05 });
        shade.dispose();
        const bulb = new THREE.SphereGeometry(0.1, 8, 6);
        B.glow.add(bulb, m4At(x, y, z), TONE[sp.tone || 'warm'] || 0xffffff, { grime: 0 });
        bulb.dispose();
        L.fixtures.push({ pos: new THREE.Vector3(x, y - 0.1, z), tone: sp.tone || 'warm' });
      }
    }
  }
}

// 壁の1区間。窓が掛かっていればそこを抜く
function wallPiece(L, e, a, b, y0, y1, T, col, sp) {
  const B = L.batches;
  // この壁の線に掛かる窓
  const cuts = [];
  for (const w of (L.def.windows || [])) {
    const at = (w.axis === 'x' ? (w.at + L.ox) : (w.at + L.oz));
    const wAxis = w.axis === 'x' ? 'z' : 'x';     // 窓の axis は「どの座標の壁か」。辺の向きと逆
    if (wAxis !== e.axis || Math.abs(at - e.at) > 0.01) continue;
    const off = (e.axis === 'x') ? L.ox : L.oz;
    const f = w.from + off, t = w.to + off;
    if (t <= a || f >= b) continue;
    cuts.push({ f: Math.max(a, f), t: Math.min(b, t), y0: w.y0, y1: w.y1 });
  }
  const put = (p, q, ya, yb) => {
    if (q - p < 0.01 || yb - ya < 0.01) return;
    // 角を閉じるため、矩形の角に接する端は壁の厚みぶん伸ばす
    let pp = p, qq = q;
    if (Math.abs(p - e.a0) < 0.01) pp -= T;
    if (Math.abs(q - e.a1) < 0.01) qq += T;
    if (e.axis === 'x') {
      const z0 = e.out < 0 ? e.at - T : e.at, z1 = e.out < 0 ? e.at : e.at + T;
      addBox(B.concrete, pp, qq, ya, yb, z0, z1, col, { lowDark: true });
    } else {
      const x0 = e.out < 0 ? e.at - T : e.at, x1 = e.out < 0 ? e.at : e.at + T;
      addBox(B.concrete, x0, x1, ya, yb, pp, qq, col, { lowDark: true });
    }
  };
  if (!cuts.length) { put(a, b, y0, y1); return; }
  cuts.sort((m, n) => m.f - n.f);
  let cur = a;
  for (const c of cuts) {
    put(cur, c.f, y0, y1);
    put(c.f, c.t, y0, Math.min(y1, c.y0));
    put(c.f, c.t, Math.max(y0, c.y1), y1);
    cur = c.t;
  }
  put(cur, b, y0, y1);
}

// かまぼこ天井（通路）。リブ・ケーブル・配管・蛍光灯もここで付ける
function buildArch(L, sp) {
  const B = L.batches;
  const [a0, a1] = sp.span;
  const len = a1 - a0;
  if (len <= 0.05) return;
  const r = sp.r, yb = STAGE_CFG.corridorWall;
  const mid = (a0 + a1) / 2;
  const cx = (sp.x0 + sp.x1) / 2, cz = (sp.z0 + sp.z1) / 2;
  const radial = Math.max(8, Math.round(r * 6));
  // 長い通路は 12m ずつに分ける（遠くの区間を描かないため）
  const nChunk = Math.max(1, Math.ceil(len / 12));
  const chunks = [];
  for (let i = 0; i < nChunk; i++) chunks.push([a0 + len * i / nChunk, a0 + len * (i + 1) / nChunk]);
  for (const [c0, c1] of chunks) {
    const cl = c1 - c0, cm = (c0 + c1) / 2;
    const g = new THREE.CylinderGeometry(r, r, cl, radial, Math.max(1, Math.ceil(cl / 2.6)), true,
      sp.alongX ? 0 : Math.PI / 2, Math.PI);
    // 円柱の軸（Y）を通路の向きへ。内側から見るので面を裏返す
    const m = sp.alongX ? m4At(cm, yb, cz, 0, 0, Math.PI / 2) : m4At(cx, yb, cm, 0, Math.PI / 2, 0);
    B.concrete.add(g, m, sp.tone === 'cold' ? COL.wallCold : COL.wall, { flip: true });
    g.dispose();
  }
  void mid;
  // 端がほかの空間につながっているときは、天井の切れ目を塞ぐ（入口の上の壁）
  for (const [t, dir] of [[a0, 1], [a1, -1]]) {
    const atEdge = sp.alongX ? (Math.abs(t - sp.x0) < 0.01 || Math.abs(t - sp.x1) < 0.01)
                             : (Math.abs(t - sp.z0) < 0.01 || Math.abs(t - sp.z1) < 0.01);
    if (atEdge) continue;
    const p0 = t + dir * 0.02, p1 = t + dir * 0.32;
    if (sp.alongX) addBox(B.concrete, Math.min(p0, p1), Math.max(p0, p1), yb, yb + r + 0.3, sp.z0 - 0.4, sp.z1 + 0.4, COL.wall);
    else addBox(B.concrete, sp.x0 - 0.4, sp.x1 + 0.4, yb, yb + r + 0.3, Math.min(p0, p1), Math.max(p0, p1), COL.wall);
  }
  // リブ（3.2m おき）
  for (let s = a0 + 1.6; s < a1 - 0.5; s += 3.2) {
    const rg = new THREE.CylinderGeometry(r - 0.07, r - 0.07, 0.3, radial, 1, true, sp.alongX ? 0 : Math.PI / 2, Math.PI);
    const rm = sp.alongX ? m4At(s, yb, cz, 0, 0, Math.PI / 2) : m4At(cx, yb, s, 0, Math.PI / 2, 0);
    B.concrete.add(rg, rm, COL.rib, { flip: true });
    rg.dispose();
    // リブの下の柱型
    if (sp.alongX) {
      addBox(B.concrete, s - 0.15, s + 0.15, 0, yb, sp.z0, sp.z0 + 0.1, COL.rib);
      addBox(B.concrete, s - 0.15, s + 0.15, 0, yb, sp.z1 - 0.1, sp.z1, COL.rib);
    } else {
      addBox(B.concrete, sp.x0, sp.x0 + 0.1, 0, yb, s - 0.15, s + 0.15, COL.rib);
      addBox(B.concrete, sp.x1 - 0.1, sp.x1, 0, yb, s - 0.15, s + 0.15, COL.rib);
    }
  }
  // 天井を這うケーブルの束と、壁沿いの配管
  const top = yb + r;
  const P = (s, side, y) => sp.alongX ? [s, y, cz + side] : [cx + side, y, s];
  const cables = [[-0.34, top - 0.24, COL.cable, 0.035], [-0.2, top - 0.17, COL.cable, 0.03],
                  [0.1, top - 0.14, COL.cableRed, 0.03], [0.26, top - 0.2, COL.cable, 0.04],
                  [0.42, top - 0.3, COL.cable, 0.028]];
  const wallIn = r - 0.18;
  for (const [c0, c1] of chunks) {
    for (const [side, y, col, rr] of cables) {
      if (Math.abs(side) > r * 0.6) continue;
      addRod(B.cable, P(c0, side * r / 2, y), P(c1, side * r / 2, y), rr, col, 4);
    }
    addRod(B.metal, P(c0, -wallIn, 2.25), P(c1, -wallIn, 2.25), 0.075, COL.pipe);
    addRod(B.metal, P(c0, -wallIn + 0.05, 2.02), P(c1, -wallIn + 0.05, 2.02), 0.05, COL.pipeRust);
    if (r > 1.2) addRod(B.metal, P(c0, wallIn, 0.42), P(c1, wallIn, 0.42), 0.1, COL.pipe);
  }
  // 蛍光灯（6m おき）
  if (sp.lights !== false) {
    for (let s = a0 + 3; s < a1 - 1; s += 6) {
      const [x, y, z] = P(s, 0, top - 0.28);
      const tube = sp.alongX ? boxGeo(1.2, 0.06, 0.12) : boxGeo(0.12, 0.06, 1.2);
      B.glow.add(tube, m4At(x, y, z), TONE[sp.tone || 'cold'], { grime: 0 });
      tube.dispose();
      const hous = sp.alongX ? boxGeo(1.3, 0.06, 0.22) : boxGeo(0.22, 0.06, 1.3);
      B.metal.add(hous, m4At(x, y + 0.06, z), COL.darkMetal, { grime: 0 });
      hous.dispose();
      L.fixtures.push({ pos: new THREE.Vector3(x, y - 0.1, z), tone: sp.tone || 'cold' });
    }
  }
}

// ダクト（頭だけが通れる低い横穴）。外から見えないよう、面は内向きだけ
function buildDuct(L, sp) {
  const B = L.batches;
  const alongX = (sp.x1 - sp.x0) > (sp.z1 - sp.z0);
  sp.alongX = alongX;
  const cx = (sp.x0 + sp.x1) / 2, cz = (sp.z0 + sp.z1) / 2;
  const [a0, a1] = alongX ? corridorSpan(L, sp, sp.x0, sp.x1, cz) : corridorSpan(L, sp, sp.z0, sp.z1, cx);
  const H = 1.5, col = 0x3c3f42;
  const len = a1 - a0, w = alongX ? sp.z1 - sp.z0 : sp.x1 - sp.x0;
  const mk = (gw, gh, x, y, z, ry, rx) => {
    const g = new THREE.PlaneGeometry(gw, gh, Math.max(1, Math.ceil(gw / 1.2)), 1);
    B.metal.add(g, m4At(x, y, z, ry || 0, rx || 0), col, { grime: 0.3 });
    g.dispose();
  };
  if (alongX) {
    const mx = (a0 + a1) / 2;
    mk(len, w, mx, 0.02, cz, 0, -Math.PI / 2);          // 床
    mk(len, w, mx, H, cz, 0, Math.PI / 2);              // 天井（下向き）
    mk(len, H, mx, H / 2, sp.z0, 0);                    // 北の壁（南向き）
    mk(len, H, mx, H / 2, sp.z1, Math.PI);              // 南の壁（北向き）
    for (let s = a0 + 0.6; s < a1; s += 1.2) addBox(B.dark, s - 0.03, s + 0.03, 0.02, H, sp.z0, sp.z0 + 0.04, 0x222426);
  } else {
    const mz = (a0 + a1) / 2;
    mk(w, len, cx, 0.02, mz, 0, -Math.PI / 2);
    mk(w, len, cx, H, mz, 0, Math.PI / 2);
    mk(len, H, sp.x0, H / 2, mz, Math.PI / 2);
    mk(len, H, sp.x1, H / 2, mz, -Math.PI / 2);
    for (let s = a0 + 0.6; s < a1; s += 1.2) addBox(B.dark, sp.x0, sp.x0 + 0.04, 0.02, H, s - 0.03, s + 0.03, 0x222426);
  }
  // 口の枠（格子を外した跡）
  for (const t of [a0, a1]) {
    if (alongX) addBox(B.metal, t - 0.05, t + 0.05, H - 0.08, H + 0.04, sp.z0, sp.z1, 0x55585a);
    else addBox(B.metal, sp.x0, sp.x1, H - 0.08, H + 0.04, t - 0.05, t + 0.05, 0x55585a);
  }
  // 中が見えるように薄い灯り
  L.fixtures.push({ pos: new THREE.Vector3(cx, 1.3, cz), tone: 'dim' });
}

// 壁と壁のあいだの短い戸口
function buildDoorway(L, sp) {
  const B = L.batches;
  const alongX = (sp.x1 - sp.x0) > (sp.z1 - sp.z0);
  const cx = (sp.x0 + sp.x1) / 2, cz = (sp.z0 + sp.z1) / 2;
  const [a0, a1] = alongX ? corridorSpan(L, sp, sp.x0, sp.x1, cz) : corridorSpan(L, sp, sp.z0, sp.z1, cx);
  if (alongX) {
    addFloor(B.floor, a0, a1, sp.z0, sp.z1, 0, COL.floor);
    addBox(B.concrete, a0, a1, 0, 2.7, sp.z0 - 0.3, sp.z0, COL.wall);
    addBox(B.concrete, a0, a1, 0, 2.7, sp.z1, sp.z1 + 0.3, COL.wall);
    addBox(B.concrete, a0, a1, 2.4, 2.7, sp.z0, sp.z1, COL.wall);
  } else {
    addFloor(B.floor, sp.x0, sp.x1, a0, a1, 0, COL.floor);
    addBox(B.concrete, sp.x0 - 0.3, sp.x0, 0, 2.7, a0, a1, COL.wall);
    addBox(B.concrete, sp.x1, sp.x1 + 0.3, 0, 2.7, a0, a1, COL.wall);
    addBox(B.concrete, sp.x0, sp.x1, 2.4, 2.7, a0, a1, COL.wall);
  }
}

// 窓。ガラス（または格子）と枠
function buildWindow(L, w) {
  const B = L.batches, M = stageMats();
  const at = w.axis === 'x' ? w.at + L.ox : w.at + L.oz;
  const off = w.axis === 'x' ? L.oz : L.ox;
  const f = w.from + off, t = w.to + off;
  const len = t - f, hh = w.y1 - w.y0, mid = (f + t) / 2, my = (w.y0 + w.y1) / 2;
  const mat = w.style === 'grille' ? M.grille : M.glass;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, hh), mat);
  if (w.axis === 'x') { pane.position.set(at, my, mid); pane.rotation.y = Math.PI / 2; }
  else pane.position.set(mid, my, at);
  if (w.style === 'grille') { mat.map.repeat.set(len * 2, hh * 2); }
  L.group.add(pane);
  // 枠
  const fr = 0.06, col = 0x2f3236;
  if (w.axis === 'x') {
    addBox(B.metal, at - 0.04, at + 0.04, w.y0 - fr, w.y0, f, t, col);
    addBox(B.metal, at - 0.04, at + 0.04, w.y1, w.y1 + fr, f, t, col);
    addBox(B.metal, at - 0.04, at + 0.04, w.y0, w.y1, f - fr, f, col);
    addBox(B.metal, at - 0.04, at + 0.04, w.y0, w.y1, t, t + fr, col);
    for (let s = f + 1.2; s < t - 0.3; s += 1.2) addBox(B.metal, at - 0.03, at + 0.03, w.y0, w.y1, s - 0.025, s + 0.025, col);
  } else {
    addBox(B.metal, f, t, w.y0 - fr, w.y0, at - 0.04, at + 0.04, col);
    addBox(B.metal, f, t, w.y1, w.y1 + fr, at - 0.04, at + 0.04, col);
    addBox(B.metal, f - fr, f, w.y0, w.y1, at - 0.04, at + 0.04, col);
    addBox(B.metal, t, t + fr, w.y0, w.y1, at - 0.04, at + 0.04, col);
    for (let s = f + 1.2; s < t - 0.3; s += 1.2) addBox(B.metal, s - 0.025, s + 0.025, w.y0, w.y1, at - 0.03, at + 0.03, col);
  }
}

// 血液凝固ガス。床から薄く漂う何枚かの層
function buildGas(L, g) {
  const w = g.x1 - g.x0, d = g.z1 - g.z0;
  const tex = gasTexture();
  for (const [y, op, sc] of [[0.1, 0.32, 0.25], [0.42, 0.2, 0.18], [0.85, 0.09, 0.14]]) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w * sc, d * sc);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: 0xc8b8a0, map: t, transparent: true, opacity: op,
        depthWrite: false, side: THREE.DoubleSide, fog: true }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((g.x0 + g.x1) / 2, y, (g.z0 + g.z1) / 2);
    m.renderOrder = 2;
    L.group.add(m);
    const sp = 0.012 + y * 0.01;
    L.anim.push({ update: (dt) => { t.offset.x += dt * sp; t.offset.y += dt * sp * 0.6; } });
  }
}

/* ---------- 扉 ----------
   blast（防爆扉・上へ開く）/ shutter（巻き上げ・上へ）/ hatch（点検扉・横へ滑る）。
   閉じている間は r が歩けない。decor は飾り（開かない・当たりもない）              */
const DOOR_COL = { blast: 0x4b5154, shutter: 0x55534a, hatch: 0x50565a };
let _hazardTex = null;
function hazardTexture() {
  if (_hazardTex) return _hazardTex;
  _hazardTex = canvasTex(256, 32, (c, W, H) => {
    c.fillStyle = '#d4a81e'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#16161a';
    for (let x = -H; x < W + H; x += 36) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 18, 0); c.lineTo(x + 18 + H, H); c.lineTo(x + H, H); c.fill();
    }
  });
  _hazardTex.wrapS = THREE.RepeatWrapping;
  return _hazardTex;
}

function buildDoor(L, d) {
  const axis = d.axis;
  const at = axis === 'x' ? d.at + L.oz : d.at + L.ox;
  const off = axis === 'x' ? L.ox : L.oz;
  const f = d.from + off, t = d.to + off, w = t - f, mid = (f + t) / 2, h = d.h || 2.6;
  // どちら側に壁の厚みがあるか（その辺を持つ空間の外側）。部屋を優先する
  let out = 1, found = null;
  for (const sp of L.spaces) {
    if (sp.type === 'duct' || sp.type === 'doorway') continue;
    const e0 = axis === 'x' ? sp.z0 : sp.x0, e1 = axis === 'x' ? sp.z1 : sp.x1;
    const a0 = axis === 'x' ? sp.x0 : sp.z0, a1 = axis === 'x' ? sp.x1 : sp.z1;
    if (a0 > f + 0.01 || a1 < t - 0.01) continue;
    let o = 0;
    if (Math.abs(e0 - at) < 0.01) o = -1; else if (Math.abs(e1 - at) < 0.01) o = 1;
    if (!o) continue;
    if (!found || (found.type !== 'room' && sp.type === 'room')) { found = sp; out = o; }
  }
  const perp = d.decor ? at - out * 0.07 : at + out * 0.2;
  const g = new THREE.Group();
  if (axis === 'x') g.position.set(mid, 0, perp); else { g.position.set(perp, 0, mid); g.rotation.y = Math.PI / 2; }
  // ここから先、g のローカルで x = 扉の幅方向、z = 厚み方向
  const style = d.style || 'blast';
  const thick = style === 'hatch' ? 0.12 : 0.3;
  const panel = new THREE.Group();
  const pm = new THREE.MeshLambertMaterial({ color: DOOR_COL[style] || 0x4b5154 });
  const body = new THREE.Mesh(boxGeo(w, h, thick, 0.8), pm);
  body.position.y = h / 2;
  panel.add(body);
  for (const s of [-1, 1]) {
    if (style === 'blast') {
      // 下端の警告帯と、真ん中のハンドル
      const tex = hazardTexture().clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(w / 1.6, 1);
      const band = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.32), new THREE.MeshLambertMaterial({ map: tex }));
      band.position.set(0, 0.3, s * (thick / 2 + 0.005)); if (s < 0) band.rotation.y = Math.PI;
      panel.add(band);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 18), new THREE.MeshLambertMaterial({ color: 0x2c2f31 }));
      wheel.position.set(0, h * 0.5, s * (thick / 2 + 0.06));
      panel.add(wheel);
      for (let k = 0; k < 2; k++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.04), wheel.material);
        sp.position.copy(wheel.position); sp.rotation.z = k * Math.PI / 2;
        panel.add(sp);
      }
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.02), new THREE.MeshLambertMaterial({ color: 0x24272a }));
      seam.position.set(0, h / 2, s * (thick / 2 + 0.01));
      panel.add(seam);
    } else if (style === 'shutter') {
      for (let y = 0.2; y < h; y += 0.22) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.02), new THREE.MeshLambertMaterial({ color: 0x3c3b35 }));
        slat.position.set(0, y, s * (thick / 2 + 0.01));
        panel.add(slat);
      }
    } else {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshBasicMaterial({ color: 0x0c1012 }));
      win.position.set(0, h * 0.72, s * (thick / 2 + 0.005)); if (s < 0) win.rotation.y = Math.PI;
      panel.add(win);
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.06), new THREE.MeshLambertMaterial({ color: 0x8a8d90 }));
      knob.position.set(w * 0.36, h * 0.45, s * (thick / 2 + 0.03));
      panel.add(knob);
    }
  }
  g.add(panel);
  // 枠
  const fm = new THREE.MeshLambertMaterial({ color: 0x26292c });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.25, thick + 0.25), fm);
    post.position.set(s * (w / 2 + 0.11), (h + 0.25) / 2, 0);
    g.add(post);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(w + 0.44, 0.25, thick + 0.25), fm);
  head.position.set(0, h + 0.125, 0);
  g.add(head);
  // ランプ（閉＝赤 / 開＝緑）。両側に付ける
  let lamps = [];
  if (d.lamp || !d.decor) {
    for (const s of [-1, 1]) {
      const lm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      lm.position.set(w / 2 + 0.11, h + 0.42, s * (thick / 2 + 0.16));
      g.add(lm);
      lamps.push(lm);
    }
  }
  L.group.add(g);
  const r = axis === 'x' ? { x0: f, x1: t, z0: perp - 0.55, z1: perp + 0.55 }
                         : { x0: perp - 0.55, x1: perp + 0.55, z0: f, z1: t };
  L.doors[d.id] = {
    id: d.id, def: d, axis, style, w, h, group: g, panel, lamps, r,
    open: !!d.open, k: d.open ? 1 : 0, decor: !!d.decor, out,
    center: new THREE.Vector3(axis === 'x' ? mid : at, 0, axis === 'x' ? at : mid),
  };
  applyDoorPose(L.doors[d.id]);
}

function applyDoorPose(dr) {
  if (dr.style === 'hatch') dr.panel.position.x = dr.k * (dr.w + 0.1);
  else dr.panel.position.y = dr.k * (dr.h + 0.15);
  dr.panel.visible = dr.k < 0.999 || dr.style === 'hatch';
  const on = dr.open ? 0x3aff7a : (dr.locked ? 0xff2a1a : 0xff2a1a);
  for (const lm of dr.lamps) lm.material.color.setHex(on);
}

function setDoor(id, open, instant) {
  const dr = STG.L && STG.L.doors[id];
  if (!dr || dr.decor) return;
  if (dr.open === open) return;
  dr.open = open;
  if (instant) dr.k = open ? 1 : 0;
  applyDoorPose(dr);
  if (!instant) sfx(open ? 'equip' : 'bonk');
}

/* ---------- 置き物 ---------- */
// 正面（ローカル+Z）を face に向けた局所座標 → ワールド座標
function propFrame(L, p) {
  const yaw = p.face ? FACE_YAW[p.face] : (p.rot || 0);
  const x = p.x + L.ox, z = p.z + L.oz, c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    yaw, x, z,
    at: (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c],
  };
}
function lbox(b, F, lx0, lx1, y0, y1, lz0, lz1, color, opts) {
  const [x, y, z] = F.at((lx0 + lx1) / 2, (y0 + y1) / 2, (lz0 + lz1) / 2);
  const g = boxGeo(lx1 - lx0, y1 - y0, lz1 - lz0, opts && opts.seg);
  b.add(g, m4At(x, y, z, F.yaw), color, opts);
  g.dispose();
}
function lcyl(b, F, lx, y0, y1, lz, r, color, seg) {
  const [x, y, z] = F.at(lx, (y0 + y1) / 2, lz);
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg || 12, 1);
  b.add(g, m4At(x, y, z, F.yaw), color, { grime: 0.15 });
  g.dispose();
}
// 正面を向いた円盤（計器の文字盤）
function ldisc(b, F, lx, ly, lz, r, color) {
  const [x, y, z] = F.at(lx, ly, lz);
  const g = new THREE.CylinderGeometry(r, r, 0.02, 14, 1);
  b.add(g, m4At(x, y, z, F.yaw, Math.PI / 2), color, { grime: 0 });
  g.dispose();
}
function addSolid(L, F, w, d, pad) {
  const rot = Math.abs(Math.sin(F.yaw)) > 0.7;
  const hw = (rot ? d : w) / 2 + (pad || 0), hd = (rot ? w : d) / 2 + (pad || 0);
  L.solids.push({ x0: F.x - hw, x1: F.x + hw, z0: F.z - hd, z1: F.z + hd });
}
function spaceAt(L, x, z) {
  for (const sp of L.spaces) if (sp.type !== 'view' && x >= sp.x0 && x <= sp.x1 && z >= sp.z0 && z <= sp.z1) return sp;
  return null;
}
// 文字の板（両面ではなく正面だけ）
function textPlane(L, lines, style, w, h, x, y, z, face) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: signTexture(lines, style, w / h), transparent: true,
      depthWrite: style === 'plate' || style === 'warn' || style === 'notice', side: THREE.FrontSide }));
  m.position.set(x, y, z);
  m.rotation.y = FACE_YAW[face];
  L.group.add(m);
  return m;
}
// 小さなCRT（緑の文字）。update で書き換えられるように canvas を持っておく
function makeCrt(L, x, y, z, yaw, w, lines, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const hh = w * 0.78;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w * 1.15, hh * 1.15, w * 0.9), new THREE.MeshLambertMaterial({ color: 0xbdb39a }));
  g.add(body);
  const tex = canvasTex(256, 200, (c, W, H) => drawCrt(c, W, H, lines, o.color));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.z = w * 0.451;
  g.add(scr);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  L.group.add(g);
  return { group: g, tex, set: (ls, col) => redrawTex(tex, (c, W, H) => drawCrt(c, W, H, ls, col)) };
}
function drawCrt(c, W, H, lines, color) {
  c.fillStyle = '#071209'; c.fillRect(0, 0, W, H);
  c.fillStyle = color || '#6dff9a';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const n = Math.max(1, lines.length);
  for (let i = 0; i < n; i++) {
    const t = lines[i] || '';
    const size = Math.min(H / n * 0.6, W / Math.max(3, t.length) * 1.6, 46);
    c.font = 'bold ' + Math.round(size) + 'px ' + JP_GOTH;
    c.fillText(t, W / 2, H * (i + 0.5) / n);
  }
  c.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
}

function buildProp(L, p) {
  const B = L.batches, F = propFrame(L, p);
  const sp = spaceAt(L, F.x, F.z);
  switch (p.type) {
    case 'pillar': {
      const h = sp ? sp.h : 4;
      lbox(B.concrete, F, -p.w / 2, p.w / 2, 0, h, -p.d / 2, p.d / 2, COL.wall, { lowDark: true });
      lbox(B.dark, F, -p.w / 2 - 0.02, p.w / 2 + 0.02, 0.9, 1.05, -p.d / 2 - 0.02, p.d / 2 + 0.02, 0xa08a28, { grime: 0.3 });
      addSolid(L, F, p.w, p.d);
      break;
    }
    case 'crate': {
      lbox(B.wood, F, -p.w / 2, p.w / 2, 0, p.h, -p.d / 2, p.d / 2, COL.wood);
      lbox(B.dark, F, -p.w / 2 - 0.01, p.w / 2 + 0.01, p.h * 0.45, p.h * 0.55, -p.d / 2 - 0.01, p.d / 2 + 0.01, 0x2a2018);
      addSolid(L, F, p.w, p.d);
      break;
    }
    case 'shelf': {
      const w = p.w, d = p.d, h = p.h;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lbox(B.metal, F, sx * w / 2 - 0.03, sx * w / 2 + 0.03, 0, h, sz * d / 2 - 0.03, sz * d / 2 + 0.03, COL.darkMetal);
      for (let y = 0.15; y < h; y += 0.6) {
        lbox(B.metal, F, -w / 2, w / 2, y, y + 0.03, -d / 2, d / 2, 0x4a4d4f);
        // 棚の上の物（瓶か箱）
        for (let x = -w / 2 + 0.25; x < w / 2 - 0.15; x += 0.34 + hash3(x, y, F.x) * 0.2) {
          if (hash3(x, y, F.z) < 0.25) continue;
          if (p.jars) {
            lcyl(B.glow, F, x, y + 0.03, y + 0.36, 0, 0.1, 0x3a3a1e, 6);
            lcyl(B.metal, F, x, y + 0.36, y + 0.4, 0, 0.105, 0x2a2a2a, 6);
          } else lbox(B.wood, F, x - 0.13, x + 0.13, y + 0.03, y + 0.28, -d / 2 + 0.06, d / 2 - 0.06, 0x6a5a40);
        }
      }
      if (p.solid !== false) addSolid(L, F, w, d, 0.02);
      break;
    }
    case 'machine': {
      const w = p.w, d = p.d, h = p.h;
      if (p.style === 'console') {
        lbox(B.metal, F, -w / 2, w / 2, 0, h * 0.62, -d / 2, d / 2, 0x5a5e58);
        lbox(B.metal, F, -w / 2, w / 2, h * 0.62, h, -d / 2, 0, 0x50544e);
        for (let i = 0; i < 18; i++) {
          const lx = -w / 2 + 0.2 + (w - 0.4) * hash3(i, F.x, 1), ly = h * 0.66 + (h * 0.3) * hash3(i, F.z, 2);
          const colr = [0xff3a2a, 0x3aff7a, 0xffc040, 0xdfe8ff][i % 4];
          lbox(B.glow, F, lx - 0.04, lx + 0.04, ly - 0.03, ly + 0.03, 0.005, 0.03, colr, { grime: 0 });
          lbox(B.glow, F, lx - 0.04, lx + 0.04, ly - 0.03, ly + 0.03, -d / 2 - 0.03, -d / 2 - 0.005, colr, { grime: 0 });
        }
      } else if (p.style === 'pump') {
        lbox(B.metal, F, -w / 2, w / 2, 0, h * 0.5, -d / 2, d / 2, 0x4c5048);
        lcyl(B.metal, F, -w * 0.22, h * 0.5, h, 0, w * 0.2, 0x5d6158, 16);
        lcyl(B.metal, F, w * 0.22, h * 0.5, h, 0, w * 0.2, 0x5d6158, 16);
        addRod(B.metal, F.at(-w * 0.22, h, 0), F.at(-w * 0.22, h + 1.6, 0), 0.18, COL.pipeRust);
        addRod(B.metal, F.at(w * 0.22, h, 0), F.at(w * 0.22, h + 1.6, 0), 0.18, COL.pipeRust);
      } else {
        lbox(B.metal, F, -w / 2, w / 2, 0, h, -d / 2, d / 2, 0x52574f);
        for (let i = 0; i < 4; i++) {
          const lx = -w / 2 + w * (i + 0.5) / 4;
          ldisc(B.glow, F, lx, h * 0.62, d / 2 + 0.01, 0.13, 0xd8d0b8);
        }
      }
      if (p.label) {
        const [x, , z] = F.at(0, 0, d / 2 + 0.02);
        textPlane(L, [p.label], 'plate', Math.min(w * 0.8, 2.2), 0.32, x, h * 0.35, z, p.face || 's');
      }
      addSolid(L, F, w, d);
      break;
    }
    case 'tank': {
      lcyl(B.metal, F, 0, 0, p.h, 0, p.r, 0x58605a, 18);
      for (const y of [0.4, p.h * 0.5, p.h - 0.3]) lcyl(B.dark, F, 0, y, y + 0.12, 0, p.r + 0.03, 0x2c302e, 18);
      lcyl(B.glow, F, 0, p.h * 0.55, p.h * 0.8, p.r - 0.02, 0.18, 0x5a7a30, 8);   // 覗き窓（液が見える）
      addRod(B.metal, [F.x, p.h, F.z], [F.x, (sp ? sp.h : 5), F.z], 0.12, COL.pipe);
      addSolid(L, F, p.r * 2, p.r * 2);
      break;
    }
    case 'desk': {
      const w = p.w, d = p.d;
      lbox(B.wood, F, -w / 2, w / 2, 0.74, 0.8, -d / 2, d / 2, 0x4a3c2c);
      for (const sx of [-1, 1]) lbox(B.metal, F, sx * w / 2 - 0.05 * sx - 0.03, sx * w / 2 - 0.05 * sx + 0.03, 0, 0.74, -d / 2 + 0.05, d / 2 - 0.05, COL.darkMetal);
      if (p.crt) {
        const [x, , z] = F.at(-w * 0.2, 0, -d * 0.1);
        makeCrt(L, x, 1.05, z, F.yaw, 0.42, [p.crt, '▮'], {});
      }
      if (p.phone) {
        lbox(B.dark, F, w * 0.25, w * 0.25 + 0.22, 0.8, 0.88, -0.1, 0.08, 0x141414);
        lbox(B.dark, F, w * 0.25 - 0.01, w * 0.25 + 0.23, 0.88, 0.93, -0.08, -0.02, 0x141414);
      }
      if (p.papers) for (let i = 0; i < 4; i++) {
        const lx = w * 0.05 + 0.12 * i, lz = d * 0.1 - 0.06 * i;
        lbox(B.glow, F, lx - 0.1, lx + 0.1, 0.8 + i * 0.002, 0.802 + i * 0.002, lz - 0.14, lz + 0.14, 0xb8b2a0, { grime: 0.1 });
      }
      if (p.solid !== false) addSolid(L, F, w, d);
      break;
    }
    case 'counter': {
      lbox(B.wood, F, -p.w / 2, p.w / 2, 0, p.h, -p.d / 2, p.d / 2, 0x4e4032);
      lbox(B.wood, F, -p.w / 2 - 0.05, p.w / 2 + 0.05, p.h, p.h + 0.05, -p.d / 2 - 0.05, p.d / 2 + 0.05, 0x3a2e22);
      addSolid(L, F, p.w, p.d);
      break;
    }
    case 'panel': {
      const w = p.w || 1.2;
      lbox(B.metal, F, -w / 2, w / 2, 0.9, 2.2, 0, 0.16, 0x4d5450);
      for (let i = 0; i < 8; i++) {
        const lx = -w / 2 + 0.15 + (w - 0.3) * (i % 4) / 3, ly = 1.3 + Math.floor(i / 4) * 0.35;
        lbox(B.dark, F, lx - 0.02, lx + 0.02, ly, ly + 0.1, 0.16, 0.22, 0x1c1c1c);   // トグルスイッチ
      }
      for (let i = 0; i < 3; i++) {
        const lx = -w / 2 + 0.25 + (w - 0.5) * i / 2;
        ldisc(B.glow, F, lx, 1.9, 0.17, 0.09, 0xd9d3bd);                                // 計器
        lbox(B.glow, F, lx - 0.03, lx + 0.03, 1.72, 1.76, 0.165, 0.18, [0xff3a2a, 0x3aff7a, 0xffc040][i], { grime: 0 });
      }
      break;
    }
    case 'sign': {
      textPlane(L, p.lines, p.style || 'plate', p.w, p.h, F.x, p.y, F.z, p.face);
      break;
    }
    case 'mark': {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62),
        new THREE.MeshLambertMaterial({ map: markTexture(), transparent: true, depthWrite: false }));
      m.position.set(F.x, p.y, F.z);
      m.rotation.y = FACE_YAW[p.face];
      L.group.add(m);
      break;
    }
    case 'barrel': {
      lcyl(B.metal, F, 0, 0, 0.92, 0, 0.3, 0x6a4a30, 14);
      lcyl(B.dark, F, 0, 0.3, 0.36, 0, 0.31, 0x2a2420, 14);
      addSolid(L, F, 0.6, 0.6);
      break;
    }
    case 'lowwall': {
      lbox(B.concrete, F, -p.w / 2, p.w / 2, 0, p.h, -p.d / 2, p.d / 2, 0x55524a);
      lbox(B.wood, F, -p.w / 2, p.w / 2, p.h, p.h + 0.18, -p.d / 2 + 0.05, p.d / 2 - 0.05, 0x5c5440);
      addSolid(L, F, p.w, p.d);
      break;
    }
    case 'locker': {
      const n = p.n || 3, w = 0.55;
      for (let i = 0; i < n; i++) {
        const lx = (i - (n - 1) / 2) * w;
        lbox(B.metal, F, lx - w / 2 + 0.01, lx + w / 2 - 0.01, 0, 1.9, -0.25, 0.25, 0x4f5a52);
        for (let k = 0; k < 3; k++) lbox(B.dark, F, lx - 0.12, lx + 0.12, 1.6 + k * 0.07, 1.62 + k * 0.07, 0.25, 0.26, 0x1c1f1d);
      }
      addSolid(L, F, n * w, 0.5);
      break;
    }
    case 'bench': {
      lbox(B.wood, F, -p.w / 2, p.w / 2, 0.42, 0.48, -p.d / 2, p.d / 2, COL.wood);
      for (const sx of [-1, 1]) lbox(B.metal, F, sx * (p.w / 2 - 0.15) - 0.03, sx * (p.w / 2 - 0.15) + 0.03, 0, 0.42, -p.d / 2 + 0.05, p.d / 2 - 0.05, COL.darkMetal);
      break;
    }
    case 'puddle': {
      const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 20),
        new THREE.MeshPhongMaterial({ color: 0x0c0d0e, specular: 0x5a6670, shininess: 70, transparent: true, opacity: 0.72, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(1, 0.6 + hash3(F.x, F.z, 3) * 0.6, 1);
      m.position.set(F.x, 0.012, F.z);
      L.group.add(m);
      break;
    }
    case 'hatch': {
      lbox(B.dark, F, -0.75, 0.75, 0, 2.1, 0, 0.04, 0x050506, { grime: 0 });
      lbox(B.metal, F, -0.85, -0.75, 0, 2.2, 0, 0.12, 0x2c2e30);
      lbox(B.metal, F, 0.75, 0.85, 0, 2.2, 0, 0.12, 0x2c2e30);
      lbox(B.metal, F, -0.85, 0.85, 2.1, 2.2, 0, 0.12, 0x2c2e30);
      break;
    }
    case 'furnace': {
      lbox(B.concrete, F, -p.w / 2, p.w / 2, 0, p.h, -p.d / 2, p.d / 2, 0x4a4038);
      lbox(B.metal, F, -p.w / 2 - 0.05, p.w / 2 + 0.05, p.h, p.h + 0.3, -p.d / 2 - 0.05, p.d / 2 + 0.05, 0x3a3634);
      addRod(B.metal, F.at(0, p.h, 0), F.at(0, sp ? sp.h : 6, 0), 0.5, COL.pipeRust);
      // 四面の焚き口（ちらちら光る）
      const mat = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
      for (const [lx, lz, ry] of [[0, p.d / 2 + 0.01, 0], [0, -p.d / 2 - 0.01, Math.PI], [p.w / 2 + 0.01, 0, Math.PI / 2], [-p.w / 2 - 0.01, 0, -Math.PI / 2]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), mat);
        const [x, , z] = F.at(lx, 0, lz);
        m.position.set(x, 0.9, z); m.rotation.y = F.yaw + ry;
        L.group.add(m);
      }
      L.anim.push({ update: () => { const k = 0.75 + 0.25 * Math.sin(STG.t * 13) * Math.sin(STG.t * 7.3); mat.color.setRGB(1.0 * k, 0.42 * k, 0.12 * k); } });
      addSolid(L, F, p.w, p.d);
      break;
    }
    case 'gurney': {
      lbox(B.metal, F, -1.0, 1.0, 0.75, 0.82, -0.35, 0.35, 0x8a8e90);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lbox(B.metal, F, sx * 0.85 - 0.03, sx * 0.85 + 0.03, 0, 0.75, sz * 0.28 - 0.03, sz * 0.28 + 0.03, COL.darkMetal);
      lbox(B.glow, F, -0.95, 0.95, 0.82, 0.86, -0.33, 0.33, 0x8c867a, { grime: 0.2 });
      lbox(B.glow, F, -0.6, 0.4, 0.86, 1.08, -0.2, 0.2, 0x7a1e18, { grime: 0.4 });
      addSolid(L, F, 2.0, 0.7);
      break;
    }
    case 'crusher': buildCrusherBody(L, F, p); break;
    case 'pedestal': {
      lbox(B.metal, F, -0.4, 0.4, 0, 1.1, -0.4, 0.4, 0x3a3e40);
      lbox(B.glow, F, -0.42, 0.42, 1.08, 1.12, -0.42, 0.42, 0x9a7a20, { grime: 0 });
      addSolid(L, F, 0.8, 0.8);
      const [x, , z] = F.at(0, 0, 0.41);
      textPlane(L, ['No. 01'], 'plate', 0.6, 0.2, x, 0.85, z, 's');
      break;
    }
    case 'frame': buildFrameBody(L, F, p); break;
    case 'board': buildBoard(L, F, p); break;
    case 'switch': buildSwitchBody(L, F, p); break;
  }
}

/* ---------- 研究員（窓の向こう。静止で、頭だけプレイヤーを追う） ---------- */
function buildResearcher(L, r) {
  const g = new THREE.Group();
  const coat = new THREE.MeshLambertMaterial({ color: 0xd9d6cc });
  const dark = new THREE.MeshLambertMaterial({ color: 0x24262a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9ad92 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.86, 0.26), dark); legs.position.y = 0.43; g.add(legs);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.32), coat); body.position.y = 1.24; g.add(body);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.34), coat); skirt.position.y = 0.72; g.add(skirt);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.16), coat);
    arm.position.set(s * 0.36, 1.22, r.pose === 'clip' && s > 0 ? 0.12 : 0);
    if (r.pose === 'clip' && s > 0) arm.rotation.x = -0.9;
    g.add(arm);
  }
  if (r.pose === 'clip') {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.02), new THREE.MeshLambertMaterial({ color: 0xb8ac90 }));
    clip.position.set(0.2, 1.22, 0.4); clip.rotation.x = -0.6;
    g.add(clip);
  }
  const head = new THREE.Group(); head.position.y = 1.78;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin); head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), dark);
  hair.rotation.x = -0.25; head.add(hair);
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.02), dark); glasses.position.set(0, 0.02, 0.145); head.add(glasses);
  g.add(head);
  g.position.set(r.x + L.ox, r.y || 0, r.z + L.oz);
  g.rotation.y = FACE_YAW[r.face || 's'];
  L.group.add(g);
  L.researchers.push({ g, head, look: !!r.look, base: g.rotation.y, phase: Math.random() * 6 });
}

/* =========================================================
   ギミックの見た目
   ========================================================= */
// 照合装置の粉砕器（ミッションB）。正面の投入口から腕を入れると上のローラーが噛む
function buildCrusherBody(L, F, p) {
  const B = L.batches;
  lbox(B.metal, F, -1.2, 1.2, 0, 2.0, -0.8, 0.8, 0x4c514c);
  lbox(B.metal, F, -1.25, 1.25, 2.0, 2.15, -0.85, 0.85, 0x2c302e);
  lbox(B.dark, F, -0.5, 0.5, 0.95, 1.45, 0.79, 0.81, 0x050505, { grime: 0 });         // 投入口
  lbox(B.glow, F, -0.55, 0.55, 1.47, 1.52, 0.8, 0.83, 0xd4a81e, { grime: 0 });
  lbox(B.glow, F, -0.55, 0.55, 0.88, 0.93, 0.8, 0.83, 0xd4a81e, { grime: 0 });
  // ホッパーとローラー（上から見える）
  lbox(B.dark, F, -0.9, 0.9, 2.15, 2.6, -0.5, 0.5, 0x1e2022);
  const drums = [];
  for (const lz of [-0.18, 0.18]) {
    const d = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 10), new THREE.MeshLambertMaterial({ color: 0x6a6e70 }));
    cyl.rotation.z = Math.PI / 2; d.add(cyl);
    for (let k = 0; k < 6; k++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.08), new THREE.MeshLambertMaterial({ color: 0x8a8e90 }));
      tooth.position.set(0, Math.cos(k / 6 * Math.PI * 2) * 0.18, Math.sin(k / 6 * Math.PI * 2) * 0.18);
      tooth.rotation.x = k / 6 * Math.PI * 2;
      d.add(tooth);
    }
    const [x, , z] = F.at(0, 0, lz);
    d.position.set(x, 2.45, z); d.rotation.y = F.yaw;
    L.group.add(d);
    drums.push(d);
  }
  const [sx, , sz] = F.at(0, 0, 0.82);
  textPlane(L, ['照合・粉砕'], 'plate', 1.2, 0.26, sx, 1.75, sz, p.face);
  L.crusher = { F, drums, spin: 0, slot: new THREE.Vector3(sx, 1.2, sz) };
  addSolid(L, F, 2.4, 1.6);
}

// 身体を固定する台座（ミッションD）。左腕・右腕の掛け金と、胴体を据える椅子
function buildFrameBody(L, F, p) {
  const B = L.batches;
  lbox(B.metal, F, -1.3, 1.3, 0, 0.2, -0.7, 0.5, 0x3a3e40);                // 台
  lbox(B.metal, F, -0.5, 0.5, 0.2, 0.55, -0.45, 0.35, 0x55595a);           // 座面
  lbox(B.metal, F, -0.5, 0.5, 0.55, 2.0, -0.55, -0.4, 0x4a4e50);           // 背もたれ
  for (const sx of [-1, 1]) {
    lbox(B.metal, F, sx * 1.15 - 0.07, sx * 1.15 + 0.07, 0.2, 2.3, -0.55, -0.4, COL.darkMetal);   // 腕を掛ける柱
    lbox(B.metal, F, sx * 1.15 - 0.2, sx * 1.15 + 0.2, 1.62, 1.68, -0.5, -0.1, 0x8a8e90);          // 掛け金
    lbox(B.dark, F, sx * 0.5 - 0.03, sx * 0.5 + 0.03, 0.9, 1.0, -0.45, 0.4, 0x1a1412);             // 拘束ベルト
  }
  lbox(B.dark, F, -0.52, 0.52, 1.3, 1.38, -0.42, -0.36, 0x1a1412);
  const tor = new THREE.TorusGeometry(0.2, 0.03, 6, 14);
  B.metal.add(tor, m4At(...F.at(0, 2.15, -0.45), F.yaw), 0x6a6e70);
  tor.dispose();
  // 左右の札。体は手前（正面）を向くので、体の左腕は正面から見て右
  const plate = (side, lx) => {
    const [x, , z] = F.at(lx, 0, -0.38);
    textPlane(L, [side === 'LEFT' ? '左腕  L' : '右腕  R'], 'plate', 0.5, 0.18, x, 2.0, z, p.face);
  };
  plate('LEFT', 1.15); plate('RIGHT', -1.15);
  const [tx, , tz] = F.at(0, 0, -0.38);
  textPlane(L, ['胴体'], 'plate', 0.4, 0.16, tx, 2.3, tz, p.face);
  L.frame = {
    F,
    slot: {
      LEFT: new THREE.Vector3(...F.at(1.15, 1.25, -0.25)),
      RIGHT: new THREE.Vector3(...F.at(-1.15, 1.25, -0.25)),
    },
    seat: new THREE.Vector3(...F.at(0, 0.55, 0.0)),
    prompt: {
      LEFT: new THREE.Vector3(...F.at(1.15, 1.4, 0.4)),
      RIGHT: new THREE.Vector3(...F.at(-1.15, 1.4, 0.4)),
      TORSO: new THREE.Vector3(...F.at(0, 1.1, 0.4)),
    },
    hung: { LEFT: null, RIGHT: null },
  };
  addSolid(L, F, 2.6, 1.2);
}

// 完成させる身体の写真（紙の指示書）。体は正面を向いているので、写真の左側が右腕
function buildBoard(L, F, p) {
  const tex = canvasTex(512, 384, (c, W, H) => {
    c.fillStyle = '#2a2622'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#d6cdb2'; c.fillRect(14, 14, W - 28, H - 28);
    c.fillStyle = '#3a3026'; c.textAlign = 'left'; c.textBaseline = 'top';
    c.font = 'bold 24px ' + JP_FONT; c.fillText('再構成指示書  第十四号', 30, 24);
    c.font = '15px ' + JP_FONT; c.fillText('下記の構成で検体を一体完成させること', 30, 56);
    // 写真（白黒の体の正面）
    c.fillStyle = '#4c4a44'; c.fillRect(30, 86, 210, 270);
    c.fillStyle = '#9a968a';
    c.fillRect(105, 130, 60, 110);                         // 胴
    c.fillRect(110, 240, 22, 90); c.fillRect(138, 240, 22, 90);   // 脚
    c.fillStyle = '#6b6f7a'; c.fillRect(70, 132, 30, 100); // 写真の左＝右腕（銃）
    c.fillStyle = '#2a2c31'; c.fillRect(76, 232, 18, 24);
    c.fillStyle = '#c8c0b0'; c.fillRect(170, 132, 30, 100); c.fillRect(166, 230, 38, 30);   // 左腕（拳）
    c.fillStyle = '#7a3a33'; c.fillRect(120, 116, 30, 14); // 首の切断面
    c.fillStyle = '#3a3026'; c.font = 'bold 14px ' + JP_GOTH;
    c.fillText('R', 78, 100); c.fillText('L', 178, 100);
    // 項目
    c.font = 'bold 26px ' + JP_GOTH;
    c.fillText('右腕  …  銃腕', 262, 120);
    c.fillText('左腕  …  通常腕', 262, 180);
    c.fillText('胴体  …  通常の人間体', 262, 240);
    c.font = '15px ' + JP_FONT;
    c.fillText('※ 両腕を掛けてから胴体を据えること', 262, 300);
    c.fillText('※ 完成体には頭部を接着して搬出', 262, 324);
    c.fillStyle = 'rgba(160,30,24,0.8)'; c.font = 'bold 22px ' + JP_GOTH;
    c.fillText('検', W - 70, 22);
    c.strokeStyle = 'rgba(160,30,24,0.8)'; c.lineWidth = 3; c.strokeRect(W - 78, 16, 40, 40);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.set(F.x, p.y, F.z);
  m.rotation.y = FACE_YAW[p.face];
  L.group.add(m);
}

// 大型スイッチ（終盤の演出）
function buildSwitchBody(L, F, p) {
  const B = L.batches;
  lbox(B.metal, F, -0.45, 0.45, 0.8, 2.0, -0.05, 0.25, 0x4a4f4a);
  lbox(B.glow, F, -0.47, 0.47, 0.78, 0.82, 0.2, 0.27, 0xd4a81e, { grime: 0 });
  const lever = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), new THREE.MeshLambertMaterial({ color: 0x8a1e18 }));
  arm.position.y = 0.31; lever.add(arm);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  grip.position.y = 0.62; lever.add(grip);
  const [x, , z] = F.at(0, 0, 0.3);
  lever.position.set(x, 1.4, z);
  lever.rotation.y = F.yaw;
  lever.rotation.x = 0.7;
  L.group.add(lever);
  L.switchLever = lever;
  L.switchPos = new THREE.Vector3(x, 1.4, z);
}

function buildGimmicks(L) {
  const def = L.def, B = L.batches, X = L.X, Z = L.Z;
  // --- バルブ（ミッションA） ---
  if (def.valves) {
    L.valves = {};
    for (const v of def.valves) {
      const [fx, fz] = faceVec(v.face);
      const yaw = FACE_YAW[v.face];
      const px = X(v.x), pz = Z(v.z);
      // 壁の座金・軸・色帯
      const plate = boxGeo(0.7, 0.7, 0.08);
      B.metal.add(plate, m4At(px - fx * 0.02, v.y, pz - fz * 0.02, yaw), 0x3a3e40); plate.dispose();
      addRod(B.metal, [px - fx * 0.05, v.y, pz - fz * 0.05], [px + fx * 0.3, v.y, pz + fz * 0.3], 0.06, v.color);
      const wheel = new THREE.Group();
      const wm = new THREE.MeshLambertMaterial({ color: v.color });
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 22), wm));
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.05), wm);
        sp.rotation.z = k * Math.PI / 3;
        wheel.add(sp);
      }
      wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a2c2e })));
      wheel.position.set(px + fx * 0.32, v.y, pz + fz * 0.32);
      wheel.rotation.y = yaw;
      L.group.add(wheel);
      // 文字の札と、開いたら点く小さなランプ
      textPlane(L, [v.id], 'plate', 0.34, 0.34, px + fx * 0.05, v.y + 0.62, pz + fz * 0.05, v.face);
      const vl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3a1410 }));
      vl.position.set(px + fx * 0.08 + (fz) * 0.45, v.y + 0.62, pz + fz * 0.08 - fx * 0.45);
      L.group.add(vl);
      // 扉の上のランプ（A/B/C）
      const lp = v.lamp;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 16), new THREE.MeshLambertMaterial({ color: v.color }));
      rim.position.set(X(lp[0]), lp[1], Z(lp[2]) + 0.03);
      L.group.add(rim);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), new THREE.MeshBasicMaterial({ color: 0x1c1412 }));
      bulb.position.set(X(lp[0]), lp[1], Z(lp[2]) + 0.04);
      L.group.add(bulb);
      textPlane(L, [v.id], 'plate', 0.26, 0.22, X(lp[0]), lp[1] - 0.34, Z(lp[2]) + 0.04, 's');
      // ランプからバルブまでの細い配管。色と文字で追える
      const pts = v.pipe.map((q) => [X(q[0]), q[1], Z(q[2])]);
      for (let i = 0; i + 1 < pts.length; i++) {
        addRod(B.metal, pts[i], pts[i + 1], 0.055, v.color, 6);
        const el = new THREE.SphereGeometry(0.075, 6, 5);
        B.metal.add(el, m4At(...pts[i + 1]), v.color); el.dispose();
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        // 長い区間には一定間隔で文字の札（色が見分けにくくても追える）
        for (let s = 3.5; s < len - 1; s += 7) {
          const k = s / len, mx = a[0] + (b[0] - a[0]) * k, my = a[1] + (b[1] - a[1]) * k, mz = a[2] + (b[2] - a[2]) * k;
          const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
            new THREE.MeshBasicMaterial({ map: signTexture([v.id], 'plate', 1), side: THREE.DoubleSide }));
          tag.position.set(mx, my - 0.17, mz);
          tag.rotation.y = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]) ? 0 : Math.PI / 2;
          L.group.add(tag);
        }
      }
      L.valves[v.id] = {
        def: v, wheel, lamp: bulb, valveLamp: vl, spin: 0,
        pos: new THREE.Vector3(px + fx * 0.5, v.y, pz + fz * 0.5),
        stand: new THREE.Vector3(px + fx * 1.15, 0, pz + fz * 1.15),
        center: new THREE.Vector3(px + fx * 0.32, v.y, pz + fz * 0.32),
      };
    }
  }
  // --- 照合装置のCRT（ミッションB） ---
  if (def.armCheck) {
    const c = def.armCheck.crusher;
    L.armCrt = makeCrt(L, X(c.crt[0]), c.crt[1], Z(c.crt[2]), FACE_YAW[c.face], 0.62, ['REQUIRED ARM', '— 01 —'], {});
    L.armCrt.group.scale.setScalar(1.25);
  }
  if (def.conveyor) buildConveyor(L, def.conveyor);
  if (def.finale) buildFinale(L, def.finale);
}

/* ---------- 搬送コンベア（ミッションC） ----------
   床は下がった穴。ベルトだけが高い。足場（東と西）はコンクリートの台。
   ベルトの進む先の端に粉砕機、反対の端に死体の出てくる口がある              */
function buildConveyor(L, cv) {
  const B = L.batches, X = L.X, Z = L.Z;
  const room = L.spaces.find((s) => s.id === cv.room);
  const fy = room ? room.fy : -1.6;
  const z0 = Z(cv.z0), z1 = Z(cv.z1), len = z1 - z0;
  const by = cv.beltY;
  // 足場（歩ける矩形と同じ大きさの台）
  for (const w of L.walk) {
    if (!room || w.head || w.sp) continue;
    if (!(w.x0 >= room.x0 - 0.01 && w.x1 <= room.x1 + 0.01 && w.z0 >= room.z0 - 0.01 && w.z1 <= room.z1 + 0.01)) continue;
    addBox(B.concrete, w.x0, w.x1, fy, 0, w.z0, w.z1, 0x55524a);
    addBox(B.floor, w.x0, w.x1, -0.05, 0, w.z0, w.z1, COL.floor);
    // 縁の警告帯と手すり（ベルトの側だけ）
    for (const ex of [w.x0, w.x1]) {
      if (ex <= room.x0 + 0.5 || ex >= room.x1 - 0.5) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, w.z1 - w.z0), new THREE.MeshLambertMaterial({ map: (() => { const t = hazardTexture().clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set((w.z1 - w.z0) / 1.6, 1); return t; })() }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2;
      m.position.set(ex + (ex === w.x0 ? 0.18 : -0.18), 0.01, (w.z0 + w.z1) / 2);
      L.group.add(m);
      const rx = ex + (ex === w.x0 ? 0.08 : -0.08);
      addRod(B.metal, [rx, 1.0, w.z0], [rx, 1.0, w.z1], 0.035, 0xb0a020);
      for (let z = w.z0; z <= w.z1 + 0.01; z += 2.4) addRod(B.metal, [rx, 0, z], [rx, 1.0, z], 0.03, 0xb0a020);
    }
  }
  L.conv = { def: cv, lanes: [], by, z0, z1, fy };
  for (const ln of cv.lanes) {
    const x = X(ln.x), h = cv.half;
    // ベルトの架台
    addBox(B.metal, x - h, x + h, fy, by - 0.08, z0, z1, 0x2e3133);
    for (let z = z0 + 1; z < z1; z += 2) addBox(B.metal, x - h - 0.12, x + h + 0.12, fy, by - 0.1, z - 0.15, z + 0.15, 0x3c4043);
    addBox(B.metal, x - h - 0.1, x - h, by - 0.15, by + 0.18, z0, z1, 0x6a6e40);
    addBox(B.metal, x + h, x + h + 0.1, by - 0.15, by + 0.18, z0, z1, 0x6a6e40);
    // ベルトの面（縞を流す）
    const tex = beltTexture().clone();
    tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, len / 2);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(h * 2, len), new THREE.MeshLambertMaterial({ map: tex }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set(x, by, (z0 + z1) / 2);
    L.group.add(belt);
    // 粉砕機（進む先の端）と、死体の出てくる口（反対の端）
    const kill = ln.dir < 0 ? z0 : z1, feed = ln.dir < 0 ? z1 : z0;
    const kIn = kill - ln.dir * cv.killMargin;       // ここから先が粉砕機の口
    const hz0 = Math.min(kIn, kill + ln.dir * 1.2), hz1 = Math.max(kIn, kill + ln.dir * 1.2);
    addBox(B.metal, x - h - 0.5, x + h + 0.5, fy, by + 2.4, hz0, hz1, 0x4a3c32);
    const mouthZ = kIn - ln.dir * 0.02;
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(h * 2, 1.0), new THREE.MeshBasicMaterial({ color: 0x050303 }));
    mouth.position.set(x, by + 0.55, mouthZ); mouth.rotation.y = ln.dir < 0 ? 0 : Math.PI;
    L.group.add(mouth);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(h * 2 + 1, 0.3), new THREE.MeshLambertMaterial({ map: (() => { const t = hazardTexture().clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); return t; })() }));
    stripe.position.set(x, by + 1.25, mouthZ); stripe.rotation.y = mouth.rotation.y;
    L.group.add(stripe);
    const drums = [];
    for (const dy of [0.25, 0.85]) {
      const d = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, h * 2 - 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x5e6264 }));
      cyl.rotation.z = Math.PI / 2; d.add(cyl);
      for (let k = 0; k < 8; k++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(h * 2 - 0.1, 0.07, 0.1), new THREE.MeshLambertMaterial({ color: 0x9a9ea0 }));
        tooth.position.set(0, Math.cos(k / 8 * Math.PI * 2) * 0.23, Math.sin(k / 8 * Math.PI * 2) * 0.23);
        tooth.rotation.x = k / 8 * Math.PI * 2;
        d.add(tooth);
      }
      d.position.set(x, by + dy, kIn - ln.dir * 0.25);
      L.group.add(d);
      drums.push(d);
    }
    // 口（ビニールのすだれ）
    const fz0 = Math.min(feed, feed - ln.dir * 1.0), fz1 = Math.max(feed, feed - ln.dir * 1.0);
    addBox(B.concrete, x - h - 0.4, x + h + 0.4, by + 1.6, by + 2.6, fz0, fz1, 0x3c3a36);
    for (let k = -3; k <= 3; k++) addBox(B.dark, x + k * 0.24 - 0.1, x + k * 0.24 + 0.1, by + 0.05, by + 1.6, feed - ln.dir * 0.5 - 0.01, feed - ln.dir * 0.5 + 0.01, 0x1a1c1a, { grime: 0 });
    L.conv.lanes.push({ def: ln, x, dir: ln.dir, speed: ln.speed, gap: ln.gap, tex, drums,
      kill, kIn, feed, start: feed - ln.dir * 0.6, bodies: [] });
    L.fixtures.push({ pos: new THREE.Vector3(x, by + 2.2, kIn - ln.dir * 0.6), tone: 'red' });
  }
  // ベルトは頭だけが歩ける
  for (const ln of L.conv.lanes) {
    L.walk.push({ x0: ln.x - cv.half, x1: ln.x + cv.half, z0: z0, z1: z1, head: true, id: 'belt', lane: ln });
  }
}

/* ---------- 中央搬送棟（終盤の演出） ----------
   観覧回廊の大窓から見下ろす吹き抜け。最初は真っ暗で、スイッチを入れると
   奥から順に照明が点き、何十本もの搬送ラインが人体を運んでいるのが見えてくる      */
function buildFinale(L, fd) {
  const hall = L.spaces.find((s) => s.id === fd.hall);
  if (!hall) return;
  const rows = [];
  const nRows = 6;
  const partGeo = { torso: new THREE.BoxGeometry(0.8, 0.36, 1.0), limb: new THREE.BoxGeometry(0.18, 0.18, 0.85) };
  for (let r = 0; r < nRows; r++) {
    const z = hall.z1 - 6 - r * 7.5;
    const y = (r % 2) ? 0.9 : 3.2;
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a3634, emissive: 0x000000 });
    const fleshMat = new THREE.MeshLambertMaterial({ color: 0x5a2c26, emissive: 0x000000 });
    const beltLen = hall.x1 - hall.x0 - 4;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(beltLen, 0.3, 1.8), mat);
    frame.position.set((hall.x0 + hall.x1) / 2, y - 0.15, z);
    L.group.add(frame);
    if (y > 2) for (let x = hall.x0 + 4; x < hall.x1 - 2; x += 6) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, y, 0.3), mat);
      post.position.set(x, y / 2, z); L.group.add(post);
    }
    const n = 18;
    const inst = new THREE.InstancedMesh(partGeo.torso, fleshMat, n);
    const inst2 = new THREE.InstancedMesh(partGeo.limb, fleshMat, n * 2);
    L.group.add(inst, inst2);
    const lamps = [];
    for (let k = 0; k < 4; k++) {
      const lm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.6), new THREE.MeshBasicMaterial({ color: 0x0c0c0c }));
      lm.position.set(hall.x0 + (hall.x1 - hall.x0) * (k + 0.5) / 4, hall.h - 0.6, z);
      L.group.add(lm); lamps.push(lm);
    }
    const row = { z, y, mat, fleshMat, inst, inst2, n, lamps, phase: Math.random() * 10, speed: 1.2 + r * 0.15,
      x0: hall.x0 + 2, x1: hall.x1 - 2, on: 0 };
    rows.push(row);
    for (const fx of [-0.25, 0.25]) {
      L.fixtures.push({ pos: new THREE.Vector3((hall.x0 + hall.x1) / 2 + (hall.x1 - hall.x0) * fx, hall.h - 2, z),
        tone: 'spot', cond: () => row.on > 0.5 });
    }
  }
  L.finaleRows = rows;
  L.finaleOn = false;
  L.finaleT = 0;
  const m = new THREE.Matrix4();
  const place = (row) => {
    const span = row.x1 - row.x0;
    for (let i = 0; i < row.n; i++) {
      const x = row.x0 + ((i / row.n * span + row.phase * row.speed) % span + span) % span;
      m.makeRotationY(i * 1.7);
      m.setPosition(x, row.y + 0.2, row.z + Math.sin(i * 3.1) * 0.3);
      row.inst.setMatrixAt(i, m);
      for (let k = 0; k < 2; k++) {
        m.makeRotationY(i * 2.3 + k);
        m.setPosition(x + 0.9 + k * 0.6, row.y + 0.12, row.z + (k ? 0.4 : -0.4));
        row.inst2.setMatrixAt(i * 2 + k, m);
      }
    }
    row.inst.instanceMatrix.needsUpdate = true;
    row.inst2.instanceMatrix.needsUpdate = true;
  };
  for (const row of rows) place(row);
  L.anim.push({ update: (dt) => {
    if (!L.finaleOn) return;
    L.finaleT += dt;
    rows.forEach((row, i) => {
      const k = Math.max(0, Math.min(1, (L.finaleT - i * 0.7) / 0.5));
      if (k > row.on) {
        row.on = k;
        const e = 0.55 * k;
        row.mat.emissive.setRGB(e, e * 0.95, e * 0.9);
        row.fleshMat.emissive.setRGB(e * 1.4, e * 0.6, e * 0.5);
        for (const lm of row.lamps) lm.material.color.setRGB(0.05 + 0.9 * k, 0.05 + 0.85 * k, 0.05 + 0.75 * k);
        if (k >= 1 && !row.sounded) { row.sounded = true; sfx('bonk'); }
      }
      if (row.on > 0) { row.phase += dt * row.on; place(row); }
    });
  } });
}

/* =========================================================
   画面（暗転・プロンプト・会話）
   ========================================================= */
const stageUi = {};
(function buildStageUi() {
  const fade = document.createElement('div'); fade.id = 'stageFade'; document.body.appendChild(fade);
  const pr = document.createElement('div'); pr.id = 'stagePrompt'; pr.className = 'hidden';
  pr.innerHTML = '<span class="key">F</span><span class="txt"></span>';
  document.body.appendChild(pr);
  const dl = document.createElement('div'); dl.id = 'stageDialog'; dl.className = 'hidden';
  dl.innerHTML = '<div class="spk"></div><div class="txt"></div><ul class="choices"></ul>' +
    '<div class="help"><span class="key">W</span><span class="key">S</span> 選ぶ　<span class="key">F</span> 決定</div>';
  document.body.appendChild(dl);
  stageUi.fade = fade; stageUi.prompt = pr; stageUi.promptKey = pr.querySelector('.key');
  stageUi.promptTxt = pr.querySelector('.txt'); stageUi.dialog = dl;
})();

function stageFade(onBlack) {
  if (STG.fade) return;
  STG.fade = { t: 0, phase: 'out', onBlack, done: false };
}
function updateFade(rdt) {
  const f = STG.fade;
  if (!f) { stageUi.fade.style.opacity = '0'; return; }
  f.t += rdt;
  let a = 0;
  if (f.phase === 'out') {
    a = Math.min(1, f.t / STAGE_CFG.fadeTime);
    if (f.t >= STAGE_CFG.fadeTime) { f.phase = 'hold'; f.t = 0; a = 1; if (!f.done) { f.done = true; f.onBlack(); } }
  } else if (f.phase === 'hold') {
    a = 1;
    if (f.t >= STAGE_CFG.fadeHold) { f.phase = 'in'; f.t = 0; }
  } else {
    a = 1 - Math.min(1, f.t / STAGE_CFG.fadeTime);
    if (f.t >= STAGE_CFG.fadeTime) STG.fade = null;
  }
  stageUi.fade.style.opacity = String(a);
  player.invuln = Math.max(player.invuln, 0.3);   // 暗転中は殴られない
}

function openDialog(spec) {
  STG.dialog = { spec, idx: 0 };
  const d = stageUi.dialog;
  d.querySelector('.spk').textContent = spec.speaker || '';
  d.querySelector('.txt').textContent = spec.text || '';
  renderDialog();
  d.classList.remove('hidden');
  hideSubtitle();
}
function renderDialog() {
  const dg = STG.dialog;
  const ul = stageUi.dialog.querySelector('.choices');
  ul.innerHTML = '';
  dg.spec.choices.forEach((c, i) => {
    const li = document.createElement('li');
    li.textContent = c.label;
    if (i === dg.idx) li.className = 'on';
    ul.appendChild(li);
  });
}
function closeDialog() {
  STG.dialog = null;
  stageUi.dialog.classList.add('hidden');
}
function dialogKey(e) {
  const dg = STG.dialog, n = dg.spec.choices.length;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') { dg.idx = (dg.idx + n - 1) % n; renderDialog(); }
  else if (e.code === 'KeyS' || e.code === 'ArrowDown') { dg.idx = (dg.idx + 1) % n; renderDialog(); }
  else if (e.code === 'KeyF' || e.code === 'Enter' || e.code === 'Space') {
    const c = dg.spec.choices[dg.idx];
    closeDialog();
    if (c.act) c.act();
  } else if (/^Digit[1-9]$/.test(e.code)) {
    const i = +e.code.slice(5) - 1;
    if (i < n) { dg.idx = i; renderDialog(); }
  } else if (e.code === 'Backspace') closeDialog();
}

/* =========================================================
   出入り
   ========================================================= */
// セーフルームへ（H）。どこからでも暗転して移動する
function stageGoSafe(fromStage) {
  if (STG.fade) return;
  closeDialog();
  stageFade(() => stageEnterArea('safe', { fromStage: !!fromStage }));
}

function stageEnterArea(id, opts) {
  const def = BK_STAGES[id];
  if (!def) return;
  resetAll();                 // ハブ・デモ・検証室・ボス・前のステージをまとめて片付ける（stageStop も呼ばれる）
  STG.area = id;
  STG.def = def;
  STG.L = buildLevel(def);
  scene.add(STG.L.group);
  ensureLightPool();
  applyAtmosphere(def);
  STG.dead = 0; STG.busy = null; STG.strap = null; STG.crushed = false; STG.pick = null;
  if (def.kind === 'stage') {
    STG.prog = newProgress(def);
    STG.selected = null;
    syncGimmickVisuals();
    respawnAtCheckpoint(true);
    stageMsg(def.label + '　' + def.title, 3.2);
  } else {
    const sp = (opts && opts.fromStage) ? def.returnSpawn : def.spawn;
    placePlayer(sp.x, sp.z, sp.yaw);
    const big = STG.L.doors.big;
    if (big) for (const lm of big.lamps) lm.material.color.setHex(STG.selected ? 0x3aff7a : 0xff2a1a);
    if (opts && opts.fromStage) {
      say('受付研究員：おかえりなさい。検体の回収を確認しました。', 3.2);
    }
  }
}

// ステージから出る（resetAll から呼ばれる）。敵・死体・床の腕を片付けて建物を下げる
function stageStop() {
  if (!STG.area) return;
  despawnDynamic();
  if (STG.L) scene.remove(STG.L.group);
  restoreAtmosphere();
  for (const l of STG.lights) { l.light.intensity = 0; l.fx = null; }
  closeDialog();
  STG.area = null; STG.def = null; STG.L = null;
  STG.busy = null; STG.strap = null; STG.dead = 0; STG.pick = null;
  stageUi.prompt.classList.add('hidden');
  if (state === S.STRAPPED) state = S.HUMAN;
}

function placePlayer(x, z, yw) {
  const L = STG.L;
  playerPos.set(L.X(x), 0, L.Z(z));
  yaw = yw || 0; pitch = 0;
}

function applyAtmosphere(def) {
  if (!STG.base) STG.base = { fogColor: scene.fog.color.getHex(), near: scene.fog.near, far: scene.fog.far,
                              bg: scene.background.getHex() };
  scene.fog.color.setHex(def.fog.color);
  scene.background.setHex(def.fog.color);
  scene.fog.near = def.fog.near; scene.fog.far = def.fog.far;
  floor.visible = false; grid.visible = false;
  camera.far = 60; camera.updateProjectionMatrix();   // 霧の向こうは描かない
}
function restoreAtmosphere() {
  const b = STG.base;
  if (!b) return;
  scene.fog.color.setHex(b.fogColor); scene.background.setHex(b.bg);
  scene.fog.near = b.near; scene.fog.far = b.far;
  hemiLight.intensity = LIGHT_BASE.hemi; dirLight.intensity = LIGHT_BASE.dir;
  floor.visible = true; grid.visible = true;
  camera.far = 100; camera.updateProjectionMatrix();
}

/* ---------- 点光源のプール ----------
   照明器具は数百あるが、three.js の光源は数だけシェーダが重くなる。
   決まった数の点光源を、カメラに近い器具へ毎回付け替えて灯す                     */
function ensureLightPool() {
  if (STG.lightsAdded) return;
  STG.lightsAdded = true;
  for (let i = 0; i < STAGE_CFG.lightPool; i++) {
    const l = new THREE.PointLight(0xffffff, 0, STAGE_CFG.lightRange, 2);
    scene.add(l);
    STG.lights.push({ light: l, fx: null, k: 0 });
  }
}
let _lightPickT = 0;
function updateLights(rdt) {
  const L = STG.L;
  _lightPickT -= rdt;
  if (_lightPickT <= 0) {
    _lightPickT = 0.15;
    const cam = camera.position;
    camera.getWorldDirection(_sv1);
    const scored = [];
    for (const f of L.fixtures) {
      if (f.cond && !f.cond()) continue;
      const dx = f.pos.x - cam.x, dy = f.pos.y - cam.y, dz = f.pos.z - cam.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 26) continue;
      const front = (dx * _sv1.x + dz * _sv1.z) / (d || 1);
      scored.push({ f, s: d - front * 4 });
    }
    scored.sort((a, b) => a.s - b.s);
    STG.lightWant = scored.slice(0, STG.lights.length).map((o) => o.f);
  }
  const want = STG.lightWant || [];
  for (const sl of STG.lights) {
    if (sl.fx && want.indexOf(sl.fx) < 0) sl.fading = true;
  }
  for (const sl of STG.lights) {
    if (sl.fading) {
      sl.k -= rdt * 6;
      if (sl.k <= 0) { sl.k = 0; sl.fx = null; sl.fading = false; }
    }
    if (!sl.fx) {
      const f = want.find((w) => !STG.lights.some((o) => o.fx === w));
      if (f) { sl.fx = f; sl.k = 0; sl.light.position.copy(f.pos); sl.light.color.setHex(TONE[f.tone] || 0xffffff); }
    }
    if (sl.fx && !sl.fading) sl.k = Math.min(1, sl.k + rdt * 4);
    let p = sl.fx ? (TONE_POWER[sl.fx.tone] || 1) : 0;
    if (sl.fx && sl.fx.tone === 'red') p *= 0.7 + 0.3 * Math.sin(STG.t * 3 + sl.fx.pos.x);
    if (sl.fx && sl.fx.tone === 'fire') p *= 0.8 + 0.2 * Math.sin(STG.t * 17) * Math.sin(STG.t * 5.3);
    if (sl.fx && sl.fx.tone === 'cold' && hash3(Math.floor(STG.t * 9), sl.fx.pos.x, sl.fx.pos.z) > 0.985) p *= 0.3;
    sl.light.intensity = p * sl.k;
    sl.light.distance = sl.fx && sl.fx.tone === 'spot' ? 18 : STAGE_CFG.lightRange;
  }
}

/* =========================================================
   歩ける範囲・壁・カメラ
   ========================================================= */
function doorBlocks(d) { return !d.decor && !(d.open && d.k > 0.85); }

function stageWalkable(x, z, head) {
  const L = STG.L;
  if (!L) return true;
  const r = head ? STAGE_CFG.headR : STAGE_CFG.playerR;
  let ok = false;
  for (const w of L.walk) {
    if (w.head && !head) continue;
    if (x >= w.x0 + r && x <= w.x1 - r && z >= w.z0 + r && z <= w.z1 - r) { ok = true; break; }
  }
  if (!ok) return false;
  for (const s of L.solids) if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return false;
  for (const id in L.doors) {
    const d = L.doors[id];
    if (!doorBlocks(d)) continue;
    if (x > d.r.x0 - r && x < d.r.x1 + r && z > d.r.z0 - r && z < d.r.z1 + r) return false;
  }
  return true;
}

function stageConfine(prevX, prevZ) {
  if (state === S.STRAPPED || state === S.POSSESS) return;
  const head = (state === S.HEAD);
  if (stageWalkable(playerPos.x, playerPos.z, head)) return;
  if (stageWalkable(playerPos.x, prevZ, head)) { playerPos.z = prevZ; return; }
  if (stageWalkable(prevX, playerPos.z, head)) { playerPos.x = prevX; return; }
  if (stageWalkable(prevX, prevZ, head)) { playerPos.x = prevX; playerPos.z = prevZ; return; }
  // 前の位置も無効（扉が閉じた・頭が壁際に跳ねた等）。近くの歩ける点へ押し出す
  for (let rr = 0.25; rr <= 4; rr += 0.25) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      const x = playerPos.x + Math.cos(a) * rr, z = playerPos.z + Math.sin(a) * rr;
      if (stageWalkable(x, z, head)) { playerPos.x = x; playerPos.z = z; return; }
    }
  }
}

function stageThrowBlocked(x, z) { return !stageWalkable(x, z, false); }

// 弾とパージした手首は壁で止まる
function stageBlocksProjectile(p) {
  if (!STG.L) return false;
  const L = STG.L;
  let inside = false;
  for (const sp of L.spaces) {
    if (sp.type === 'view') continue;
    if (p.x >= sp.x0 && p.x <= sp.x1 && p.z >= sp.z0 && p.z <= sp.z1 && p.y < sp.h + 0.2 && p.y > sp.fy - 0.1) { inside = true; break; }
  }
  if (!inside) return true;
  for (const s of L.solids) if (p.x > s.x0 && p.x < s.x1 && p.z > s.z0 && p.z < s.z1 && p.y < 2.0) return true;
  for (const id in L.doors) {
    const d = L.doors[id];
    if (doorBlocks(d) && p.x > d.r.x0 + 0.3 && p.x < d.r.x1 - 0.3 && p.z > d.r.z0 + 0.3 && p.z < d.r.z1 - 0.3) return true;
    if (doorBlocks(d) && p.x > d.r.x0 && p.x < d.r.x1 && p.z > d.r.z0 && p.z < d.r.z1) return true;
  }
  return false;
}

// 頭モードの三人称カメラが壁の向こうへ出ないように縮める（ダクトの中は低く）
function stageHeadCam(cam) {
  if (!STG.L) return;
  const L = STG.L;
  let inDuct = false;
  for (const sp of L.spaces) if (sp.type === 'duct' && inR(sp, headPos.x, headPos.z)) { inDuct = true; break; }
  const dx = cam.x - headPos.x, dz = cam.z - headPos.z;
  const len = Math.hypot(dx, dz);
  const ok = (x, z) => {
    let inSp = false;
    for (const sp of L.spaces) {
      if (sp.type === 'view') continue;
      if (x >= sp.x0 + 0.1 && x <= sp.x1 - 0.1 && z >= sp.z0 + 0.1 && z <= sp.z1 - 0.1) { inSp = true; break; }
    }
    if (!inSp) return false;
    for (const s of L.solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return false;
    for (const id in L.doors) {
      const d = L.doors[id];
      if (doorBlocks(d) && x > d.r.x0 + 0.3 && x < d.r.x1 - 0.3 && z > d.r.z0 + 0.3 && z < d.r.z1 - 0.3) return false;
    }
    return true;
  };
  let keep = len;
  for (let s = 0.15; s <= len; s += 0.15) {
    if (!ok(headPos.x + dx * s / len, headPos.z + dz * s / len)) { keep = Math.max(0.35, s - 0.25); break; }
  }
  if (keep < len) { cam.x = headPos.x + dx * keep / len; cam.z = headPos.z + dz * keep / len; }
  if (inDuct) cam.y = Math.min(cam.y, 1.32);
}

// 搬送中（固定）の一人称カメラ。仰向けの首元から見上げる
function stageCameraHook() {
  if (state !== S.STRAPPED || !STG.strap) return;
  STG.strap.corpse.neck.getWorldPosition(_sv1);
  camera.position.set(_sv1.x, _sv1.y + 0.3, _sv1.z);
  camera.rotation.set(pitch, yaw, 0);
}

// 血液凝固ガスの中では頭モードの出血が止まる
function stageBleedPaused() {
  if (!STG.L) return false;
  for (const g of STG.L.gas) if (inR(g, playerPos.x, playerPos.z)) return true;
  return false;
}
function stageInGas() { return stageBleedPaused(); }

// 入力を止める場面
function stageLocksMove() { return !!(STG.fade || STG.dialog || STG.busy || STG.dead > 0); }
function stageBlocksMouse() { return !!(STG.fade || STG.dialog || STG.busy || STG.dead > 0 || state === S.STRAPPED); }
function stageBlocksLook() { return !!(STG.dialog || (STG.busy && STG.busy.kind === 'valve')); }

function stageKeyHook(e) {
  if (e.code === 'KeyH') { stageGoSafe(false); return true; }
  if (STG.fade) return e.code !== 'Tab';
  if (STG.dialog) { dialogKey(e); return true; }
  if (!STG.area) return false;
  const pass = (e.code === 'Tab' || e.code === 'KeyG' || e.code === 'KeyB' || e.code === 'KeyV' || e.code === 'KeyT');
  if (STG.dead > 0 || STG.busy) return !pass;
  if (state === S.STRAPPED) {
    if (e.code === 'Space') { detachStrap(); return true; }
    return !pass;
  }
  if (e.code === 'KeyF') return stageInteract();
  return false;
}

/* =========================================================
   進行と、敵・死体・床の腕の配置
   ========================================================= */
function newProgress(def) {
  return {
    done: {}, valves: {}, flags: {}, cleared: {}, opened: {},
    slots: { LEFT: null, RIGHT: null, torso: false },
    finale: false,
  };
}
function missionIndex() {
  const ms = STG.def.missions;
  let i = 0;
  while (i < ms.length && STG.prog.done[ms[i].id]) i++;
  return i;
}
function currentMission() { const ms = STG.def.missions; return ms[missionIndex()] || null; }
function allMissionsDone() { return missionIndex() >= STG.def.missions.length; }

function completeMission(id) {
  const P = STG.prog;
  if (P.done[id]) return;
  P.done[id] = true;
  doFlash(0.35, '#9ce8ff');
  addShake(0.3);
  sfx('lock');
}

// 進行どおりに扉・ランプ・CRT・台座の見た目を合わせる
function syncGimmickVisuals() {
  const L = STG.L, P = STG.prog, def = STG.def;
  for (const id in L.doors) {
    const d = L.doors[id];
    if (d.decor) continue;
    d.open = !!(d.def.open || P.opened[id]);
    d.k = d.open ? 1 : 0;
    applyDoorPose(d);
  }
  if (L.valves) for (const id in L.valves) setValveLook(L.valves[id], !!P.valves[id]);
  if (L.armCrt) L.armCrt.set(P.done.B ? ['照合完了', 'ACCEPTED'] : ['REQUIRED ARM', '— ' + def.armCheck.tag + ' —'],
    P.done.B ? '#9ce8ff' : null);
  if (L.frame) syncFrameArms();
  if (L.finaleRows) L.finaleOn = !!P.finale;
}
function setValveLook(v, on) {
  v.lamp.material.color.setHex(on ? v.def.color : 0x1c1412);
  v.valveLamp.material.color.setHex(on ? 0x3aff7a : 0x3a1410);
}

function levelContains(L, x, z) {
  for (const sp of L.spaces) if (x >= sp.x0 - 1 && x <= sp.x1 + 1 && z >= sp.z0 - 1 && z <= sp.z1 + 1) return true;
  return false;
}

// このエリアの敵・死体・床の腕を全部消す
function despawnDynamic() {
  const L = STG.L;
  for (const en of STG.enemies) if (enemies.indexOf(en) >= 0) demoRemoveEnemy(en);
  STG.enemies = [];
  STG.enc = {};
  if (!L) return;
  for (const c of corpses.slice()) if (c.stage || levelContains(L, c.group.position.x, c.group.position.z)) removeCorpse(c);
  for (const p of severedParts.slice()) if (p.stage || levelContains(L, p.obj.position.x, p.obj.position.z)) removeSeveredPart(p, true);
  for (const p of projectiles) scene.remove(p.obj);
  projectiles = [];
  if (L.conv) for (const ln of L.conv.lanes) ln.bodies = [];
  if (L.frame) for (const k of ['LEFT', 'RIGHT']) if (L.frame.hung[k]) { L.group.remove(L.frame.hung[k]); L.frame.hung[k] = null; }
  STG.arm01 = null; STG.armRespawnT = 0;
}

function armsFrom(list) {
  return { LEFT: makeArmState(list[0] || ARM.FIST), RIGHT: makeArmState(list[1] || ARM.FIST) };
}

// 配置どおりに作り直す（入ったとき・死んで戻ったとき）。進行（扉・バルブ・台座）は消さない
function spawnDynamic() {
  const L = STG.L, def = STG.def, P = STG.prog;
  despawnDynamic();
  for (const c of (def.corpses || [])) {
    const cc = createCorpse(L.X(c.x), L.Z(c.z), c.rot || 0, {
      arms: armsFrom(c.arms || []), fuse: null,
      skill: c.skill ? makeBodySkill(c.skill) : undefined, resMax: c.resMax,
    });
    cc.stage = true;
  }
  for (const a of (def.arms || [])) spawnGroundArm(a.kind, L.X(a.x), L.Z(a.z), a.y);
  // ミッションB：指定番号の腕
  if (def.armCheck && !P.done.B) spawnTaggedArm();
  // ミッションC：ベルトの死体
  if (L.conv) populateBelts();
  // ミッションD：組み立て済みの体（胴体まで置いたあと）
  if (L.frame) syncFrameArms();
  if (L.frame && P.slots.torso && !P.done.D) makeAssembledBody();
  // 戦闘
  STG.enc = {};
  for (const e of (def.encounters || [])) {
    STG.enc[e.id] = { def: e, state: P.cleared[e.id] ? 'cleared' : 'idle', enemies: [], pending: [], wave: -1,
      zone: absRect(L, e.zone), trigger: absRect(L, e.trigger || e.zone) };
  }
  // 戦闘中に閉じる扉は開けておく（倒した戦闘はもともと開いている）
  for (const e of (def.encounters || [])) if (e.doors) for (const id of e.doors) setDoor(id, true, true);
}
function absRect(L, a) { return { x0: a[0] + L.ox, x1: a[1] + L.ox, z0: a[2] + L.oz, z1: a[3] + L.oz }; }

// 床に置く腕（寿命なし。ライジングの□＋クリックで取る）
function spawnGroundArm(kind, x, z, y, extra) {
  const st = makeArmState(kind, extra);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.72, 0.13), new THREE.MeshLambertMaterial({ color: armColor(st) }));
  m.userData.kind = kind;
  if (kind === ARM.GUN) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8), new THREE.MeshLambertMaterial({ color: COLOR_GUN_BARREL }));
    barrel.position.y = -0.48; m.add(barrel);
  } else if (kind === ARM.TENTACLE) {
    for (let k = 0; k < 3; k++) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshLambertMaterial({ color: COLOR_TENTACLE_TIP }));
      t.position.set((k - 1) * 0.05, -0.42 - k * 0.03, 0); m.add(t);
    }
  } else {
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.17, 0.19), new THREE.MeshLambertMaterial({ color: armColor(st) }));
    fist.position.y = -0.44; m.add(fist);
  }
  syncArmAddons(m, st, 'loose', 1);
  m.position.set(x, (y === undefined ? 0.12 : y), z);
  m.rotation.set(0, (x * 7.3 + z * 3.1) % (Math.PI * 2), Math.PI / 2);
  scene.add(m);
  const el = document.createElement('div');
  el.className = 'shoulder-target hidden';
  document.body.appendChild(el);
  const part = {
    obj: m, key: 'RIGHT', el, phase: 'grounded', armState: st,
    vel: new THREE.Vector3(), spin: new THREE.Vector3(), dropAt: 0, expireAt: null,
    baseColor: armColor(st), blinkPhase: 0, stage: true,
  };
  severedParts.push(part);
  return part;
}

/* =========================================================
   ミッションA：バルブ
   ========================================================= */
const KIND_JP = { fist: '通常腕', gun: '銃腕', tentacle: '触手腕' };
function valveCondition() {
  const a = player.arms;
  const fist = (s) => !s.lost && s.kind === ARM.FIST && !s.purged;
  if (state !== S.HUMAN) return '人間の体でなければ回せない';
  if (!fist(a.LEFT) || !fist(a.RIGHT)) return '普通の腕でなければ力が入らない……';
  return true;
}
function arenaActive() {
  for (const id in (STG.enc || {})) if (STG.enc[id].state === 'active' && STG.enc[id].def.type === 'arena') return STG.enc[id];
  return null;
}
function startValve(v) {
  const ok = valveCondition();
  if (ok !== true) { stageMsg(PLAYER_SPEAKER + '：' + ok); sfx('bonk'); return; }
  if (arenaActive()) { stageMsg(PLAYER_SPEAKER + '：今は手が離せない……'); return; }
  cancelCurrentAction();
  mouseHold.LEFT = null; mouseHold.RIGHT = null; gunHold.LEFT = false; gunHold.RIGHT = false;
  STG.busy = { kind: 'valve', v, t: 0, from: playerPos.clone() };
  sfx('equip');
}
function updateValve(b, dt) {
  const v = b.v, T = STAGE_CFG.valveTime;
  b.t += dt;
  // 正面に立って、ハンドルを見る
  const k = Math.min(1, b.t / 0.35);
  playerPos.x = b.from.x + (v.stand.x - b.from.x) * k;
  playerPos.z = b.from.z + (v.stand.z - b.from.z) * k;
  const dx = v.center.x - playerPos.x, dz = v.center.z - playerPos.z;
  const ty = Math.atan2(-dx, -dz);
  let dyaw = ty - yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  yaw += dyaw * Math.min(1, dt * 10);
  const tp = Math.atan2(v.center.y - EYE, Math.hypot(dx, dz));
  pitch += (tp - pitch) * Math.min(1, dt * 10);
  // 回す（ハンドルと手が一緒に回る）。最初はかたく、だんだん回る
  const u = Math.min(1, b.t / T);
  const spd = (0.6 + 2.8 * u * u);
  if (b.t > 0.35) v.spin += dt * spd;
  v.wheel.rotation.z = -v.spin;
  if (Math.floor(b.t * 3) !== Math.floor((b.t - dt) * 3)) addShake(0.05);
  if (b.t >= T) {
    STG.busy = null;
    STG.prog.valves[v.def.id] = true;
    if (v.def.flag) STG.prog.flags[v.def.flag] = true;
    setValveLook(v, true);
    sfx('lock'); addShake(0.25); doFlash(0.18, '#' + v.def.color.toString(16).padStart(6, '0'));
    const n = Object.keys(STG.prog.valves).length, all = STG.def.valves.length;
    if (n >= all) {
      setDoor(STG.def.lockDoor, true); STG.prog.opened[STG.def.lockDoor] = true;
      completeMission('A');
      stageMsg('第一閘門：' + all + '系統の圧力を確認。開放します。', 3.2);
    } else stageMsg('第一閘門：' + v.def.id + '系統 開放（' + n + ' / ' + all + '）', 2.6);
  }
}
// バルブを回している手。両手でハンドルの縁を握り、ハンドルと一緒に回る
function stageHandsHook() {
  const b = STG.busy;
  if (!b || b.kind !== 'valve' || state !== S.HUMAN) return;
  const v = b.v;
  const [fx, fz] = faceVec(v.def.face);
  const n = _sv1.set(fx, 0, fz);
  const up = _sv2.set(0, 1, 0);
  const right = _sv3.crossVectors(up, n);    // ハンドルの面の横方向
  const k = Math.min(1, b.t / 0.3);
  for (const side of ['LEFT', 'RIGHT']) {
    const hand = fpHands[side];
    if (!hand.visible) continue;
    // 手は左右（9時と3時）でハンドルを握り、ハンドルと一緒に回して、90°ごとに握り直す
    const ph = (v.spin % (Math.PI / 2)) / (Math.PI / 2);
    const swing = ph < 0.8 ? (ph / 0.8) : (1 - (ph - 0.8) / 0.2);
    const base = (side === 'LEFT' ? Math.PI : 0) + 0.35 - swing * (Math.PI / 2) * 0.8;
    const rim = v.center.clone().addScaledVector(right, Math.cos(base) * 0.36).addScaledVector(up, Math.sin(base) * 0.36)
      .addScaledVector(n, 0.04);
    const dir = rim.clone().sub(camera.position).normalize();
    const pos = rim.clone().addScaledVector(dir, -0.55);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    hand.position.lerp(pos, k);
    hand.quaternion.slerp(q, k);
  }
}

/* =========================================================
   ミッションB：指定番号の腕と照合装置
   ========================================================= */
function spawnTaggedArm() {
  const ac = STG.def.armCheck, L = STG.L;
  STG.arm01 = spawnGroundArm(ac.kind || ARM.FIST, L.X(ac.pedestal.x), L.Z(ac.pedestal.z), ac.pedestal.y, { tag: ac.tag });
  STG.arm01.obj.rotation.set(0, 0.4, Math.PI / 2);
  STG.armRespawnT = 0;
}
// 番号の腕がいまどこにあるか（無ければ null）
function findTaggedArm(tag) {
  for (const s of ['LEFT', 'RIGHT']) if (!player.arms[s].lost && player.arms[s].tag === tag) return { where: 'player', side: s };
  for (const g of graftArms) if (g.armState && g.armState.tag === tag) return { where: 'graft', pos: g.obj.position };
  for (const c of corpses) for (const s of ['LEFT', 'RIGHT']) if (c.arms[s] && c.arms[s].tag === tag) return { where: 'corpse', pos: c.group.position, corpse: c };
  for (const p of severedParts) if (p.armState && p.armState.tag === tag) return { where: 'ground', pos: p.obj.position, part: p };
  if (STG.busy && STG.busy.kind === 'submit' && STG.busy.tag === tag) return { where: 'submit' };
  return null;
}
function updateTaggedArm(dt) {
  const P = STG.prog, ac = STG.def.armCheck;
  if (!ac || P.done.B) return;
  const at = findTaggedArm(ac.tag);
  if (at && (at.where === 'player' || at.where === 'graft') && !P.flags[ac.takenFlag]) P.flags[ac.takenFlag] = true;
  if (at) { STG.armRespawnT = 0; return; }
  // どこにも無い（腕のHPが0になった・床で消えた）。台座に1本だけ補充する
  STG.armRespawnT = (STG.armRespawnT || 0) + dt;
  if (STG.armRespawnT >= STAGE_CFG.armRespawnDelay) {
    spawnTaggedArm();
    if (STG.L.armCrt) STG.L.armCrt.set(['予備検体 補充', '— ' + ac.tag + ' —'], '#ffd75e');
    stageMsg('照合装置：検体 ' + ac.tag + ' の損壊を確認。保管室へ予備を補充しました。', 3.4);
  }
}
function crusherCondition() {
  if (state !== S.HUMAN) return '人間の体でなければ提出できない';
  return true;
}
function startSubmit() {
  const ac = STG.def.armCheck, L = STG.L;
  const ok = crusherCondition();
  if (ok !== true) { stageMsg(PLAYER_SPEAKER + '：' + ok); return; }
  let side = null, other = null;
  for (const s of ['LEFT', 'RIGHT']) {
    const a = player.arms[s];
    if (a.lost) continue;
    if (a.tag === ac.tag) side = s; else if (a.tag) other = a.tag;
  }
  if (!side) {
    L.armCrt.set(['MISMATCH', other ? '検体 ' + other : '検体番号なし'], '#ff6b5e');
    stageMsg(other ? '照合装置：指定外の検体番号です。（指定 ' + ac.tag + '）'
                   : '照合装置：検体番号 ' + ac.tag + ' の腕を装着して投入してください。', 3.0);
    sfx('bonk');
    STG.crtResetT = 2.4;
    return;
  }
  cancelCurrentAction();
  const st = player.arms[side];
  const hand = fpHands[side];
  const from = new THREE.Vector3();
  hand.userData.fist.getWorldPosition(from);
  const ghost = buildRackArm(st.kind);
  syncArmAddons(ghost, st, 'loose', 1);
  ghost.position.copy(from);
  scene.add(ghost);
  player.arms[side] = makeArmState(ARM.FIST, { lost: true });
  gunHold[side] = false; mouseHold[side] = null;
  updateArmVisuals();
  STG.busy = { kind: 'submit', what: 'crusher', tag: ac.tag, side, t: 0, ghost, from, to: L.crusher.slot.clone() };
  sfx('equip');
}
function updateSubmit(b, dt) {
  b.t += dt;
  const L = STG.L;
  if (b.ghost) {
    const k = Math.min(1, b.t / 0.5);
    b.ghost.position.lerpVectors(b.from, b.to, k * k);
    b.ghost.rotation.x += dt * 9; b.ghost.rotation.z += dt * 5;
    b.ghost.scale.setScalar(1 - 0.2 * k);
  }
  if (b.what === 'crusher') {
    L.crusher.spin = 1;
    if (b.t >= 0.55 && b.ghost) {
      scene.remove(b.ghost); b.ghost = null;
      spawnFleshBurst(b.to, 14, 3.2, new THREE.Vector3(0, 1, 0), 2.0);
      spawnBloodDecal(b.to.x + 0.6, b.to.z, 0.5, 0.7);
      addShake(0.5); addHitstop(0.08); doFlash(0.3, '#ff7a66'); sfx('break');
      L.armCrt.set(['照合完了', 'ACCEPTED'], '#9ce8ff');
    }
    if (b.t >= 1.5) {
      STG.busy = null;
      const ac = STG.def.armCheck;
      setDoor(ac.door, true); STG.prog.opened[ac.door] = true;
      completeMission('B');
      stageMsg('照合装置：検体 ' + ac.tag + ' を受理。搬送ラインへの扉を開放します。', 3.2);
    }
  } else if (b.what === 'slot') {
    if (b.t >= 0.5 && b.ghost) {
      scene.remove(b.ghost); b.ghost = null;
      STG.prog.slots[b.side] = b.st;
      syncFrameArms();
      addShake(0.3); doFlash(0.2, '#ffd0b0'); sfx('lock');
      STG.busy = null;
    }
  }
}

/* =========================================================
   ミッションD：身体の組み立て
   ========================================================= */
function syncFrameArms() {
  const L = STG.L, P = STG.prog, fr = L.frame;
  if (!fr) return;
  for (const side of ['LEFT', 'RIGHT']) {
    const want = P.slots[side] && !P.slots.torso;
    if (want && !fr.hung[side]) {
      const g = buildRackArm(P.slots[side].kind);
      g.position.copy(fr.slot[side]); g.position.y = 0.55;
      g.rotation.y = fr.F.yaw;
      L.group.add(g);
      fr.hung[side] = g;
    } else if (!want && fr.hung[side]) { L.group.remove(fr.hung[side]); fr.hung[side] = null; }
  }
}
function slotCondition(side) {
  const need = STG.def.assemble.need[side];
  const a = player.arms[side];
  const jp = side === 'LEFT' ? '左腕' : '右腕';
  if (state !== S.HUMAN) return '人間の体でなければ置けない';
  if (a.lost) return jp + 'がない';
  if (a.kind !== need || (need === ARM.FIST && a.purged)) {
    return jp + 'は' + KIND_JP[need] + 'でなければならない（今は' + (a.purged ? '手首のない腕' : KIND_JP[a.kind]) + '）';
  }
  return true;
}
function startSlot(side) {
  const ok = slotCondition(side);
  if (ok !== true) { stageMsg('再構成装置：' + ok + '。', 2.8); sfx('bonk'); return; }
  cancelCurrentAction();
  const st = cloneArmState(player.arms[side]);
  const from = new THREE.Vector3();
  fpHands[side].userData.fist.getWorldPosition(from);
  const ghost = buildRackArm(st.kind);
  ghost.position.copy(from);
  scene.add(ghost);
  player.arms[side] = makeArmState(ARM.FIST, { lost: true });
  gunHold[side] = false; mouseHold[side] = null;
  updateArmVisuals();
  STG.busy = { kind: 'submit', what: 'slot', side, st, t: 0, ghost, from, to: STG.L.frame.slot[side].clone() };
  sfx('equip');
}
function torsoCondition() {
  const P = STG.prog;
  if (state !== S.HUMAN) return '人間の体でなければ据えられない';
  if (!P.slots.LEFT || !P.slots.RIGHT) return '先に両腕を掛けてください';
  return true;
}
function placeTorso() {
  const ok = torsoCondition();
  if (ok !== true) { stageMsg('再構成装置：' + ok + '。', 2.8); sfx('bonk'); return; }
  STG.prog.slots.torso = true;
  syncFrameArms();
  makeAssembledBody();
  // 頭だけが外れて台座の手前に立つ（ガスの中なので出血しない）
  const fr = STG.L.frame;
  const [fx, fz] = faceVec(STG.def.assemble.face);
  stageForceHead(fr.seat.x + fx * 1.8, fr.seat.z + fz * 1.8, EYE);
  yaw = Math.atan2(fx, fz);   // 台座の方を向く
  addShake(0.45); doFlash(0.35, '#9ce8ff'); sfx('lock');
  stageMsg('再構成装置：胴体を固定。頭部を接着してください。', 3.0);
}
function makeAssembledBody() {
  const L = STG.L, P = STG.prog, fr = L.frame;
  for (const c of corpses.slice()) if (c.assembled) removeCorpse(c);
  const c = createCorpse(fr.seat.x, fr.seat.z - 0.05, fr.F.yaw, {
    arms: { LEFT: cloneArmState(P.slots.LEFT), RIGHT: cloneArmState(P.slots.RIGHT) },
    fuse: null, skill: makeBodySkill(SKILL.HEAL), resMax: 4,
  });
  c.group.position.y = 0.42;
  c.assembled = true; c.stage = true;
  return c;
}

/* ---------- 頭だけにする（ベルトから離脱／胴体を台座に置いた） ---------- */
function stageForceHead(x, z, h) {
  clearAsuraArms();
  detachTentacle();
  cancelArmGrafts();
  scheduleSeveredDrop();
  player.attack = null; player.recoverT = 0; punchBuffer = null;
  mouseHold.LEFT = null; mouseHold.RIGHT = null; gunHold.LEFT = false; gunHold.RIGHT = false;
  state = S.HEAD;
  playerPos.x = x; playerPos.z = z;
  headH = h; headVy = CONFIG.headDetachPop; headGrounded = false;
  player.hp = CONFIG.playerMaxHp;
  headBleedT = 0; headDead = false; bleedDist = 0; bleedTicks = 0;
  lastBleedPos.set(playerPos.x, 0, playerPos.z);
  risingBlend = 1;
  selectedTarget = null;
  hideTargets();
  slowTimer = 0; legSwing = null;
}

/* =========================================================
   ミッションC：搬送コンベア
   ========================================================= */
const BELT_ARMS = [['fist', 'fist'], ['fist', 'gun'], ['gun', 'fist'], ['fist', 'fist'], ['tentacle', 'fist']];
function makeBeltCorpse(ln, z, o) {
  const L = STG.L, cv = L.conv;
  const opts = o || {};
  const c = createCorpse(ln.x, z, ln.dir < 0 ? Math.PI : 0, {
    arms: opts.arms || armsFrom(BELT_ARMS[Math.floor(Math.random() * BELT_ARMS.length)]),
    fuse: null, hp: opts.hp, skill: opts.skill, resMax: opts.resMax, resource: opts.resource,
  });
  // 仰向けに寝かせる（頭は口の側、足は粉砕機の側）
  c.body.rotation.x = -Math.PI / 2;
  const legs = c.group.children.find((ch) => ch !== c.body && ch.isMesh);
  if (legs) legs.position.set(0, 0, 0.22);
  c.group.position.y = cv.by + 0.22;
  // 拘束具
  const band = new THREE.MeshLambertMaterial({ color: 0x1c1816 });
  for (const lz of [-0.65, -1.15, 0.45]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 0.1), band);
    b.position.set(0, 0, lz);
    c.group.add(b);
  }
  c.belt = { lane: ln, z };
  c.stage = true;
  ln.bodies.push(c);
  return c;
}
function populateBelts() {
  const cv = STG.L.conv;
  for (const ln of cv.lanes) {
    ln.bodies = [];
    const off = (ln.x * 13.7) % ln.gap;
    for (let s = Math.abs(off) + 1.0; ; s += ln.gap) {
      const z = ln.start + ln.dir * s;
      if ((ln.dir < 0 && z <= ln.kIn + 1.5) || (ln.dir > 0 && z >= ln.kIn - 1.5)) break;
      makeBeltCorpse(ln, z);
    }
    ln.since = 0;
  }
}
function beltLaneAt(x, z) {
  const cv = STG.L && STG.L.conv;
  if (!cv) return null;
  for (const ln of cv.lanes) if (Math.abs(x - ln.x) <= cv.def.half && z >= cv.z0 && z <= cv.z1) return ln;
  return null;
}
function updateConveyor(wdt, rdt) {
  const L = STG.L, cv = L.conv;
  for (const ln of cv.lanes) {
    ln.tex.offset.y += ln.dir * ln.speed * wdt / 2;
    for (const d of ln.drums) d.rotation.x += ln.dir * rdt * 6;
    for (const c of ln.bodies.slice()) {
      c.belt.z += ln.dir * ln.speed * wdt;
      c.group.position.z = c.belt.z;
      const past = ln.dir < 0 ? c.belt.z <= ln.kIn : c.belt.z >= ln.kIn;
      if (!past) continue;
      // 粉砕機に入った
      ln.bodies.splice(ln.bodies.indexOf(c), 1);
      const at = new THREE.Vector3(ln.x, cv.by + 0.4, ln.kIn);
      if (corpses.indexOf(c) >= 0) removeCorpse(c);
      spawnFleshBurst(at, 10, 2.6, new THREE.Vector3(0, 1, -ln.dir * 0.5), 1.6);
      if (c.occupied) stageKillPlayer('crushed');
      else if (playerPos.distanceTo(at) < 14) sfx('break');
    }
    ln.since = (ln.since || 0) + ln.speed * wdt;
    if (ln.since >= ln.gap) { ln.since = 0; makeBeltCorpse(ln, ln.start); }
  }
  // 頭モードでベルトに乗っていれば一緒に運ばれる。端まで行けば粉砕される
  if (state === S.HEAD && !headDead) {
    const ln = beltLaneAt(playerPos.x, playerPos.z);
    if (ln) {
      playerPos.z += ln.dir * ln.speed * wdt;
      playerPos.y = cv.by;
      const past = ln.dir < 0 ? playerPos.z <= ln.kIn + 0.3 : playerPos.z >= ln.kIn - 0.3;
      if (past) {
        spawnFleshBurst(headPos, 8, 2.4, null, 1.2);
        killPlayerHead();
        STG.crushed = true;
      }
    } else playerPos.y = 0;
  } else if (state === S.STRAPPED && STG.strap) {
    const c = STG.strap.corpse;
    playerPos.set(c.group.position.x, cv.by, c.group.position.z);
  } else if (state !== S.POSSESS) playerPos.y = 0;
}

// 乗っ取りが終わった（main.js の finishPossess の最後から呼ばれる）
function stageOnPossessed(c) {
  if (!STG.area) return;
  if (c.belt) {
    const ln = c.belt.lane;
    const i = ln.bodies.indexOf(c);
    if (i >= 0) ln.bodies.splice(i, 1);
    // 同じ場所に「自分が入っている体」を作り直して固定する
    const nc = makeBeltCorpse(ln, c.belt.z, {
      arms: { LEFT: cloneArmState(player.arms.LEFT), RIGHT: cloneArmState(player.arms.RIGHT) },
      hp: player.hp, skill: Object.assign({}, player.skill), resMax: player.resMax, resource: player.resource,
    });
    nc.occupied = true;
    nc.el.classList.add('hidden');
    state = S.STRAPPED;
    STG.strap = { corpse: nc, lane: ln };
    playerPos.set(nc.group.position.x, STG.L.conv.by, nc.group.position.z);
    // 進む向き（粉砕機）を見る
    yaw = ln.dir < 0 ? 0 : Math.PI;
    pitch = 0.25;
    addShake(0.25);
    return;
  }
  if (c.assembled) {
    const d = STG.def.assemble;
    setDoor(d.door, true); STG.prog.opened[d.door] = true;
    completeMission('D');
    stageMsg('再構成装置：再構成体の起動を確認。搬出口を開放します。', 3.2);
  }
}

// Space：搬送中の死体から頭だけ離脱する
function detachStrap() {
  const s = STG.strap;
  if (!s) return;
  const c = s.corpse;
  c.occupied = false;
  c.hp = player.hp;
  c.arms = { LEFT: cloneArmState(player.arms.LEFT), RIGHT: cloneArmState(player.arms.RIGHT) };
  c.skill = Object.assign({}, player.skill);
  c.resMax = player.resMax; c.resource = player.resource;
  c.neck.getWorldPosition(_sv1);
  STG.strap = null;
  STG.lastLeft = c; STG.lastLeftT = STG.t;
  stageForceHead(_sv1.x, _sv1.z - s.lane.dir * 0.2, 0.5);
  playerPos.y = STG.L.conv.by;
  addShake(0.3); doFlash(0.25, '#9ce8ff');
}

/* =========================================================
   戦闘（通路戦・アリーナ）
   ========================================================= */
function condOk(cond) {
  if (!cond) return true;
  const [k, v] = cond.split(':');
  if (k === 'valves') return Object.keys(STG.prog.valves).length >= +v;
  if (k === 'flag') return !!STG.prog.flags[v];
  if (k === 'done') return !!STG.prog.done[v];
  return true;
}
function spawnStageEnemy(rt, s) {
  const L = STG.L;
  const x = L.X(s[0]), z = L.Z(s[1]);
  const en = createEnemy(x, z, s[2], s[3]);
  const o = s[5] || {};
  if (o.strong) {
    en.strong = true;
    en.maxHp = en.hp = CONFIG.strongHp;
    en.torsoColor = 0x4a2f2a;
    en.torso.material.color.setHex(en.torsoColor);
    en.group.scale.setScalar(1.2);
  }
  buildEnemyUi(en);
  en.stage = true;
  en.room = rt.zone;
  en.home = new THREE.Vector3(x, 0, z);
  en.cooldown = 0.8 + Math.random() * 0.6;
  en.group.rotation.y = Math.atan2(playerPos.x - x, playerPos.z - z);
  rt.enemies.push(en);
  STG.enemies.push(en);
  spawnFleshBurst(new THREE.Vector3(x, 1.2, z), 4, 1.6, null, 0.6);
  return en;
}
function startEncounter(rt) {
  rt.state = 'active';
  if (rt.def.type === 'arena') {
    for (const id of rt.def.doors) setDoor(id, false);
    rt.wave = -1;
    nextWave(rt);
    addShake(0.4); doFlash(0.25, '#ff6a5a'); sfx('boom');
  } else {
    rt.pending = rt.def.spawns.map((s) => ({ t: s[4] || 0, s }));
  }
}
function nextWave(rt) {
  rt.wave++;
  rt.pending = rt.def.waves[rt.wave].map((s) => ({ t: s[4] || 0, s }));
}
function liveCount(rt) { return rt.enemies.filter((en) => en.state !== E.DEAD).length; }
function clearEncounter(rt) {
  rt.state = 'cleared';
  STG.prog.cleared[rt.def.id] = true;
  if (rt.def.type === 'arena') {
    for (const id of rt.def.doors) setDoor(id, true);
    doFlash(0.25, '#9ce8ff'); sfx('lock');
  }
  if (rt.def.onClear && rt.def.onClear.open) {
    setDoor(rt.def.onClear.open, true);
    STG.prog.opened[rt.def.onClear.open] = true;
  }
}
function playerZoneOk(r) {
  return (state === S.HUMAN || state === S.HEAD || state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT) &&
    inR(r, playerPos.x, playerPos.z);
}
function updateEncounters(wdt) {
  for (const id in STG.enc) {
    const rt = STG.enc[id];
    if (rt.state === 'idle') {
      if (condOk(rt.def.cond) && playerZoneOk(rt.trigger)) startEncounter(rt);
      continue;
    }
    if (rt.state !== 'active') continue;
    for (const p of rt.pending.slice()) {
      p.t -= wdt;
      if (p.t > 0) continue;
      spawnStageEnemy(rt, p.s);
      rt.pending.splice(rt.pending.indexOf(p), 1);
    }
    const live = liveCount(rt);
    if (rt.def.type === 'arena') {
      const last = rt.wave >= rt.def.waves.length - 1;
      if (!rt.pending.length && !last && live <= 1) nextWave(rt);
      else if (!rt.pending.length && last && live === 0) clearEncounter(rt);
    } else if (!rt.pending.length && live === 0) clearEncounter(rt);
  }
  // 倒れきった敵は消す（死体は残る）。□とバーを溜めない
  for (const en of STG.enemies.slice()) {
    if (en.state !== E.DEAD || en.fallT < 1) continue;
    if (player.attack && player.attack.enemy === en) continue;
    demoRemoveEnemy(en);
    STG.enemies.splice(STG.enemies.indexOf(en), 1);
  }
  // 敵は自分の区画から出ない。柱や閉じた扉もすり抜けない
  const L = STG.L;
  for (const en of STG.enemies) {
    if (en.state === E.DEAD || en.state === E.GRABBED || en.state === E.TETHER || en.state === E.THROWN) continue;
    const p = en.group.position, r = en.room, m = 0.5;
    if (r) {
      p.x = Math.max(r.x0 + m, Math.min(r.x1 - m, p.x));
      p.z = Math.max(r.z0 + m, Math.min(r.z1 - m, p.z));
    }
    const pushOut = (b) => {
      const rr = 0.45;
      if (p.x <= b.x0 - rr || p.x >= b.x1 + rr || p.z <= b.z0 - rr || p.z >= b.z1 + rr) return;
      const dl = p.x - (b.x0 - rr), dr = (b.x1 + rr) - p.x, dn = p.z - (b.z0 - rr), ds = (b.z1 + rr) - p.z;
      const mn = Math.min(dl, dr, dn, ds);
      if (mn === dl) p.x = b.x0 - rr; else if (mn === dr) p.x = b.x1 + rr;
      else if (mn === dn) p.z = b.z0 - rr; else p.z = b.z1 + rr;
    };
    for (const s of L.solids) pushOut(s);
    for (const id in L.doors) if (doorBlocks(L.doors[id])) pushOut(L.doors[id].r);
  }
}

/* =========================================================
   インタラクト（F）
   照準の向きと距離で、いちばん手前の1つだけに反応する。プロンプトもその1つだけ
   ========================================================= */
// 頭モードで乗り移る死体。近さに加えて照準の向きも見る
// （ベルトでは離脱したばかりの自分の体がいちばん近いので、距離だけだと戻ってしまう）
function stageCorpsePick() {
  if (state !== S.HEAD || headDead) return null;
  camera.getWorldDirection(_sv1);
  const fl = Math.hypot(_sv1.x, _sv1.z) || 1;
  let best = null, bs = Infinity;
  for (const c of corpses) {
    if (c.occupied) continue;
    const d = playerPos.distanceTo(c.group.position);
    if (d > CONFIG.corpseInteractDistance) continue;
    const dx = c.group.position.x - playerPos.x, dz = c.group.position.z - playerPos.z;
    const hl = Math.hypot(dx, dz) || 1;
    const cos = (dx * _sv1.x + dz * _sv1.z) / (hl * fl);
    // 見ている方向（左右およそ70°以内）の死体だけ。真横や後ろの体は選ばない
    if (cos < 0.34 && hl > 0.25) continue;
    let s = d * (1 + 3 * (1 - cos));
    // 離脱したばかりの体は後回し（すぐ隣にあるので、放っておくと次のベルトより先に選ばれる）
    if (c === STG.lastLeft && STG.t - STG.lastLeftT < 3) s *= 4;
    if (s < bs) { bs = s; best = c; }
  }
  return best;
}
// 既存の「頭モードで一番近い死体」をステージ中だけ差し替える（□の表示とFが同じ相手を指すように）
const _origFindCorpseNearby = findCorpseNearby;
findCorpseNearby = function () {
  if (STG.area) return stageCorpsePick();
  return _origFindCorpseNearby();
};

function stageCandidates() {
  const L = STG.L, def = STG.def, P = STG.prog;
  const out = [];
  const human = state === S.HUMAN, head = state === S.HEAD && !headDead;
  if (def.kind === 'safe') {
    const rc = def.receptionist;
    if (human || head) out.push({ pos: new THREE.Vector3(L.X(rc.x), 1.4, L.Z(rc.z)), range: rc.r, label: '会話する', act: talkReception });
    const sd = def.stageDoor;
    if (STG.selected && (human || head)) {
      out.push({ pos: new THREE.Vector3(L.X(sd.x), 1.6, L.Z(sd.z)), range: sd.r, label: '試験区画へ進む',
        act: () => { const id = STG.selected; stageFade(() => stageEnterArea(id)); } });
    }
  }
  if (human && def.kind === 'stage') {
    // バルブ
    if (L.valves && !P.done.A) for (const id in L.valves) {
      if (P.valves[id]) continue;
      const v = L.valves[id];
      out.push({ pos: v.pos, range: 2.2, label: 'バルブを回す', act: () => startValve(v) });
    }
    // 照合装置
    if (def.armCheck && !P.done.B && P.done.A) {
      out.push({ pos: L.crusher.slot, range: def.armCheck.crusher.r, label: '腕を提出する', act: startSubmit });
    }
    // 身体の台座
    if (L.frame && !P.done.D && P.done.C) {
      const fr = L.frame;
      for (const side of ['LEFT', 'RIGHT']) {
        if (P.slots[side]) continue;
        out.push({ pos: fr.prompt[side], range: 1.9, label: (side === 'LEFT' ? '左腕' : '右腕') + 'を掛ける', act: () => startSlot(side) });
      }
      if (!P.slots.torso) out.push({ pos: fr.prompt.TORSO, range: 1.9, label: '胴体を据える', act: placeTorso });
    }
    // 終盤のスイッチ（任意）
    if (L.switchPos && !P.finale) {
      out.push({ pos: L.switchPos, range: 2.0, label: '搬送棟を起動する', act: pullFinaleSwitch });
    }
  }
  // ゴール扉
  if ((human || head) && def.kind === 'stage' && def.goal && allMissionsDone()) {
    out.push({ pos: new THREE.Vector3(L.X(def.goal.x), 1.6, L.Z(def.goal.z)), range: def.goal.r, label: 'セーフルームへ戻る',
      act: () => stageFade(() => { STG.selected = null; stageEnterArea('safe', { fromStage: true }); }) });
  }
  // 頭モードの乗っ取り
  if (head) {
    const c = stageCorpsePick();
    if (c) {
      c.neck.getWorldPosition(_sv2);
      out.push({ pos: _sv2.clone(), range: 99, corpse: c,
        label: c.assembled ? '完成した身体に接着する' : c.belt ? '搬送体に接着する' : '身体に接着する',
        act: () => startPossess(c) });
    }
  }
  return out;
}

function pickInteract() {
  if (!STG.area || STG.fade || STG.dialog || STG.busy || STG.dead > 0) return null;
  const list = stageCandidates();
  if (!list.length) return null;
  camera.getWorldDirection(_sv1);
  const fl = Math.hypot(_sv1.x, _sv1.z) || 1;
  let best = null, bs = Infinity;
  for (const c of list) {
    if (c.corpse) { const s = 50; if (s < bs) { bs = s; best = c; } continue; }
    const dx = c.pos.x - playerPos.x, dz = c.pos.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d > c.range) continue;
    const cos = (dx * _sv1.x + dz * _sv1.z) / ((d || 1) * fl);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (d > 1.0 && ang > STAGE_CFG.interactAngle) continue;
    const s = d + ang * 3;
    if (s < bs) { bs = s; best = c; }
  }
  return best;
}

function stageInteract() {
  const c = STG.pick;
  if (!c) return false;
  c.act();
  STG.pick = null;
  return true;
}

function updatePrompt() {
  const pr = stageUi.prompt;
  if (STG.area && state === S.STRAPPED && !STG.fade && !STG.dead) {
    stageUi.promptKey.textContent = 'Space';
    stageUi.promptTxt.textContent = '離脱する';
    pr.classList.remove('hidden');
    return;
  }
  const c = STG.pick;
  if (!c) { pr.classList.add('hidden'); return; }
  stageUi.promptKey.textContent = 'F';
  if (stageUi.promptTxt.textContent !== c.label) stageUi.promptTxt.textContent = c.label;
  pr.classList.remove('hidden');
}

/* ---------- セーフルームの受付 ---------- */
function talkReception() {
  const list = Object.keys(BK_STAGES).filter((k) => BK_STAGES[k].selectable);
  const choices = list.map((k) => ({
    label: BK_STAGES[k].label, act: () => {
      STG.selected = k;
      const big = STG.L.doors.big;
      if (big) for (const lm of big.lamps) lm.material.color.setHex(0x3aff7a);
      say('受付研究員：' + BK_STAGES[k].title + '、承認しました。大型扉の施錠を解きます。', 3.2);
      sfx('lock');
    },
  }));
  choices.push({ label: '戻る', act: () => {} });
  openDialog({ speaker: '受付研究員', text: '試験区画を選択してください。', choices });
}

/* ---------- 終盤：搬送棟の起動（任意） ---------- */
function pullFinaleSwitch() {
  const L = STG.L;
  STG.prog.finale = true;
  L.finaleOn = true; L.finaleT = 0;
  L.leverT = 0;
  addShake(0.35); sfx('boom');
}

/* =========================================================
   死んだとき・チェックポイント
   ========================================================= */
function stageKillPlayer(why) {
  if (STG.dead > 0) return;
  STG.crushed = true;
  if (state === S.STRAPPED) {
    state = S.HUMAN;
    STG.strap = null;
  }
  player.hp = 0;
  doFlash(0.6, '#ff3b30'); addShake(0.8);
  sfx('break');
}
function isPlayerDead() {
  if (STG.crushed) return true;
  if (headDead) return true;
  return player.hp <= 0 && (state === S.HUMAN || state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT);
}
function currentCheckpoint() {
  const cps = STG.def.checkpoints;
  let best = cps[0];
  for (const cp of cps) if (cp.after === null || STG.prog.done[cp.after]) best = cp;
  return best;
}
// プレイヤーの体を作り直す（resetAll の体の部分と同じ。ステージの外は触らない）
function stageResetPlayer(cp) {
  player.hp = CONFIG.playerMaxHp;
  player.resMax = CONFIG.resourceStart; player.resource = player.resMax; player.resourceCharge = 0;
  player.arms.LEFT = makeArmState(cp.arms[0] || ARM.FIST);
  player.arms.RIGHT = makeArmState(cp.arms[1] || ARM.FIST);
  player.skill = makeBodySkill();
  clearAsuraArms(); clearHealFx(); clearScanRipples(); clearBombFx();
  wristCool.LEFT = 0; wristCool.RIGHT = 0;
  player.gunRecoil.LEFT = 0; player.gunRecoil.RIGHT = 0;
  gunHold.LEFT = false; gunHold.RIGHT = false; gunCool.LEFT = 0; gunCool.RIGHT = 0;
  mouseHold.LEFT = null; mouseHold.RIGHT = null;
  player.attack = null; player.recoverT = 0; player.dodgeT = 0; player.invuln = 1.0; player.stagger = 0;
  punchBuffer = null;
  detachTentacle();
  tentComboStep = 0; tentComboAt = -99; tentFovKick = 0;
  state = S.HUMAN;
  risingBlend = 0; legSwing = null; legDeploy = 0;
  headH = 0; headVy = 0; headGrounded = false; possess = null;
  headBleedT = 0; headDead = false; bleedDist = 0; bleedTicks = 0;
  spineGroup.visible = false; spiderGroup.visible = false;
  slowTimer = 0; slowScaleOverride = 1; hitstop = 0; shake = 0;
  cancelArmGrafts();
  selectedTarget = null; hideTargets();
  placePlayer(cp.x, cp.z, cp.yaw);
  updateArmVisuals();
}
function respawnAtCheckpoint(first) {
  const cp = currentCheckpoint();
  STG.busy = null; STG.strap = null; STG.dead = 0; STG.crushed = false; STG.pick = null;
  stageResetPlayer(cp);
  spawnDynamic();
  syncGimmickVisuals();
  void first;
}

/* =========================================================
   目標（Tab）とコンパス
   ========================================================= */
const _stGoal = new THREE.Vector3();
function stageObjective() {
  const L = STG.L, def = STG.def, P = STG.prog;
  const at = (x, z) => _stGoal.set(x, 0, z);
  if (def.kind === 'safe') {
    if (!STG.selected) return { text: '受付で試験区画を選ぶ', goal: at(L.X(def.receptionist.x), L.Z(def.receptionist.z)) };
    return { text: '大型扉から試験区画へ進む', goal: at(L.X(def.stageDoor.x), L.Z(def.stageDoor.z)) };
  }
  const ar = arenaActive();
  if (ar) {
    let best = null, bd = Infinity;
    for (const en of ar.enemies) {
      if (en.state === E.DEAD) continue;
      const d = playerPos.distanceTo(en.group.position);
      if (d < bd) { bd = d; best = en; }
    }
    return { text: '扉が閉鎖された。敵を全滅させる', goal: best ? _stGoal.copy(best.group.position) : null };
  }
  const m = currentMission();
  if (!m) {
    return { text: 'ゴール扉からセーフルームへ戻る' + (P.finale ? '' : '（任意：回廊の起動スイッチ）'),
      goal: at(L.X(def.goal.x), L.Z(def.goal.z)) };
  }
  if (m.type === 'valves') {
    const marks = def.valves.map((v) => v.id + (P.valves[v.id] ? '●' : '○')).join(' ');
    let best = null, bd = Infinity;
    for (const v of def.valves) {
      if (P.valves[v.id]) continue;
      const d = Math.hypot(L.X(v.x) - playerPos.x, L.Z(v.z) - playerPos.z);
      if (d < bd) { bd = d; best = v; }
    }
    return { text: '3つのバルブを開いて第一閘門を開放する　' + marks,
      goal: best ? at(L.X(best.x), L.Z(best.z)) : null };
  }
  if (m.type === 'armCheck') {
    const ac = def.armCheck;
    const w = findTaggedArm(ac.tag);
    if (w && w.where === 'player') return { text: '照合装置に ' + ac.tag + ' の腕を提出する', goal: _stGoal.copy(L.crusher.slot) };
    return { text: '指定番号 ' + ac.tag + ' の腕を探して装着する',
      goal: w && w.pos ? _stGoal.copy(w.pos) : at(L.X(ac.pedestal.x), L.Z(ac.pedestal.z)) };
  }
  if (m.type === 'conveyor') {
    const g = L.walk.find((w) => w.id === def.conveyor.goal);
    if (state === S.STRAPPED) return { text: '粉砕機に入る前に離脱して、次のベルトの死体へ移る', goal: g ? at((g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2) : null };
    return { text: '搬送ラインの死体を乗り継いで対岸へ渡る', goal: g ? at((g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2) : null };
  }
  if (m.type === 'assemble') {
    const s = P.slots;
    if (s.torso) return { text: '頭だけで、完成した身体に接着する', goal: _stGoal.copy(L.frame.seat) };
    const st = '左腕' + (s.LEFT ? '●' : '○') + ' 右腕' + (s.RIGHT ? '●' : '○') + ' 胴体○';
    return { text: '写真のとおりに身体を組み立てる　' + st, goal: _stGoal.copy(L.frame.seat) };
  }
  return { text: '-', goal: null };
}
function stageRoomLabel() {
  if (!STG.area) return null;
  const L = STG.L;
  const sp = spaceAt(L, playerPos.x, playerPos.z);
  return STG.def.label + (sp && sp.name ? ' / ' + sp.name : '');
}

/* =========================================================
   毎フレーム
   ========================================================= */
function updateStage(dt, rdt, wdt) {
  updateFade(rdt);
  if (!STG.area) { stageUi.prompt.classList.add('hidden'); return; }
  STG.t += rdt;
  const L = STG.L, def = STG.def;
  // 明るさ（ボス戦の照明の更新のあとで上書きする）
  hemiLight.intensity = def.ambient.hemi;
  dirLight.intensity = def.ambient.dir;
  updateLights(rdt);
  for (const a of L.anim) a.update(rdt);
  // 扉の開け閉め
  for (const id in L.doors) {
    const d = L.doors[id];
    if (d.decor) continue;
    const want = d.open ? 1 : 0;
    if (d.k !== want) {
      d.k += Math.sign(want - d.k) * Math.min(Math.abs(want - d.k), rdt * STAGE_CFG.doorSpeed);
      applyDoorPose(d);
    }
  }
  // 研究員は頭だけこちらを追う
  for (const r of L.researchers) {
    if (!r.look) continue;
    const dx = playerPos.x - r.g.position.x, dz = playerPos.z - r.g.position.z;
    let a = Math.atan2(dx, dz) - r.base;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    a = Math.max(-1.1, Math.min(1.1, a));
    r.head.rotation.y += (a - r.head.rotation.y) * Math.min(1, rdt * 2.5);
    r.head.rotation.x = Math.sin(STG.t * 0.7 + r.phase) * 0.05;
  }

  if (def.kind === 'stage') {
    const P = STG.prog;
    // 操作中（バルブ・提出）
    if (STG.busy) {
      if (STG.busy.kind === 'valve') updateValve(STG.busy, dt);
      else if (STG.busy.kind === 'submit') updateSubmit(STG.busy, dt);
    }
    if (L.crusher) {
      L.crusher.spin = Math.max(0, L.crusher.spin - rdt * 0.5);
      for (const d of L.crusher.drums) d.rotation.x += rdt * (0.6 + 9 * L.crusher.spin) * (d === L.crusher.drums[0] ? 1 : -1);
    }
    if (STG.crtResetT > 0) {
      STG.crtResetT -= rdt;
      if (STG.crtResetT <= 0 && !P.done.B) L.armCrt.set(['REQUIRED ARM', '— ' + def.armCheck.tag + ' —']);
    }
    if (L.switchLever) {
      const tgt = P.finale ? -0.7 : 0.7;
      L.switchLever.rotation.x += (tgt - L.switchLever.rotation.x) * Math.min(1, rdt * 6);
    }
    if (L.conv) updateConveyor(wdt, rdt);
    updateTaggedArm(dt);
    updateEncounters(wdt);
    // 隠し部屋の点検扉：中に人間の体でいれば内側から開く
    for (const d of (def.doors || [])) {
      if (!d.insideOpen || P.opened[d.id]) continue;
      const sp = L.spaces.find((s) => s.id === d.insideOpen);
      if (sp && state === S.HUMAN && inR(sp, playerPos.x, playerPos.z)) {
        setDoor(d.id, true); P.opened[d.id] = true;
      }
    }
    // ミッションC：人間の体で対岸に立てば突破
    if (def.conveyor && P.done.B && !P.done.C && state === S.HUMAN) {
      const g = L.walk.find((w) => w.id === def.conveyor.goal);
      if (g && inR(g, playerPos.x, playerPos.z)) {
        setDoor(def.conveyor.door, true); P.opened[def.conveyor.door] = true;
        completeMission('C');
        stageMsg('受入口：搬送検体の受領を確認。扉を開放します。', 3.0);
      }
    }
    // 死んだ → 少し待って暗転 → チェックポイントへ
    if (isPlayerDead()) {
      STG.dead += rdt;
      if (STG.dead >= STAGE_CFG.deathWait && !STG.fade) stageFade(() => respawnAtCheckpoint(false));
    }
  }
  STG.pick = pickInteract();
  updatePrompt();
}

// スタート画面の「セーフルームへ移動」。クリックで開始（ロック）しつつ移動する
document.getElementById('startSafe').addEventListener('click', () => { stageGoSafe(false); });
