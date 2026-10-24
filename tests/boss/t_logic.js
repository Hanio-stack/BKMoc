// ロジックの単体テスト：ページを開いて、関数を直接呼んで結果を確かめる（操作や描画には頼らない）
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { ev } = o;

  o.section('腕の状態の複製（入れ子まで複製して共有しない）');
  o.expect('入れ子のオブジェクトを共有しない', await ev(() => {
    const a = makeArmState(ARM.FIST, { wrist: { id: 'scanner' }, bomb: { armed: true, fuse: 1 } });
    const b = cloneArmState(a);
    b.bomb.fuse = 0.2; b.wrist.id = 'x';
    return { sameBomb: a.bomb === b.bomb, sameWrist: a.wrist === b.wrist, aFuse: a.bomb.fuse, aId: a.wrist.id };
  }), { sameBomb: false, sameWrist: false, aFuse: 1, aId: 'scanner' });
  o.expect('新しい腕は手首アイテムも爆弾も無い', await ev(() => {
    const a = makeArmState(ARM.GUN);
    return { wrist: a.wrist, bomb: a.bomb };
  }), { wrist: null, bomb: null });

  o.section('手首アイテムの装着条件');
  o.expect('パージ済み・壊れていない・未装着だけ付けられる', await ev(() => ({
    fresh: canEquipWrist(makeArmState(ARM.FIST), 'scanner'),
    purged: canEquipWrist(makeArmState(ARM.FIST, { purged: true }), 'scanner'),
    lost: canEquipWrist(makeArmState(ARM.FIST, { purged: true, lost: true }), 'scanner'),
    already: canEquipWrist(makeArmState(ARM.FIST, { purged: true, wrist: { id: 'scanner' } }), 'scanner'),
    unknown: canEquipWrist(makeArmState(ARM.FIST, { purged: true }), 'nope'),
  })), { fresh: false, purged: true, lost: false, already: false, unknown: false });
  o.expect('アイテムの定義に必要な項目が揃っている', await ev(() => Object.values(WRIST_ITEMS).every((d) =>
    typeof d.id === 'string' && typeof d.icon === 'string' && typeof d.repurge === 'boolean' &&
    typeof d.canEquip === 'function' && typeof d.build === 'function' && typeof d.idle === 'function' &&
    typeof d.attackPose === 'function' && typeof d.onAttack === 'function' && typeof d.hitCost === 'function' &&
    d.attack && d.attack.cooldown > 0 && d.fx && d.fx.equip && d.fx.attack && d.fx.break)), true);
  o.expect('スキャナは再パージ不可・特殊攻撃なし', await ev(() => ({ repurge: WRIST_ITEMS.scanner.repurge, special: WRIST_ITEMS.scanner.special })),
    { repurge: false, special: null });
  o.expect('装着してもHPは変わらない', await ev(() => {
    player.arms.RIGHT = makeArmState(ARM.FIST, { purged: true, hp: 63 });
    const ok = equipWrist('RIGHT', 'scanner');
    return { ok, hp: player.arms.RIGHT.hp, wrist: player.arms.RIGHT.wrist };
  }), { ok: true, hp: 63, wrist: { id: 'scanner' } });

  o.section('再パージ（repurge:true のアイテムだけ。共通処理の確認用に仮のアイテムを足す）');
  o.expect('再パージ可のアイテムは長押しで外れる／スキャナは外れない', await ev(() => {
    WRIST_ITEMS.testItem = Object.assign({}, WRIST_ITEMS.scanner, { id: 'testItem', repurge: true });
    player.arms.LEFT = makeArmState(ARM.FIST, { purged: true, wrist: { id: 'testItem' } });
    player.arms.RIGHT = makeArmState(ARM.FIST, { purged: true, wrist: { id: 'scanner' } });
    player.attack = null; player.recoverT = 0;
    const a = doWristPurge('LEFT');
    player.attack = null;
    const b = doWristPurge('RIGHT');
    const r = { left: a, leftWrist: player.arms.LEFT.wrist, right: b, rightWrist: player.arms.RIGHT.wrist && player.arms.RIGHT.wrist.id };
    delete WRIST_ITEMS.testItem;
    for (const p of projectiles) scene.remove(p.obj);
    projectiles.length = 0;
    return r;
  }), { left: true, leftWrist: null, right: false, rightWrist: 'scanner' });

  o.section('弱点');
  o.expect('印は1体に1つ・付け直さない', await ev(() => {
    const en = enemies[0];
    clearWeak(en);
    const a = markWeak(en);
    const spot = en.weak.spot, marker = en.weak.marker;
    const b = markWeak(en);
    const sprites = [];
    en.group.traverse((x) => { if (x.isSprite) sprites.push(x); });
    const r = { first: a, second: b, sameSpot: en.weak.spot === spot, sameMarker: en.weak.marker === marker, sprites: sprites.length };
    clearWeak(en);
    return r;
  }), { first: true, second: false, sameSpot: true, sameMarker: true, sprites: 1 });
  o.expect('ボス・強敵は固定の場所、雑魚は候補から選ぶ', await ev(() => ({
    boss: WEAK_TYPES[weakTypeOf(bossMan)].pick + ':' + WEAK_TYPES[weakTypeOf(bossMan)].spots.join(','),
    strong: weakTypeOf({ strong: true }), grunt: weakTypeOf({}),
    gruntSpots: WEAK_TYPES.grunt.spots.length > 1,
  })), { boss: 'fixed:chest', strong: 'strong', grunt: 'grunt', gruntSpots: true });
  o.expect('弱点の効き方：雑魚は一撃で倒す・強敵とボスはスタン値を倍', await ev(() => ({
    grunt: WEAK_TYPES.grunt.effect, strong: WEAK_TYPES.strong.effect, boss: WEAK_TYPES.boss.effect })),
    { grunt: 'kill', strong: 'stunMul', boss: 'stunMul' });
  o.expect('雑魚の弱点に当てると一撃で倒れる（関数を直接呼ぶ）', await ev(() => {
    const en = enemies[1];
    const r = { before: en.state };
    weakStrike(en, 10);
    r.after = en.state; r.hp = en.hp;
    resetAll();
    return r;
  }), { before: 'IDLE', after: 'DEAD', hp: 0 });
  o.expect('片付けると印が消える', await ev(() => {
    const en = enemies[0];
    markWeak(en);
    clearWeak(en);
    let n = 0; en.group.traverse((x) => { if (x.isSprite) n++; });
    return { weak: en.weak, sprites: n };
  }), { weak: null, sprites: 0 });

  o.section('爆弾の秒読み');
  o.expect('ピンが刺さっている爆弾は数えない／抜けたら数える', await ev(() => {
    const safe = { bomb: { armed: false } };
    const snap = { bomb: { armed: true, fuse: 1, snap: true } };
    const armed = { bomb: { armed: true, fuse: 0.05, snap: false } };
    const lost = { lost: true, bomb: { armed: true, fuse: 0.01, snap: false } };
    return { safe: bombTicks(safe, 1), snap: bombTicks(snap, 1), snapFuse: snap.bomb.fuse,
             armed: bombTicks(armed, 0.1), lost: bombTicks(lost, 1) };
  }), { safe: false, snap: false, snapFuse: 1, armed: true, lost: false });
  o.expect('ピンは1回しか抜けない（二重起爆しない）', await ev(() => {
    const st = makeArmState(ARM.FIST, { bomb: { armed: false } });
    const obj = new THREE.Object3D(); scene.add(obj);
    const a = pullBombPin(st, obj, new THREE.Vector3());
    const b = pullBombPin(st, obj, new THREE.Vector3());
    scene.remove(obj); clearBombFx();
    return { a, b, fuse: st.bomb.fuse };
  }), { a: true, b: false, fuse: await ev(() => CONFIG.bombFuse) });
  o.expect('自分の腕に付いた爆弾は1回だけ爆発して腕ごと消える', await ev(() => {
    const before = bombStats.blasts;
    player.arms.LEFT = makeArmState(ARM.FIST, { bomb: { armed: true, fuse: 0.01, snap: false } });
    state = S.HUMAN;
    updateBombs(0.05);
    updateBombs(0.05);
    return { blasts: bombStats.blasts - before, lost: player.arms.LEFT.lost, bomb: player.arms.LEFT.bomb };
  }), { blasts: 1, lost: true, bomb: null });
  o.expect('腕HP0で壊れた爆弾腕は爆発しない', await ev(() => {
    const before = bombStats.blasts;
    player.arms.RIGHT = makeArmState(ARM.FIST, { hp: 5, bomb: { armed: true, fuse: 0.5, snap: false } });
    damageArm('RIGHT', 50);
    updateBombs(1.0);
    return { blasts: bombStats.blasts - before, lost: player.arms.RIGHT.lost, bomb: player.arms.RIGHT.bomb };
  }), { blasts: 0, lost: true, bomb: null });
  o.expect('爆発の猶予は腕の吸着時間より長い', await ev(() => CONFIG.bombFuse > CONFIG.armGraftTime), true);
  await o.finish();
})();
