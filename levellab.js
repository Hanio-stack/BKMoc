'use strict';
/* =========================================================
   BK LevelLab 連携（stage.js の後に読む）

   LevelLab（マップ制作ツール）が書き出したプロジェクト JSON を、BKMoc のステージ定義に変換して
   BK_registerStage() で登録する。ステージごとの専用コードは書かない（どのマップも同じ変換を通る）。

   ・公開ステージ   maps/manifest.js に並べた maps/*.js（LevelLab の JSON をそのまま包んだもの）。
                     Git で管理するので、どのブラウザ・アカウントでも同じ内容になる
   ・ローカル取り込み 受付で「LevelLab の JSON を読み込む」→ ファイルを選ぶ（または画面へドロップ）。
                     このブラウザだけに保存され、ID は local- で始まる（公開・同梱のステージと衝突しない）。
                     同じマップを読み込み直すと、明示的な更新として置き換わる

   形式の版（version）ごとに変換を分ける（LEVELLAB_CONVERTERS）。今は v7 のみ。
   変換は「エディタ上の今の状態」を正とする：
     ・形と位置   floors[].items の座標（x, y, w, h / 線 / 経路）。mock.origin2D を原点にしてメートルのまま使う
     ・属性       items[].mock.raw（扉の種類・バルブの色や配管・敵の腕など）
     ・進行       progression（部屋・フラグ・扉の開く条件・戦闘イベント）
     ・既定値     mock.source（ミッションの文言・チェックポイント・霧など、エディタが持たない設定）
   エディタに無い mock.source の空間・扉などは使わない（古い写し）。使わなかったものは報告に残す。

   扱えない要素は warnings、ゲームの進行に要る要素が欠ける・壊れているときは errors（登録しない）。
   ========================================================= */

const LEVELLAB_FORMAT_LATEST = 7;
const LEVELLAB_ORIGIN_START = 1200;           // 取り込んだステージを置くワールドの x（同梱のステージと離す）
const LEVELLAB_ORIGIN_STEP = 400;
const LEVELLAB_LOCAL_KEY = 'bk.levellab.local';
// buildProp が作れる置物
const LEVELLAB_PROP_TYPES = new Set(['pillar', 'crate', 'shelf', 'machine', 'tank', 'desk', 'counter', 'panel', 'sign', 'mark', 'barrel',
  'lowwall', 'locker', 'bench', 'puddle', 'hatch', 'furnace', 'gurney', 'crusher', 'pedestal', 'frame', 'inspector', 'terminal', 'lift',
  'armpile', 'gauge', 'board', 'switch', 'upgradeBench']);
const LEVELLAB_SPACE_TYPES = new Set(['room', 'corridor', 'duct', 'doorway', 'view', 'catwalk']);
const LEVELLAB_ARM_KINDS = new Set(['fist', 'gun', 'tentacle']);
// mock.raw で知っているキー（ほかは警告）
const LEVELLAB_RAW_KEYS = {
  space: ['id', 'r', 'name', 'tone', 'type', 'h', 'walk', 'floorY', 'lights'],
  door: ['id', 'axis', 'at', 'from', 'to', 'h', 'style', 'lamp', 'open', 'decor', 'insideOpen'],
  valve: ['id', 'x', 'z', 'face', 'y', 'color', 'lamp', 'flag', 'line', 'pipe', 'cond', 'opens', 'approach'],
  corpse: ['x', 'z', 'rot', 'arms', 'resMax', 'skill', 'bodyTag'],
  arm: ['x', 'z', 'y', 'kind', 'tag', 'side', 'label', 'takenFlag'],
  supply: ['x', 'z', 'face', 'name'],
  enemy: ['arms', 'delay', 'strong'],
  spawn: ['after', 'x', 'z', 'yaw', 'arms'],
  goal: ['door', 'x', 'z', 'r'],
  check: ['parallel', 'tag', 'label', 'kind', 'side', 'mode', 'device', 'door', 'idleCrt', 'okCrt', 'crusher', 'takenFlag'],
};
const LEVELLAB_MOCK_KEYS = { door: ['width', 'requires', 'any'], valve: ['requires', 'any'], enemy: ['roomId', 'wave', 'encounter'],
  arm: ['replenish'], prop: ['signText'] };

/* ---------- 変換 ---------- */
function levelLabConvert(json, opts) {
  opts = opts || {};
  const errors = [], warnings = [], notes = [];
  const out = { ok: false, def: null, errors, warnings, notes, id: null };
  if (!json || typeof json !== 'object') { errors.push('JSON がオブジェクトではない'); return out; }
  const ver = json.version;
  const conv = LEVELLAB_CONVERTERS[ver];
  if (!conv) { errors.push('LevelLab の形式 version ' + ver + ' には対応していない（対応：' + Object.keys(LEVELLAB_CONVERTERS).join(', ') + '）'); return out; }
  try { conv(json, opts, out); }
  catch (e) { errors.push('変換中の例外：' + (e && e.message)); console.error(e); }
  out.ok = !errors.length && !!out.def;
  return out;
}

function convertLevelLabV7(json, opts, out) {
  const { errors, warnings, notes } = out;
  const W = (m) => warnings.push(m), ERR = (m) => errors.push(m);
  const known = ['version', 'title', 'width', 'height', 'snap', 'exportGrid', 'exportLabels', 'ghost', 'floors', 'verticals', 'switchLinks', 'graph', 'progression', 'mock'];
  for (const k of Object.keys(json)) if (!known.includes(k)) W('未対応のルート要素「' + k + '」');
  const floors = Array.isArray(json.floors) ? json.floors : [];
  if (!floors.length) { ERR('floors（階層）が無い'); return; }
  const floor = floors[0];
  for (let i = 1; i < floors.length; i++) if ((floors[i].items || []).length) ERR('2階以上（' + (floors[i].name || floors[i].id) + '）は未対応：BKMoc のステージは1階層');
  if ((json.verticals || []).length) ERR('verticals（階層をつなぐ階段・昇降機）は未対応');
  if ((json.switchLinks || []).length) ERR('switchLinks（スイッチと扉の連動）は未対応：進行に関わるため読み込まない');
  const g = json.graph || {};
  if ((g.nodes || []).length || (g.edges || []).length) W('graph（ノード図）は読み込まない（' + (g.nodes || []).length + ' ノード）');
  const src = (json.mock && json.mock.source) || {};
  const hasSrc = !!(json.mock && json.mock.source);
  if (!hasSrc) notes.push('mock.source が無いので、ミッションなどは配置と progression から組み立てる');
  const items = Array.isArray(floor.items) ? floor.items : [];
  const prog = json.progression || { rooms: [], flags: [], links: [], events: [] };
  for (const k of Object.keys(prog)) if (!['version', 'rooms', 'flags', 'links', 'events'].includes(k)) W('未対応の progression 要素「' + k + '」');

  // 原点：mock.origin2D。無ければ開始地点
  let o2 = json.mock && Array.isArray(json.mock.origin2D) ? json.mock.origin2D : null;
  if (!o2) {
    const sp = items.find((i) => i.mock && i.mock.type === 'spawn');
    o2 = sp ? [sp.x, sp.y] : [0, 0];
    notes.push('mock.origin2D が無いので開始地点を原点にした');
  }
  const LX = (x) => +(x - o2[0]).toFixed(3), LZ = (y) => +(y - o2[1]).toFixed(3);
  const r3 = (v) => Math.round(v * 1000) / 1000;

  // ID：mock.source.id か題名から。英数字と - _ だけにする
  const baseId = levelLabSlug(src.id || json.title || floor.id || 'map');
  const id = (opts.idPrefix || 'll-') + baseId;
  out.id = id; out.baseId = baseId;
  const title = json.title || src.title || baseId;
  const def = {
    id, kind: 'stage', selectable: true,
    label: (opts.labelPrefix || '') + (src.label || ('LEVELLAB ' + baseId)),
    title,
    speaker: src.speaker || '研究員',
    origin: [0, 0, 0],                // 登録するときに空いている場所を割り当てる
    fog: src.fog || { color: 0x06080a, near: 3, far: 30 },
    ambient: src.ambient || { hemi: 0.45, dir: 0.14 },
    spaces: [], doors: [], gas: [], props: [], corpses: [], arms: [], taggedArms: [], valves: [], armSupply: [],
    encounters: [], missions: [], checkpoints: [],
    levellab: { format: 7, title: json.title, source: opts.source || 'public', file: opts.file || null, baseId },
  };
  if (src.lights) def.lights = src.lights;
  if (src.lockName) def.lockName = src.lockName;
  if (src.valveObjective) def.valveObjective = src.valveObjective;
  if (src.chips) def.chips = src.chips;
  const usedIds = new Set();
  const uniq = (want, kind) => {
    let i = want, n = 2;
    while (usedIds.has(kind + ':' + i)) i = want + '_' + (n++);
    if (i !== want) W(kind + ' の id「' + want + '」が重複 → 「' + i + '」');
    usedIds.add(kind + ':' + i);
    return i;
  };
  const checkRaw = (kind, raw, label, mock) => {
    for (const k of Object.keys(raw || {})) if (!LEVELLAB_RAW_KEYS[kind].includes(k)) W(kind + '「' + label + '」の未対応の属性「' + k + '」');
    if (mock) for (const k of Object.keys(mock)) if (!['type', 'raw'].includes(k) && !(LEVELLAB_MOCK_KEYS[kind] || []).includes(k)) W(kind + '「' + label + '」の未対応の設定「' + k + '」');
  };
  const ARMS = (a, where) => {
    const l = Array.isArray(a) ? a : ['fist', 'fist'];
    for (const k of l) if (!LEVELLAB_ARM_KINDS.has(k)) W(where + ' の腕の種類「' + k + '」は未対応（拳にする）');
    return [LEVELLAB_ARM_KINDS.has(l[0]) ? l[0] : 'fist', LEVELLAB_ARM_KINDS.has(l[1]) ? l[1] : 'fist'];
  };

  /* --- 空間（部屋・通路・経路） --- */
  for (const it of items) {
    if (it.type === 'rect') {
      const m = it.mock || {};
      if (it.mock && m.type !== 'space') { W('rect「' + it.label + '」の mock.type「' + m.type + '」は未対応'); continue; }
      const raw = m.raw || {};
      checkRaw('space', raw, it.label || it.id);
      let type = raw.type || 'room';
      if (!LEVELLAB_SPACE_TYPES.has(type)) { W('空間「' + (raw.id || it.id) + '」の種類「' + type + '」は未対応 → room'); type = 'room'; }
      const sp = { id: uniq(raw.id || it.id, 'space'), type, r: [LX(it.x), LX(it.x + it.w), LZ(it.y), LZ(it.y + it.h)],
        h: raw.h || (type === 'corridor' || type === 'duct' ? 4 : 4.5), tone: raw.tone || 'cold' };
      if (raw.name || it.label) sp.name = raw.name || it.label;
      for (const k of ['walk', 'floorY', 'lights']) if (raw[k] !== undefined) sp[k] = raw[k];
      if (raw.r && (Math.abs(raw.r[0] - sp.r[0]) > 0.01 || Math.abs(raw.r[2] - sp.r[2]) > 0.01 || Math.abs(raw.r[1] - sp.r[1]) > 0.01 || Math.abs(raw.r[3] - sp.r[3]) > 0.01)) {
        notes.push('空間「' + sp.id + '」はエディタで動かされている（エディタの位置を使う）');
      }
      if ((it.manualOpenings || []).length) W('空間「' + sp.id + '」の manualOpenings（手で開けた出入口 ' + it.manualOpenings.length + ' 件）は未対応');
      def.spaces.push(sp);
    } else if (it.type === 'corridor') {
      const w = it.width || 2;
      const a = { x: LX(it.x1), z: LZ(it.y1) }, b = { x: LX(it.x2), z: LZ(it.y2) };
      const r = levelLabSegRect(a, b, w, 1.0);
      if (!r) { W('通路「' + it.id + '」が斜め（未対応）'); continue; }
      def.spaces.push({ id: uniq(it.id, 'space'), type: 'corridor', r, h: 4, tone: 'cold', name: it.label || undefined, levellabItem: it.id });
    } else if (it.type === 'route') {
      const pts = (it.points || []).map((p) => ({ x: LX(p.x), z: LZ(p.y) }));
      const w = it.width || 2;
      let k = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        if (Math.hypot(a.x - b.x, a.z - b.z) < 0.01) continue;
        const r = levelLabSegRect(a, b, w, i === 0 || i + 2 === pts.length ? 1.0 : w / 2);
        if (!r) { W('経路「' + it.id + '」の区間 ' + i + ' が斜め（未対応）'); continue; }
        def.spaces.push({ id: uniq(it.id + '_' + (k++), 'space'), type: 'corridor', r, h: 4, tone: 'cold', levellabItem: it.id });
      }
    } else if (it.type === 'gas') {
      def.gas.push([LX(it.x), LX(it.x + it.w), LZ(it.y), LZ(it.y + it.h)]);
    } else if (it.type !== 'icon') {
      W('未対応の要素「' + it.type + '」（' + (it.label || it.id) + '）');
    }
  }
  if (!def.spaces.length) { ERR('部屋・通路が1つも無い'); return; }
  const spaceAtL = (x, z) => def.spaces.filter((s) => x >= s.r[0] - 0.01 && x <= s.r[1] + 0.01 && z >= s.r[2] - 0.01 && z <= s.r[3] + 0.01);
  const roomAtL = (x, z) => { const l = spaceAtL(x, z); return l.find((s) => s.type === 'room') || l[0] || null; };

  /* --- 進行（progression） --- */
  const flagTitle = {};
  for (const f of prog.flags || []) flagTitle[f.id] = f.title || f.id;
  const condFlag = (f) => {
    // LevelLab のフラグ名をそのまま BKMoc の条件にする（cleared:戦闘 / valve:弁 / done:ミッション / flag:名前）
    if (typeof f !== 'string' || f.indexOf(':') < 0) { ERR('条件「' + f + '」の形式が不正'); return 'flag:' + f; }
    const k = f.split(':')[0];
    if (!COND_KINDS.has(k)) ERR('条件「' + f + '」の種類「' + k + '」は未対応');
    return f;
  };
  const condText = (alts) => alts.map((g) => g.map((f) => '「' + (flagTitle[f] || f) + '」').join('と')).join('または') + 'が必要';
  const doorRules = {};
  for (const ln of prog.links || []) {
    if (!ln.mapDoorId) continue;
    const rules = (ln.rules || []).filter((g) => Array.isArray(g) && g.length);
    if (rules.length) doorRules[ln.mapDoorId] = rules.map((g) => g.map(condFlag));
  }
  const roomMap = {};
  for (const r of prog.rooms || []) roomMap[r.id] = r.mapRoomId || r.id;
  const eventOf = {};
  for (const ev of prog.events || []) eventOf[roomMap[ev.roomId] || ev.roomId] = ev;
  const encIdOfRoom = {};
  for (const f of prog.flags || []) if (/^cleared:/.test(f.id) && f.roomId) encIdOfRoom[roomMap[f.roomId] || f.roomId] = f.id.slice(8);

  /* --- 置物・ギミック（アイコン） --- */
  const enemies = [];
  let spawn = null, goal = null, check = null, checkItem = null;
  const props = [];
  for (const it of items) {
    if (it.type !== 'icon') continue;
    const m = it.mock;
    if (!m) { W('アイコン「' + (it.label || it.id) + '」（' + it.kind + '）は BKMoc の設定が無い'); continue; }
    const raw = m.raw || {};
    const x = LX(it.x), z = LZ(it.y);
    const lab = it.label || it.id;
    switch (m.type) {
      case 'door': {
        checkRaw('door', raw, lab, m);
        // 向き：raw.axis（x＝東西に延びる壁＝z 一定の線上、z＝南北の壁）。無ければ近い部屋の壁から決める
        let axis = raw.axis === 'z' ? 'z' : raw.axis === 'x' ? 'x' : null;
        if (!axis) {
          let bd = 1e9;
          for (const sp of def.spaces) {
            const [a0, a1, b0, b1] = sp.r;
            const inX = x >= a0 - 0.5 && x <= a1 + 0.5, inZ = z >= b0 - 0.5 && z <= b1 + 0.5;
            if (inX) for (const e of [b0, b1]) if (Math.abs(z - e) < bd) { bd = Math.abs(z - e); axis = 'x'; }
            if (inZ) for (const e of [a0, a1]) if (Math.abs(x - e) < bd) { bd = Math.abs(x - e); axis = 'z'; }
          }
          axis = axis || 'x';
          notes.push('扉「' + (raw.id || it.id) + '」に向き（axis）が無い → 近い壁から「' + axis + '」');
        }
        const w = m.width || (raw.to - raw.from) || 4;
        const d = { id: uniq(raw.id || it.id, 'door'), axis, at: axis === 'x' ? z : x,
          from: r3((axis === 'x' ? x : z) - w / 2), to: r3((axis === 'x' ? x : z) + w / 2),
          h: raw.h || 2.8, style: raw.style || 'blast' };
        for (const k of ['lamp', 'open', 'decor', 'insideOpen']) if (raw[k] !== undefined) d[k] = raw[k];
        // 開く条件：アイコンの requires（any なら「どれか」）と progression の扉のルール
        const req = (m.requires || []).filter(Boolean);
        let rules = doorRules[d.id] || doorRules[raw.id] || null;
        if (req.length) rules = m.any ? req.map((f) => [condFlag(f)]) : [req.map(condFlag)];
        if (rules) { d.requires = rules; d.requiresText = condText(rules); }
        if (!spaceAtL(x, z).length) W('扉「' + d.id + '」が部屋・通路の外にある');
        def.doors.push(d);
        break;
      }
      case 'valve': {
        checkRaw('valve', raw, lab, m);
        const v = Object.assign({}, raw, { x, z });
        v.id = uniq(raw.id || it.id, 'valve');
        if (v.y === undefined) v.y = 1.35;
        if (v.color === undefined) v.color = 0xd0412f;
        if (!v.face) { W('バルブ「' + v.id + '」の向き face が無い → e'); v.face = 'e'; }
        const req = (m.requires || []).filter(Boolean);
        if (req.length) v.cond = m.any ? req.map((f) => [condFlag(f)]) : req.map(condFlag);
        else if (raw.cond) v.cond = condFlag(raw.cond);
        if (v.cond) v.condText = 'まだ圧力がかかっていない。' + condText(Array.isArray(v.cond) ? (Array.isArray(v.cond[0]) ? v.cond : [v.cond]) : [[v.cond]]);
        // エディタで動かした：配管とアプローチを今の位置に合わせる
        const dx = raw.x !== undefined ? x - raw.x : 0, dz = raw.z !== undefined ? z - raw.z : 0;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          if (v.lamp) v.pipe = [[v.lamp[0], v.lamp[1], v.lamp[2]], [v.lamp[0], 3.6, v.lamp[2]], [x, 3.6, v.lamp[2]], [x, 3.6, z], [x, 1.8, z]];
          else delete v.pipe;
          if (raw.approach) v.approach = { x: r3(raw.approach.x + dx), z: r3(raw.approach.z + dz) };
          notes.push('バルブ「' + v.id + '」は動かされている → 配管を今の位置へ引き直した');
        }
        if (!spaceAtL(x, z).length) W('バルブ「' + v.id + '」が部屋の外にある');
        def.valves.push(v);
        break;
      }
      case 'corpse': {
        checkRaw('corpse', raw, lab, m);
        def.corpses.push(Object.assign({}, raw, { x, z, arms: ARMS(raw.arms, '死体「' + lab + '」') }));
        break;
      }
      case 'arm': {
        checkRaw('arm', raw, lab, m);
        const kind = LEVELLAB_ARM_KINDS.has(raw.kind) ? raw.kind : (W('腕「' + lab + '」の種類「' + raw.kind + '」は未対応 → 拳'), 'fist');
        const a = Object.assign({}, raw, { x, z, kind });
        if (m.replenish && !raw.tag) W('腕「' + lab + '」は補充（replenish）だが番号 tag が無い');
        if (m.replenish && raw.tag) a.replenish = true;
        def.arms.push(a);
        break;
      }
      case 'prop': {
        if (!raw.type) { W('置物「' + lab + '」の種類が無い'); break; }
        if (!LEVELLAB_PROP_TYPES.has(raw.type)) { W('置物「' + lab + '」の種類「' + raw.type + '」は未対応（表示されない）'); break; }
        const p = Object.assign({}, raw, { x, z });
        if (m.signText) p.lines = String(m.signText).split('\n');
        for (const k of Object.keys(m)) if (!['type', 'raw', 'signText'].includes(k)) W('置物「' + lab + '」の未対応の設定「' + k + '」');
        props.push(p);
        break;
      }
      case 'supply': checkRaw('supply', raw, lab, m); def.armSupply.push(Object.assign({}, raw, { x, z, face: raw.face || 'e' })); break;
      case 'enemy': {
        checkRaw('enemy', raw, lab, m);
        enemies.push({ x, z, arms: ARMS(raw.arms, '敵「' + lab + '」'), delay: +raw.delay || 0, strong: !!raw.strong,
          roomId: m.roomId || '', wave: typeof m.wave === 'number' ? m.wave : 1, enc: m.encounter || null, label: lab });
        break;
      }
      case 'spawn':
        checkRaw('spawn', raw, lab, m);
        if (spawn) W('開始地点が2つ以上ある（最初の1つを使う）');
        else spawn = { after: null, x, z, yaw: raw.yaw || 0, arms: ARMS(raw.arms, '開始地点') };
        break;
      case 'goal':
        checkRaw('goal', raw, lab, m);
        goal = { door: raw.door, x, z, r: raw.r || 2.6 };
        break;
      case 'check':
        checkRaw('check', raw, lab, m);
        if (check) W('照合装置が2つ以上ある（最初の1つを使う）');
        else { check = raw; checkItem = { x, z }; }
        break;
      default:
        W('アイコン「' + lab + '」の種類「' + m.type + '」は未対応');
    }
  }
  if (!spawn) {
    const cp0 = (src.checkpoints || []).find((c) => c.after === null);
    if (cp0) { spawn = Object.assign({}, cp0); W('開始地点のアイコンが無い → mock.source の開始地点を使う'); }
    else ERR('開始地点（spawn）が無い');
  }
  if (spawn && !spaceAtL(spawn.x, spawn.z).length) ERR('開始地点が部屋・通路の外にある');
  if (!goal) ERR('ゴール（セーフルームへ戻る扉）が無い');
  else {
    if (!goal.door || !def.doors.find((d) => d.id === goal.door)) ERR('ゴールの扉「' + goal.door + '」が無い');
    def.goal = goal;
  }

  /* --- 照合装置（番号付きの腕の提出） --- */
  if (check) {
    const ac = Object.assign({}, check);
    const dev = props.filter((p) => p.type === 'inspector' || p.type === 'crusher')
      .map((p) => ({ p, d: Math.hypot(p.x - checkItem.x, p.z - checkItem.z) })).sort((a, b) => a.d - b.d)[0];
    const rc = check.crusher || {};
    let cx = checkItem.x, cz = checkItem.z, face = rc.face || 's';
    if (dev && dev.d < 10) { cx = dev.p.x; cz = dev.p.z; face = dev.p.face || face; }
    else {
      props.push({ type: check.mode === 'store' ? 'inspector' : 'crusher', x: cx, z: cz, face, label: check.device || '照合装置' });
      W('照合装置の本体（inspector / crusher の置物）が近くに無い → 照合アイコンの位置に置いた');
    }
    const crtOff = rc.crt && rc.x !== undefined ? [rc.crt[0] - rc.x, rc.crt[1], rc.crt[2] - rc.z] : [1.6, 2.8, 0];
    ac.crusher = { x: cx, z: cz, face, crt: [r3(cx + crtOff[0]), crtOff[1], r3(cz + crtOff[2])], r: rc.r || 2.5 };
    if (ac.door && !def.doors.find((d) => d.id === ac.door)) ERR('照合装置の扉「' + ac.door + '」が無い');
    if (!ac.tag) ERR('照合装置に指定の番号 tag が無い');
    def.armCheck = ac;
  }
  def.props = props;

  /* --- 番号付きの腕（壊れたら補充するもの） --- */
  for (const a of def.arms.slice()) {
    const isCheck = def.armCheck && a.tag === def.armCheck.tag;
    if (!a.replenish && !isCheck) continue;
    def.arms.splice(def.arms.indexOf(a), 1);
    // 台座の上なら台の高さ、無ければ床に置く
    const ped = props.find((p) => p.type === 'pedestal' && Math.hypot(p.x - a.x, p.z - a.z) < 0.7);
    let y = a.y !== undefined ? a.y : 0.12;
    if (!ped && y > 0.5) { W('番号付きの腕「' + a.tag + '」の下に台座が無い → 床に置く'); y = 0.12; }
    const t = { tag: a.tag, label: a.label || (isCheck && def.armCheck.label) || a.tag, kind: a.kind, at: { x: a.x, z: a.z, y } };
    if (a.side) t.side = a.side;
    if (a.takenFlag) t.takenFlag = a.takenFlag;
    def.taggedArms.push(t);
  }
  if (def.armCheck && !def.taggedArms.find((t) => t.tag === def.armCheck.tag)) ERR('照合装置が求める腕「' + def.armCheck.tag + '」がマップに無い（クリアできない）');

  /* --- 戦闘：部屋（roomId）とウェーブごとにまとめる --- */
  const groups = {};
  for (const e of enemies) {
    const here = roomAtL(e.x, e.z);
    if (!here) { ERR('敵「' + e.label + '」（' + e.x + ', ' + e.z + '）が部屋・通路の外にある'); continue; }
    // 戦闘の ID：敵に書いた encounter → 部屋の「cleared:戦闘」フラグ → enc_部屋
    const roomId = e.roomId || here.id;
    if (!e.roomId) notes.push('部屋が未指定の敵「' + e.label + '」を位置から「' + here.id + '」の戦闘に入れた');
    else if (!def.spaces.find((s) => s.id === e.roomId)) notes.push('敵の部屋「' + e.roomId + '」がエディタに無い（位置は「' + here.id + '」）');
    const key = e.enc || encIdOfRoom[roomId] || ('enc_' + roomId);
    (groups[key] = groups[key] || { key, roomId, enemies: [], spaces: new Set() });
    groups[key].enemies.push(e);
    groups[key].spaces.add(here.id);
  }
  const srcEnc = {};
  for (const e of src.encounters || []) srcEnc[e.id] = e;
  for (const key of Object.keys(groups)) {
    const gr = groups[key];
    const encId = key;
    const se = srcEnc[encId] || null;
    // 戦闘の範囲：その部屋（無ければ敵がいる空間）
    let zoneSp = def.spaces.find((s) => s.id === gr.roomId);
    if (!zoneSp) {
      const cnt = {};
      for (const e of gr.enemies) { const s = roomAtL(e.x, e.z); cnt[s.id] = (cnt[s.id] || 0) + 1; }
      const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      zoneSp = def.spaces.find((s) => s.id === best);
      W('戦闘「' + encId + '」の部屋「' + gr.roomId + '」がエディタに無い → 敵が多くいる「' + zoneSp.id + '」で始まる');
    }
    const zone = zoneSp.r.slice();
    const ev = eventOf[gr.roomId] || eventOf[zoneSp.id] || null;
    const waveNums = [...new Set(gr.enemies.map((e) => e.wave))].sort((a, b) => a - b);
    const sp = (e) => { const s = [e.x, e.z, e.arms[0], e.arms[1], e.delay]; if (e.strong) s.push({ strong: true }); return s; };
    const enc = { id: uniq(encId, 'enc'), zone };
    const inset = Math.min(1.5, (zone[1] - zone[0]) / 4, (zone[3] - zone[2]) / 4);
    enc.trigger = [r3(zone[0] + inset), r3(zone[1] - inset), r3(zone[2] + inset), r3(zone[3] - inset)];
    const arena = (se && se.type === 'arena') || waveNums.length > 1;
    if (arena) {
      enc.type = 'arena';
      enc.doors = [];
      enc.waves = waveNums.map((wn) => gr.enemies.filter((e) => e.wave === wn).map(sp));
      if (!se || se.type !== 'arena') notes.push('戦闘「' + enc.id + '」はウェーブが ' + waveNums.length + ' つあるのでアリーナにした');
    } else enc.spawns = gr.enemies.map(sp);
    if (se && se.doors) enc.doors = se.doors.filter((d) => def.doors.find((q) => q.id === d) || (W('戦闘「' + enc.id + '」の扉「' + d + '」が無い'), false));
    const start = ev && ev.note ? ev.note : se && se.startLine;
    if (start) enc.startLine = start;
    if (se && se.clearLine) enc.clearLine = se.clearLine;
    const cond = ev && ev.triggerFlagId ? condFlag(ev.triggerFlagId) : se && se.cond;
    if (cond) enc.cond = cond;
    def.encounters.push(enc);
  }
  for (const id of Object.keys(srcEnc)) if (!def.encounters.find((e) => e.id === id)) notes.push('mock.source の戦闘「' + id + '」はエディタに敵がいないので使わない');

  /* --- ミッション --- */
  const encIds = new Set(def.encounters.map((e) => e.id));
  const missions = Array.isArray(src.missions) && src.missions.length ? src.missions.map((m) => Object.assign({}, m)) : null;
  if (missions) {
    for (const m of missions) {
      if (m.type === 'valves' && !def.valves.length) ERR('ミッション「' + m.id + '」（バルブ）なのにバルブが無い');
      else if (m.type === 'armCheck') { if (!def.armCheck) ERR('ミッション「' + m.id + '」（照合）なのに照合装置が無い'); if (def.armCheck && def.armCheck.parallel) m.parallel = true; }
      else if (m.type === 'arena' && !encIds.has(m.enc)) ERR('ミッション「' + m.id + '」の戦闘「' + m.enc + '」が無い');
      else if (!['valves', 'armCheck', 'arena'].includes(m.type)) ERR('ミッション「' + m.id + '」の種類「' + m.type + '」は LevelLab の取り込みでは未対応');
    }
    def.missions = missions;
  } else {
    // mock.source が無い：配置から組み立てる（バルブ → 照合（並行）→ 終点の部屋の戦闘）
    if (def.valves.length) def.missions.push({ id: 'valves', type: 'valves' });
    if (def.armCheck) def.missions.push({ id: 'armCheck', type: 'armCheck', parallel: !!def.armCheck.parallel });
    const end = (prog.rooms || []).find((r) => r.type === 'end');
    const before = end && (prog.links || []).find((l) => l.to === end.id);
    const finalEnc = before && def.encounters.find((e) => e.zone && def.spaces.find((s) => s.id === (roomMap[before.from] || before.from) && s.r[0] === e.zone[0]));
    if (finalEnc && finalEnc.type === 'arena') def.missions.push({ id: 'final', type: 'arena', enc: finalEnc.id });
  }
  // バルブを全部開けると開く扉（lockDoor）
  if (def.valves.length) {
    def.lockDoor = src.lockDoor && def.doors.find((d) => d.id === src.lockDoor) ? src.lockDoor : null;
    if (!def.lockDoor) {
      const flags = def.valves.map((v) => 'valve:' + v.id);
      const d = def.doors.find((q) => q.requires && q.requires.some((g) => flags.every((f) => g.includes(f))));
      if (d) def.lockDoor = d.id;
      else W('全バルブで開く扉（lockDoor）が分からない');
    }
  }

  // ランプ（どのバルブが開いたかを示す灯り）の位置が無いバルブ：全バルブで開く扉の上に並べる
  const lockD = def.lockDoor && def.doors.find((d) => d.id === def.lockDoor);
  def.valves.forEach((v, i) => {
    if (v.lamp || !lockD) return;
    const n = def.valves.length, off = i - (n - 1) / 2, cx = (lockD.from + lockD.to) / 2, top = (lockD.h || 2.8) + 0.7;
    const sp = spawn || { x: 0, z: 0 };
    if (lockD.axis === 'x') v.lamp = [r3(cx + off), top, r3(lockD.at + 0.2 * Math.sign((sp.z - lockD.at) || 1))];
    else v.lamp = [r3(lockD.at + 0.2 * Math.sign((sp.x - lockD.at) || 1)), top, r3(cx + off)];
    notes.push('バルブ「' + v.id + '」のランプを扉「' + lockD.id + '」の上に置いた');
  });
  // 配管が無いバルブ：ランプから天井ぞいにバルブまで引く
  for (const v of def.valves) if (!v.pipe && v.lamp) v.pipe = [[v.lamp[0], v.lamp[1], v.lamp[2]], [v.lamp[0], 3.6, v.lamp[2]], [v.x, 3.6, v.lamp[2]], [v.x, 3.6, v.z], [v.x, 1.8, v.z]];

  /* --- チェックポイント：開始地点はアイコン、ほかは mock.source（ミッションの後） --- */
  def.checkpoints.push(spawn);
  for (const c of src.checkpoints || []) {
    if (c.after === null) continue;
    if (!def.missions.find((m) => m.id === c.after)) { W('チェックポイント（' + c.after + ' の後）のミッションが無い'); continue; }
    if (!spaceAtL(c.x, c.z).length) { W('チェックポイント（' + c.after + ' の後）が部屋・通路の外 → 使わない'); continue; }
    def.checkpoints.push(Object.assign({}, c));
  }

  // 使わなかった mock.source の要素を報告
  if (hasSrc) {
    const ids = new Set(def.spaces.map((s) => s.id));
    const gone = (src.spaces || []).filter((s) => !ids.has(s.id)).map((s) => s.id);
    if (gone.length) notes.push('mock.source の空間 ' + gone.length + ' 件（' + gone.join(', ') + '）はエディタに無いので使わない');
    const dids = new Set(def.doors.map((d) => d.id));
    const dg = (src.doors || []).filter((d) => !dids.has(d.id)).map((d) => d.id);
    if (dg.length) W('mock.source の扉 ' + dg.length + ' 件（' + dg.join(', ') + '）がエディタに無い');
  }
  // 参照の確認（進行に要る扉）
  for (const v of def.valves) for (const d of (v.opens || [])) if (!def.doors.find((q) => q.id === d)) ERR('バルブ「' + v.id + '」が開く扉「' + d + '」が無い');
  // 条件が指す相手（戦闘・バルブ・ミッション）が本当にあるか。無ければ永遠に満たせない＝詰むのでエラー
  const encSet = new Set(def.encounters.map((e) => e.id)), valveSet = new Set(def.valves.map((v) => v.id)), misSet = new Set(def.missions.map((m) => m.id));
  const flagSet = new Set(def.valves.map((v) => v.flag).filter(Boolean));
  const refCheck = (c, where) => {
    if (!c) return;
    if (Array.isArray(c)) { for (const x of c) refCheck(x, where); return; }
    const i = c.indexOf(':'), k = c.slice(0, i), v = c.slice(i + 1);
    if (k === 'cleared' && !encSet.has(v)) ERR(where + 'の条件「' + c + '」：戦闘「' + v + '」が無い');
    if (k === 'valve' && !valveSet.has(v)) ERR(where + 'の条件「' + c + '」：バルブ「' + v + '」が無い');
    if ((k === 'done' || k === 'current') && !misSet.has(v)) ERR(where + 'の条件「' + c + '」：ミッション「' + v + '」が無い');
    if (k === 'flag' && !flagSet.has(v)) W(where + 'の条件「' + c + '」：フラグ「' + v + '」を立てるものが見当たらない');
  };
  for (const d of def.doors) refCheck(d.requires, '扉「' + d.id + '」');
  for (const v of def.valves) refCheck(v.cond, 'バルブ「' + v.id + '」');
  for (const e of def.encounters) refCheck(e.cond, '戦闘「' + e.id + '」');
  out.def = def;
}

// 線分（縦か横）→ 幅 w の矩形。両端は ext だけ伸ばして、つながる空間と重ねる
function levelLabSegRect(a, b, w, ext) {
  const h = w / 2;
  if (Math.abs(a.x - b.x) < 0.01) {
    const z0 = Math.min(a.z, b.z) - ext, z1 = Math.max(a.z, b.z) + ext;
    return [+(a.x - h).toFixed(3), +(a.x + h).toFixed(3), +z0.toFixed(3), +z1.toFixed(3)];
  }
  if (Math.abs(a.z - b.z) < 0.01) {
    const x0 = Math.min(a.x, b.x) - ext, x1 = Math.max(a.x, b.x) + ext;
    return [+x0.toFixed(3), +x1.toFixed(3), +(a.z - h).toFixed(3), +(a.z + h).toFixed(3)];
  }
  return null;
}
function levelLabSlug(s) {
  let t = String(s).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!t) {   // 日本語だけの題名など：文字列のハッシュ
    let h = 0;
    for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    t = 'map' + h.toString(36);
  }
  return t.slice(0, 30);
}
const LEVELLAB_CONVERTERS = { 7: convertLevelLabV7 };

/* ---------- 登録（公開・ローカル） ---------- */
const BK_LEVELLAB = window.BK_LEVELLAB = { stages: {}, reports: [], ready: null, published: [] };
function levelLabNextOrigin() {
  let x = LEVELLAB_ORIGIN_START - LEVELLAB_ORIGIN_STEP;
  for (const k of Object.keys(BK_STAGES)) { const o = BK_STAGES[k].origin; if (o && o[0] >= LEVELLAB_ORIGIN_START) x = Math.max(x, o[0]); }
  return [x + LEVELLAB_ORIGIN_STEP, 0, 0];
}
// json を変換して登録する。opts.source = 'public' | 'local'、opts.update = 同じ ID を更新してよい
function levelLabRegister(json, opts) {
  opts = opts || {};
  const local = opts.source === 'local';
  const res = levelLabConvert(json, Object.assign({}, opts, { idPrefix: local ? 'local-' : 'll-', labelPrefix: local ? '[ローカル] ' : '' }));
  const report = { file: opts.file || null, source: opts.source || 'public', id: res.id, ok: false, errors: res.errors, warnings: res.warnings, notes: res.notes };
  BK_LEVELLAB.reports.push(report);
  for (const w of res.warnings) console.warn('[LevelLab ' + (res.id || opts.file) + '] ' + w);
  if (!res.ok) { for (const e of res.errors) console.error('[LevelLab ' + (res.id || opts.file) + '] ' + e); return report; }
  const cur = BK_STAGES[res.id];
  res.def.origin = cur && cur.levellab ? cur.origin.slice() : levelLabNextOrigin();
  res.def.version = cur && cur.version ? cur.version + 1 : 1;
  if (cur && !cur.levellab) { report.errors.push('ID「' + res.id + '」は同梱のステージと同じ'); console.error('[LevelLab] ' + report.errors[0]); return report; }
  const r = BK_registerStage(res.def, { update: !!(cur && opts.update) });
  report.ok = r.ok;
  if (!r.ok) for (const e of r.errors) report.errors.push(e === 'duplicate' ? 'ID「' + res.id + '」は既に登録されている（更新するには読み込み直しを選ぶ）' : e);
  else BK_LEVELLAB.stages[res.id] = { source: report.source, file: report.file, report };
  return report;
}
// 公開ステージ（maps/*.js）から呼ばれる
function BK_publishLevelLab(file, json) {
  BK_LEVELLAB.published.push(file);
  return levelLabRegister(json, { source: 'public', file });
}
window.BK_publishLevelLab = BK_publishLevelLab;

/* ---------- ローカル取り込み（このブラウザだけ） ---------- */
function levelLabLocalStore() {
  try { const s = JSON.parse(localStorage.getItem(LEVELLAB_LOCAL_KEY) || '{}'); return s && typeof s === 'object' ? s : {}; }
  catch (e) { console.warn('[LevelLab] ローカルのマップを読めません', e); return {}; }
}
function levelLabLocalSave(st) {
  try { localStorage.setItem(LEVELLAB_LOCAL_KEY, JSON.stringify(st)); return true; }
  catch (e) { console.warn('[LevelLab] ローカルのマップを保存できません', e); return false; }
}
// 文字列の JSON を取り込む。同じマップ（同じ ID）は更新になる
function levelLabImportText(text, file) {
  let json;
  try { json = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON として読めない：' + e.message], warnings: [], notes: [] }; }
  const report = levelLabRegister(json, { source: 'local', file, update: true });
  if (report.ok) {
    const st = levelLabLocalStore();
    st[report.id] = { file, text, at: Date.now() };
    levelLabLocalSave(st);
  }
  return report;
}
function levelLabRemoveLocal(id) {
  const st = levelLabLocalStore();
  delete st[id];
  levelLabLocalSave(st);
  if (BK_STAGES[id] && BK_STAGES[id].levellab && BK_STAGES[id].levellab.source === 'local') delete BK_STAGES[id];
  delete BK_LEVELLAB.stages[id];
}
// 起動時：保存してあるローカルのマップを登録し直す
function levelLabRestoreLocal() {
  const st = levelLabLocalStore();
  for (const id of Object.keys(st)) {
    try { levelLabRegister(JSON.parse(st[id].text), { source: 'local', file: st[id].file }); }
    catch (e) { console.warn('[LevelLab] ローカルのマップ ' + id + ' を読めません', e); }
  }
}
// 受付から：ファイルを選ぶ（キー入力の中で呼ぶので、ブラウザがファイル選択を開ける）
let levelLabInput = null;
function levelLabPickFile() {
  if (!levelLabInput) {
    levelLabInput = document.createElement('input');
    levelLabInput.type = 'file';
    levelLabInput.accept = '.json,application/json';
    levelLabInput.style.display = 'none';
    levelLabInput.addEventListener('change', () => {
      const f = levelLabInput.files && levelLabInput.files[0];
      levelLabInput.value = '';
      if (f) levelLabReadFile(f);
    });
    document.body.appendChild(levelLabInput);
  }
  levelLabInput.click();
}
function levelLabReadFile(f) {
  const rd = new FileReader();
  rd.onload = () => levelLabShowResult(levelLabImportText(String(rd.result), f.name));
  rd.onerror = () => levelLabShowResult({ ok: false, errors: ['ファイルを読めない'], warnings: [], notes: [] });
  rd.readAsText(f);
}
// 結果：成功なら受付の一覧に出る。警告・エラーは字幕とコンソール、結果の画面（BK_LEVELLAB.lastReport）に残す
function levelLabShowResult(rep) {
  BK_LEVELLAB.lastReport = rep;
  levelLabRenderReport(rep);
  if (rep.ok) {
    const st = BK_STAGES[rep.id];
    say('受付研究員：' + st.title + ' を登録しました。' + (rep.warnings.length ? '（注意 ' + rep.warnings.length + ' 件）' : ''), 4.0);
    if (STG.area === rep.id) stageMsg('現在の区画の更新は、入り直したときに反映されます。', 3.0);
  } else say('受付研究員：読み込めませんでした。' + (rep.errors[0] || ''), 4.5);
}
// 取り込みの報告（右上の小さな一覧。クリックか数秒で閉じる）
function levelLabRenderReport(rep) {
  let el = document.getElementById('llReport');
  if (!el) {
    el = document.createElement('div');
    el.id = 'llReport';
    el.addEventListener('click', () => el.classList.add('hidden'));
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  const h = document.createElement('b');
  h.textContent = (rep.ok ? '登録：' : '読み込めない：') + (rep.id || rep.file || '');
  el.appendChild(h);
  const add = (cls, list) => { for (const t of list.slice(0, 8)) { const d = document.createElement('div'); d.className = cls; d.textContent = t; el.appendChild(d); } if (list.length > 8) { const d = document.createElement('div'); d.className = cls; d.textContent = '…ほか ' + (list.length - 8) + ' 件（コンソール）'; el.appendChild(d); } };
  add('e', rep.errors || []); add('w', rep.warnings || []);
  el.classList.remove('hidden');
  clearTimeout(levelLabRenderReport.t);
  levelLabRenderReport.t = setTimeout(() => el.classList.add('hidden'), rep.ok && !(rep.warnings || []).length ? 4000 : 12000);
}
// 画面へ JSON をドロップしても取り込める
window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f || !/\.json$/i.test(f.name)) return;
  e.preventDefault();
  levelLabReadFile(f);
});

/* ---------- 公開ステージの読み込み（maps/manifest.js の一覧） ---------- */
// 一覧の順に maps/ のファイルを足す。file:// でも動くよう、JSON ではなく JS で包んだファイルを script で読む
BK_LEVELLAB.ready = new Promise((resolve) => {
  const list = Array.isArray(window.BK_PUBLIC_MAPS) ? window.BK_PUBLIC_MAPS : [];
  const v = window.BK_ASSET_V || '';
  let i = 0;
  const next = () => {
    if (i >= list.length) { levelLabRestoreLocal(); resolve(BK_LEVELLAB); return; }
    const f = list[i++];
    const s = document.createElement('script');
    s.src = 'maps/' + f + (v ? '?v=' + v : '');
    s.onload = next;
    s.onerror = () => { console.error('[LevelLab] 公開マップ maps/' + f + ' を読めません'); BK_LEVELLAB.reports.push({ file: f, ok: false, errors: ['ファイルを読めない'], warnings: [], notes: [] }); next(); };
    document.head.appendChild(s);
  };
  next();
});
