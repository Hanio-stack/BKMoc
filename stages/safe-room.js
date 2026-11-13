'use strict';
/* =========================================================
   セーフルーム（待機室）のレベルデータ
   座標はメートル。origin を原点にしたローカル座標で書く（x=東 / z=南。北は -z）。
   形式は stages/stage-1-1.js の先頭コメントを参照。
   ========================================================= */
(window.BK_STAGES = window.BK_STAGES || {}).safe = {
  id: 'safe',
  label: 'SAFE ROOM',
  title: '第三区画 待機室',
  kind: 'safe',
  origin: [220, 0, 0],
  fog: { color: 0x0b0d10, near: 6, far: 34 },
  ambient: { hemi: 0.42, dir: 0.16 },

  spawn: { x: 0, z: 4.2, yaw: 0 },           // モックから来たとき（扉の方を向く）
  returnSpawn: { x: 0, z: -4.2, yaw: Math.PI },   // ステージから戻ったとき（扉の前で振り返る）

  spaces: [
    { id: 'room', type: 'room', r: [-7, 7, -7, 7], h: 4.2, tone: 'warm', name: '待機室' },
    // 受付の小部屋（窓の向こう。入れない）
    { id: 'booth', type: 'view', r: [-11.4, -7.6, -3, 3], h: 3.2, tone: 'cold' },
    // 大型扉の奥（扉が開いたときに見える前室）
    { id: 'lock', type: 'view', r: [-2.6, 2.6, -11.6, -7.6], h: 4.0, tone: 'red', lights: false },
  ],
  windows: [
    { axis: 'x', at: -7, from: -2, to: 2, y0: 1.05, y1: 2.35, style: 'glass' },
    { axis: 'x', at: -7.6, from: -2, to: 2, y0: 1.05, y1: 2.35, style: 'glass' },
  ],
  doors: [
    // ステージへ進む大型扉。北の壁の中央
    { id: 'big', axis: 'x', at: -7, from: -2.2, to: 2.2, h: 3.4, style: 'blast', lamp: true },
  ],
  gas: [[-7, 7, -7, 7]],
  lights: [
    { x: -3, y: 4.0, z: -2, tone: 'warm' }, { x: 3, y: 4.0, z: 2, tone: 'warm' },
    { x: -9.5, y: 3.0, z: 0, tone: 'cold' },
    { x: 0, y: 3.6, z: -9.6, tone: 'red' },
  ],
  props: [
    // 受付のカウンター（窓の手前）
    { type: 'counter', x: -6.6, z: 0, w: 0.8, d: 4.4, h: 1.05 },
    { type: 'desk', x: -9.2, z: -1.6, w: 1.6, d: 0.9, face: 'e', crt: '受付端末', phone: true, papers: true, solid: false },
    { type: 'sign', x: -6.95, y: 2.85, z: 0, face: 'e', w: 2.2, h: 0.42, lines: ['受付  RECEPTION'], style: 'plate' },
    { type: 'sign', x: 0, y: 3.75, z: -6.95, face: 's', w: 3.4, h: 0.5, lines: ['試験区画 連絡扉'], style: 'plate' },
    { type: 'sign', x: 6.95, y: 2.4, z: -2.5, face: 'w', w: 1.8, h: 1.0,
      lines: ['待機室', '頭部のみの検体は', '本室内で止血される'], style: 'notice' },
    { type: 'locker', x: 6.5, z: 2.5, face: 'w', n: 4 },
    { type: 'bench', x: 3.2, z: 5.6, w: 3.0, d: 0.6, rot: 0 },
    { type: 'shelf', x: -5.6, z: 6.4, w: 2.4, d: 0.6, h: 1.9, face: 'n' },
    { type: 'panel', x: 2.9, z: -6.95, face: 's', w: 1.0 },
    { type: 'puddle', x: 1.5, z: -1.2, r: 1.1 },
  ],
  researchers: [
    { x: -9.0, z: 0.3, face: 'e', look: true, pose: 'stand' },
  ],
  // 受付（Fで会話）と大型扉（ステージを選んだあとFで出発）
  receptionist: { x: -6.5, z: 0, r: 2.6 },
  stageDoor: { door: 'big', x: 0, z: -6.2, r: 3.0 },
};
