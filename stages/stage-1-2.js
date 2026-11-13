'use strict';
/* =========================================================
   DEMO STAGE 1-2「第四検体処理区画（主搬送棟）」のレベルデータ
   形式は stages/stage-1-1.js の先頭コメントと同じ。1-1 からの追加:
     type:'catwalk'  壁も天井もない鉄の足場（吹き抜けを渡る）
     fills           壁を補う箱 [x0,x1,y0,y1,z0,z1]（足場が壁を貫く所の上下）
     taggedArms      番号付きの腕（壊れて無くなれば at に1本だけ補充）
     armCheck.mode   'store' は粉砕せず装置に保管する（M1 → M4 で使う）
     specimen        検体番号の付いた体（搬送ライン上。搬出口で拘束が外れる）
     assemble.need   { kind, tag } 番号も照合 / { from } 保管した腕 / torso:{ bodyTag }
     valves[].opens  バルブを開くと開く扉
     decoBelts       条件で動き出す小型コンベア（見た目）
     mega            主搬送棟（最後の演出）。lines は x 方向に流れるライン
     missions[].brief / doneLine  研究員の指示と完了の放送
   ========================================================= */
(window.BK_STAGES = window.BK_STAGES || {})['1-2'] = {
  id: '1-2',
  label: 'DEMO STAGE 1-2',
  title: '第四検体処理区画',
  kind: 'stage',
  selectable: true,
  speaker: '研究員',
  origin: [700, 0, 0],
  fog: { color: 0x05070a, near: 3, far: 30 },
  ambient: { hemi: 0.40, dir: 0.12 },

  /* ---------- 空間 ---------- */
  spaces: [
    // 入口と中央設備区画
    { id: 'start', type: 'room', r: [-5, 5, 0, 10], h: 4.0, tone: 'cold', name: '検体搬入口' },
    { id: 'c1', type: 'corridor', r: [-2, 2, -12, 1], tone: 'cold' },
    { id: 'hub', type: 'room', r: [-14, 14, -34, -11], h: 6.0, tone: 'cold', name: '中央設備区画' },
    { id: 'obsH', type: 'view', r: [-13, -6, -9.4, -3], h: 3.0, tone: 'cold' },
    { id: 'rec', type: 'room', r: [7, 14, -7, -1], h: 3.0, tone: 'amber', name: '検体記録室' },
    { id: 'du2', type: 'duct', r: [1, 8, -5, -3.6] },
    { id: 'recdoor', type: 'doorway', r: [9, 11, -12, -6] },
    // 西：検体保管区画（M1）
    { id: 'w1', type: 'corridor', r: [-29, -13, -24, -20], tone: 'cold', name: '保管区画 通路' },
    { id: 'w2', type: 'corridor', r: [-32, -28, -44, -19], tone: 'red' },
    { id: 'sr', type: 'room', r: [-46, -27, -62, -43], h: 4.5, tone: 'amber', name: '検体保管庫' },
    { id: 'w4', type: 'corridor', r: [-50, -45, -48, -16], tone: 'red' },
    { id: 'w5', type: 'corridor', r: [-47, -31, -20, -16], tone: 'cold' },
    { id: 'hr1', type: 'room', r: [-42, -34, -14, -8], h: 3.0, tone: 'amber', name: '腕の廃棄庫' },
    { id: 'du1', type: 'duct', r: [-39, -37.6, -17, -13] },
    { id: 'hr1door', type: 'doorway', r: [-36, -34, -17, -13] },
    // 東：配管区画（M2）
    { id: 'e1', type: 'corridor', r: [13, 26, -24, -20], tone: 'cold' },
    { id: 'jx', type: 'room', r: [25, 37, -30, -10], h: 5.0, tone: 'green', name: '配管分岐室' },
    { id: 'a1', type: 'corridor', r: [36, 52, -22, -18], tone: 'cold' },
    { id: 'va', type: 'room', r: [51, 63, -30, -8], h: 5.0, tone: 'cold', name: 'エアロック' },
    { id: 'a2', type: 'corridor', r: [55, 59, -9, 6], tone: 'red' },
    { id: 'a3', type: 'corridor', r: [4, 60, 4, 8], tone: 'cold', name: '搬入路' },
    { id: 'b1', type: 'corridor', r: [29, 33, -46, -29], tone: 'warm' },
    { id: 'vb', type: 'room', r: [22, 40, -62, -45], h: 6.0, tone: 'warm', name: '搬送動力室' },
    { id: 'b2', type: 'corridor', r: [29, 33, -65, -61], tone: 'red' },
    { id: 'vc', type: 'room', r: [22, 44, -79, -64], h: 6.0, tone: 'red', name: '隔壁制御室' },
    // 主搬送棟（吹き抜け。序盤から窓と足場越しに見える）
    { id: 'big', type: 'view', r: [-24, 20, -80, -35.4], h: 10, tone: 'dark', lights: false, floorY: -10, name: '主搬送棟' },
    { id: 'cw', type: 'catwalk', r: [-2, 2, -81.6, -33], name: '中央足場' },
    { id: 'sc', type: 'catwalk', r: [1, 23, -74, -70], name: '連絡足場' },
    // 北：搬送ライン室（M3）・組立区画（M4）
    { id: 'tr', type: 'room', r: [-6, 30, -110, -80.6], h: 8.0, tone: 'red', walk: false, floorY: -1.6, name: '検体搬送室' },
    { id: 'ex', type: 'corridor', r: [29, 32, -108, -104], tone: 'cold' },
    { id: 'as', type: 'room', r: [31, 53, -110, -88], h: 5.0, tone: 'cold', name: '人体組立区画' },
    { id: 'p1', type: 'corridor', r: [52, 60, -100, -96], tone: 'warm' },
    { id: 'ps', type: 'room', r: [59, 71, -108, -88], h: 3.6, tone: 'warm', name: '部品保管庫' },
    { id: 'du3', type: 'duct', r: [52, 60, -92, -90.6] },
    // 大型試験場（M5）
    { id: 'aa', type: 'corridor', r: [32, 36, -115, -109], tone: 'red' },
    { id: 'ar', type: 'room', r: [-10, 36, -152, -114], h: 9.0, tone: 'warm', name: '大型試験場' },
    { id: 'obsA', type: 'view', r: [-4, 30, -160, -152.6], h: 7.2, tone: 'cold', floorY: 3.5 },
    { id: 'dvA', type: 'duct', r: [37, 38.4, -148, -118] },
    { id: 'dvS1', type: 'duct', r: [35, 38.4, -147.6, -146.2] },
    { id: 'dvS2', type: 'duct', r: [35, 38.4, -120.4, -119] },
    // 主搬送制御室（M6）
    { id: 'k1', type: 'corridor', r: [-22, -9, -128, -124], tone: 'cold' },
    { id: 'k2', type: 'corridor', r: [-20, -16, -129, -95], tone: 'dim' },
    { id: 'cc', type: 'room', r: [-24, -7.2, -96, -80.6], h: 5.0, tone: 'cold', name: '主搬送制御室' },
  ],
  walks: [
    { id: 'spA', r: [-6, 3, -108, -81] },            // 搬送室の足場（足場の先）
    { id: 'unload', r: [15.6, 30, -110, -102.5] },   // 搬出台（仕分け機の先）
  ],
  // 足場が壁を貫く所の上下（壁が抜けたままにならないように）
  fills: [
    [-2, 2, 2.6, 6, -34.4, -34], [-2, 2, 2.6, 10, -35.4, -35], [-2, 2, -10, -0.12, -35.4, -35],
    [-2, 2, 2.6, 10, -80.4, -80], [-2, 2, -10, -0.12, -80.4, -80],
    [-2, 2, 2.6, 8, -80.6, -80.2], [-2, 2, -1.6, -0.12, -80.6, -80.2],
    [20, 20.4, 2.6, 10, -74, -70], [20, 20.4, -10, -0.12, -74, -70], [21.6, 22, 2.6, 6, -74, -70],
  ],

  windows: [
    { axis: 'z', at: -34, from: -12, to: -5, y0: 1.2, y1: 3.8, style: 'glass' },     // 中央設備区画 → 主搬送棟
    { axis: 'z', at: -35.4, from: -12, to: -5, y0: 1.2, y1: 3.8, style: 'glass' },
    { axis: 'z', at: -34, from: 5, to: 12, y0: 1.2, y1: 3.8, style: 'glass' },
    { axis: 'z', at: -35.4, from: 5, to: 12, y0: 1.2, y1: 3.8, style: 'glass' },
    { axis: 'x', at: 22, from: -60, to: -48, y0: 1.0, y1: 3.4, style: 'glass' },      // 動力室 → 主搬送棟
    { axis: 'x', at: 20, from: -60, to: -48, y0: 1.0, y1: 3.4, style: 'glass' },
    { axis: 'z', at: -80.6, from: -22, to: -9, y0: 0.8, y1: 3.8, style: 'glass' },    // 制御室 → 主搬送棟（大窓）
    { axis: 'z', at: -80, from: -22, to: -9, y0: 0.8, y1: 3.8, style: 'glass' },
    { axis: 'x', at: -7.2, from: -94, to: -84, y0: 1.0, y1: 2.6, style: 'glass' },   // 制御室 → 搬送室
    { axis: 'x', at: -6, from: -94, to: -84, y0: 1.0, y1: 2.6, style: 'glass' },
    { axis: 'z', at: -11, from: -12, to: -7, y0: 1.0, y1: 2.3, style: 'glass' },      // 中央 → 監視室
    { axis: 'z', at: -9.4, from: -12, to: -7, y0: 1.0, y1: 2.3, style: 'glass' },
    { axis: 'z', at: -152, from: 2, to: 24, y0: 4.6, y1: 6.8, style: 'glass' },       // 試験場 → 観察室（高窓）
    { axis: 'z', at: -152.6, from: 2, to: 24, y0: 4.6, y1: 6.8, style: 'glass' },
  ],

  doors: [
    { id: 'entryBack', axis: 'x', at: 10, from: -2, to: 2, h: 3.0, style: 'blast', decor: true },
    { id: 'dE', axis: 'z', at: 14, from: -24, to: -20, h: 2.6, style: 'blast', lamp: true },        // M1 で開く
    { id: 'dAir', axis: 'x', at: -8, from: 55, to: 59, h: 2.6, style: 'blast', lamp: true },        // バルブA
    { id: 'dB2', axis: 'x', at: -62, from: 29, to: 33, h: 2.6, style: 'shutter', lamp: true },     // バルブB
    { id: 'dBulk', axis: 'z', at: 22, from: -74, to: -70, h: 2.6, style: 'blast', lamp: true },    // バルブC
    { id: 'dCore', axis: 'x', at: -80.6, from: -2, to: 2, h: 2.6, style: 'blast', lamp: true },    // M2：搬送区画
    { id: 'dArena', axis: 'x', at: -110, from: 32, to: 36, h: 2.6, style: 'blast', lamp: true },   // M4 で開く
    { id: 'arS', axis: 'x', at: -114, from: 32, to: 36, h: 2.6, style: 'shutter', open: true },
    { id: 'arW', axis: 'z', at: -10, from: -128, to: -124, h: 2.6, style: 'shutter' },
    { id: 'hr1d', axis: 'x', at: -16, from: -36, to: -34, h: 2.2, style: 'hatch', insideOpen: 'hr1' },
    { id: 'recd', axis: 'x', at: -11, from: 9, to: 11, h: 2.2, style: 'hatch', insideOpen: 'rec' },
    { id: 'goal', axis: 'z', at: -24, from: -90, to: -86, h: 3.0, style: 'blast', lamp: true, decor: true },
  ],

  gas: [
    [-6, 3, -108, -81],            // 搬送室の足場
    [36, 52, -109.5, -100],        // 組立台のまわり
    [-42, -34, -14, -8],           // 腕の廃棄庫
    [7, 14, -7, -1],               // 検体記録室
    [52, 60, -92, -90.6],          // 長いダクト
    [35, 38.4, -148, -118],        // 試験場の通風路
  ],

  lights: [
    { x: 0, y: 3.2, z: -79.6, tone: 'red' },          // 搬送区画の扉
    { x: 12, y: 3.2, z: -28, tone: 'spot' },          // 検査装置
    { x: -42, y: 3.6, z: -58, tone: 'spot' },         // 指定の腕
    { x: 44, y: 4.2, z: -105, tone: 'spot' },         // 組立台
    { x: 13, y: 7.0, z: -133, tone: 'fire' },         // 試験場の中央設備
    { x: 13.7, y: 6.0, z: -108, tone: 'red' }, { x: 6.1, y: 6.0, z: -108, tone: 'red' }, { x: 9.9, y: 6.0, z: -83, tone: 'red' },
  ],

  props: [
    // --- 入口 ---
    { type: 'sign', x: 0, y: 3.2, z: 0.05, face: 's', w: 4.2, h: 0.6, lines: ['第四検体処理区画'], style: 'plate' },
    { type: 'sign', x: -4.95, y: 2.1, z: 6, face: 'e', w: 1.6, h: 0.9, lines: ['作業員心得', '指示に従い', '速やかに作業せよ'], style: 'notice' },
    { type: 'locker', x: 4.5, z: 6.5, face: 'w', n: 3 },
    { type: 'sign', x: -1.95, y: 2.0, z: -7, face: 'e', w: 1.3, h: 0.5, lines: ['区画 4-01'], style: 'stencil' },
    { type: 'mark', x: 1.95, y: 1.9, z: -6.2, face: 'w' },
    { type: 'puddle', x: 0.4, z: -3, r: 1.0 },
    // --- 中央設備区画 ---
    { type: 'sign', x: 0, y: 4.6, z: -33.95, face: 's', w: 5.0, h: 0.6, lines: ['中央設備区画 ― 主搬送棟'], style: 'plate' },
    { type: 'machine', x: -4.5, z: -22, w: 3.2, d: 3.2, h: 2.6, style: 'pump', label: '圧力調整器' },
    { type: 'machine', x: 4.5, z: -22, w: 3.6, d: 1.4, h: 1.8, style: 'console', label: '中央制御盤' },
    { type: 'pillar', x: -9, z: -28, w: 1.1, d: 1.1 }, { type: 'pillar', x: 9, z: -28, w: 1.1, d: 1.1 },
    { type: 'pillar', x: -9, z: -16, w: 1.1, d: 1.1 }, { type: 'pillar', x: 9, z: -16, w: 1.1, d: 1.1 },
    { type: 'inspector', x: 11.8, z: -29.5, face: 'w', label: '適合検査装置' },
    { type: 'sign', x: 13.95, y: 3.3, z: -29.5, face: 'w', w: 2.0, h: 0.4, lines: ['検査装置（右腕搬入）'], style: 'plate' },
    { type: 'sign', x: -13.95, y: 3.0, z: -22, face: 'e', w: 2.2, h: 0.5, lines: ['← 検体保管区画'], style: 'stencil' },
    { type: 'sign', x: 13.95, y: 3.0, z: -18.5, face: 'w', w: 2.0, h: 0.5, lines: ['配管区画 →'], style: 'stencil' },
    { type: 'sign', x: 0, y: 2.9, z: -33.6, face: 's', w: 1.8, h: 0.4, lines: ['中央足場'], style: 'stencil' },
    { type: 'panel', x: -13.95, z: -30, face: 'e', w: 1.6 },
    { type: 'gauge', x: 13.95, z: -14, y: 2.0, face: 'w' }, { type: 'gauge', x: 13.95, z: -15.2, y: 2.0, face: 'w' },
    { type: 'puddle', x: -2, z: -14, r: 1.3 },
    // --- 監視室（窓の向こう）・検体記録室（ダクトの先） ---
    { type: 'desk', x: -9.5, z: -8.4, w: 2.4, d: 0.8, face: 'n', crt: '監視 4-01', phone: true, papers: true, solid: false },
    { type: 'shelf', x: 13.4, z: -4, w: 3.0, d: 0.6, h: 2.2, face: 'w', solid: false },
    { type: 'desk', x: 9.5, z: -1.6, w: 2.0, d: 0.7, face: 'n', crt: '検体記録 1983', papers: true, solid: false },
    { type: 'sign', x: 7.05, y: 2.0, z: -4, face: 'e', w: 1.6, h: 1.0, lines: ['検体記録', '第一号〜第二九四号', '処理済'], style: 'notice' },
    // --- 検体保管区画（M1） ---
    { type: 'sign', x: -21, y: 2.0, z: -20.05, face: 'n', w: 1.4, h: 0.5, lines: ['区画 4-03'], style: 'stencil' },
    { type: 'sign', x: -31.95, y: 2.2, z: -38, face: 'e', w: 1.6, h: 0.5, lines: ['検体保管庫'], style: 'stencil' },
    { type: 'sign', x: -36.5, y: 3.6, z: -61.95, face: 's', w: 3.8, h: 0.6, lines: ['検体保管庫 ― 右腕'], style: 'plate' },
    { type: 'shelf', x: -44.4, z: -47, w: 5.0, d: 0.8, h: 2.4, face: 'e', solid: true },
    { type: 'shelf', x: -44.4, z: -55, w: 5.0, d: 0.8, h: 2.4, face: 'e', solid: true },
    { type: 'shelf', x: -36.5, z: -48.5, w: 6.0, d: 0.8, h: 2.4, face: 's', solid: true, jars: true },
    { type: 'shelf', x: -36.5, z: -54.5, w: 6.0, d: 0.8, h: 2.4, face: 'n', solid: true, jars: true },
    { type: 'shelf', x: -29, z: -58, w: 4.0, d: 0.8, h: 2.4, face: 'w', solid: true },
    { type: 'pedestal', x: -42, z: -59.6 },
    { type: 'sign', x: -42, y: 2.5, z: -61.95, face: 's', w: 1.6, h: 0.7, lines: ['右腕', 'R01'], style: 'big01' },
    { type: 'sign', x: -49.95, y: 2.0, z: -30, face: 'e', w: 1.4, h: 0.5, lines: ['区画 4-04'], style: 'stencil' },
    { type: 'mark', x: -36.4, y: 1.9, z: -16.05, face: 'n' },
    // --- 腕の廃棄庫（隠し部屋） ---
    { type: 'armpile', x: -39.5, z: -10.5, n: 60, r: 1.8 },
    { type: 'sign', x: -34.05, y: 2.1, z: -11, face: 'w', w: 1.4, h: 0.8, lines: ['不適合', '廃棄待ち'], style: 'notice' },
    // --- 配管区画（M2） ---
    { type: 'sign', x: 31, y: 3.6, z: -29.95, face: 's', w: 3.0, h: 0.5, lines: ['配管分岐室'], style: 'plate' },
    { type: 'tank', x: 27.5, z: -13, r: 1.0, h: 3.6 }, { type: 'tank', x: 34.5, z: -13, r: 1.0, h: 3.6 },
    { type: 'machine', x: 27, z: -26, w: 2.4, d: 1.0, h: 1.6, style: 'cabinet' },
    { type: 'sign', x: 36.95, y: 2.6, z: -20, face: 'w', w: 1.6, h: 0.4, lines: ['A エアロック →'], style: 'stencil' },
    { type: 'sign', x: 31, y: 2.6, z: -29.6, face: 's', w: 1.6, h: 0.4, lines: ['↑ B 動力 / C 隔壁'], style: 'stencil' },
    { type: 'machine', x: 57, z: -14, w: 4.0, d: 2.0, h: 2.6, style: 'pump', label: '圧縮空気' },
    { type: 'sign', x: 62.95, y: 2.9, z: -19, face: 'w', w: 1.8, h: 0.4, lines: ['A 圧縮空気系統'], style: 'plate' },
    { type: 'sign', x: 57, y: 3.0, z: -8.05, face: 'n', w: 2.0, h: 0.4, lines: ['エアロック'], style: 'plate' },
    { type: 'sign', x: 30, y: 2.0, z: 4.05, face: 's', w: 1.6, h: 0.5, lines: ['区画 4-02'], style: 'stencil' },
    { type: 'sign', x: 39.95, y: 2.9, z: -55, face: 'w', w: 1.8, h: 0.4, lines: ['B 搬送動力系統'], style: 'plate' },
    { type: 'machine', x: 35, z: -49, w: 3.6, d: 1.6, h: 2.2, style: 'cabinet' },
    { type: 'sign', x: 22.05, y: 3.8, z: -54, face: 'e', w: 2.0, h: 0.4, lines: ['主搬送棟 監視窓'], style: 'plate' },
    { type: 'sign', x: 43.95, y: 2.9, z: -72, face: 'w', w: 1.8, h: 0.4, lines: ['C 隔壁制御系統'], style: 'plate' },
    { type: 'pillar', x: 29, z: -69, w: 1.2, d: 1.2 }, { type: 'pillar', x: 37, z: -69, w: 1.2, d: 1.2 },
    { type: 'pillar', x: 29, z: -75, w: 1.2, d: 1.2 }, { type: 'pillar', x: 37, z: -75, w: 1.2, d: 1.2 },
    { type: 'lowwall', x: 33, z: -72, w: 3.0, d: 0.8, h: 1.0 },
    { type: 'crate', x: 25, z: -66.5, w: 1.4, d: 1.4, h: 1.2 },
    { type: 'hatch', x: 33, z: -78.9, face: 's' }, { type: 'hatch', x: 22.1, z: -66.5, face: 'e' },
    // --- 主搬送棟の足場 ---
    { type: 'sign', x: 0, y: 3.6, z: -79.95, face: 's', w: 3.0, h: 0.5, lines: ['検体搬送室'], style: 'plate' },
    // --- 検体搬送室（M3） ---
    { type: 'sign', x: -5.95, y: 4.4, z: -95, face: 'e', w: 3.4, h: 0.6, lines: ['搬送ライン 第四系統'], style: 'plate' },
    { type: 'sign', x: 18, y: 3.8, z: -109.95, face: 's', w: 2.6, h: 0.5, lines: ['仕分け・搬出'], style: 'plate' },
    { type: 'sign', x: 1.5, y: 2.2, z: -107.9, face: 's', w: 1.4, h: 0.8, lines: ['危険', '粉砕機'], style: 'warn' },
    // --- 人体組立区画（M4） ---
    { type: 'sign', x: 42, y: 3.8, z: -109.95, face: 's', w: 4.0, h: 0.6, lines: ['人体組立区画'], style: 'plate' },
    { type: 'frame', x: 44, z: -108.2, face: 's' },
    { type: 'board', x: 48.4, y: 1.9, z: -109.95, face: 's', title: '組立指示書　第二七号',
      rows: [['胴体', '検体12'], ['右腕', '右腕01（保管中）'], ['左腕', '通常腕 03']],
      notes: ['※ 左腕は部品保管庫から', '※ 胴体は最後に据えること'] },
    { type: 'terminal', x: 32.4, z: -100, face: 'e', id: 'reg', lines: ['検体登録', '検体12'] },
    { type: 'lift', x: 35, z: -92, face: 's' },
    { type: 'sign', x: 31.05, y: 2.6, z: -92, face: 'e', w: 1.6, h: 0.4, lines: ['検体リフト'], style: 'plate' },
    { type: 'gurney', x: 48, z: -94, rot: 1.3 },
    { type: 'sign', x: 52.95, y: 2.2, z: -98, face: 'w', w: 1.8, h: 0.5, lines: ['部品保管庫 →'], style: 'stencil' },
    { type: 'mark', x: 52.95, y: 1.9, z: -93.2, face: 'w' },
    { type: 'shelf', x: 70.4, z: -93, w: 5.0, d: 0.8, h: 2.2, face: 'w', solid: true },
    { type: 'shelf', x: 70.4, z: -101, w: 5.0, d: 0.8, h: 2.2, face: 'w', solid: true },
    { type: 'shelf', x: 65, z: -107.4, w: 5.0, d: 0.8, h: 2.2, face: 's', solid: true },
    { type: 'sign', x: 65, y: 2.9, z: -107.95, face: 's', w: 2.4, h: 0.4, lines: ['左腕 部品'], style: 'plate' },
    // --- 大型試験場（M5） ---
    { type: 'sign', x: 34, y: 2.2, z: -112, face: 'w', w: 1.6, h: 0.5, lines: ['試験場'], style: 'stencil' },
    { type: 'machine', x: 13, z: -133, w: 8.0, d: 8.0, h: 4.2, style: 'pump', label: '運動負荷装置' },
    { type: 'pillar', x: 0, z: -122, w: 1.6, d: 1.6 }, { type: 'pillar', x: 26, z: -122, w: 1.6, d: 1.6 },
    { type: 'pillar', x: 0, z: -144, w: 1.6, d: 1.6 }, { type: 'pillar', x: 26, z: -144, w: 1.6, d: 1.6 },
    { type: 'lowwall', x: 13, z: -121, w: 4.0, d: 0.8, h: 1.1 }, { type: 'lowwall', x: 13, z: -145, w: 4.0, d: 0.8, h: 1.1 },
    { type: 'lowwall', x: -4, z: -133, w: 0.8, d: 4.0, h: 1.1 }, { type: 'lowwall', x: 30, z: -133, w: 0.8, d: 4.0, h: 1.1 },
    { type: 'crate', x: -6.5, z: -118, w: 1.6, d: 1.6, h: 1.4 }, { type: 'crate', x: 32.5, z: -149, w: 1.6, d: 1.6, h: 1.4 },
    { type: 'shelf', x: -9.4, z: -142, w: 3.6, d: 0.6, h: 2.0, face: 'e', solid: false },
    { type: 'sign', x: -9.95, y: 2.6, z: -142, face: 'e', w: 1.8, h: 0.4, lines: ['予備部品'], style: 'plate' },
    { type: 'hatch', x: 2, z: -151.9, face: 's' }, { type: 'hatch', x: 24, z: -151.9, face: 's' },
    { type: 'hatch', x: -9.9, z: -118, face: 'e' }, { type: 'hatch', x: 35.9, z: -133, face: 'w' },
    { type: 'mark', x: 35.95, y: 1.9, z: -121.4, face: 'w' }, { type: 'mark', x: 35.95, y: 1.9, z: -144.8, face: 'w' },
    { type: 'sign', x: 13, y: 7.4, z: -151.95, face: 's', w: 5.0, h: 0.5, lines: ['運動機能試験'], style: 'plate' },
    // --- 主搬送制御室（M6） ---
    { type: 'switch', x: -20.5, z: -82.4, face: 'n' },
    { type: 'sign', x: -20.5, y: 0.6, z: -82.69, face: 'n', w: 0.9, h: 0.2, lines: ['主搬送系統 起動'], style: 'plate' },
    { type: 'panel', x: -23.95, z: -84, face: 'e', w: 1.6 }, { type: 'panel', x: -23.95, z: -93, face: 'e', w: 1.6 },
    { type: 'gauge', x: -10, z: -95.95, y: 2.0, face: 's' }, { type: 'gauge', x: -11.2, z: -95.95, y: 2.0, face: 's' },
    { type: 'gauge', x: -12.4, z: -95.95, y: 2.0, face: 's' }, { type: 'gauge', x: -13.6, z: -95.95, y: 2.0, face: 's' },
    { type: 'desk', x: -20.5, z: -94.8, w: 2.4, d: 0.8, face: 's', crt: '主搬送 系統図', papers: true, phone: true },
    { type: 'sign', x: -23.95, y: 3.6, z: -88, face: 'e', w: 2.6, h: 0.5, lines: ['待機室 連絡扉'], style: 'plate' },
    { type: 'sign', x: -17.95, y: 2.0, z: -110, face: 'e', w: 1.4, h: 0.5, lines: ['区画 4-09'], style: 'stencil' },
  ],
  researchers: [
    { x: -10.5, z: -6.0, face: 'n', look: true }, { x: -8.0, z: -5.2, face: 'n', look: true, pose: 'clip' },
    { x: -9.5, z: -89, face: 'e', look: true }, { x: -21.5, z: -83.4, face: 's', look: true, pose: 'clip' },
    { x: 6, z: -156, face: 's', look: true, y: 3.5 }, { x: 13, z: -156.5, face: 's', look: true, y: 3.5, pose: 'clip' },
    { x: 20, z: -156, face: 's', look: true, y: 3.5 },
  ],

  corpses: [
    { x: -38, z: -46, rot: 0, arms: ['fist', 'fist'] },                       // 保管庫
    { x: -40.5, z: -11.5, rot: Math.PI / 2, arms: ['tentacle', 'gun'], resMax: 6, skill: 'heal' },   // 廃棄庫
    { x: 12.5, z: -5, rot: -Math.PI / 2, arms: ['fist', 'fist'], resMax: 5, skill: 'heal' },         // 記録室
    { x: 26.5, z: -20, rot: Math.PI / 2, arms: ['fist', 'fist'] },          // 配管分岐室（バルブ用）
    { x: 60.5, z: -26, rot: -Math.PI / 2, arms: ['fist', 'fist'] },         // エアロック
    { x: 25, z: -59, rot: Math.PI / 2, arms: ['fist', 'fist'] },            // 動力室
    { x: 41.5, z: -77.5, rot: -Math.PI * 0.75, arms: ['fist', 'gun'] },     // 隔壁制御室
    { x: 49.5, z: -90, rot: Math.PI, arms: ['fist', 'fist'] },              // 組立区画の予備
    { x: -7.5, z: -149.5, rot: Math.PI * 0.25, arms: ['fist', 'gun'] },     // 試験場の隅
    { x: 33.5, z: -116.5, rot: -Math.PI * 0.75, arms: ['tentacle', 'fist'] },
    { x: -7.5, z: -116.5, rot: Math.PI * 0.75, arms: ['fist', 'fist'] },
    { x: 33.8, z: -146.9, rot: -Math.PI / 2, arms: ['gun', 'fist'] },       // 通風路の出口（頭で逃げた先）
    { x: 33.8, z: -119.7, rot: -Math.PI / 2, arms: ['fist', 'fist'] },
  ],
  arms: [
    // 保管庫のほかの番号（違う番号は検査装置が受け付けない）
    { x: -43.6, z: -46, y: 1.0, kind: 'fist', tag: 'R02', side: 'RIGHT' },
    { x: -43.6, z: -48.4, y: 1.0, kind: 'fist', tag: 'R04', side: 'RIGHT' },
    { x: -43.6, z: -54, y: 1.0, kind: 'fist', tag: 'L01', side: 'LEFT' },
    { x: -35, z: -49.2, y: 1.0, kind: 'fist', tag: 'R05', side: 'RIGHT' },
    { x: -38, z: -11, kind: 'gun' }, { x: -36.5, z: -9.5, kind: 'fist' },  // 廃棄庫
    { x: 40, z: -66, kind: 'gun' }, { x: 41.4, z: -66, kind: 'fist' },    // 隔壁制御室
    // 部品保管庫（左腕）
    { x: 69.6, z: -91.8, y: 1.0, kind: 'fist', tag: 'L01', side: 'LEFT' },
    { x: 69.6, z: -94.2, y: 1.0, kind: 'fist', tag: 'L02', side: 'LEFT' },
    { x: 69.6, z: -101, y: 1.0, kind: 'fist', tag: 'L04', side: 'LEFT' },
    // 試験場の予備部品
    { x: -8.8, z: -140.8, kind: 'fist' }, { x: -8.8, z: -142.2, kind: 'gun' }, { x: -8.8, z: -143.6, kind: 'fist' },
  ],
  taggedArms: [
    { tag: 'R01', label: '右腕01', kind: 'fist', side: 'RIGHT', at: { x: -42, z: -59.6, y: 1.15 }, takenFlag: 'R01taken' },
    { tag: 'L03', label: '左腕03', kind: 'fist', side: 'LEFT', at: { x: 63.5, z: -107.0, y: 1.0 } },
  ],

  encounters: [
    { id: 'w1', zone: [-29, -13, -24, -20], spawns: [[-22, -22.6, 'fist', 'fist', 0], [-26, -21.4, 'fist', 'gun', 0.3]] },
    { id: 'w2', zone: [-32, -28, -44, -19], spawns: [[-30, -40, 'fist', 'fist', 0]] },
    { id: 'sr', zone: [-46, -27, -62, -43], cond: 'flag:R01taken',
      spawns: [[-30, -45.5, 'fist', 'fist', 0.6], [-40.5, -44.2, 'fist', 'fist', 1.2], [-29, -61, 'gun', 'fist', 2.0]] },
    { id: 'w5', zone: [-47, -31, -20, -16], spawns: [[-42, -18, 'fist', 'fist', 0]] },
    { id: 'jx', zone: [25, 37, -30, -10], cond: 'current:M2', spawns: [[31, -12.5, 'fist', 'fist', 0], [35, -16, 'fist', 'gun', 0.4]] },
    { id: 'a3', zone: [4, 60, 4, 8], cond: 'flag:valveA', spawns: [[30, 6, 'fist', 'fist', 0], [22, 5.4, 'gun', 'fist', 0.5]] },
    { id: 'vb', zone: [22, 40, -62, -45], spawns: [[27, -50, 'fist', 'fist', 0]] },
    { id: 'vcAr', type: 'arena', zone: [22, 44, -79, -64], trigger: [22.5, 43.5, -78.5, -64.5], cond: 'flag:valveC',
      doors: ['dB2', 'dBulk'], startLine: '隔壁開放。区画内の対象を排除してください。',
      waves: [
        [[24, -72, 'fist', 'fist', 0.4], [24.2, -69, 'fist', 'fist', 0.9]],
        [[33, -78, 'fist', 'gun', 0], [24, -76, 'fist', 'fist', 0.5], [42.5, -66, 'fist', 'fist', 1.0]],
        [[24, -72, 'fist', 'fist', 0, { strong: true }], [33, -78, 'gun', 'fist', 0.7], [42.5, -78, 'fist', 'fist', 1.3]],
      ] },
    { id: 'ps', zone: [59, 71, -108, -88], spawns: [[64, -96, 'fist', 'fist', 0], [66, -104, 'fist', 'gun', 0.4]] },
    { id: 'trial', type: 'arena', zone: [-10, 36, -152, -114], trigger: [-7.5, 33.5, -149.5, -116.5],
      doors: ['arS', 'arW'], startLine: '運動機能試験を開始します。投入される対象をすべて排除してください。',
      waves: [
        [[2, -150.4, 'fist', 'fist', 0], [24, -150.4, 'fist', 'fist', 0.8], [13, -150.4, 'fist', 'fist', 1.6]],
        [[-8.4, -118, 'fist', 'gun', 0], [34.4, -133, 'fist', 'fist', 0.4], [2, -150.4, 'fist', 'fist', 0.9], [24, -150.4, 'gun', 'fist', 1.5]],
        [[13, -150.4, 'fist', 'fist', 0, { strong: true }], [-8.4, -118, 'fist', 'fist', 0.5], [34.4, -133, 'fist', 'gun', 1.0],
         [-8.4, -146, 'gun', 'fist', 1.6], [24, -150.4, 'fist', 'fist', 2.2]],
      ] },
  ],

  valves: [
    { id: 'A', x: 62.55, y: 1.35, z: -19, face: 'w', color: 0xd0412f, lamp: [-1, 3.25, -79.94], opens: ['dAir'], flag: 'valveA',
      line: '圧縮空気系統、供給開始。エアロックを開放します。',
      pipe: [[-1, 3.45, -79.9], [-1, 4.1, -79.9], [2.6, 4.1, -79.9], [2.6, 1.6, -79.6], [2.6, 1.6, -33.4], [2.6, 3.4, -33.4],
             [13.6, 3.4, -33.4], [13.6, 2.4, -33.4], [13.6, 2.4, -23.65], [36.6, 2.4, -23.65], [36.6, 2.4, -21.65],
             [62.6, 2.4, -21.65], [62.6, 2.4, -19], [62.6, 1.75, -19]] },
    { id: 'B', x: 39.55, y: 1.35, z: -55, face: 'w', color: 0xe0b020, lamp: [0, 3.25, -79.94], opens: ['dB2'], flag: 'beltB',
      line: '搬送動力系統、復旧。第四系統の一部が稼働します。',
      pipe: [[0, 3.45, -79.9], [0, 3.9, -79.9], [2.75, 3.9, -79.9], [2.75, 1.45, -79.6], [2.75, 1.45, -33.55], [2.75, 3.2, -33.55],
             [13.45, 3.2, -33.55], [13.45, 2.2, -33.55], [13.45, 2.2, -23.5], [32.65, 2.2, -23.5], [32.65, 2.2, -45.6],
             [39.6, 2.2, -45.6], [39.6, 2.2, -55], [39.6, 1.75, -55]] },
    { id: 'C', x: 43.55, y: 1.35, z: -72, face: 'w', color: 0x3b78e0, lamp: [1, 3.25, -79.94], opens: ['dBulk'], flag: 'valveC',
      line: '隔壁制御系統、作動。',
      pipe: [[1, 3.45, -79.9], [1, 3.7, -79.9], [2.9, 3.7, -79.9], [2.9, 1.3, -79.6], [2.9, 1.3, -33.7], [2.9, 3.0, -33.7],
             [13.3, 3.0, -33.7], [13.3, 2.0, -33.7], [13.3, 2.0, -23.35], [32.45, 2.0, -23.35], [32.45, 2.0, -64.6],
             [43.6, 2.0, -64.6], [43.6, 2.0, -72], [43.6, 1.75, -72]] },
  ],
  lockDoor: 'dCore',
  lockName: '搬送区画',

  // M1：右腕01（粉砕せず検査装置に保管して、M4 で使う）
  armCheck: {
    tag: 'R01', label: '右腕01', side: 'RIGHT', kind: 'fist', mode: 'store',
    device: '検査装置', prompt: '右腕を搬入する', door: 'dE',
    idleCrt: ['適合検査', '指定 右腕01'], okCrt: ['適合', '右腕01 保管'],
    crusher: { x: 11.8, z: -29.5, face: 'w', crt: [13.0, 3.6, -27.0], r: 2.4 },
  },

  // M3：検体12（搬送ライン3本目。仕分け機で搬出台に下ろされる）
  specimen: {
    tag: '12', lane: 2, arms: ['fist', 'fist'], respawn: 4,
    unloadAt: [19.5, -106.2], unloadYaw: -Math.PI / 2,
    register: { x: 33.6, z: -100, r: 2.4 },
    supply: { x: 35, z: -92, rot: Math.PI },
    releaseLine: '検体12、搬出を確認。組立区画の登録装置へ移送してください。',
  },
  conveyor: {
    room: 'tr', beltY: 0.9, half: 0.9, z0: -109, z1: -82, killMargin: 1.6, numbered: true,
    lanes: [
      { x: 6.1, dir: -1, speed: 1.4, gap: 7.5 },
      { x: 9.9, dir: 1, speed: 1.6, gap: 8.0 },
      { x: 13.7, dir: -1, speed: 1.3, gap: 6.5, sort: true },
    ],
  },

  // M4：組立（左腕03・保管した右腕01・検体12の胴体）
  assemble: {
    x: 44, z: -108.2, face: 's', lamps: true, door: 'dArena',
    need: { LEFT: { kind: 'fist', tag: 'L03' }, RIGHT: { from: 'R01' }, torso: { bodyTag: '12' } },
    text: '指示書のとおりに検体を完成させる',
    torsoLine: '胴体を固定しました。頭部を接着してください。',
  },

  decoBelts: [
    { r: [24, 38, -60, -58.4], y: 0.8, dir: -1, speed: 1.2, cond: 'flag:beltB', cargo: 'arms' },   // 動力室の小型コンベア
  ],

  // M6：主搬送棟（ライン：z は奥行き、y は階。group の小さい順＝制御室に近い順に点く）
  mega: {
    hall: 'big', fogFar: 120, fogNear: 10, partialCond: 'flag:beltB', partialLines: [8, 12], prompt: '主搬送系統を起動する',
    lines: [
      { z: -77, y: -1.6, kind: 'corpse', dir: 1, group: 0 },
      { z: -76, y: -5.2, kind: 'torso', dir: -1, group: 0 },
      { z: -74.5, y: 4.6, kind: 'rarm', dir: 1, group: 4, speed: 1.8 },
      { z: -70, y: -8.6, kind: 'leg', dir: -1, group: 5 },
      { z: -66, y: -1.6, kind: 'larm', dir: -1, group: 1, speed: 1.7 },
      { z: -63, y: -5.2, kind: 'head', dir: 1, group: 1, gap: 1.6 },
      { z: -60, y: 4.6, kind: 'corpse', dir: -1, group: 4 },
      { z: -57, y: -8.6, kind: 'torso', dir: 1, group: 5 },
      { z: -54, y: -1.6, kind: 'rarm', dir: 1, group: 2, speed: 1.7 },
      { z: -51, y: -5.2, kind: 'corpse', dir: -1, group: 2 },
      { z: -48, y: 4.6, kind: 'leg', dir: 1, group: 4 },
      { z: -45, y: -8.6, kind: 'head', dir: -1, group: 5, gap: 1.6 },
      { z: -40, y: -1.6, kind: 'corpse', dir: 1, group: 3 },
      { z: -38, y: -5.2, kind: 'larm', dir: -1, group: 3, speed: 1.6 },
      { z: -42, y: 4.6, kind: 'torso', dir: -1, group: 4 },
      { z: -66.5, y: -8.6, kind: 'corpse', dir: 1, group: 5 },
    ],
  },

  goal: { door: 'goal', x: -23, z: -88, r: 2.6 },

  missions: [
    { id: 'M1', type: 'armCheck',
      brief: '指定番号の右腕を回収し、検査装置へ搬入してください。指定番号は右腕01。保管区画は西側です。',
      doneLine: '右腕01、適合を確認。組立工程まで保管します。' },
    { id: 'M2', type: 'valves',
      brief: '搬送設備の供給圧力が不足しています。3か所の調整弁を開放してください。',
      doneLine: '供給圧力、規定値に到達。搬送区画の扉を開放します。' },
    { id: 'M3', type: 'specimen',
      brief: '搬送ライン上の検体番号12を回収し、組立区画まで移送してください。',
      doneLine: '検体12、登録を確認しました。' },
    { id: 'M4', type: 'assemble',
      brief: '適合試験を実施します。指定された部位を装着し、検体を完成させてください。',
      doneLine: '接合状態を確認しました。続いて運動機能試験を実施します。' },
    { id: 'M5', type: 'arena', enc: 'trial', text: '大型試験場で、投入される対象をすべて排除する',
      brief: '試験場へ移動してください。',
      doneLine: '試験終了。運動性能を確認しました。' },
    { id: 'M6', type: 'mega',
      brief: '全工程の試験が完了しました。最後に主搬送系統を起動してください。',
      doneLine: '主搬送系統、正常稼働を確認。試験を終了します。' },
  ],
  checkpoints: [
    { after: null, x: 0, z: 7, yaw: 0, arms: ['fist', 'gun'] },
    { after: 'M1', x: 8, z: -22, yaw: -Math.PI / 2, arms: ['fist', 'fist'] },
    { after: 'M2', x: -2, z: -84, yaw: -Math.PI / 2, arms: ['fist', 'fist'] },
    { after: 'M3', x: 35, z: -98, yaw: 0, arms: ['fist', 'fist'], bodyTag: '12' },
    { after: 'M4', x: 34, z: -106, yaw: 0, bodyTag: '12',
      arms: [{ kind: 'fist', tag: 'L03', side: 'LEFT' }, { kind: 'fist', tag: 'R01', side: 'RIGHT' }] },
    { after: 'M5', x: -14, z: -126, yaw: Math.PI / 2, arms: ['fist', 'gun'] },
    { after: 'M6', x: -15.5, z: -84, yaw: Math.PI, arms: ['fist', 'gun'] },
  ],
};
