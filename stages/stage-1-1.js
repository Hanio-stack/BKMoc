'use strict';
/* =========================================================
   DEMO STAGE 1-1「第三検体処理区画」のレベルデータ

   ここには「どこに何があるか」だけを書く。動き（バルブ・扉・搬送ライン…）は stage.js。
   将来、外部のマップ作成ツールから書き出したデータをこの形に変換して読み込む想定なので、
   値は数値・文字列・配列・素のオブジェクトだけにしてある（関数は書かない）。

   座標
     メートル単位。origin を原点にしたローカル座標（x=東 / z=南。北は -z）。
     既存のモックと同じく yaw 0 が北（-z）を向く。高さ y は床が 0。
     矩形 r は [x0, x1, z0, z1]。

   spaces（空間）
     type: room（部屋・平天井）/ corridor（通路・かまぼこ天井）/ duct（頭だけが通れる）/
           doorway（壁と壁のあいだの短い戸口）/ view（入れない部屋。窓の向こうや吹き抜け）
     つながる空間どうしは 1m 重ねる。重なった辺は壁が抜けて出入り口になる。
     つながらない空間どうしは 0.6m 以上離す（そのあいだが壁の厚み）。
     walk: false にすると見た目だけの空間になる（歩ける範囲は walks で別に足す）。
   walks: 歩ける範囲を空間とは別に足す（プラットフォーム、ベルト）。head:true は頭だけ。
   windows: 壁に開ける窓。axis:'x' は x=at の壁、'z' は z=at の壁。from-to はその壁に沿った範囲。
   doors: 扉。開いていないあいだは r が通れなくなる。
   gas: 血液凝固ガスの範囲（頭モードの出血が止まる）。
   props: 置き物。solid の物は通れない（敵も避ける）。face は正面の向き n/s/e/w。
   encounters: 戦闘。zone に入る（cond があればそれも満たす）と spawns が湧く。
               type:'arena' は doors を閉じてウェーブ戦をする。
   missions: 順番に達成する主目標。checkpoints は死んだときに戻る位置と体（腕）。
   ========================================================= */
(window.BK_STAGES = window.BK_STAGES || {})['1-1'] = {
  id: '1-1',
  label: 'DEMO STAGE 1-1',
  title: '第三検体処理区画',
  kind: 'stage',
  selectable: true,
  origin: [400, 0, 0],
  fog: { color: 0x06080a, near: 3, far: 30 },
  ambient: { hemi: 0.42, dir: 0.12 },

  /* ---------- 空間 ---------- */
  spaces: [
    // 入口
    { id: 'entry', type: 'room', r: [-5, 5, -4, 6], h: 4.0, tone: 'cold', name: '昇降機前室' },
    { id: 'c01', type: 'corridor', r: [-2, 2, -24, -3], tone: 'cold', name: '第三区画 第一通路' },
    { id: 'c02', type: 'corridor', r: [-2, 16, -27, -23], tone: 'cold' },
    { id: 'c03', type: 'corridor', r: [12, 16, -38, -26], tone: 'cold' },
    // 中央：第一閘門（ミッションA）
    { id: 'hall', type: 'room', r: [6, 26, -54, -37], h: 5.5, tone: 'cold', name: '第一閘門' },
    // 西：第一制御室（バルブA）
    { id: 'w1', type: 'corridor', r: [-10, 7, -48, -44], tone: 'cold' },
    { id: 'crA', type: 'room', r: [-20, -9, -60, -38], h: 4.2, tone: 'warm', name: '第一制御室' },
    { id: 'hr1', type: 'room', r: [-8.4, -2, -60, -53], h: 3.0, tone: 'amber', name: '検体補助保管' },
    { id: 'du1', type: 'duct', r: [-5.7, -4.3, -54, -47] },
    { id: 'hr1door', type: 'doorway', r: [-10, -7.4, -59.5, -57.5] },
    { id: 'mA', type: 'corridor', r: [-18, -16, -39, -32], tone: 'red', name: '保守通路' },
    { id: 'mA2', type: 'corridor', r: [-18, 13, -34, -32], tone: 'red' },
    // 東：旧弾薬庫（アリーナ1・バルブB）
    { id: 'e1', type: 'corridor', r: [25, 35, -48, -44], tone: 'red' },
    { id: 'ar1', type: 'room', r: [34, 58, -62, -36], h: 6.0, tone: 'warm', name: '旧弾薬庫' },
    // 南東：第二処理設備室（バルブC）
    { id: 's1', type: 'corridor', r: [20, 24, -38, -29], tone: 'cold' },
    { id: 'pc', type: 'room', r: [18, 46, -30, -14], h: 5.0, tone: 'green', name: '第二処理設備室' },
    { id: 's2', type: 'corridor', r: [38, 42, -37, -29], tone: 'red' },
    { id: 'obs2', type: 'room', r: [24.6, 37.4, -35.4, -30.6], h: 3.0, tone: 'cold', name: '観察室 弐' },
    { id: 'du2', type: 'duct', r: [23, 25.6, -34.2, -32.8] },
    { id: 'obs2door', type: 'doorway', r: [36.4, 39, -34, -32] },
    // 北：検体照合室（ミッションB）
    { id: 'n1', type: 'corridor', r: [14, 18, -68, -53], tone: 'cold' },
    { id: 'bh', type: 'room', r: [4, 28, -82, -67], h: 5.0, tone: 'cold', name: '検体照合室' },
    { id: 'sr', type: 'room', r: [12, 26, -96, -82.8], h: 4.0, tone: 'amber', name: '検体保管室' },
    { id: 'srdoor', type: 'doorway', r: [23, 25, -83.8, -81] },
    { id: 'se1', type: 'corridor', r: [27, 40, -72, -68], tone: 'red' },
    { id: 'se2', type: 'corridor', r: [36, 40, -95, -71], tone: 'cold' },
    { id: 'se3', type: 'corridor', r: [25, 40, -95, -91], tone: 'cold' },
    { id: 'sp1', type: 'corridor', r: [39, 43, -84, -81], tone: 'warm' },
    { id: 'st1', type: 'room', r: [42, 48, -88, -78], h: 3.5, tone: 'warm', name: '資材庫' },
    { id: 'hr2', type: 'room', r: [29, 35, -89.4, -82], h: 3.0, tone: 'amber', name: '検体補助保管' },
    { id: 'du3', type: 'duct', r: [31.3, 32.7, -83, -71] },
    { id: 'hr2door', type: 'doorway', r: [34, 37, -84.5, -82.5] },
    // 西：搬送ライン室（ミッションC）
    { id: 'nw', type: 'corridor', r: [-8, 5, -78, -74], tone: 'cold' },
    { id: 'cv', type: 'room', r: [-40, -7, -98, -61], h: 8.0, tone: 'red', walk: false, name: '搬送ライン室',
      floorY: -1.6 },
    // 検体処理ホール（アリーナ2）
    { id: 'wa2', type: 'corridor', r: [-50, -39, -80, -76], tone: 'red' },
    { id: 'ar2', type: 'room', r: [-76, -49, -96, -62], h: 6.0, tone: 'warm', name: '検体処理ホール' },
    { id: 'nd', type: 'corridor', r: [-64, -60, -107, -95], tone: 'cold' },
    // 検体再構成室（ミッションD）
    { id: 'as', type: 'room', r: [-74, -50, -122, -106], h: 5.0, tone: 'cold', name: '検体再構成室' },
    { id: 'g1', type: 'corridor', r: [-64, -60, -136, -121], tone: 'cold' },
    // 第三観覧回廊（終盤の演出とゴール）
    { id: 'fg', type: 'room', r: [-78, -46, -148, -135], h: 4.5, tone: 'dim', name: '第三観覧回廊' },
    // 窓の向こう（入れない）
    { id: 'big', type: 'view', r: [-100, -24, -200, -149], h: 14, tone: 'dark', lights: false },
    { id: 'obs1', type: 'view', r: [2.6, 8, -16, -8], h: 3.0, tone: 'cold' },
    { id: 'obs3', type: 'view', r: [7.4, 13.4, -66, -56], h: 3.0, tone: 'cold' },
    { id: 'obs4', type: 'view', r: [-32, -21, -60.4, -55], h: 3.0, tone: 'cold', floorY: 2.2 },
    { id: 'obs5', type: 'view', r: [-49.4, -43, -120, -108], h: 3.0, tone: 'cold' },
  ],

  // 空間とは別に足す歩ける範囲（搬送ライン室の足場とベルト）
  walks: [
    { id: 'spA', r: [-14, -7, -90, -66] },                          // 東の足場（入ってきた側）
    { id: 'spB', r: [-40, -31.3, -90, -66] },                       // 西の足場（渡った先）
  ],

  /* ---------- 窓 ---------- */
  windows: [
    { axis: 'x', at: 2, from: -14, to: -10, y0: 1.0, y1: 2.3, style: 'glass' },       // 第一通路 → 観察室壱
    { axis: 'x', at: 2.6, from: -14, to: -10, y0: 1.0, y1: 2.3, style: 'glass' },
    { axis: 'x', at: -9, from: -56, to: -54, y0: 0.5, y1: 2.2, style: 'grille' },    // 制御室 → 隠し部屋1
    { axis: 'x', at: -8.4, from: -56, to: -54, y0: 0.5, y1: 2.2, style: 'grille' },
    { axis: 'z', at: -30, from: 27, to: 35, y0: 1.1, y1: 2.6, style: 'glass' },      // 処理設備室 → 観察室弐
    { axis: 'z', at: -30.6, from: 27, to: 35, y0: 1.1, y1: 2.6, style: 'glass' },
    { axis: 'x', at: 14, from: -63, to: -58, y0: 1.0, y1: 2.3, style: 'glass' },      // 北通路 → 観察室参
    { axis: 'x', at: 13.4, from: -63, to: -58, y0: 1.0, y1: 2.3, style: 'glass' },
    { axis: 'z', at: -82, from: 16, to: 22, y0: 0.9, y1: 2.5, style: 'glass' },       // 照合室 → 保管室（指定の腕が見える）
    { axis: 'z', at: -82.8, from: 16, to: 22, y0: 0.9, y1: 2.5, style: 'glass' },
    { axis: 'x', at: 36, from: -88, to: -85.5, y0: 0.5, y1: 2.2, style: 'grille' },  // 通路 → 隠し部屋2
    { axis: 'x', at: 35, from: -88, to: -85.5, y0: 0.5, y1: 2.2, style: 'grille' },
    { axis: 'z', at: -61, from: -30, to: -23, y0: 2.6, y1: 4.6, style: 'glass' },     // 搬送ライン室 ← 監視室（高窓）
    { axis: 'z', at: -60.4, from: -30, to: -23, y0: 2.6, y1: 4.6, style: 'glass' },
    { axis: 'x', at: -50, from: -118, to: -110, y0: 1.0, y1: 2.6, style: 'glass' },   // 再構成室 → 観察室伍
    { axis: 'x', at: -49.4, from: -118, to: -110, y0: 1.0, y1: 2.6, style: 'glass' },
    { axis: 'z', at: -148, from: -74, to: -50, y0: 0.9, y1: 3.8, style: 'glass' },    // 観覧回廊 → 中央搬送棟
    { axis: 'z', at: -149, from: -74, to: -50, y0: 0.9, y1: 3.8, style: 'glass' },
  ],

  /* ---------- 扉 ---------- */
  // axis:'x' は z=at の壁に付いた扉（x の from-to に広がる）、'z' は x=at の壁。
  // r は閉まっているときに通れなくなる範囲（自動で作る。壁の前後 0.5m）
  // 予備腕の支給口（壁の箱。通常腕が足りなくなると、ここに足りない本数だけ出てくる）
  // x,z は壁の位置、face は部屋の内側の向き。アリーナの中にも置く（閉じ込められても立て直せる）
  armSupply: [
    { x: 6, z: -40, face: 'e', name: '第一閘門' },
    { x: -9, z: -42, face: 'w', name: '第一制御室' },
    { x: 55.5, z: -62, face: 's', name: '旧弾薬庫' },
    { x: 20, z: -14, face: 'n', name: '第二処理設備室' },
    { x: 26, z: -67, face: 'n', name: '検体照合室' },
    { x: -76, z: -70, face: 'e', name: '検体処理ホール' },
    { x: -74, z: -110, face: 'e', name: '検体再構成室' },
  ],

  doors: [
    { id: 'entryBack', axis: 'x', at: 6, from: -2, to: 2, h: 3.0, style: 'blast', decor: true },
    { id: 'dA', axis: 'x', at: -54, from: 14, to: 18, h: 2.6, style: 'blast', lamp: true },
    { id: 'dB', axis: 'z', at: 4, from: -78, to: -74, h: 2.6, style: 'blast', lamp: true },
    { id: 'dC', axis: 'z', at: -40, from: -80, to: -76, h: 2.6, style: 'blast', lamp: true },
    { id: 'dD', axis: 'x', at: -122, from: -64, to: -60, h: 2.6, style: 'blast', lamp: true },
    { id: 'ar1W', axis: 'z', at: 34, from: -48, to: -44, h: 2.6, style: 'shutter', open: true },
    { id: 'ar1S', axis: 'x', at: -36, from: 38, to: 42, h: 2.6, style: 'shutter', open: true },
    { id: 'ar2E', axis: 'z', at: -49, from: -80, to: -76, h: 2.6, style: 'shutter', open: true },
    { id: 'ar2N', axis: 'x', at: -96, from: -64, to: -60, h: 2.6, style: 'shutter', open: true },
    // 隠し部屋の点検扉。中に人間の体でいると内側から開く（閉じ込められない）
    { id: 'hr1d', axis: 'z', at: -9, from: -59.5, to: -57.5, h: 2.2, style: 'hatch', insideOpen: 'hr1' },
    { id: 'obs2d', axis: 'z', at: 38, from: -34, to: -32, h: 2.2, style: 'hatch', insideOpen: 'obs2' },
    { id: 'hr2d', axis: 'z', at: 36, from: -84.5, to: -82.5, h: 2.2, style: 'hatch', insideOpen: 'hr2' },
    // 照合室と保管室のあいだの近道。保管室での戦闘が終わると開く
    { id: 'srd', axis: 'x', at: -82, from: 23, to: 25, h: 2.4, style: 'hatch', lamp: true },
    // ゴール扉（共通）。全目標を達成すると操作できる
    { id: 'goal', axis: 'z', at: -78, from: -143, to: -139, h: 3.0, style: 'blast', lamp: true, decor: true },
  ],

  /* ---------- 血液凝固ガス ---------- */
  gas: [
    [-14, -7, -90, -66],          // 搬送ライン室 東の足場
    [-40, -31.3, -90, -66],       // 搬送ライン室 西の足場
    [31.3, 32.7, -83, -71],       // 長いダクトの中
    [-70, -54, -121.5, -111],     // 身体の台座のまわり
    [-8.4, -2, -60, -53],         // 隠し部屋1
    [29, 35, -89.4, -82],         // 隠し部屋2
  ],

  /* ---------- 照明（通路と部屋は自動で付く。ここは追加ぶん） ---------- */
  lights: [
    { x: 16, y: 3.2, z: -52.8, tone: 'red' },        // 閘門の扉
    { x: 34.8, y: 2.4, z: -46, tone: 'red' },        // 弾薬庫の入口
    { x: 6.4, y: 2.6, z: -71, tone: 'red' },         // 粉砕器
    { x: 19, y: 3.4, z: -92.5, tone: 'spot' },       // 指定の腕の台座
    { x: -17, y: 6.5, z: -95, tone: 'red' }, { x: -24.6, y: 6.5, z: -95, tone: 'red' },
    { x: -20.8, y: 6.5, z: -64, tone: 'red' }, { x: -28.4, y: 6.5, z: -64, tone: 'red' },
    { x: -62, y: 4.2, z: -117, tone: 'spot' },       // 身体の台座
    { x: -62, y: 3.0, z: -79, tone: 'fire' },        // 焼却炉
  ],

  /* ---------- 置き物 ---------- */
  props: [
    // --- 入口 ---
    { type: 'sign', x: 0, y: 3.2, z: -3.95, face: 's', w: 4.2, h: 0.62, lines: ['第三検体処理区画'], style: 'plate' },
    { type: 'sign', x: -4.95, y: 2.2, z: 1.0, face: 'e', w: 1.6, h: 0.9,
      lines: ['注意', '検体は回収後', '直ちに処理すること'], style: 'notice' },
    { type: 'locker', x: 4.5, z: 2.0, face: 'w', n: 3 },
    { type: 'bench', x: -3.4, z: 3.6, w: 2.4, d: 0.6, rot: Math.PI / 2 },
    { type: 'puddle', x: 1.2, z: -1.8, r: 1.2 },
    // --- 第一通路（観察室壱の窓） ---
    { type: 'sign', x: -1.95, y: 2.0, z: -8, face: 'e', w: 1.3, h: 0.5, lines: ['区画 3-01'], style: 'stencil' },
    { type: 'sign', x: 1.95, y: 2.45, z: -12, face: 'w', w: 1.6, h: 0.32, lines: ['観察室 壱'], style: 'plate' },
    { type: 'sign', x: -1.95, y: 1.6, z: -19, face: 'e', w: 1.2, h: 0.8, lines: ['危険', '高電圧'], style: 'warn' },
    { type: 'desk', x: 5.8, z: -12, w: 1.8, d: 0.8, face: 'w', crt: '監視 3-01', phone: true, papers: true, solid: false },
    { type: 'panel', x: 7.95, z: -10, face: 'w', w: 1.2 },
    { type: 'puddle', x: 0.3, z: -16, r: 0.9 },
    // --- 曲がり角の先 ---
    { type: 'sign', x: 6, y: 2.0, z: -26.95, face: 'n', w: 1.4, h: 0.5, lines: ['区画 3-02'], style: 'stencil' },
    { type: 'barrel', x: 3.0, z: -26.3 }, { type: 'barrel', x: 3.8, z: -26.4 },
    { type: 'sign', x: 15.95, y: 2.0, z: -30, face: 'w', w: 1.6, h: 0.5, lines: ['→ 第一閘門'], style: 'stencil' },
    // --- 第一閘門（中央） ---
    { type: 'sign', x: 16, y: 4.85, z: -53.9, face: 's', w: 4.4, h: 0.62, lines: ['第一閘門'], style: 'plate' },
    { type: 'machine', x: 16, z: -45.5, w: 4.0, d: 2.6, h: 2.2, style: 'console', label: '閘門制御盤' },
    { type: 'pillar', x: 10, z: -49, w: 1.1, d: 1.1 }, { type: 'pillar', x: 22, z: -49, w: 1.1, d: 1.1 },
    { type: 'pillar', x: 10, z: -41.5, w: 1.1, d: 1.1 }, { type: 'pillar', x: 22, z: -41.5, w: 1.1, d: 1.1 },
    { type: 'desk', x: 11.2, z: -52.9, w: 2.0, d: 0.8, face: 's', crt: 'VALVE', papers: true },
    { type: 'crate', x: 24.4, z: -40.0, w: 1.4, d: 1.4, h: 1.2 },
    { type: 'sign', x: 6.05, y: 3.2, z: -46, face: 'e', w: 1.8, h: 0.5, lines: ['A ← 第一制御室'], style: 'stencil' },
    { type: 'sign', x: 25.95, y: 3.2, z: -46, face: 'w', w: 1.8, h: 0.5, lines: ['旧弾薬庫 → B'], style: 'stencil' },
    { type: 'sign', x: 22, y: 3.2, z: -37.05, face: 'n', w: 2.0, h: 0.5, lines: ['C ↓ 処理設備室'], style: 'stencil' },
    { type: 'puddle', x: 14, z: -40, r: 1.4 },
    // --- 第一制御室（A） ---
    { type: 'desk', x: -14.5, z: -59.2, w: 3.2, d: 0.9, face: 's', crt: '第一系統', phone: true, papers: true },
    { type: 'panel', x: -19.95, z: -54, face: 'e', w: 1.6 }, { type: 'panel', x: -19.95, z: -45, face: 'e', w: 1.6 },
    { type: 'shelf', x: -10, z: -39.4, w: 2.0, d: 0.7, h: 2.0, face: 'n' },
    { type: 'machine', x: -15, z: -48.5, w: 2.4, d: 1.2, h: 1.6, style: 'cabinet' },
    { type: 'sign', x: -19.95, y: 2.9, z: -50, face: 'e', w: 1.6, h: 0.4, lines: ['A 系統 主弁'], style: 'plate' },
    { type: 'sign', x: -9.05, y: 2.6, z: -56.6, face: 'w', w: 1.4, h: 0.32, lines: ['点検口'], style: 'plate' },
    { type: 'mark', x: -9.05, y: 2.45, z: -55, face: 'w' },
    { type: 'mark', x: -5, y: 1.9, z: -47.95, face: 's' },
    // --- 隠し部屋1 ---
    { type: 'shelf', x: -3, z: -59.4, w: 1.8, d: 0.6, h: 1.8, face: 'n', solid: false },
    { type: 'sign', x: -2.05, y: 2.1, z: -56, face: 'w', w: 1.4, h: 0.8, lines: ['検体補助保管', '予備検体'], style: 'notice' },
    // --- 保守通路 ---
    { type: 'sign', x: -17.95, y: 1.9, z: -33, face: 'e', w: 1.0, h: 0.3, lines: ['保守通路'], style: 'plate' },
    // --- 旧弾薬庫（アリーナ1・B） ---
    { type: 'sign', x: 30, y: 2.2, z: -44.05, face: 'n', w: 1.6, h: 0.5, lines: ['旧弾薬庫'], style: 'stencil' },
    { type: 'pillar', x: 40, z: -42, w: 1.4, d: 1.4 }, { type: 'pillar', x: 52, z: -42, w: 1.4, d: 1.4 },
    { type: 'pillar', x: 40, z: -56, w: 1.4, d: 1.4 }, { type: 'pillar', x: 52, z: -56, w: 1.4, d: 1.4 },
    { type: 'machine', x: 46, z: -49, w: 5.0, d: 5.0, h: 3.2, style: 'pump', label: '揚水機' },
    { type: 'lowwall', x: 45, z: -40.6, w: 3.4, d: 0.8, h: 1.0 },
    { type: 'lowwall', x: 47, z: -57.6, w: 3.4, d: 0.8, h: 1.0 },
    { type: 'crate', x: 38.2, z: -49.5, w: 1.5, d: 1.5, h: 1.4 },
    { type: 'crate', x: 54.2, z: -49.5, w: 1.5, d: 1.5, h: 1.4 },
    { type: 'shelf', x: 34.7, z: -40.4, w: 3.6, d: 0.6, h: 2.0, face: 'e', solid: false },
    { type: 'sign', x: 34.05, y: 2.6, z: -40.4, face: 'e', w: 1.6, h: 0.4, lines: ['検体部品 支給'], style: 'plate' },
    { type: 'sign', x: 57.95, y: 2.9, z: -49, face: 'w', w: 1.6, h: 0.4, lines: ['B 系統 主弁'], style: 'plate' },
    { type: 'hatch', x: 46, z: -61.9, face: 's' }, { type: 'hatch', x: 52, z: -61.9, face: 's' },
    { type: 'hatch', x: 40, z: -61.9, face: 's' }, { type: 'hatch', x: 57.9, z: -40, face: 'w' },
    { type: 'hatch', x: 57.9, z: -53, face: 'w' },
    { type: 'puddle', x: 42, z: -46, r: 1.5 }, { type: 'puddle', x: 50, z: -53, r: 1.0 },
    // --- 第二処理設備室（C） ---
    { type: 'tank', x: 25, z: -22.5, r: 1.2, h: 3.4 }, { type: 'tank', x: 30, z: -22.5, r: 1.2, h: 3.4 },
    { type: 'tank', x: 38, z: -22.5, r: 1.2, h: 3.4 }, { type: 'tank', x: 43, z: -22.5, r: 1.2, h: 3.4 },
    { type: 'machine', x: 31, z: -26.6, w: 3.2, d: 1.2, h: 1.4, style: 'cabinet' },
    { type: 'machine', x: 40, z: -17.4, w: 3.2, d: 1.2, h: 1.4, style: 'cabinet' },
    { type: 'sign', x: 32, y: 2.8, z: -14.05, face: 'n', w: 1.6, h: 0.4, lines: ['C 系統 主弁'], style: 'plate' },
    { type: 'sign', x: 31, y: 3.0, z: -29.95, face: 's', w: 1.6, h: 0.32, lines: ['観察室 弐'], style: 'plate' },
    { type: 'sign', x: 45.95, y: 2.2, z: -22, face: 'w', w: 1.4, h: 0.8, lines: ['処理槽', '素手で触れるな'], style: 'warn' },
    { type: 'mark', x: 36.2, y: 3.0, z: -29.95, face: 's' },
    { type: 'mark', x: 23.95, y: 1.9, z: -34.8, face: 'w' },
    // --- 観察室弐（ダクトの先） ---
    { type: 'desk', x: 30.6, z: -31.3, w: 3.0, d: 0.8, face: 's', crt: '観察記録', papers: true, phone: true, solid: false },
    { type: 'sign', x: 37.35, y: 2.0, z: -33, face: 'w', w: 1.0, h: 0.32, lines: ['非常口'], style: 'plate' },
    // --- 北通路・観察室参 ---
    { type: 'sign', x: 17.95, y: 2.0, z: -62, face: 'w', w: 1.4, h: 0.5, lines: ['区画 3-07'], style: 'stencil' },
    { type: 'desk', x: 10.6, z: -61.2, w: 1.8, d: 0.8, face: 'e', crt: '監視 3-07', papers: true, solid: false },
    // --- 検体照合室（B） ---
    { type: 'sign', x: 16, y: 3.6, z: -81.95, face: 's', w: 4.0, h: 0.6, lines: ['検体照合室'], style: 'plate' },
    { type: 'crusher', x: 5.6, z: -71.2, face: 'e' },
    { type: 'shelf', x: 12, z: -67.6, w: 4.0, d: 0.7, h: 2.0, face: 'n' },
    { type: 'shelf', x: 20, z: -67.6, w: 4.0, d: 0.7, h: 2.0, face: 'n' },
    { type: 'pillar', x: 9.5, z: -76.5, w: 1.0, d: 1.0 }, { type: 'pillar', x: 23, z: -73.5, w: 1.0, d: 1.0 },
    { type: 'desk', x: 24.5, z: -77.0, w: 2.0, d: 0.8, face: 'w', crt: '照合', papers: true },
    { type: 'sign', x: 24, y: 2.75, z: -81.95, face: 's', w: 1.6, h: 0.32, lines: ['保管室 連絡口'], style: 'plate' },
    { type: 'sign', x: 27.95, y: 2.0, z: -70, face: 'w', w: 1.6, h: 0.5, lines: ['資材搬入路 →'], style: 'stencil' },
    { type: 'mark', x: 31.0, y: 1.9, z: -71.95, face: 'n' },
    // --- 検体保管室 ---
    { type: 'pedestal', x: 19, z: -92.5 },
    { type: 'sign', x: 19, y: 2.6, z: -95.95, face: 's', w: 2.4, h: 0.9, lines: ['検体腕', '01'], style: 'big01' },
    { type: 'shelf', x: 12.6, z: -89, w: 3.6, d: 0.7, h: 2.2, face: 'e', jars: true },
    { type: 'shelf', x: 12.6, z: -93.5, w: 3.6, d: 0.7, h: 2.2, face: 'e', jars: true },
    { type: 'shelf', x: 25.4, z: -86.5, w: 2.4, d: 0.7, h: 2.2, face: 'w', jars: true },
    // --- 資材搬入路・資材庫 ---
    { type: 'sign', x: 39.95, y: 2.0, z: -78, face: 'w', w: 1.4, h: 0.5, lines: ['区画 3-11'], style: 'stencil' },
    { type: 'shelf', x: 47.4, z: -85, w: 3.6, d: 0.7, h: 2.0, face: 'w' },
    { type: 'crate', x: 43.2, z: -79.0, w: 1.2, d: 1.2, h: 1.0 },
    { type: 'sign', x: 30, y: 2.0, z: -94.95, face: 'n', w: 1.6, h: 0.5, lines: ['← 検体保管室'], style: 'stencil' },
    // --- 隠し部屋2 ---
    { type: 'shelf', x: 30, z: -88.8, w: 1.8, d: 0.6, h: 1.8, face: 'n', solid: false, jars: true },
    { type: 'mark', x: 35.95, y: 2.45, z: -86.8, face: 'e' },
    // --- 搬送ライン室（C） ---
    { type: 'sign', x: 0, y: 2.2, z: -74.05, face: 'n', w: 1.6, h: 0.5, lines: ['搬送ライン'], style: 'stencil' },
    { type: 'sign', x: -7.05, y: 4.4, z: -78, face: 'w', w: 3.4, h: 0.6, lines: ['第三搬送ライン'], style: 'plate' },
    { type: 'sign', x: -7.6, y: 2.2, z: -68, face: 'w', w: 1.4, h: 0.8, lines: ['危険', '粉砕機'], style: 'warn' },
    { type: 'sign', x: -39.95, y: 4.0, z: -78, face: 'e', w: 2.4, h: 0.5, lines: ['受入口'], style: 'plate' },
    // --- 検体処理ホール（アリーナ2） ---
    { type: 'sign', x: -44.5, y: 2.2, z: -76.05, face: 'n', w: 1.6, h: 0.5, lines: ['区画 3-15'], style: 'stencil' },
    { type: 'furnace', x: -62, z: -79, w: 6.0, d: 7.0, h: 4.0 },
    { type: 'pillar', x: -70, z: -70, w: 1.4, d: 1.4 }, { type: 'pillar', x: -54, z: -70, w: 1.4, d: 1.4 },
    { type: 'pillar', x: -70, z: -88, w: 1.4, d: 1.4 }, { type: 'pillar', x: -54, z: -88, w: 1.4, d: 1.4 },
    { type: 'gurney', x: -58, z: -66.5, rot: 0.2 }, { type: 'gurney', x: -66, z: -91.5, rot: -0.3 },
    { type: 'lowwall', x: -73.2, z: -79, w: 0.8, d: 3.2, h: 1.0 },
    { type: 'shelf', x: -49.7, z: -65, w: 3.0, d: 0.6, h: 2.0, face: 'w', solid: false },
    { type: 'hatch', x: -62, z: -95.9, face: 's' }, { type: 'hatch', x: -75.9, z: -80, face: 'e' },
    { type: 'hatch', x: -62, z: -62.1, face: 'n' },
    // --- 検体再構成室（D） ---
    { type: 'sign', x: -62, y: 3.8, z: -121.95, face: 's', w: 4.0, h: 0.6, lines: ['検体再構成室'], style: 'plate' },
    { type: 'frame', x: -62, z: -119.2, face: 's' },
    { type: 'board', x: -57.6, y: 1.9, z: -121.95, face: 's' },
    { type: 'shelf', x: -50.7, z: -109, w: 3.0, d: 0.6, h: 2.0, face: 'w', solid: false },
    { type: 'sign', x: -50.05, y: 2.5, z: -109, face: 'w', w: 1.6, h: 0.32, lines: ['部品棚'], style: 'plate' },
    { type: 'gurney', x: -70, z: -116, rot: 1.4 },
    { type: 'desk', x: -46.4, z: -114, w: 2.0, d: 0.8, face: 'w', crt: '再構成', papers: true, solid: false },
    // --- 観覧回廊（終盤） ---
    { type: 'switch', x: -56, z: -147.6, face: 's' },
    { type: 'sign', x: -56, y: 2.6, z: -147.85, face: 's', w: 1.8, h: 0.4, lines: ['搬送棟 照明・起動'], style: 'plate' },
    { type: 'sign', x: -77.95, y: 3.6, z: -141, face: 'e', w: 2.6, h: 0.5, lines: ['待機室 連絡扉'], style: 'plate' },
    { type: 'bench', x: -66, z: -136.4, w: 3.0, d: 0.6, rot: 0 },
  ],

  // 窓の向こうの研究員（静止。頭だけプレイヤーを追う）
  researchers: [
    { x: 5.4, z: -11.0, face: 'w', look: true },
    { x: 6.8, z: -14.2, face: 'w', look: true, pose: 'clip' },
    { x: 10.2, z: -59.6, face: 'e', look: true },
    { x: 10.0, z: -63.0, face: 'e', look: true, pose: 'clip' },
    { x: -26.5, z: -58.8, face: 'n', look: true, y: 2.2 },
    { x: -24.0, z: -59.2, face: 'n', look: true, y: 2.2, pose: 'clip' },
    { x: -45.6, z: -112.5, face: 'w', look: true },
    { x: -45.2, z: -116.0, face: 'w', look: true, pose: 'clip' },
  ],

  /* ---------- 死体と腕 ----------
     死体は爆発しない（置いてあるもの）。腕の種類は fist / gun / tentacle。
     arms は床に落ちている腕（寿命なし。ライジングの□＋クリックで取る）。
     死んで戻るたびにこの配置に作り直す（詰み防止）                          */
  corpses: [
    { x: -12, z: -41.2, rot: Math.PI, arms: ['fist', 'fist'] },            // A：両腕が拳の体
    { x: 55.6, z: -59.6, rot: -Math.PI * 0.75, arms: ['fist', 'fist'] },   // B（弾薬庫の隅）
    { x: 27, z: -16.4, rot: Math.PI, arms: ['fist', 'fist'] },             // C
    { x: -5, z: -57, rot: -Math.PI / 2, arms: ['tentacle', 'fist'], resMax: 6, skill: 'heal' },   // 隠し部屋1
    { x: 31, z: -32.8, rot: 0, arms: ['gun', 'gun'], resMax: 5, skill: 'asura' },                 // 観察室弐
    { x: 32, z: -87, rot: 0, arms: ['fist', 'fist'], resMax: 5, skill: 'heal' },                  // 隠し部屋2
    { x: 14.4, z: -85.6, rot: Math.PI / 2, arms: ['fist', 'fist'] },       // 保管室（ダクトで来たとき用）
    { x: 45, z: -84.6, rot: -Math.PI / 2, arms: ['gun', 'fist'] },         // 資材庫
    { x: -32.4, z: -72, rot: -Math.PI / 2, arms: ['tentacle', 'fist'] },   // C の受け取り（西の足場）
    { x: -32.4, z: -84, rot: -Math.PI / 2, arms: ['tentacle', 'fist'] },
    { x: -74, z: -64.4, rot: Math.PI * 0.75, arms: ['fist', 'fist'] },     // アリーナ2
    { x: -72.6, z: -108.4, rot: Math.PI * 0.5, arms: ['fist', 'fist'] },   // 再構成室の予備
  ],
  arms: [
    { x: -3.2, z: -54.6, kind: 'gun' },                                      // 隠し部屋1
    { x: 35.5, z: -38.9, kind: 'fist' }, { x: 35.5, z: -40.3, kind: 'fist' }, { x: 35.5, z: -41.8, kind: 'gun' },
    { x: 46.8, z: -80.6, kind: 'fist' },                                     // 資材庫
    { x: 30, z: -84.2, kind: 'tentacle' },                                   // 隠し部屋2
    { x: -50.6, z: -64.2, kind: 'gun' }, { x: -50.6, z: -65.6, kind: 'fist' },   // アリーナ2
    { x: -51.1, z: -108.2, kind: 'gun' }, { x: -51.1, z: -109.8, kind: 'fist' }, // 再構成室の部品棚
  ],

  /* ---------- 戦闘 ----------
     spawns の1体 = [x, z, 左腕, 右腕, 湧くまでの秒数, { strong }]
     cond: 'valves:2'（バルブを2つ開けた）/ 'flag:名前'（ギミックが立てる印）       */
  encounters: [
    { id: 'c02', zone: [-2, 16, -27, -23],
      spawns: [[10, -25.4, 'fist', 'fist', 0], [13.6, -24.2, 'fist', 'fist', 0.3]] },
    { id: 'w1', zone: [-10, 7, -48, -44],
      spawns: [[-3.6, -46.2, 'fist', 'gun', 0], [-7.6, -45.4, 'fist', 'fist', 0.2]] },
    { id: 'mA2', zone: [-18, 13, -34, -32],
      spawns: [[-4, -33, 'fist', 'fist', 0]] },
    { id: 'hall', zone: [6, 26, -54, -37], cond: 'valves:2',
      spawns: [[8, -52.4, 'fist', 'fist', 0.2], [24, -52.4, 'gun', 'fist', 1.0], [24, -38.4, 'fist', 'fist', 1.8]] },
    { id: 'pc1', zone: [18, 46, -30, -14],
      spawns: [[27.6, -19.4, 'fist', 'fist', 0], [41, -26.4, 'fist', 'gun', 0.3]] },
    { id: 'pc2', zone: [18, 46, -30, -14], cond: 'flag:valveC',
      spawns: [[22.6, -20.4, 'fist', 'fist', 0.6], [34, -20.6, 'fist', 'fist', 1.2], [44.4, -27.6, 'gun', 'fist', 1.8]] },
    { id: 'se1', zone: [27, 40, -72, -68],
      spawns: [[37.4, -70.2, 'fist', 'fist', 0]] },
    { id: 'se2', zone: [36, 40, -95, -71],
      spawns: [[38, -88.6, 'fist', 'fist', 0], [38.4, -81.6, 'gun', 'fist', 0.3]] },
    { id: 'sr', zone: [12, 26, -96, -82.8], cond: 'flag:armTaken', onClear: { open: 'srd' },
      spawns: [[24.4, -93.2, 'fist', 'fist', 0.8], [14.2, -94.6, 'fist', 'fist', 1.4], [24.6, -85.2, 'gun', 'fist', 2.2]] },
    { id: 'arena1', type: 'arena', zone: [34, 58, -62, -36], trigger: [36.5, 57.5, -61.5, -38.5],
      doors: ['ar1W', 'ar1S'],
      waves: [
        [[46, -60.2, 'fist', 'fist', 0], [52, -60.2, 'fist', 'fist', 0.6], [40, -60.2, 'fist', 'gun', 1.2]],
        [[56.6, -40, 'fist', 'fist', 0], [56.6, -53, 'gun', 'fist', 0.5], [44, -37.6, 'fist', 'fist', 1.2]],
        [[46, -60.2, 'fist', 'fist', 0, { strong: true }], [36.4, -56, 'fist', 'fist', 0.8], [56.6, -46, 'fist', 'gun', 1.6]],
      ] },
    { id: 'arena2', type: 'arena', zone: [-76, -49, -96, -62], trigger: [-73.5, -51.5, -93.5, -64.5],
      doors: ['ar2E', 'ar2N'],
      waves: [
        [[-70, -92.4, 'fist', 'fist', 0], [-56, -92.4, 'fist', 'gun', 0.5], [-70, -66.6, 'fist', 'fist', 1.0]],
        [[-62, -94.4, 'gun', 'gun', 0], [-74.4, -84, 'fist', 'fist', 0.6], [-52.4, -66.6, 'fist', 'fist', 1.2]],
        [[-62, -63.6, 'fist', 'fist', 0, { strong: true }], [-73.6, -93.4, 'fist', 'gun', 0.8], [-51.6, -93.4, 'gun', 'fist', 1.4]],
      ] },
  ],

  /* ---------- ギミック ---------- */
  valves: [
    // lamp はロック扉の上のランプの位置。pipe はランプからバルブまでの細い配管（色＋文字で追える）
    { id: 'A', x: -19.55, y: 1.35, z: -50, face: 'e', color: 0xd0412f,
      lamp: [15, 3.25, -53.72],
      pipe: [[15, 3.45, -53.7], [15, 4.4, -53.7], [6.35, 4.4, -53.7], [6.35, 2.4, -53.7], [6.35, 2.4, -47.65],
             [-19.65, 2.4, -47.65], [-19.65, 2.4, -50], [-19.65, 1.75, -50]] },
    { id: 'B', x: 57.55, y: 1.35, z: -49, face: 'w', color: 0xe0b020,
      lamp: [16, 3.25, -53.72],
      pipe: [[16, 3.45, -53.7], [16, 4.0, -53.7], [25.65, 4.0, -53.7], [25.65, 2.4, -53.7], [25.65, 2.4, -47.65],
             [34.35, 2.4, -47.65], [34.35, 4.2, -47.65], [57.65, 4.2, -47.65], [57.65, 4.2, -49], [57.65, 1.75, -49]] },
    { id: 'C', x: 32, y: 1.35, z: -14.45, face: 'n', color: 0x3b78e0,
      lamp: [17, 3.25, -53.72],
      pipe: [[17, 3.45, -53.7], [17, 3.6, -53.7], [25.3, 3.6, -53.7], [25.3, 0.3, -53.7], [25.3, 0.3, -37.35],
             [23.65, 0.3, -37.35], [23.65, 0.3, -14.35], [32, 0.3, -14.35], [32, 0.95, -14.35]],
      flag: 'valveC' },
  ],
  lockDoor: 'dA',

  // ミッションB：指定番号の腕
  armCheck: {
    tag: '01',
    door: 'dB',
    crusher: { x: 5.6, z: -71.2, face: 'e', slot: [6.55, 1.2, -71.2], crt: [4.95, 2.15, -72.5], r: 2.4 },
    pedestal: { x: 19, z: -92.5, y: 1.15 },     // 置いてある場所（壊れたら予備がここに補充される）
    kind: 'fist',
    takenFlag: 'armTaken',
  },

  // ミッションC：搬送コンベア
  conveyor: {
    room: 'cv',
    beltY: 0.9,
    half: 0.9,
    z0: -97, z1: -62,          // ベルトの範囲。進む向きの端に粉砕機
    killMargin: 1.6,           // 端からこの距離に入ったら巻き込まれる
    lanes: [
      { x: -17.0, dir: -1, speed: 1.5, gap: 7.5 },
      { x: -20.8, dir: 1, speed: 1.75, gap: 8.0 },
      { x: -24.6, dir: -1, speed: 1.6, gap: 7.0 },
      { x: -28.4, dir: 1, speed: 1.9, gap: 8.5 },
    ],
    goal: 'spB',               // 人間の体でここに立てば突破
    door: 'dC',
  },

  // ミッションD：身体の組み立て
  assemble: {
    x: -62, z: -119.2, face: 's',
    need: { LEFT: 'fist', RIGHT: 'gun' },
    door: 'dD',
  },

  // 終盤：搬送棟の照明と搬送ライン（任意）
  finale: { switchAt: [-56, -147.0], hall: 'big' },

  goal: { door: 'goal', x: -77.0, z: -141, r: 2.6 },

  /* ---------- 進行 ---------- */
  missions: [
    { id: 'A', type: 'valves' },
    { id: 'B', type: 'armCheck' },
    { id: 'C', type: 'conveyor' },
    { id: 'D', type: 'assemble' },
  ],
  // 死んだらこの位置・この体で戻る。after はそのミッションを達成すると有効になる
  checkpoints: [
    { after: null, x: 0, z: 3.5, yaw: 0, arms: ['fist', 'gun'] },
    { after: 'A', x: 16, z: -58, yaw: 0, arms: ['fist', 'fist'] },
    { after: 'B', x: -2, z: -76, yaw: Math.PI / 2, arms: ['fist', 'fist'] },
    { after: 'C', x: -36, z: -78, yaw: Math.PI / 2, arms: ['tentacle', 'fist'] },
    { after: 'D', x: -62, z: -126, yaw: 0, arms: ['fist', 'gun'] },
  ],
};
