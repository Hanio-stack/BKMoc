// 手首アイテム（スキャナ）と弱点：実際のクリック・長押し・ライジング・乗っ取りで確かめる
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const arm = (s) => ev((s) => JSON.parse(JSON.stringify(player.arms[s])), s);
  const standAt = (x, z, yawV, pitchV) => ev(([x, z, y, p]) => {
    playerPos.set(LAB.cx + x, 0, LAB.cz + z); yaw = y; pitch = p;
  }, [x, z, yawV || 0, pitchV || 0]);
  await o.lab();
  // スキャンを1回出して、波紋が広がり終わるまで待つ（遅いマシンでも取りこぼさない）
  const scan = async (btn) => {
    const n = await ev(() => scanStats.scans);
    await o.ready(); await o.click(btn);
    await o.waitFor((n) => scanStats.scans > n && !scanRipples.length, 8000, n);
  };
  // 敵の回避（乱数）を止める。弱点の比較やスタンの確認で敵が避けると結果がぶれる
  await ev(() => { const r = Math.random; window.__rand = r; CONFIG.enemyDodgeChance = 0; CONFIG.enemyDodgeForceHits = 999; });

  o.section('A1：左右それぞれパージできる');
  await o.ready(); await o.hold('left', 450); await wait(300);
  await o.ready(); await o.hold('right', 450); await wait(300);
  o.expect('左右ともパージ済み', [(await arm('LEFT')).purged, (await arm('RIGHT')).purged], [true, true]);

  o.section('A2：パージしていない腕ではスキャナを取れない');
  await page.keyboard.press('KeyT'); await wait(400);    // 配置をやり直す（腕も戻る）
  await ev(() => { for (const e of LAB.enemies) e.cooldown = 99; });
  await standAt(2.5, 11.7, 0, -0.3);
  await o.ready(); await o.click('right'); await wait(500);
  o.expect('殴っても付かない', (await arm('RIGHT')).wrist, null);
  o.expect('台座のアイテムは残っている', await ev(() => wristPickups.filter((p) => p.active).length), 2);

  o.section('A3：パージした腕で殴ると手首に付く');
  await ev(() => { player.arms.RIGHT.hp = 64; });
  await o.ready(); await o.hold('right', 450); await wait(400);
  o.expect('右腕がパージ済み', (await arm('RIGHT')).purged, true);
  await standAt(2.5, 11.7, 0, -0.3);
  await o.ready(); await o.click('right'); await wait(500);
  const r1 = await arm('RIGHT');
  o.expect('スキャナが付いた', r1.wrist, { id: 'scanner' });
  o.expect('スキャナに独立したHPや回数は無い（{ id } だけ）', Object.keys(r1.wrist), ['id']);
  o.expect('装着前後で腕HPが同じ（回復しない）', r1.hp, 64);
  o.expect('取った台座は空になる', await ev(() => wristPickups.filter((p) => p.active).length), 1);
  o.expect('一人称の手にスキャナが見える', await ev(() => !!(fpHands.RIGHT.userData.addons.wrist && fpHands.RIGHT.visible)), true);
  o.expect('HUDの右腕はスキャナのアイコン', await ev(() => hudCircle.RIGHT.iconKey), 'scanner');

  o.section('A4/B1：クリック1回でスキャン1回、パンチは出ない');
  await standAt(6, 9, 0, -0.05);
  await wait(300);
  const s0 = await ev(() => ({ scans: scanStats.scans, hp: LAB.enemies.map((e) => e.hp) }));
  await o.ready(); await o.click('right');
  o.expect('攻撃はスキャン（パンチではない）', await ev(() => player.attack && player.attack.type), 'wrist');
  await o.waitFor((n) => scanStats.scans > n && !scanRipples.length, 8000, s0.scans);
  const s1 = await ev(() => ({ scans: scanStats.scans, hp: LAB.enemies.map((e) => e.hp) }));
  o.expect('スキャンは1回', s1.scans - s0.scans, 1);
  o.expect('B3：波紋にダメージは無い（敵のHPは減らない）', s1.hp, s0.hp);
  o.expect('B4：3体に弱点が付いた', await ev(() => LAB.enemies.slice(1, 4).map((e) => !!e.weak)), [true, true, true]);
  o.expect('範囲外の敵には付かない（左の1体・爆弾・強敵）', await ev(() => [0, 4, 5, 6].map((i) => !!LAB.enemies[i].weak)), [false, false, false, false]);
  o.expect('A8：3体に当たっても腕HPは1回分だけ減る', (await arm('RIGHT')).hp, 64 - await ev(() => CONFIG.scanHitCost));
  o.expect('B5：印は敵の体（頭か胴）に付いている', await ev(() => LAB.enemies.slice(1, 4).every((e) =>
    e.weak.marker.parent === e.head || e.weak.marker.parent === e.torso)), true);
  await page.screenshot({ path: __dirname + '/shots/wrist_marks.png' });

  o.section('B2：長押ししても連射・特殊攻撃・再パージは出ない');
  const before = await ev(() => ({ scans: scanStats.scans, proj: projectiles.length }));
  await o.ready(); await o.hold('right', 1600);
  await o.waitFor(() => !scanRipples.length, 8000); await wait(300);
  const after = await ev(() => ({ scans: scanStats.scans, proj: projectiles.length }));
  o.expect('長押しでもスキャンは1回だけ', after.scans - before.scans, 1);
  o.expect('A5：手首は飛ばない（再パージしない）', after.proj, before.proj);
  o.expect('スキャナは付いたまま', (await arm('RIGHT')).wrist, { id: 'scanner' });
  const hpAfterRe = (await arm('RIGHT')).hp;
  o.expect('再スキャンでも敵に触れれば腕HPは減る', hpAfterRe, 64 - 2 * await ev(() => CONFIG.scanHitCost));

  o.section('B6/B7：再スキャンしても印は増えず、場所も変わらない。時間で消えない');
  const spots = await ev(() => LAB.enemies.slice(1, 4).map((e) => e.weak.spot + ':' + e.weak.marker.uuid));
  await scan('right');
  o.expect('印は同じもの（増えない・場所も同じ）', await ev(() => LAB.enemies.slice(1, 4).map((e) => e.weak.spot + ':' + e.weak.marker.uuid)), spots);
  o.expect('印の数は1体1つ', await ev(() => LAB.enemies.slice(1, 4).map((e) => { let n = 0; e.group.traverse((x) => { if (x.isSprite) n++; }); return n; })), [1, 1, 1]);
  await wait(4000);
  o.expect('4秒たっても消えない', await ev(() => LAB.enemies.slice(1, 4).every((e) => !!e.weak)), true);

  o.section('A9：空振りでは腕HPが減らない');
  const hpW0 = (await arm('RIGHT')).hp;
  await standAt(0, 12, Math.PI, 0);     // 後ろ（誰もいない入口側）を向く
  await wait(300);
  await scan('right');
  o.expect('敵に触れなければ減らない', (await arm('RIGHT')).hp, hpW0);

  o.section('B8：弱点に当てると雑魚は即スタン');
  // 左の1体をスキャンしてから、印を狙って左手（拳）で殴る
  await standAt(-6, 8.5, 0, -0.05); await wait(300);
  await scan('right');
  o.expect('左の1体に印', await ev(() => !!LAB.enemies[0].weak), true);
  await ev(() => { const en = LAB.enemies[0]; en.group.position.set(LAB.cx - 6, 0, LAB.cz + 4.4); en.group.rotation.y = 0; playerPos.set(LAB.cx - 6, 0, LAB.cz + 6.2); setEnemyState(en, E.IDLE); en.stun = 0; });
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); updateArmVisuals(); });
  await o.lookAt(await o.weakPos(0));
  const wh0 = await ev(() => weakStats.hits);
  await o.ready(); await o.click('left');
  await o.waitFor(() => LAB.enemies[0].state === E.STUNNED || LAB.enemies[0].hp < 100, 4000); await wait(100);
  o.expect('一発でスタン', await ev(() => LAB.enemies[0].state), 'STUNNED');
  o.expect('弱点ヒットとして数えた', await ev(() => weakStats.hits) - wh0, 1);

  o.section('B10：弱点以外に当てても弱点の効果は出ない');
  await ev(() => { const en = LAB.enemies[1]; en.group.position.set(LAB.cx + 3.5, 0, LAB.cz + 4.4); en.group.rotation.y = 0; playerPos.set(LAB.cx + 3.5, 0, LAB.cz + 6.2); setEnemyState(en, E.IDLE); en.stun = 0; });
  // 印から 0.6m 以上ずれた所（印が頭なら腹、胴なら頭）を狙う
  const off = await ev(() => { const en = LAB.enemies[1]; const v = new THREE.Vector3(); weakWorld(en, v);
    const head = en.weak.spot === 'head'; return { x: v.x + 0.0, y: head ? v.y - 0.95 : v.y + (en.weak.spot === 'chest' ? 0.75 : 1.1), z: v.z }; });
  await o.lookAt(off);
  const wh1 = await ev(() => weakStats.hits);
  await o.ready(); await o.click('left');
  await o.waitFor(() => LAB.enemies[1].hp < 100, 4000); await wait(100);
  o.expect('スタンしない（普通のヒット）', await ev(() => LAB.enemies[1].state !== 'STUNNED'), true);
  o.expect('弱点ヒットに数えない', await ev(() => weakStats.hits) - wh1, 0);
  o.expect('ダメージは入った（当たってはいる）', await ev(() => LAB.enemies[1].hp < 100), true);

  o.section('共通処理：銃弾・刺突・パージした手首でも弱点が効く');
  // 銃：左腕を銃にして印を撃つ
  await ev(() => { const en = LAB.enemies[2]; en.group.position.set(LAB.cx + 6, 0, LAB.cz + 2.5); en.group.rotation.y = 0; setEnemyState(en, E.IDLE); en.stun = 0; playerPos.set(LAB.cx + 6, 0, LAB.cz + 8); player.arms.LEFT = makeArmState(ARM.GUN); updateArmVisuals(); });
  await o.lookAt(await o.weakPos(2));
  await o.ready(); await o.click('left'); await wait(400);
  o.expect('銃弾が弱点に当たって即スタン', await ev(() => LAB.enemies[2].state), 'STUNNED');
  // 刺突：左腕を触手にして印へ伸ばす
  await ev(() => { const en = LAB.enemies[3]; en.group.position.set(LAB.cx + 8.5, 0, LAB.cz + 2.5); en.group.rotation.y = 0; setEnemyState(en, E.IDLE); en.stun = 0; playerPos.set(LAB.cx + 8.5, 0, LAB.cz + 7); player.arms.LEFT = makeArmState(ARM.TENTACLE); updateArmVisuals(); });
  await o.lookAt(await o.weakPos(3));
  await o.ready(); await o.hold('left', 700); await wait(300);
  o.expect('刺突が弱点に当たって即スタン（拘束しない）', await ev(() => LAB.enemies[3].state), 'STUNNED');

  o.section('B9：強敵の弱点はスタン値が約2倍');
  await ev(() => { const en = LAB.enemies[6]; markWeak(en); player.arms.LEFT = makeArmState(ARM.FIST); updateArmVisuals(); });
  const strongPunch = async (weak) => {
    await ev(() => { const en = LAB.enemies[6]; en.group.position.set(LAB.cx, 0, LAB.cz - 13); en.group.rotation.y = 0; setEnemyState(en, E.IDLE); en.stun = 0; en.cooldown = 99; playerPos.set(LAB.cx, 0, LAB.cz - 11.1); });
    const w = await o.weakPos(6);
    await o.lookAt(weak ? w : { x: w.x + 0.0, y: w.y + 0.85, z: w.z });
    await o.ready(); await o.click('left');
    await o.waitFor(() => LAB.enemies[6].stun > 0, 4000);   // パンチが当たるまで（遅いマシンでも取りこぼさない）
    const st = await ev(() => LAB.enemies[6].stun);
    await wait(500);
    return st;
  };
  const sNormal = await strongPunch(false);
  const sWeak = await strongPunch(true);
  o.expectTrue('弱点のスタン値は普通の約2倍', sWeak / sNormal > 1.8 && sWeak / sNormal < 2.2, [+sNormal.toFixed(1), +sWeak.toFixed(1)]);

  o.section('B9：ボス（ダクトの男）の弱点もスタン値が約2倍');
  await o.startBoss();
  await ev(() => { Math.random = () => 0.99;   // キックで潰してくる抽選を外す
    const en = bossMan; en.kickCd = 99; en.riseCd = 99; en.gunCd = 99; en.cooldown = 99;
    player.arms.RIGHT = makeArmState(ARM.FIST, { purged: true, wrist: { id: 'scanner' } });
    player.arms.LEFT = makeArmState(ARM.FIST); updateArmVisuals(); });
  await o.faceBoss(4.0);
  await scan('right');
  o.expect('ボスに弱点（胸・固定）', await ev(() => bossMan.weak && bossMan.weak.spot), 'chest');
  const bossPunch = async (weak) => {
    await ev(() => { const en = bossMan; setEnemyState(en, E.IDLE); en.stun = 0; en.poise = 0; en.cooldown = 99;
      playerPos.set(en.group.position.x, 0, en.group.position.z + 1.9); });
    const w = await ev(() => { const v = new THREE.Vector3(); weakWorld(bossMan, v); return { x: v.x, y: v.y, z: v.z }; });
    await o.lookAt(weak ? w : { x: w.x, y: w.y + 0.9, z: w.z });
    await o.ready(); await o.click('left');
    await o.waitFor(() => bossMan.stun > 0, 4000);
    const st = await ev(() => bossMan.stun);
    await wait(400);
    return st;
  };
  const bN = await bossPunch(false);
  const bW = await bossPunch(true);
  o.expectTrue('弱点のスタン値は普通の約2倍', bW / bN > 1.8 && bW / bN < 2.2, [+bN.toFixed(1), +bW.toFixed(1)]);
  o.expect('ボスは即スタンにはならない（倍率だけ）', await ev(() => bossMan.state !== 'STUNNED'), true);
  await o.lab();
  await ev(() => { CONFIG.enemyDodgeChance = 0; CONFIG.enemyDodgeForceHits = 999; });

  o.section('A10：腕HP0で腕とスキャナが一緒に消える');
  await ev(() => { player.arms.RIGHT = makeArmState(ARM.FIST, { purged: true, wrist: { id: 'scanner' }, hp: CONFIG.scanHitCost }); updateArmVisuals();
    LAB.enemies[1].group.position.set(LAB.cx + 3.5, 0, LAB.cz + 4); });
  await standAt(4, 8.5, 0, -0.05); await wait(300);
  await scan('right');
  const lostR = await arm('RIGHT');
  o.expect('右腕は無くなり、スキャナも消えた', { lost: lostR.lost, wrist: lostR.wrist }, { lost: true, wrist: null });
  o.expect('一人称の手からスキャナも消えた', await ev(() => !fpHands.RIGHT.userData.addons.wrist && !fpHands.RIGHT.visible), true);

  o.section('A11：左右で別々に持てる');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST, { purged: true, hp: 70 }); player.arms.RIGHT = makeArmState(ARM.FIST, { hp: 90 }); updateArmVisuals(); });
  await ev(() => { for (const p of wristPickups) { p.active = true; p.holder.visible = true; p.glow.visible = true; p.respawnAt = null; } });
  await standAt(-2.5, 11.7, 0, -0.3);
  await o.ready(); await o.click('left'); await wait(500);
  o.expect('左だけスキャナ、右は拳のまま', [(await arm('LEFT')).wrist, (await arm('RIGHT')).wrist, (await arm('RIGHT')).purged], [{ id: 'scanner' }, null, false]);
  o.expect('左のHPは装着前のまま', (await arm('LEFT')).hp, 70);

  o.section('A12：交換・頭モード・乗っ取りでも装着状態とHPが壊れない');
  // 交換：左のスキャナ腕を床の腕と交換して外す
  // 床の腕から 2.4m 離れて見下ろす（近すぎると□の狙いが行き過ぎる）
  await ev(() => {
    const p = severedParts.find((q) => q.lab && q.armState.kind === 'fist' && q.obj.position.x < LAB.cx);
    p.el.id = 'spare';
    const t = p.obj.position;
    playerPos.set(t.x + 2.4, 0, t.z - 0.6);
    yaw = Math.atan2(-(t.x - playerPos.x), -(t.z - playerPos.z)); pitch = -0.55;
  });
  await o.rise();
  o.expect('床の腕を狙えた', await o.aimAtEl('#spare'), true);
  await o.ready(); await o.click('left'); await wait(300);
  await page.keyboard.up('KeyQ');
  await o.waitFor(() => state === S.HUMAN && !graftArms.length, 4000);
  await wait(300);
  const dropped = await ev(() => { const p = severedParts.find((q) => q.armState && q.armState.wrist); return p ? { wrist: p.armState.wrist, hp: p.armState.hp } : null; });
  o.expect('外した腕は床でスキャナとHPを持ったまま', dropped, { wrist: { id: 'scanner' }, hp: 70 });
  o.expect('左は新しい拳', [(await arm('LEFT')).wrist, (await arm('LEFT')).purged], [null, false]);
  // 拾い直す
  await o.waitFor(() => severedParts.some((q) => q.armState && q.armState.wrist && q.phase === 'grounded'), 3000);
  await o.rise();
  await ev(() => { const p = severedParts.find((q) => q.armState && q.armState.wrist); p.el.id = 'scanArm'; });
  o.expect('外したスキャナ腕を狙えた', await o.aimAtEl('#scanArm'), true);
  await o.ready(); await o.click('left'); await wait(300);
  await page.keyboard.up('KeyQ');
  await o.waitFor(() => state === S.HUMAN && !graftArms.length, 4000);
  o.expect('拾い直すとスキャナとHPがそのまま戻る', [(await arm('LEFT')).wrist, (await arm('LEFT')).hp], [{ id: 'scanner' }, 70]);
  // 頭モードで体を捨てて、乗っ取り直す
  await page.keyboard.down('KeyQ'); await wait(500);
  await page.keyboard.press('Space'); await wait(300);
  await page.keyboard.up('KeyQ');
  o.expect('頭モード', await ev(() => state), 'HEAD');
  o.expect('捨てた体の左腕はスキャナ付き・HPそのまま', await ev(() => { const c = corpses[corpses.length - 1]; return { wrist: c.arms.LEFT.wrist, hp: c.arms.LEFT.hp }; }), { wrist: { id: 'scanner' }, hp: 70 });
  await wait(300);
  await page.keyboard.press('KeyF');
  await o.waitFor(() => state === S.HUMAN, 4000);
  o.expect('乗っ取り直すとスキャナとHPが戻る', [(await arm('LEFT')).wrist, (await arm('LEFT')).hp], [{ id: 'scanner' }, 70]);
  o.expect('戻ったスキャナでスキャンできる', await (async () => { const n = await ev(() => scanStats.scans); await scan('left'); return (await ev(() => scanStats.scans)) - n; })(), 1);

  o.section('B11：死亡・リセットで古い印が残らない');
  await ev(() => { const en = LAB.enemies[1]; markWeak(en); applyDamage(en, 999); });
  o.expect('倒した敵の印は消える', await ev(() => LAB.enemies[1].weak), null);
  o.expect('死体に印は付いていない', await ev(() => { let n = 0; for (const c of corpses) c.group.traverse((x) => { if (x.isSprite) n++; }); return n; }), 0);
  await page.keyboard.press('KeyG'); await wait(400);
  o.expect('リセット後、どの敵にも印は無い', await ev(() => enemies.every((e) => !e.weak)), true);
  o.expect('リセット後、シーンに印のスプライトが残らない', await ev(() => { let n = 0; scene.traverse((x) => { if (x.isSprite && x.material.map === weakMarkerTex) n++; }); return n; }), 0);
  o.expect('リセット後、台座は片付いている（検証室を出た）', await ev(() => wristPickups.length), 0);
  await o.finish();
})();
