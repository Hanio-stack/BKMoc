// 回帰：既存の基本操作（パンチ・キック・パージ・ドッジ・ガード・スタン・ライジング・腕交換・
// 床の腕の再取得・乗っ取り・頭モード・銃腕・触手腕・腕HP・体スキル・リセット）が今までどおり動く
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const arm = (s) => ev((s) => JSON.parse(JSON.stringify(player.arms[s])), s);
  // ハブの1体の部屋の敵（enemies[0]）を目の前に置く
  const facing = (d) => ev((d) => {
    const en = enemies[0];
    CONFIG.enemyDodgeChance = 0; CONFIG.enemyDodgeForceHits = 999;
    en.group.position.set(-11, 0, -6); en.group.rotation.y = 0; en.cooldown = 99; en.stun = 0; en.hp = 100;
    setEnemyState(en, E.IDLE);
    playerPos.set(-11, 0, -6 + d); yaw = 0; pitch = 0;
  }, d);
  await page.keyboard.press('KeyG'); await wait(300);

  o.section('パンチ：ダメージが入り、腕HPが減る');
  await facing(1.8); await o.ready();
  await o.click('left'); await wait(400);
  o.expect('敵のHPが減った', await ev(() => enemies[0].hp), 80);
  o.expect('左腕のHPが減った', (await arm('LEFT')).hp, 80);

  o.section('キック：リソースを使ってスタンが入る');
  await facing(2.0); await o.ready();
  const res0 = await ev(() => player.resource);
  await page.keyboard.press('Space'); await wait(600);
  o.expect('リソースが1減った', await ev(() => player.resource), res0 - 1);
  o.expectTrue('スタンが溜まった', (await ev(() => enemies[0].stun)) > 0, await ev(() => enemies[0].stun));

  o.section('パージ：手首が飛んで当たる');
  await facing(5); await o.ready();
  await o.hold('right', 700); await wait(600);
  o.expect('右腕はパージ済み', (await arm('RIGHT')).purged, true);
  o.expect('手首が当たって敵のHPが減った', await ev(() => enemies[0].hp), 80);

  o.section('ドッジ：リソースを使って無敵で下がる');
  await ev(() => { player.resource = player.resMax; });
  await o.ready();
  const z0 = await ev(() => playerPos.z);
  await page.keyboard.press('ShiftLeft'); await wait(500);
  { const z1 = await ev(() => playerPos.z); o.expectTrue('後ろへ下がった', z1 > z0 + 2, +(z1 - z0).toFixed(2)); }

  o.section('ガード：受けるダメージが半分になって腕に入る');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); player.hp = 100; });
  await page.keyboard.down('ControlLeft'); await wait(200);
  await ev(() => { window.__g = damagePlayer(12); });
  await page.keyboard.up('ControlLeft');
  o.expect('体は減らず、両腕に半分ずつ', await ev(() => [player.hp, player.arms.LEFT.hp, player.arms.RIGHT.hp]), [100, 94, 94]);

  o.section('スタン：溜め切ると STUNNED');
  await facing(1.8);
  await ev(() => applyStun(enemies[0], 999));
  o.expect('スタンした', await ev(() => enemies[0].state), 'STUNNED');

  o.section('ライジング：スタン中の敵の腕を斬って左右に付ける');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); playerPos.set(-11, 0, -3); });
  await page.keyboard.down('KeyQ');
  o.expect('ライジング中', await o.waitFor(() => state === S.RISING, 4000), true);
  await wait(300);
  await ev(() => { for (const k of ['LEFT', 'RIGHT']) targetEntries.find((t) => t.enemy === enemies[0] && t.key === k).el.id = 'c' + k; });
  o.expect('敵の左腕の□を狙えた', await o.aimAtEl('#cLEFT'), true);
  await o.click('right'); await wait(300);
  o.expect('敵の右腕の□を狙えた', await o.aimAtEl('#cRIGHT'), true);
  await o.click('left'); await wait(300);
  await page.keyboard.up('KeyQ');
  await o.waitFor(() => state === S.HUMAN && !graftArms.length, 4000);
  o.expect('右クリックで斬った腕は右、左クリックは左（銃腕も取れる）', [(await arm('RIGHT')).kind, (await arm('LEFT')).kind, (await arm('LEFT')).swapped], ['fist', 'gun', true]);

  o.section('床の腕の再取得：交換で外れた腕を拾い直すとHPそのまま');
  await o.waitFor(() => severedParts.some((p) => p.phase === 'grounded' && p.armState), 4000);
  const g = await ev(() => { const p = severedParts.find((q) => q.phase === 'grounded' && q.armState); p.el.id = 'ground'; return p.armState.hp; });
  await ev(() => { const p = severedParts.find((q) => q.el && q.el.id === 'ground'); const dx = p.obj.position.x - playerPos.x, dz = p.obj.position.z - playerPos.z; yaw = Math.atan2(-dx, -dz); pitch = -0.6; });
  await o.rise();
  o.expect('床の腕を狙えた', await o.aimAtEl('#ground'), true);
  await o.click('right'); await wait(300);
  await page.keyboard.up('KeyQ');
  await o.waitFor(() => state === S.HUMAN && !graftArms.length, 4000);
  o.expect('拾った腕のHPは床にあったときのまま', (await arm('RIGHT')).hp, g);

  o.section('銃腕：撃つと腕HPが減り、当たれば敵のHPも減る');
  await facing(6); await o.ready();
  await ev(() => { player.arms.LEFT = makeArmState(ARM.GUN); updateArmVisuals(); });
  await o.lookAt(await ev(() => ({ x: enemies[0].group.position.x, y: 1.5, z: enemies[0].group.position.z })));
  await o.click('left'); await wait(500);
  o.expect('腕HPが減った', (await arm('LEFT')).hp, 100 - await ev(() => CONFIG.gunShotCost));
  o.expect('敵のHPが減った', await ev(() => enemies[0].hp), 90);

  o.section('触手腕：薙ぎ払い（短押し）と刺突（長押し）');
  await facing(2.6); await o.ready();
  await ev(() => { player.arms.LEFT = makeArmState(ARM.TENTACLE); updateArmVisuals(); });
  await o.click('left'); await o.waitFor(() => !player.attack, 4000); await wait(200);
  o.expect('薙ぎ払いが当たった', await ev(() => enemies[0].hp), 100 - await ev(() => CONFIG.tentSweepDamage));
  await facing(5); await o.ready();
  await o.lookAt(await ev(() => ({ x: enemies[0].group.position.x, y: 1.4, z: enemies[0].group.position.z })));
  await page.mouse.down({ button: 'left' });
  o.expect('刺さって拘束した', await o.waitFor(() => enemies[0].state === E.TETHER, 3000), true);
  await page.mouse.up({ button: 'left' }); await wait(500);

  o.section('腕HP：0になると腕が消える');
  await facing(1.8); await o.ready();
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST, { hp: CONFIG.armHitCost }); updateArmVisuals(); });
  await o.click('left'); await wait(400);
  o.expect('左腕が消えた', (await arm('LEFT')).lost, true);

  o.section('乗っ取りと頭モード');
  await page.keyboard.press('KeyG'); await wait(300);
  await ev(() => { playerPos.set(0, 0, 6); yaw = 0; pitch = 0; });
  await page.keyboard.down('KeyQ'); await wait(500);
  await page.keyboard.press('Space'); await wait(400);
  await page.keyboard.up('KeyQ');
  o.expect('頭モードに入った（体は死体として残る）', [await ev(() => state), await ev(() => corpses.length)], ['HEAD', 4]);
  // ハブの死体（-3, 2）へ近づいて乗っ取る
  await ev(() => { playerPos.set(-3, 0, 4); });
  await wait(300);
  await page.keyboard.press('KeyF');
  o.expect('近くの死体に乗っ取った', await o.waitFor(() => state === S.HUMAN, 5000), true);
  o.expect('死体は1つ減った', await ev(() => corpses.length), 3);

  o.section('体スキル：回復で体と腕が全快する');
  await ev(() => { player.hp = 40; player.arms.LEFT.hp = 30; player.skill = makeBodySkill(SKILL.HEAL); });
  await page.keyboard.press('KeyZ'); await wait(300);
  o.expect('体と腕が全快', await ev(() => [player.hp, player.arms.LEFT.hp, player.skill.used]), [100, 100, true]);
  o.section('体スキル：阿修羅で腕が4本生える');
  await page.keyboard.press('Digit4'); await page.keyboard.press('KeyZ');
  o.expect('4本生えた', await o.waitFor(() => asuraArms.length === 4 && asuraArms.every((xa) => asuraGrowK(xa) >= 1 - 1e-6), 4000), true);

  o.section('検証室から B（ボス戦）・V（デモ）・G（ハブ）へ移れる');
  await page.keyboard.press('KeyT'); await wait(400);
  o.expect('検証室に入った', await ev(() => ({ lab: LAB.active, enemies: LAB.enemies.length, pickups: wristPickups.length })), { lab: true, enemies: 7, pickups: 2 });
  await page.keyboard.press('KeyB'); await wait(400);
  o.expect('B：検証室を出てボス戦の入口へ（検証室の敵・台座・床の腕は消える）', await ev(() => ({
    lab: LAB.active, enemies: LAB.enemies.length, pickups: wristPickups.length,
    spares: severedParts.filter((p) => p.lab).length, nearArena: playerPos.z < -20 })),
    { lab: false, enemies: 0, pickups: 0, spares: 0, nearArena: true });
  await page.keyboard.press('KeyT'); await wait(400);
  await page.keyboard.press('KeyV'); await wait(400);
  o.expect('V：検証室を出てデモへ', await ev(() => ({ lab: LAB.active, demo: DEMO.active })), { lab: false, demo: true });
  await page.keyboard.press('KeyT'); await wait(400);
  o.expect('デモから T：デモを出て検証室へ', await ev(() => ({ lab: LAB.active, demo: DEMO.active })), { lab: true, demo: false });

  o.section('リセット：初期状態へ戻る');
  await page.keyboard.press('KeyG'); await wait(300);
  o.expect('リセット後', await ev(() => ({
    state, hp: player.hp, L: player.arms.LEFT.kind + (player.arms.LEFT.lost ? '-lost' : ''), R: player.arms.RIGHT.kind,
    asura: asuraArms.length, corpses: corpses.length, enemies: enemies.filter((e) => !e.boss).length,
    pos: [playerPos.x, playerPos.z], parts: severedParts.length })),
    { state: 'HUMAN', hp: 100, L: 'fist', R: 'fist', asura: 0, corpses: 3, enemies: 4, pos: [0, 6], parts: 0 });
  await o.finish();
})();
