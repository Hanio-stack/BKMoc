'use strict';
/* =========================================================
   BK アップグレード（main.js / stage.js の後に読む）

   ・XP        敵を倒すと入る（1体につき1回）。セーフルームのアップグレード台で使う
   ・購入品    ジェットパック（頭モードの飛行）／目からビーム／こめかみバルカン
   ・頭スキル  ビームとバルカンは「HEAD SKILL」。E長押しで発動。装備枠は1つ（台で選ぶ・切り替えは無料）
   ・チップ    ステージに落ちている。最大2枚装備（アドレナリン／オキシトシン／セロトニン）
   ・保存      プレイヤーの永続データ（XP・購入品・装備・回収済みアイテム）。
               ステージの進行（STG.prog）や resetAll() とは別に localStorage へ保存する

   数値は UPG_CFG、品目は UPG_SHOP / CHIP_DEFS に集めてある。
   main.js / stage.js から呼ぶ入口：
     upgOnEnemyKilled(en)  敵が倒れた（killEnemy / bossDefeated）
     upgSkillKey(down)     E の押下と解放
     upgKeyHook(e)         アップグレード台を開いているあいだのキー
     upgUpdate(dt, rdt)    毎フレーム
     upgCameraHook(rdt)    カメラを決めたあと（アップグレード台の専用カメラ）
     upgOnHeadJump()       頭モードのジャンプ（ジェットパックの準備）
     upgHeadThrust(dt)     頭モードの上下の速度に足す分（ジェットパック）
     upgAttackMul() / upgMoveMul() / upgDamageTakenMul() / upgArmBreakSave(side)  チップの効果
     upgBenchOpen() / upgHidesHands()
   デバッグ用（コンソール）：BKUpg.grant(n) / BKUpg.dump() / BKUpg.reset() / BKUpg.setRng(fn)
   ========================================================= */

const UPG_CFG = {
  // 敵を倒したときの XP（種類ごと）
  xp: { normal: 250, strong: 600, boss: 3000 },
  jet: {
    fuel: 1.5,            // 連続で飛べる時間(s)
    recharge: 2.2,        // 空から満タンまで(s)。地面にいるあいだだけ回復する
    thrust: 74,           // 上向きの加速(m/s^2)。頭の重力（52〜78）に勝つ
    maxRise: 4.2,         // 上昇の最高速度(m/s)
    armDelay: 0.16,       // ジャンプしてから長押しが飛行に変わるまで(s)
    ceiling: 4.2,         // ステージ外での最高高度(m)。ステージでは部屋の天井の 0.45m 下まで
  },
  beam: {
    maxTime: 2.6,         // 1回に照射できる時間(s)
    dps: 90,              // 敵 HP へのダメージ(/s)
    range: 22,            // 射程(m)
    cooldown: 30,         // 照射が終わってから次まで(s)
  },
  vulcan: {
    interval: 0.075,      // 発射間隔(s)。左右交互
    range: 20,            // 射程(m)
    stun: 5,              // 1発で敵のスタン値に入る量（HP は減らない）
    spread: 0.014,        // ばらつき(rad)
  },
  chips: {
    adrenaline: { maxMul: 1.8 },                       // 体・腕の HP が0に近いほど攻撃力が最大この倍率
    oxytocin: { speedMul: 1.3, damageTakenMul: 1.5 },  // 移動速度と被ダメージ
    serotonin: { chance: 0.35 },                       // 腕が壊れるときに回避して HP 全回復する確率
  },
  chipSlots: 2,
  installTime: 1.7,       // 購入品の装着演出(s)
  chipTime: 1.1,          // チップの抜き差しの演出(s)
};

const UPG_SHOP = [
  { id: 'jetpack', name: 'ジェットパック', price: 10000, kind: 'move',
    desc: ['頭モードでジャンプ後、Space長押しで飛行', '燃料は地上で回復'] },
  { id: 'beam', name: '目からビーム', price: 15000, kind: 'skill',
    desc: ['E長押しで両目から照射（敵HPにダメージ）', '照射後クールタイム30秒'] },
  { id: 'vulcan', name: 'こめかみバルカン', price: 15000, kind: 'skill',
    desc: ['E長押しで左右から連射', '敵のスタン値を蓄積させる（HPは減らない）'] },
];
const CHIP_DEFS = {
  adrenaline: { name: 'アドレナリン', color: 0xd8402c, desc: ['体・腕のHPが低いほど', '攻撃力が上がる'] },
  oxytocin: { name: 'オキシトシン', color: 0x3c8ad0, desc: ['移動速度が上がる', '被ダメージが増える'] },
  serotonin: { name: 'セロトニン', color: 0x3cb070, desc: ['腕が壊れるとき一定確率で', '破損を防いでHP全回復'] },
};

/* ---------- 保存 ---------- */
const UPG_SAVE_KEY = 'bk.player';
const UPG_SAVE_VERSION = 1;
function upgDefaultSave() {
  return { version: UPG_SAVE_VERSION, xp: 0, totalXp: 0, owned: {}, headSkill: null,
    chipsOwned: [], chipsEquipped: [null, null], collected: {} };
}
// 不正な値は捨てて既定値に置き換える（壊れたセーブでも起動できるように）
function upgSanitize(d) {
  const s = upgDefaultSave();
  if (!d || typeof d !== 'object') return s;
  const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : 0;
  s.xp = num(d.xp); s.totalXp = Math.max(num(d.totalXp), s.xp);
  if (d.owned && typeof d.owned === 'object') for (const it of UPG_SHOP) if (d.owned[it.id] === true) s.owned[it.id] = true;
  if ((d.headSkill === 'beam' || d.headSkill === 'vulcan') && s.owned[d.headSkill]) s.headSkill = d.headSkill;
  if (Array.isArray(d.chipsOwned)) s.chipsOwned = [...new Set(d.chipsOwned.filter((c) => CHIP_DEFS[c]))];
  if (Array.isArray(d.chipsEquipped)) {
    for (let i = 0; i < UPG_CFG.chipSlots; i++) {
      const c = d.chipsEquipped[i];
      if (c && s.chipsOwned.includes(c) && !s.chipsEquipped.includes(c)) s.chipsEquipped[i] = c;
    }
  }
  if (d.collected && typeof d.collected === 'object') {
    for (const k of Object.keys(d.collected)) {
      if (Array.isArray(d.collected[k])) s.collected[k] = d.collected[k].filter((x) => typeof x === 'string');
    }
  }
  return s;
}
function upgLoad() {
  let raw = null;
  try { raw = localStorage.getItem(UPG_SAVE_KEY); } catch (e) { console.warn('[BK] セーブを読めません（localStorage 不可）', e); return upgDefaultSave(); }
  if (!raw) return upgDefaultSave();
  try {
    const d = JSON.parse(raw);
    if (!d || d.version !== UPG_SAVE_VERSION) console.warn('[BK] セーブの版が違うため読み替えます', d && d.version);
    return upgSanitize(d);
  } catch (e) {
    console.warn('[BK] セーブが壊れているため初期化します', e);
    return upgDefaultSave();
  }
}
function upgSave() {
  try { localStorage.setItem(UPG_SAVE_KEY, JSON.stringify(UPG.save)); }
  catch (e) { console.warn('[BK] セーブを書けません', e); }
}

/* ---------- 実行時の状態 ---------- */
const UPG = {
  save: upgLoad(),
  rng: Math.random,          // セロトニンの抽選（テストで差し替えられる）
  eHeld: false,
  beam: { on: false, t: 0, cd: 0, target: null, fx: null },
  vulcan: { on: false, t: 0, side: 0, shots: 0, fx: null },
  jet: { fuel: UPG_CFG.jet.fuel, armedAt: -1, flying: false, fx: null },
  bench: null,               // アップグレード台を開いているあいだ { view, tab, idx, ... }
  benchProp: null,           // セーフルームに置いた台（見た目）
  toastT: 0,
  t: 0,
};

/* ---------- XP ---------- */
function upgEnemyType(en) { return en.boss ? 'boss' : en.strong ? 'strong' : 'normal'; }
// 敵が倒れた（1体につき1回だけ。生き返らせるときは en.xpPaid を false に戻す）
function upgOnEnemyKilled(en) {
  if (!en || en.xpPaid) return;
  en.xpPaid = true;
  const gain = UPG_CFG.xp[upgEnemyType(en)] || 0;
  if (gain <= 0) return;
  UPG.save.xp += gain;
  UPG.save.totalXp += gain;
  upgSave();
  upgToast('+' + gain.toLocaleString() + ' XP', UPG.save.xp.toLocaleString() + ' XP');
}
function upgOwned(id) { return !!UPG.save.owned[id]; }
// 購入。XP が足りない・買ってある・演出中は何もしない（連打しても二重に払わない）
function upgBuy(id) {
  const it = UPG_SHOP.find((q) => q.id === id);
  if (!it) return 'none';
  if (upgOwned(id)) return 'owned';
  if (UPG.save.xp < it.price) return 'short';
  UPG.save.xp -= it.price;
  UPG.save.owned[id] = true;
  // 頭スキルを初めて買ったら、空いていれば E に割り当てる
  if (it.kind === 'skill' && !UPG.save.headSkill) UPG.save.headSkill = id;
  upgSave();
  return 'ok';
}
function upgAssignSkill(id) {
  if (id !== null && !upgOwned(id)) return false;
  UPG.save.headSkill = id;
  upgSave();
  return true;
}

/* ---------- チップ ---------- */
function upgChipEquipped(id) { return UPG.save.chipsEquipped.includes(id); }
function upgEquipChip(id) {
  const s = UPG.save;
  if (!s.chipsOwned.includes(id)) return 'none';
  if (s.chipsEquipped.includes(id)) return 'already';
  const i = s.chipsEquipped.indexOf(null);
  if (i < 0) return 'full';
  s.chipsEquipped[i] = id;
  upgSave();
  return 'ok';
}
function upgUnequipChip(id) {
  const s = UPG.save, i = s.chipsEquipped.indexOf(id);
  if (i < 0) return false;
  s.chipsEquipped[i] = null;
  upgSave();
  return true;
}
// 体・腕の HP が低いほど上がる攻撃の倍率
function upgAttackMul() {
  if (!upgChipEquipped('adrenaline')) return 1;
  const maxHp = CONFIG.playerMaxHp || 100, armHp = CONFIG.armMaxHp || 100;
  const body = Math.max(0, Math.min(1, (player.hp || 0) / maxHp));
  let arms = 0;
  if (state !== S.HEAD) for (const s of ['LEFT', 'RIGHT']) {
    const a = player.arms[s];
    arms += (!a || a.lost) ? 0 : Math.max(0, Math.min(1, a.hp / armHp));
  }
  const health = state === S.HEAD ? body : (body + arms / 2) / 2;
  const k = 1 - health;
  const mul = 1 + (UPG_CFG.chips.adrenaline.maxMul - 1) * k;
  return isFinite(mul) ? mul : 1;
}
function upgMoveMul() { return upgChipEquipped('oxytocin') ? UPG_CFG.chips.oxytocin.speedMul : 1; }
function upgDamageTakenMul() { return upgChipEquipped('oxytocin') ? UPG_CFG.chips.oxytocin.damageTakenMul : 1; }
// 腕が壊れる瞬間（HP0）。セロトニンが当たれば壊れずに全回復する。1回の破損につき1回だけ抽選
function upgArmBreakSave(side) {
  if (!upgChipEquipped('serotonin')) return false;
  const roll = UPG.rng();
  if (!(roll < UPG_CFG.chips.serotonin.chance)) return false;
  const a = player.arms[side];
  a.hp = CONFIG.armMaxHp;
  addShake(0.2);
  doFlash(0.3, '#7cf0b0');
  upgTone([520, 880], 0.18, 'triangle', 0.08);
  upgToast('セロトニン', (side === 'LEFT' ? '左腕' : '右腕') + 'の破損を回避');
  UPG.serotoninCount = (UPG.serotoninCount || 0) + 1;
  return true;
}
// ステージに置いたチップを回収する（ステージID＋アイテムIDで1回だけ）
function upgChipCollected(stageId, itemId) {
  const c = UPG.save.collected[stageId];
  return !!(c && c.includes(itemId));
}
function upgCollectChip(stageId, itemId, chip) {
  if (upgChipCollected(stageId, itemId) || !CHIP_DEFS[chip]) return false;
  (UPG.save.collected[stageId] = UPG.save.collected[stageId] || []).push(itemId);
  if (!UPG.save.chipsOwned.includes(chip)) UPG.save.chipsOwned.push(chip);
  upgSave();
  upgTone([660, 990, 1320], 0.09, 'square', 0.05);
  upgToast('チップ回収', CHIP_DEFS[chip].name);
  return true;
}

// ステージに置くチップ（stage.js の buildGimmicks から）。小さな台の上で回る基板。回収済みなら出さない
// データ：chips: [{ id: 'chip-xxx', chip: 'adrenaline', x, z }]（id はステージの中で一意）
function upgBuildChips(L) {
  L.chipPickups = [];
  const seen = new Set();
  for (const d of (L.def.chips || [])) {
    if (!CHIP_DEFS[d.chip]) { console.warn('[BK] 不明なチップ', L.def.id, d); continue; }
    if (!d.id || seen.has(d.id)) { console.warn('[BK] チップの id が無い／重複', L.def.id, d); continue; }
    seen.add(d.id);
    const x = L.X(d.x), z = L.Z(d.z);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.82, 10), upgMat(0x4a4e50));
    ped.position.y = 0.41; g.add(ped);
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), upgMat(0x2e3032));
    tray.position.y = 0.84; g.add(tray);
    const chip = new THREE.Group();
    chip.position.y = 1.02;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), upgMat(CHIP_DEFS[d.chip].color));
    chip.add(board);
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), upgMat(0x1a1a1a));
    die.position.z = 0.012; chip.add(die);
    for (let k = -2; k <= 2; k++) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.022), upgMat(0xd8b860));
      pin.position.set(k * 0.03, -0.12, 0); chip.add(pin);
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: CHIP_DEFS[d.chip].color, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    chip.add(glow);
    g.add(chip);
    L.group.add(g);
    L.fixtures.push({ pos: new THREE.Vector3(x, 1.6, z), tone: 'green' });
    L.chipPickups.push({ id: d.id, chip: d.chip, g, spin: chip, pos: new THREE.Vector3(x, 1.0, z) });
  }
}
function upgUpdateChips(rdt) {
  if (typeof STG === 'undefined' || !STG.L || !STG.L.chipPickups) return;
  for (const ck of STG.L.chipPickups) {
    const got = upgChipCollected(STG.def.id, ck.id);
    ck.g.visible = !got;
    if (!got) { ck.spin.rotation.y += rdt * 1.6; ck.spin.position.y = 1.02 + Math.sin(UPG.t * 2.2) * 0.03; }
  }
}

/* ---------- HUD（XP の通知・頭スキル・燃料） ---------- */
const upgUi = (() => {
  const root = document.createElement('div');
  root.id = 'upgHud';
  root.innerHTML = '<div id="upgToast" class="hidden"><b></b><span></span></div>' +
    '<div id="upgSkill" class="hidden"><i></i><b>E</b><span></span></div>' +
    '<div id="upgJet" class="hidden"><i></i></div>';
  document.body.appendChild(root);
  const panel = document.createElement('div');
  panel.id = 'upgPanel';
  panel.className = 'hidden';
  panel.innerHTML = '<div class="crt"><div class="hd"><span class="ttl">頭部改造装置 BK-7</span><span class="xp"></span></div>' +
    '<div class="tabs"></div><div class="body"><ul class="list"></ul><div class="info"></div></div>' +
    '<div class="msg"></div><div class="bar"><i></i></div><div class="keys">A/D 画面　W/S 選択　F 決定　Q 戻る</div></div>';
  document.body.appendChild(panel);
  return {
    toast: root.querySelector('#upgToast'), skill: root.querySelector('#upgSkill'), jet: root.querySelector('#upgJet'),
    panel, xp: panel.querySelector('.xp'), tabs: panel.querySelector('.tabs'), list: panel.querySelector('.list'),
    info: panel.querySelector('.info'), msg: panel.querySelector('.msg'), bar: panel.querySelector('.bar'),
  };
})();
function upgToast(a, b) {
  upgUi.toast.querySelector('b').textContent = a;
  upgUi.toast.querySelector('span').textContent = b || '';
  upgUi.toast.classList.remove('hidden');
  UPG.toastT = 2.4;
}
function upgUpdateHud(rdt) {
  if (UPG.toastT > 0) { UPG.toastT -= rdt; if (UPG.toastT <= 0) upgUi.toast.classList.add('hidden'); }
  const sk = UPG.save.headSkill;
  const showSkill = !!sk && !UPG.bench && typeof STG !== 'undefined';
  upgUi.skill.classList.toggle('hidden', !showSkill);
  if (showSkill) {
    const it = UPG_SHOP.find((q) => q.id === sk);
    let txt = it.name, fill = 1;
    if (sk === 'beam') {
      if (UPG.beam.on) { fill = 1 - UPG.beam.t / UPG_CFG.beam.maxTime; txt += ' 照射中'; }
      else if (UPG.beam.cd > 0) { fill = 1 - UPG.beam.cd / UPG_CFG.beam.cooldown; txt += ' ' + Math.ceil(UPG.beam.cd) + 's'; }
    } else if (UPG.vulcan.on) txt += ' 連射中';
    upgUi.skill.querySelector('span').textContent = txt;
    upgUi.skill.querySelector('i').style.width = (Math.max(0, Math.min(1, fill)) * 100) + '%';
    upgUi.skill.classList.toggle('cool', sk === 'beam' && UPG.beam.cd > 0);
  }
  const showJet = upgOwned('jetpack') && state === S.HEAD && !UPG.bench;
  upgUi.jet.classList.toggle('hidden', !showJet);
  if (showJet) upgUi.jet.querySelector('i').style.height = (UPG.jet.fuel / UPG_CFG.jet.fuel * 100) + '%';
}

/* ---------- 効果音（短い合成音） ---------- */
function upgTone(freqs, dur, type, vol) {
  const ac = typeof audioCtx !== 'undefined' ? audioCtx : null;
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime;
  freqs.forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0 + i * dur * 0.6);
    g.gain.setValueAtTime(vol || 0.06, t0 + i * dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur * 0.6 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t0 + i * dur * 0.6); o.stop(t0 + i * dur * 0.6 + dur + 0.02);
  });
}

/* =========================================================
   頭スキル（E長押し）
   ========================================================= */
function upgSkillKey(down) { UPG.eHeld = !!down; }
// 使える状態か（死亡中・メニュー・会話・暗転・搬送中・乗っ取り中・台の操作中は使えない）
function upgCanUseSkill() {
  if (!locked() || manualOpen || UPG.bench) return false;
  if (typeof STG !== 'undefined' && (STG.dialog || STG.fade || STG.dead > 0 || STG.busy)) return false;
  if (player.hp <= 0 || headDead || possess) return false;
  return state === S.HUMAN || state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT || state === S.HEAD;
}
const _uF = new THREE.Vector3(), _uR = new THREE.Vector3(), _uU = new THREE.Vector3(), _uA = new THREE.Vector3(), _uB = new THREE.Vector3();
// 照準の向き（カメラの正面）と、右・上
function upgAimBasis() {
  camera.getWorldDirection(_uF);
  _uR.set(-_uF.z, 0, _uF.x).normalize();
  _uU.crossVectors(_uR, _uF).normalize();
}
// 目（とこめかみ）の位置。人間・ライジングは一人称なので視線の少し下、頭モードは頭の球の表面
function upgEyePoint(side, temple, out) {
  const sx = side < 0 ? -1 : 1;
  if (state === S.HEAD) {
    const f = _uA.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const r = _uB.set(-f.z, 0, f.x);
    out.copy(headPos).addScaledVector(f, temple ? 0.04 : 0.2).addScaledVector(r, sx * (temple ? 0.27 : 0.08));
    out.y += temple ? 0.06 : 0.05;
  } else {
    out.copy(camera.position).addScaledVector(_uF, temple ? 0.55 : 0.25).addScaledVector(_uR, sx * (temple ? 0.34 : 0.09)).addScaledVector(_uU, temple ? 0.02 : -0.16);
  }
  return out;
}
// 光線と敵の当たり（足元から頭までの縦の円柱で近似）。一番近い敵と距離
function upgRayEnemy(from, dir, range) {
  let best = null, bd = range;
  for (const en of enemies) {
    if (en.state === E.DEAD || en.state === E.HIDDEN || !en.group.visible) continue;
    const p = en.group.position;
    // 水平面での最接近
    const dx = p.x - from.x, dz = p.z - from.z;
    const hl = Math.hypot(dir.x, dir.z) || 1e-6;
    const t = (dx * dir.x + dz * dir.z) / (hl * hl);
    if (t < 0 || t > bd) continue;
    const cx = from.x + dir.x * t, cz = from.z + dir.z * t;
    const r = en.boss ? 0.7 : 0.5;
    if (Math.hypot(p.x - cx, p.z - cz) > r) continue;
    const y = from.y + dir.y * t;
    if (y < p.y - 0.1 || y > p.y + 2.35) continue;
    bd = t; best = en;
  }
  return best ? { en: best, d: bd } : null;
}
// ステージでは壁で止める（歩けない所に入ったら終わり）
function upgRayWall(from, dir, range) {
  if (typeof STG === 'undefined' || !STG.L || typeof stageWalkable !== 'function') return range;
  for (let d = 0.4; d < range; d += 0.3) {
    const x = from.x + dir.x * d, z = from.z + dir.z * d, y = from.y + dir.y * d;
    if (y < -0.2) return d;
    if (!stageWalkable(x, z, true) && !stageWalkable(x, z, false)) return d;
  }
  return range;
}

/* --- ビームの見た目：両目から伸びる赤い光（外側の淡い光と芯） --- */
function upgBeamFx() {
  if (UPG.beam.fx) return UPG.beam.fx;
  const mk = (r, color, op) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.frustumCulled = false;
    m.visible = false;
    scene.add(m);
    return m;
  };
  const fx = { outer: [mk(0.045, 0xff3a1a, 0.55), mk(0.045, 0xff3a1a, 0.55)], core: [mk(0.014, 0xfff0d0, 0.95), mk(0.014, 0xfff0d0, 0.95)],
    hit: new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })),
    eye: [] };
  fx.hit.visible = false; scene.add(fx.hit);
  UPG.beam.fx = fx;
  return fx;
}
function upgPlaceRod(m, a, b) {
  const len = a.distanceTo(b);
  m.position.copy(a).lerp(b, 0.5);
  m.scale.set(1, Math.max(0.001, len), 1);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _uA.copy(b).sub(a).normalize());
  m.visible = true;
}
function upgHideBeam() {
  const fx = UPG.beam.fx;
  if (!fx) return;
  for (const m of fx.outer.concat(fx.core)) m.visible = false;
  fx.hit.visible = false;
}
function upgUpdateBeam(dt, rdt) {
  const b = UPG.beam;
  if (b.cd > 0) b.cd = Math.max(0, b.cd - dt);
  const want = UPG.save.headSkill === 'beam' && UPG.eHeld && upgCanUseSkill();
  if (!b.on && want && b.cd <= 0 && !b.spent) { b.on = true; b.t = 0; b.hits = 0; upgTone([180, 140], 0.4, 'sawtooth', 0.05); }
  if (!UPG.eHeld) b.spent = false;                  // 押しなおすまで次は出ない（長押しのまま連続照射しない）
  if (b.on && (!want || b.t >= UPG_CFG.beam.maxTime)) {
    b.on = false; b.cd = UPG_CFG.beam.cooldown; b.spent = true;
    upgHideBeam();
  }
  if (!b.on) return;
  b.t += dt;
  upgAimBasis();
  const from = camera.position.clone();
  const dir = _uF.clone();
  const wall = upgRayWall(from, dir, UPG_CFG.beam.range);
  const hit = upgRayEnemy(from, dir, wall);
  const dist = hit ? hit.d : wall;
  const end = from.clone().addScaledVector(dir, dist);
  if (hit) {
    applyDamage(hit.en, UPG_CFG.beam.dps * dt);
    b.hits += UPG_CFG.beam.dps * dt;
    b.target = hit.en;
  } else b.target = null;
  const fx = upgBeamFx();
  const jit = 1 + Math.sin(UPG.t * 60) * 0.18;
  for (let i = 0; i < 2; i++) {
    const eye = upgEyePoint(i === 0 ? -1 : 1, false, new THREE.Vector3());
    upgPlaceRod(fx.outer[i], eye, end); fx.outer[i].scale.x = fx.outer[i].scale.z = jit;
    upgPlaceRod(fx.core[i], eye, end);
  }
  fx.hit.position.copy(end);
  fx.hit.visible = true;
  fx.hit.scale.setScalar(hit ? 1.4 + Math.random() * 0.4 : 0.8);
  if (hit && Math.random() < 0.3) spawnFleshBurst(end, 1, 1.2, null, 0.6);
}

/* --- バルカン：こめかみの小型銃から交互に撃つ。当たるとスタン値だけが増える --- */
function upgVulcanFx() {
  if (UPG.vulcan.fx) return UPG.vulcan.fx;
  const fx = { tracers: [], flashes: [], i: 0 };
  for (let k = 0; k < 18; k++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.visible = false; m.frustumCulled = false; scene.add(m);
    fx.tracers.push({ m, life: 0 });
  }
  for (let k = 0; k < 2; k++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.visible = false; scene.add(f);
    fx.flashes.push({ m: f, life: 0 });
  }
  UPG.vulcan.fx = fx;
  return fx;
}
function upgUpdateVulcan(dt, rdt) {
  const v = UPG.vulcan;
  const fx = upgVulcanFx();
  for (const t of fx.tracers) if (t.life > 0) { t.life -= rdt; if (t.life <= 0) t.m.visible = false; else t.m.material.opacity = t.life / 0.07; }
  for (const f of fx.flashes) if (f.life > 0) { f.life -= rdt; if (f.life <= 0) f.m.visible = false; }
  const want = UPG.save.headSkill === 'vulcan' && UPG.eHeld && upgCanUseSkill();
  v.on = want;
  if (!want) { v.t = 0; return; }
  v.t -= dt;
  while (v.t <= 0) {
    v.t += UPG_CFG.vulcan.interval;
    upgAimBasis();
    const side = (v.side++ % 2) ? 1 : -1;
    const muzzle = upgEyePoint(side, true, new THREE.Vector3());
    const dir = _uF.clone();
    dir.addScaledVector(_uR, (Math.random() - 0.5) * 2 * UPG_CFG.vulcan.spread).addScaledVector(_uU, (Math.random() - 0.5) * 2 * UPG_CFG.vulcan.spread).normalize();
    const from = camera.position;
    const wall = upgRayWall(from, dir, UPG_CFG.vulcan.range);
    const hit = upgRayEnemy(from, dir, wall);
    const end = from.clone().addScaledVector(dir, hit ? hit.d : wall);
    if (hit) {
      applyStun(hit.en, UPG_CFG.vulcan.stun);
      hit.en.hitFlash = 0.06;
      v.stunDealt = (v.stunDealt || 0) + UPG_CFG.vulcan.stun;
    }
    v.shots++;
    const tr = fx.tracers[fx.i++ % fx.tracers.length];
    upgPlaceRod(tr.m, muzzle, end); tr.life = 0.07;
    const fl = fx.flashes[side < 0 ? 0 : 1];
    fl.m.position.copy(muzzle); fl.m.visible = true; fl.life = 0.04;
    fl.m.scale.setScalar((state === S.HEAD ? 0.8 : 0.3) * (0.8 + Math.random() * 0.6));   // 一人称では目の前なので小さく
    upgTone([1400 + Math.random() * 200], 0.03, 'square', 0.02);
  }
}

/* =========================================================
   ジェットパック（頭モードのみ）
   ========================================================= */
function upgOnHeadJump() { if (upgOwned('jetpack')) UPG.jet.armedAt = UPG.t; }
// updateHeadMode から毎フレーム呼ぶ。頭の上下の速度への加算と、天井の制限
function upgHeadThrust(dt) {
  const j = UPG.jet, c = UPG_CFG.jet;
  j.flying = false;
  if (!upgOwned('jetpack') || headDead || state !== S.HEAD) return;
  if (headGrounded) { j.armedAt = j.armedAt === UPG.t ? j.armedAt : -1; j.used = false; j.fuel = Math.min(c.fuel, j.fuel + dt * c.fuel / c.recharge); }
  const armed = j.armedAt >= 0 && UPG.t - j.armedAt >= c.armDelay;
  if (armed && keys.Space && !headGrounded && j.fuel > 0 && locked() && !UPG.bench) {
    j.flying = true; j.used = true;
    j.fuel = Math.max(0, j.fuel - dt);
    headVy = Math.min(c.maxRise, headVy + (c.thrust + (headVy > 0 ? CONFIG.headGravity : CONFIG.headFallGravity)) * dt);
  }
  // 天井（ステージでは今いる部屋の天井の少し下）。普通のジャンプは今までどおりなので、飛んだときだけ効かせる
  if (!j.used) return;
  let ceil = c.ceiling;
  if (typeof STG !== 'undefined' && STG.L) {
    const sp = STG.L.spaces.find((s) => s.type !== 'view' && inR(s, playerPos.x, playerPos.z));
    if (sp && sp.h) ceil = Math.min(ceil + 3, (sp.fy || 0) + sp.h - 0.45);
  }
  if (headH > ceil) { headH = ceil; if (headVy > 0) headVy = 0; }
}
function upgJetFx() {
  if (UPG.jet.fx) return UPG.jet.fx;
  const g = upgMakeJetpack(1);
  headMesh.add(g);
  UPG.jet.fx = g;
  return g;
}

/* =========================================================
   頭に付く部品の見た目（ステージの頭・アップグレード台の頭で共用）
   頭の球は半径 0.24。前は -z
   ========================================================= */
function upgMat(c) { return new THREE.MeshLambertMaterial({ color: c }); }
function upgMakeJetpack(s) {
  const g = new THREE.Group();
  g.name = 'jetpack';
  for (const sx of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), upgMat(0x7a8088));
    tank.position.set(sx * 0.1, -0.08, 0.24);
    g.add(tank);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), upgMat(0x8a9098));
    cap.position.set(sx * 0.1, 0.03, 0.24); g.add(cap);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.06, 8), upgMat(0x2a2a2a));
    noz.position.set(sx * 0.1, -0.22, 0.24); g.add(noz);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.rotation.x = Math.PI; flame.position.set(sx * 0.1, -0.38, 0.24); flame.visible = false; flame.name = 'flame';
    g.add(flame);
  }
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.05), upgMat(0x3a3430));
  strap.position.set(0, -0.06, 0.2); g.add(strap);
  g.scale.setScalar(s);
  return g;
}
function upgMakeBeamParts(s) {
  const g = new THREE.Group();
  g.name = 'beam';
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.05, 12), upgMat(0x3a3a3a));
    ring.rotation.x = Math.PI / 2; ring.position.set(sx * 0.08, 0.04, -0.215); g.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0xff3a20 }));
    lens.position.set(sx * 0.08, 0.04, -0.242); lens.rotation.y = Math.PI; lens.name = 'lens';
    g.add(lens);
  }
  g.scale.setScalar(s);
  return g;
}
function upgMakeVulcan(s) {
  const g = new THREE.Group();
  g.name = 'vulcan';
  for (const sx of [-1, 1]) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.16), upgMat(0x4a4e52));
    body.position.set(sx * 0.255, 0.06, -0.02); g.add(body);
    for (let k = 0; k < 3; k++) {
      const brl = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 6), upgMat(0x202224));
      brl.rotation.x = Math.PI / 2;
      brl.position.set(sx * 0.255 + Math.cos(k * 2.1) * 0.018, 0.06 + Math.sin(k * 2.1) * 0.018, -0.14); g.add(brl);
    }
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), upgMat(0x6a6e72));
    clamp.position.set(sx * 0.225, 0.06, 0.01); g.add(clamp);
  }
  g.scale.setScalar(s);
  return g;
}
// 後頭部のチップの差し込み口（2つ）
function upgMakeChipSlots(s) {
  const g = new THREE.Group();
  g.name = 'slots';
  g.userData.chips = [];
  for (let i = 0; i < UPG_CFG.chipSlots; i++) {
    const x = (i === 0 ? -1 : 1) * 0.065;
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.03), upgMat(0x2c2c2c));
    sock.position.set(x, 0.17, 0.165); sock.rotation.x = 0.8; g.add(sock);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), new THREE.MeshBasicMaterial({ color: 0x302010 }));
    lamp.position.set(x, 0.225, 0.12); g.add(lamp);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.012), upgMat(0x406040));
    chip.position.set(x, 0.185, 0.18); chip.rotation.x = 0.8; chip.visible = false; g.add(chip);
    g.userData.chips.push({ chip, lamp, home: chip.position.clone() });
  }
  g.scale.setScalar(s);
  return g;
}

/* =========================================================
   アップグレード台（セーフルーム）
   中央の台座に頭を固定する輪、CRT、左右のロボットアーム、ケーブルと計器、警告灯
   stage.js の buildProp から type:'upgradeBench' で呼ばれる
   ========================================================= */
function buildUpgradeBench(L, p) {
  const F = propFrame(L, p), B = L.batches;
  // 台座と床板
  lbox(B.metal, F, -1.1, 1.1, 0, 0.12, -0.8, 0.8, 0x3a3e40);
  lcyl(B.metal, F, 0, 0.12, 0.95, 0, 0.16, 0x585e62, 14);
  lcyl(B.metal, F, 0, 0.95, 1.0, 0, 0.22, 0x6a7074, 14);
  // 頭を固定する輪（3本の爪）
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2;
    lbox(B.metal, F, Math.cos(a) * 0.2 - 0.025, Math.cos(a) * 0.2 + 0.025, 0.98, 1.22, Math.sin(a) * 0.2 - 0.025, Math.sin(a) * 0.2 + 0.025, 0x8a9094);
  }
  // 背面の柱と CRT（頭の右後ろ、斜めに見える）
  lbox(B.metal, F, 0.75, 0.9, 0.12, 2.0, -0.75, -0.6, 0x4a5054);
  lbox(B.metal, F, 0.55, 1.1, 1.55, 2.0, -0.78, -0.42, 0x3c3e3a);
  // 計器盤（左）とアナログ計器
  lbox(B.metal, F, -1.05, -0.65, 0.12, 1.25, -0.7, -0.4, 0x4c524c);
  // 配管とケーブル（床から壁へ）
  addRod(B.metal, F.at(-0.9, 1.1, -0.6), F.at(-0.9, 2.6, -0.95), 0.03, 0x8a6a40);
  addRod(B.metal, F.at(0.82, 2.0, -0.7), F.at(0.82, 2.8, -0.95), 0.025, 0x2a2a2a);
  addRod(B.metal, F.at(-0.3, 0.13, -0.6), F.at(-0.3, 0.13, -0.95), 0.04, 0x2a2a2a);
  addRod(B.metal, F.at(0.2, 0.13, -0.6), F.at(0.2, 0.13, -0.95), 0.03, 0x6a2a24);
  textPlane(L, ['頭部改造装置', 'BK-7'], 'plate', 1.1, 0.4, ...F.at(0, 2.45, -0.92), p.face);
  addSolid(L, F, 2.2, 1.6);
  // 動く部分（ロボットアーム・CRT・頭・警告灯）はまとめてグループに
  const g = new THREE.Group();
  g.position.set(F.x, 0, F.z);
  g.rotation.y = F.yaw;
  L.group.add(g);
  const head = new THREE.Group();
  head.position.set(0, 1.32, 0);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), upgMat(0xe8e4da));
  head.add(sph);
  // 目（正面は +z 側に向ける：台の正面＝部屋の内側）
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.01), new THREE.MeshBasicMaterial({ color: 0x1a1210 }));
    eye.position.set(sx * 0.08, 0.04, -0.236); head.add(eye);
  }
  head.rotation.y = Math.PI;                 // 部品の作り（前が -z）を台の正面（+z）へ
  const parts = { jetpack: upgMakeJetpack(1), beam: upgMakeBeamParts(1), vulcan: upgMakeVulcan(1), slots: upgMakeChipSlots(1) };
  for (const k in parts) head.add(parts[k]);
  head.visible = false;                      // 開いたときだけ置く（普段は空の台）
  g.add(head);
  // CRT（台の右後ろ）
  const crt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.38), upgMat(0x2a2c2a));
  crt.position.set(0.82, 1.78, -0.55); crt.rotation.y = -0.5; g.add(crt);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192;
  const tex = new THREE.CanvasTexture(cv);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.31), new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(0, 0, 0.192); crt.add(scr);
  // 計器（針が振れる）
  const gauges = [];
  for (let k = 0; k < 2; k++) {
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.08, 18), new THREE.MeshBasicMaterial({ color: 0xe0dccc }));
    dial.position.set(-0.85, 0.95 - k * 0.3, -0.395); g.add(dial);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.07, 0.004), new THREE.MeshBasicMaterial({ color: 0x8a1a10 }));
    needle.geometry.translate(0, 0.03, 0);
    needle.position.set(-0.85, 0.95 - k * 0.3, -0.39); g.add(needle);
    gauges.push(needle);
  }
  // 警告灯
  const warn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), new THREE.MeshBasicMaterial({ color: 0x5a2410 }));
  warn.position.set(0.82, 2.08, -0.55); g.add(warn);
  // ロボットアーム（左右）。根元の回転・肩・肘・手先
  const arms = [];
  for (const sx of [-1, 1]) {
    const base = new THREE.Group();
    base.position.set(sx * 0.82, 0.12, -0.15);
    g.add(base);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10), upgMat(0x8a6a28));
    col.position.y = 0.15; base.add(col);
    const shoulder = new THREE.Group(); shoulder.position.y = 0.3; base.add(shoulder);
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), upgMat(0xc89a30));
    up.position.y = 0.35; shoulder.add(up);
    const elbow = new THREE.Group(); elbow.position.y = 0.7; shoulder.add(elbow);
    const lo = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), upgMat(0xc89a30));
    lo.position.y = 0.275; elbow.add(lo);
    const tip = new THREE.Group(); tip.position.y = 0.55; elbow.add(tip);
    for (const fx of [-1, 1]) {
      const fing = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.08, 0.03), upgMat(0x404448));
      fing.position.set(fx * 0.025, 0.04, 0); tip.add(fing);
    }
    // 運んでくる部品（購入時に手先へ持たせる）
    const carry = new THREE.Group(); carry.position.y = 0.09; tip.add(carry);
    arms.push({ sx, base, shoulder, elbow, tip, carry, pose: { yaw: 0, sh: 0.35 * sx, el: -0.6 * sx }, target: null });
  }
  UPG.benchProp = { L, F, g, head, parts, crt, tex, cv, gauges, warn, arms, face: p.face,
    headWorld: () => head.getWorldPosition(new THREE.Vector3()) };
  upgSyncHeadParts(parts);
  upgDrawCrt('STANDBY', []);
}
// 購入・装備の状態に合わせて頭の部品を出す（パーツの集合 parts は台の頭でもステージの頭でも同じ形）
function upgSyncHeadParts(parts) {
  const s = UPG.save;
  parts.jetpack.visible = upgOwned('jetpack');
  parts.beam.visible = upgOwned('beam');
  parts.vulcan.visible = upgOwned('vulcan');
  // 装備中の頭スキルの部品だけ灯す
  parts.beam.traverse((o) => { if (o.name === 'lens') o.material.color.setHex(s.headSkill === 'beam' ? 0xff3a20 : 0x4a1a14); });
  parts.slots.userData.chips.forEach((c, i) => {
    const id = s.chipsEquipped[i];
    const anim = UPG.bench && UPG.bench.anim && UPG.bench.anim.kind === 'chip' && UPG.bench.anim.slot === i;
    if (!anim) {
      c.chip.visible = !!id;
      c.chip.position.copy(c.home);
      if (id) c.chip.material.color.setHex(CHIP_DEFS[id].color);
    }
    c.lamp.material.color.setHex(id ? 0x60ff90 : 0x302010);
  });
}
// ステージの頭（headMesh）に付ける部品（ジェットパック・ビームのレンズ・バルカン）
let upgHeadParts = null;
function upgSyncPlayerHead() {
  if (!upgHeadParts) {
    upgHeadParts = { jetpack: upgJetFx(), beam: upgMakeBeamParts(1), vulcan: upgMakeVulcan(1), slots: upgMakeChipSlots(1) };
    headMesh.add(upgHeadParts.beam); headMesh.add(upgHeadParts.vulcan); headMesh.add(upgHeadParts.slots);
  }
  // headMesh は yaw に合わせて回っていないので、向きだけ合わせる
  headMesh.rotation.set(0, yaw, 0);
  upgSyncHeadParts(upgHeadParts);
  const flying = UPG.jet.flying;
  upgHeadParts.jetpack.traverse((o) => { if (o.name === 'flame') { o.visible = flying; o.scale.y = 0.8 + Math.random() * 0.5; } });
}
function upgDrawCrt(title, lines, color) {
  const bp = UPG.benchProp;
  if (!bp) return;
  const c = bp.cv.getContext('2d');
  c.fillStyle = '#071408'; c.fillRect(0, 0, 256, 192);
  c.fillStyle = color || '#7dff9a';
  c.font = 'bold 22px monospace';
  c.fillText(title, 12, 32);
  c.font = '15px monospace';
  lines.forEach((l, i) => c.fillText(l, 12, 62 + i * 22));
  c.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 192; y += 3) c.fillRect(0, y, 256, 1);
  bp.tex.needsUpdate = true;
}

/* ---------- 開く・閉じる ---------- */
function upgBenchOpen() { return !!UPG.bench; }
function upgHidesHands() { return !!UPG.bench; }
function openUpgradeBench() {
  const bp = UPG.benchProp;
  if (!bp || UPG.bench) return;
  if (state !== S.HUMAN) { stageMsg('アップグレード台：人間の体で台の前に立ってください。', 2.6); return; }
  cancelCurrentAction();
  UPG.eHeld = false;
  UPG.bench = { tab: 0, idx: 0, view: 'main', anim: null, t: 0, closing: -1,
    camPos: camera.position.clone(), camQ: camera.quaternion.clone(), msg: '', msgCol: '' };
  bp.head.visible = true;
  upgSyncHeadParts(bp.parts);
  upgUi.panel.classList.remove('hidden');
  document.body.classList.add('upg-open');
  upgTone([220, 330, 440], 0.08, 'square', 0.04);
  upgDrawCrt('ONLINE', ['頭部 固定 完了', 'XP ' + UPG.save.xp.toLocaleString()]);
  upgRenderPanel();
}
function closeUpgradeBench() {
  const b = UPG.bench;
  if (!b || b.closing >= 0) return;
  if (b.anim) { b.closeAfter = true; return; }   // 装着中は、終わってから閉じる（演出の途中で取り残さない）
  b.closing = 0;
  upgUi.panel.classList.add('hidden');
  upgDrawCrt('STANDBY', []);
}
// 閉じきった（カメラがプレイヤーへ戻った）
function upgBenchDone() {
  const bp = UPG.benchProp;
  if (bp) { bp.head.visible = false; for (const a of bp.arms) { a.target = null; a.carry.clear(); } }
  UPG.bench = null;
  upgUi.panel.classList.add('hidden');
  document.body.classList.remove('upg-open');
}
// マウスロックが外れた（ESC）ら、その場で閉じる。次にクリックしてロックしたら普段の操作に戻る
document.addEventListener('pointerlockchange', () => {
  if (!locked() && UPG.bench) {
    if (UPG.bench.anim) upgFinishAnim();
    UPG.bench.closing = 0;
    upgUi.panel.classList.add('hidden');
    upgBenchDone();
  }
});

/* ---------- 画面（CRT） ---------- */
const UPG_TABS = [
  { id: 'main', name: '本体' },
  { id: 'upgrade', name: '改造' },
  { id: 'chip', name: 'チップ' },
];
function upgTabItems(tab) {
  const s = UPG.save;
  if (tab === 'main') return [{ id: 'exit', label: '台から離れる', status: '' }];
  if (tab === 'upgrade') return UPG_SHOP.map((it) => {
    let status;
    if (upgOwned(it.id)) status = it.kind === 'skill' ? (s.headSkill === it.id ? 'E 装備中' : '購入済') : '購入済';
    else status = s.xp >= it.price ? '購入可' : 'XP不足';
    return { id: it.id, label: it.name, status, price: it.price, it };
  });
  return Object.keys(CHIP_DEFS).map((id) => {
    const own = s.chipsOwned.includes(id);
    return { id, label: own ? CHIP_DEFS[id].name : '？？？', status: !own ? '未回収' : upgChipEquipped(id) ? '装着中' : '所持' };
  });
}
function upgRenderPanel() {
  const b = UPG.bench, s = UPG.save, tab = UPG_TABS[b.tab].id;
  upgUi.xp.textContent = 'XP ' + s.xp.toLocaleString();
  upgUi.tabs.innerHTML = UPG_TABS.map((t, i) => '<span class="' + (i === b.tab ? 'on' : '') + '">' + t.name + '</span>').join('');
  const items = upgTabItems(tab);
  b.idx = Math.max(0, Math.min(items.length - 1, b.idx));
  upgUi.list.innerHTML = '';
  items.forEach((it, i) => {
    const li = document.createElement('li');
    li.className = (i === b.idx ? 'on ' : '') + 'st-' + (it.status === '購入可' ? 'buy' : it.status === 'XP不足' ? 'short' : (it.status === '購入済' || it.status === '所持') ? 'own' : it.status === '未回収' ? 'none' : it.status ? 'eq' : '');
    li.innerHTML = '<span class="nm"></span><span class="pr"></span><span class="st"></span>';
    li.querySelector('.nm').textContent = it.label;
    li.querySelector('.pr').textContent = it.price && !upgOwned(it.id) ? it.price.toLocaleString() + ' XP' : '';
    li.querySelector('.st').textContent = it.status;
    upgUi.list.appendChild(li);
  });
  const cur = items[b.idx];
  let info = [];
  if (tab === 'main') {
    const sk = s.headSkill ? UPG_SHOP.find((q) => q.id === s.headSkill).name : 'なし';
    info = ['頭スキル（E）： ' + sk,
      'ジェットパック： ' + (upgOwned('jetpack') ? '装着済' : '未装着'),
      'チップ1： ' + (s.chipsEquipped[0] ? CHIP_DEFS[s.chipsEquipped[0]].name : '空き'),
      'チップ2： ' + (s.chipsEquipped[1] ? CHIP_DEFS[s.chipsEquipped[1]].name : '空き'),
      '累計XP： ' + s.totalXp.toLocaleString()];
  } else if (tab === 'upgrade' && cur) {
    info = cur.it.desc.slice();
    if (cur.it.kind === 'skill' && upgOwned(cur.id)) info.push(s.headSkill === cur.id ? 'F：Eから外す' : 'F：Eに割り当てる（無料）');
    else if (!upgOwned(cur.id)) info.push('F：購入して装着する');
  } else if (tab === 'chip' && cur) {
    if (s.chipsOwned.includes(cur.id)) {
      info = CHIP_DEFS[cur.id].desc.slice();
      info.push(upgChipEquipped(cur.id) ? 'F：外す' : 'F：差し込む');
    } else info = ['ステージのどこかにある'];
  }
  upgUi.info.innerHTML = '';
  for (const l of info) { const d = document.createElement('div'); d.textContent = l; upgUi.info.appendChild(d); }
  upgUi.msg.textContent = b.msg || '';
  upgUi.msg.className = 'msg ' + (b.msgCol || '');
  upgUi.panel.classList.toggle('busy', !!b.anim);
  // 見る場所：本体＝正面、改造＝選んだ部品、チップ＝後頭部
  b.view = tab === 'chip' ? 'chip' : tab === 'upgrade' ? 'upgrade:' + (cur ? cur.id : '') : 'main';
}
function upgPanelMsg(t, col) { UPG.bench.msg = t; UPG.bench.msgCol = col || ''; }
// アップグレード台を開いているあいだのキー。true を返したらほかへ回さない
function upgKeyHook(e) {
  const b = UPG.bench;
  if (!b) return false;
  if (b.closing >= 0) return true;
  if (b.anim) {                               // 装着中は決定を受け付けない（連打で二重に払わない）。戻るだけは予約できる
    if (e.code === 'KeyQ' || e.code === 'Backspace' || e.code === 'Escape') closeUpgradeBench();
    return true;
  }
  const tab = UPG_TABS[b.tab].id, items = upgTabItems(tab);
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') { b.tab = (b.tab + UPG_TABS.length - 1) % UPG_TABS.length; b.idx = 0; upgPanelMsg(''); upgTone([300], 0.05, 'square', 0.03); }
  else if (e.code === 'KeyD' || e.code === 'ArrowRight') { b.tab = (b.tab + 1) % UPG_TABS.length; b.idx = 0; upgPanelMsg(''); upgTone([300], 0.05, 'square', 0.03); }
  else if (e.code === 'KeyW' || e.code === 'ArrowUp') { b.idx = (b.idx + items.length - 1) % items.length; upgTone([420], 0.03, 'square', 0.025); }
  else if (e.code === 'KeyS' || e.code === 'ArrowDown') { b.idx = (b.idx + 1) % items.length; upgTone([420], 0.03, 'square', 0.025); }
  else if (e.code === 'KeyF' || e.code === 'Enter' || e.code === 'Space') upgConfirm(tab, items[b.idx]);
  else if (e.code === 'KeyQ' || e.code === 'Backspace' || e.code === 'Escape') { closeUpgradeBench(); return true; }
  if (UPG.bench) upgRenderPanel();
  return true;
}
function upgConfirm(tab, it) {
  const b = UPG.bench, s = UPG.save;
  if (!it) return;
  if (tab === 'main') { if (it.id === 'exit') closeUpgradeBench(); return; }
  if (tab === 'upgrade') {
    if (upgOwned(it.id)) {
      if (it.it.kind !== 'skill') { upgPanelMsg('装着済みです'); return; }
      upgAssignSkill(s.headSkill === it.id ? null : it.id);
      upgPanelMsg(s.headSkill === it.id ? 'Eキー：' + it.label : 'Eキーの割り当てを外しました', 'ok');
      upgTone([520, 780], 0.07, 'square', 0.04);
      upgSyncHeadParts(UPG.benchProp.parts);
      upgDrawCrt('HEAD SKILL', ['E = ' + (s.headSkill ? it.label : 'なし')]);
      return;
    }
    const r = upgBuy(it.id);
    if (r === 'short') { upgPanelMsg('XPが足りません（あと ' + (it.price - s.xp).toLocaleString() + '）', 'ng'); upgTone([160, 120], 0.12, 'square', 0.05); upgDrawCrt('DENIED', ['XP 不足'], '#ff7060'); return; }
    if (r !== 'ok') return;
    upgStartInstall(it.id);
    return;
  }
  // チップ
  if (!s.chipsOwned.includes(it.id)) { upgPanelMsg('まだ回収していません', 'ng'); upgTone([160], 0.1, 'square', 0.04); return; }
  if (upgChipEquipped(it.id)) {
    const slot = s.chipsEquipped.indexOf(it.id);
    upgUnequipChip(it.id);
    upgStartChipAnim(slot, it.id, false);
    return;
  }
  const slot = s.chipsEquipped.indexOf(null);
  if (slot < 0) { upgPanelMsg('スロットが空いていません（先に1枚外してください）', 'ng'); upgTone([160, 120], 0.12, 'square', 0.05); return; }
  upgEquipChip(it.id);
  upgStartChipAnim(slot, it.id, true);
}

/* ---------- 演出：ロボットアームが部品を運んで頭に付ける ---------- */
function upgStartInstall(id) {
  const bp = UPG.benchProp, b = UPG.bench;
  const part = bp.parts[id];
  part.visible = false;
  // 右のアームに部品の複製を持たせて運ぶ
  const arm = bp.arms[id === 'vulcan' ? 0 : 1];
  const ghost = (id === 'jetpack' ? upgMakeJetpack : id === 'beam' ? upgMakeBeamParts : upgMakeVulcan)(1);
  ghost.position.set(id === 'vulcan' ? 0.25 : 0, id === 'jetpack' ? 0 : -0.04, id === 'jetpack' ? -0.25 : 0.2);
  arm.carry.add(ghost);
  b.anim = { kind: 'install', id, t: 0, dur: UPG_CFG.installTime, arm, ghost };
  upgPanelMsg('装着中…', 'busy');
  upgTone([140, 160, 180], 0.25, 'sawtooth', 0.03);
  upgRenderPanel();
}
function upgStartChipAnim(slot, id, insert) {
  const b = UPG.bench;
  b.anim = { kind: 'chip', slot, id, insert, t: 0, dur: UPG_CFG.chipTime };
  upgPanelMsg(insert ? CHIP_DEFS[id].name + ' を差し込み中…' : CHIP_DEFS[id].name + ' を抜き取り中…', 'busy');
  upgTone([700, 500], 0.06, 'square', 0.03);
  upgRenderPanel();
}
function upgFinishAnim() {
  const b = UPG.bench, a = b.anim, bp = UPG.benchProp;
  b.anim = null;
  if (a.kind === 'install') {
    a.arm.carry.clear();
    a.arm.target = null;
    const it = UPG_SHOP.find((q) => q.id === a.id);
    upgPanelMsg(it.name + ' 装着完了', 'ok');
    upgDrawCrt('INSTALLED', [it.name, 'XP ' + UPG.save.xp.toLocaleString()]);
    doFlash(0.25, '#fff0c0'); addShake(0.2);
    upgTone([440, 660, 880], 0.1, 'square', 0.05);
  } else {
    upgPanelMsg(a.insert ? CHIP_DEFS[a.id].name + ' 装着' : CHIP_DEFS[a.id].name + ' を外しました', 'ok');
    upgDrawCrt('CHIP', ['SLOT ' + (a.slot + 1) + ' : ' + (a.insert ? CHIP_DEFS[a.id].name : '空き')]);
    upgTone(a.insert ? [880, 1100] : [600, 400], 0.06, 'square', 0.04);
  }
  upgSyncHeadParts(bp.parts);
  if (UPG.bench) upgRenderPanel();
  if (b.closeAfter) { b.closeAfter = false; closeUpgradeBench(); }
}
// アームの姿勢（根元の向き・肩・肘）を目標へ寄せる
function upgPoseArm(a, tgt, k) {
  const p = a.pose;
  p.yaw += (tgt.yaw - p.yaw) * k; p.sh += (tgt.sh - p.sh) * k; p.el += (tgt.el - p.el) * k;
  a.base.rotation.y = p.yaw;
  a.shoulder.rotation.z = p.sh;
  a.elbow.rotation.z = p.el;
}
function upgUpdateBench(rdt) {
  const bp = UPG.benchProp, b = UPG.bench;
  if (!bp) return;
  // 計器と警告灯はいつも少し動く
  bp.gauges.forEach((n, i) => { n.rotation.z = Math.sin(UPG.t * (1.3 + i) + i) * 0.5 + (b && b.anim ? Math.sin(UPG.t * 23) * 0.4 : 0); });
  bp.warn.material.color.setHex(b && b.anim ? (Math.sin(UPG.t * 14) > 0 ? 0xff6020 : 0x5a2410) : 0x5a2410);
  const rest = (a) => ({ yaw: 0, sh: 0.35 * a.sx, el: -0.6 * a.sx });
  for (const a of bp.arms) upgPoseArm(a, a.target || rest(a), Math.min(1, rdt * 5));
  if (!b) return;
  if (b.anim) {
    const a = b.anim;
    a.t += rdt;
    const k = a.t / a.dur;
    if (a.kind === 'install') {
      // 近づく → 押し当てる → 離れる
      const reach = k < 0.75 ? Math.min(1, k / 0.45) : Math.max(0, 1 - (k - 0.75) / 0.25);
      const sx = a.arm.sx;
      a.arm.target = { yaw: 0, sh: (0.35 - reach * 1.05) * sx, el: (-0.6 - reach * 0.55) * sx };
      if (k > 0.55 && k < 0.75 && Math.random() < 0.5) {
        const at = bp.head.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.3) * 0.3, (Math.random() - 0.5) * 0.4));
        spawnFleshBurst(at, 1, 1.0, null, 0.3);
      }
      if (k >= 0.62 && a.ghost.parent) { a.arm.carry.clear(); bp.parts[a.id].visible = true; addShake(0.08); }
    } else {
      const c = bp.parts.slots.userData.chips[a.slot];
      const out = a.insert ? 1 - Math.min(1, k * 1.4) : Math.min(1, k * 1.4);
      c.chip.visible = true;
      c.chip.material.color.setHex(CHIP_DEFS[a.id].color);
      c.chip.position.copy(c.home).add(new THREE.Vector3(0, out * 0.16, out * 0.1));
    }
    if (a.t >= a.dur) upgFinishAnim();
  }
}

/* ---------- 専用カメラ ---------- */
// 頭のまわりの視点（台の正面＝ +z 方向が頭の正面）
function upgBenchCamTarget(view) {
  const bp = UPG.benchProp;
  const hp = bp.headWorld();
  const local = (x, y, z) => bp.g.localToWorld(new THREE.Vector3(x, y, z));
  let pos, look = hp.clone();
  if (view === 'chip') { pos = local(0.32, 1.78, -0.62); look = local(0, 1.42, -0.05); }   // 後頭部の上（チップの差し込み口）
  else if (view === 'upgrade:jetpack') { pos = local(-0.55, 1.5, -0.55); }       // 背中側（燃料タンク）
  else if (view === 'upgrade:beam') { pos = local(0.18, 1.4, 0.78); look = local(0, 1.36, 0.1); }   // 目の前
  else if (view === 'upgrade:vulcan') { pos = local(0.62, 1.42, 0.3); }          // こめかみの横
  else { pos = local(0, 1.46, 1.3); }                                           // 正面
  // 右側に CRT の画面を重ねるので、頭が画面の左寄り（3分の1あたり）に来るよう視線を右へずらす
  const fwd = look.clone().sub(pos), dist = fwd.length();
  const right = fwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  look.addScaledVector(right, dist * 0.3);
  const m = new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return { pos, q };
}
function upgCameraHook(rdt) {
  const b = UPG.bench;
  if (!b || !UPG.benchProp) return;
  if (b.closing >= 0) {
    // 普段のカメラ（いま決まったもの）へ戻す
    b.closing += rdt / 0.45;
    const k = Math.min(1, b.closing);
    const e = k * k * (3 - 2 * k);
    const tp = camera.position.clone(), tq = camera.quaternion.clone();
    camera.position.copy(b.camPos).lerp(tp, e);
    camera.quaternion.copy(b.camQ).slerp(tq, e);
    if (k >= 1) upgBenchDone();
    return;
  }
  const t = upgBenchCamTarget(b.view);
  const k = 1 - Math.exp(-rdt * 4.5);
  b.camPos.lerp(t.pos, k);
  b.camQ.slerp(t.q, k);
  camera.position.copy(b.camPos);
  camera.quaternion.copy(b.camQ);
}

/* =========================================================
   毎フレーム
   ========================================================= */
function upgUpdate(dt, rdt) {
  UPG.t += rdt;
  upgUpdateBeam(dt, rdt);
  upgUpdateVulcan(dt, rdt);
  upgSyncPlayerHead();
  upgUpdateBench(rdt);
  upgUpdateChips(rdt);
  upgUpdateHud(rdt);
  if (UPG.bench && !UPG.bench.anim && UPG.bench.closing < 0) {
    // 台から離れたら閉じる（ステージ移動・死亡など）
    if (typeof STG === 'undefined' || STG.area !== 'safe' || state !== S.HUMAN) closeUpgradeBench();
  }
}

/* ---------- デバッグ（コンソールから） ---------- */
window.BKUpg = {
  grant(n) { UPG.save.xp += Math.max(0, n | 0); UPG.save.totalXp += Math.max(0, n | 0); upgSave(); return UPG.save.xp; },
  dump() { return JSON.parse(JSON.stringify(UPG.save)); },
  reset() { UPG.save = upgDefaultSave(); upgSave(); UPG.beam.cd = 0; return UPG.save; },
  setRng(fn) { UPG.rng = typeof fn === 'function' ? fn : Math.random; },
  cfg: UPG_CFG,
};
