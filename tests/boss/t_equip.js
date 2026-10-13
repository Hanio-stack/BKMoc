// 奪った腕の装着：元気なら良い腕は付ける／銃腕で撃つ・ドッジで避ける／通常スタンでは腕だけ斬り返せる／触手腕は間合いが伸びて引き寄せる
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  await o.startBoss();
  const bossArm = (k) => ev((k) => { const p = bossMan.parts[k]; return p.parent === bossMan.pivotRoot ? { kind: p.userData.kind, hp: p.userData.armState ? p.userData.armState.hp : null } : null; }, k);

  o.section('1) 耐久70の銃腕を奪わせる（男は元気なので装着）');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.GUN, { hp: 70 }); player.arms.RIGHT.lost = true; updateArmVisuals(); bossMan.hp = bossMan.maxHp; });
  await o.faceBoss(2.6); await wait(200);
  await ev(() => { bossMan.riseCd = 0; });
  o.expect('左腕を奪われる', await o.waitFor(() => player.arms.LEFT.lost, 4000), true);
  await wait(800);
  o.expect('男の左腕は銃腕（耐久70）', await bossArm('LEFT'), { kind: 'gun', hp: 70 });
  o.expect('男の右腕は自前の拳', await bossArm('RIGHT'), { kind: 'fist', hp: null });
  o.expect('食べていない', await ev(() => !!bossMan.eat), false);
  o.expectTrue('攻撃力が上がる', (await ev(() => bossMan.bonusDamage)) > 0, await ev(() => bossMan.bonusDamage));
  await page.screenshot({ path: __dirname + '/shots/equip_gun.png' });

  o.section('2) 離れると銃で撃ってくる／ドッジで避けられる');
  await ev(() => { player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); player.hp = 100; bossMan.cooldown = 0; bossMan.riseCd = 99; bossMan.gunCd = 0; });
  await o.faceBoss(8);
  o.expect('銃を撃つ（BOSS_SHOOT）', await o.waitFor(() => bossMan.state === E.BOSS_SHOOT, 3000), true);
  await wait(900);
  await page.screenshot({ path: __dirname + '/shots/gun_shot.png' });
  await wait(800);
  o.expectTrue('弾に当たると HP が減る', (await ev(() => player.hp)) < 100, await ev(() => player.hp));
  o.expect('弾は消えた', await ev(() => bossBullets.length), 0);
  await ev(() => { player.hp = 100; player.resource = 3; bossMan.gunCd = 0; setEnemyState(bossMan, E.IDLE); });
  await ev(() => new Promise((res) => { const iv = setInterval(() => { if (bossMan.state === E.BOSS_SHOOT && bossMan.shotDone) { clearInterval(iv); res(); } }, 5); }));
  await page.keyboard.press('ShiftLeft');   // 弾が飛んでいる間にドッジ（無敵）
  await wait(1200);
  o.expect('ドッジで弾を避けた（HP 100 のまま）', await ev(() => player.hp), 100);

  o.section('3) 通常スタン：首の□は出ず腕の□だけ → 銃腕を斬り返す（耐久70のまま戻る）');
  await ev(() => { bossMan.gunCd = 99; bossMan.riseCd = 99; bossMan.cooldown = 99; setEnemyState(bossMan, E.IDLE); applyStun(bossMan, 999); });
  await o.faceBoss(3.0);
  await page.keyboard.down('KeyQ'); await wait(700);
  o.expect('通常スタン', await ev(() => bossMan.state), 'STUNNED');
  const tg = await ev(() => Object.fromEntries(targetEntries.filter((t) => t.enemy === bossMan).map((t) => [t.key, !t.el.classList.contains('hidden')])));
  o.expect('□：腕は出る・首は出ない', tg, { LEFT: true, RIGHT: true, HEAD: false });
  await page.screenshot({ path: __dirname + '/shots/stun_targets.png' });
  await o.tagTarget('LEFT', 'tgL');
  o.expect('銃腕の□を狙えた', await o.aimAtEl('#tgL'), true);
  await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
  await wait(300);
  await page.keyboard.up('KeyQ'); await wait(1500);
  o.expect('左腕に銃腕が耐久70で戻る', await ev(() => ({ kind: player.arms.LEFT.kind, hp: player.arms.LEFT.hp, lost: player.arms.LEFT.lost })), { kind: 'gun', hp: 70, lost: false });
  o.expect('男の左腕はなくなる', await bossArm('LEFT'), null);

  o.section('4) 触手腕：間合いが伸び、当たると引き寄せられる');
  await ev(() => { bossSetArm(bossMan, 'RIGHT', makeArmState(ARM.TENTACLE, { hp: 55 })); setEnemyState(bossMan, E.IDLE); bossMan.stun = 0; bossMan.cooldown = 0; player.hp = 100; });
  const range = await ev(() => attackRangeOf(bossMan)), base = await ev(() => CONFIG.enemyAttackRange);
  o.expectTrue('触手腕で間合いが伸びる', range > base, [+range.toFixed(2), base]);
  await o.faceBoss(3.2);
  const d0 = await ev(() => playerPos.distanceTo(bossMan.group.position));
  o.expect('3.2m 離れていても当たる', await o.waitFor(() => player.hp < 100, 4000), true);
  const d1 = await ev(() => playerPos.distanceTo(bossMan.group.position));
  o.expectTrue('引き寄せられる', d1 < d0 - 0.3, [+d0.toFixed(2), +d1.toFixed(2)]);
  await page.screenshot({ path: __dirname + '/shots/equip_tent.png' });
  await o.finish();
})();
