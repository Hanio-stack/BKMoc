const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const log = (...a) => console.log(...a);
  await o.startBoss();
  const bossArms = () => ev(() => ['LEFT', 'RIGHT'].map(k => { const p = bossMan.parts[k]; return k[0] + ':' + (p.parent === bossMan.pivotRoot ? p.userData.kind + (p.userData.armState ? '(hp' + p.userData.armState.hp + ')' : '(own)') : 'none'); }).join(' '));
  // 1) 耐久70の銃腕を奪わせる（男は元気＝良い腕なので装着）
  await ev(() => { player.arms.LEFT = makeArmState(ARM.GUN, { hp: 70 }); player.arms.RIGHT.lost = true; updateArmVisuals(); bossMan.hp = bossMan.maxHp; });
  await o.faceBoss(2.6); await wait(200);
  await ev(() => { bossMan.riseCd = 0; });
  for (let i = 0; i < 60 && !(await ev(() => player.arms.LEFT.lost)); i++) await wait(50);
  await wait(800);
  log('[1] boss arms after steal:', await bossArms(), '| bonusDamage', await ev(() => bossMan.bonusDamage));
  await page.screenshot({ path: __dirname + '/shots/equip_gun.png' });

  // 2) 離れると撃ってくる。弾に当たると減る／ドッジで避けられる
  await ev(() => { player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); player.hp = 100; bossMan.cooldown = 0; bossMan.riseCd = 99; bossMan.gunCd = 0; });
  await o.faceBoss(8);
  let shot = false;
  for (let i = 0; i < 60; i++) { const s = await ev(() => bossMan.state); if (s === 'BOSS_SHOOT') { shot = true; break; } await wait(50); }
  await wait(900);
  await page.screenshot({ path: __dirname + '/shots/gun_shot.png' });
  await wait(800);
  log('[2] boss shot:', shot, 'player hp', await ev(() => player.hp), 'bullets left', await ev(() => bossBullets.length));
  // ドッジで避ける
  await ev(() => { player.hp = 100; player.resource = 3; bossMan.gunCd = 0; setEnemyState(bossMan, E.IDLE); });
  await ev(() => new Promise((res) => { const iv = setInterval(() => { if (bossMan.state === E.BOSS_SHOOT && bossMan.shotDone) { clearInterval(iv); res(); } }, 5); }));
  await page.keyboard.press('ShiftLeft');   // 弾が飛んでいる間にドッジ（無敵）
  await wait(1200);
  log('[2] dodged bullet: player hp', await ev(() => player.hp));

  // 3) 通常スタン → 首の□は出ない・腕の□は出る → 銃腕を斬り返す（耐久70のまま）
  await ev(() => { bossMan.gunCd = 99; bossMan.riseCd = 99; bossMan.cooldown = 99; setEnemyState(bossMan, E.IDLE); applyStun(bossMan, 999); });
  await o.faceBoss(3.0);
  await page.keyboard.down('KeyQ'); await wait(700);
  const tg = await ev(() => targetEntries.filter(t => t.enemy === bossMan).map(t => t.key + ':' + (t.el.classList.contains('hidden') ? 'hidden' : 'shown')).join(' '));
  log('[3] stunned targets:', tg, 'state', await ev(() => bossMan.state));
  await page.screenshot({ path: __dirname + '/shots/stun_targets.png' });
  // 銃腕（左）を左クリックで斬る
  const idx = await ev(() => targetEntries.findIndex(t => t.enemy === bossMan && t.key === 'LEFT'));
  await ev((i) => { targetEntries[i].el.id = 'tgL'; }, idx);
  log('[3] aimed', await o.aimAtEl('#tgL'));
  await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
  await wait(300);
  await page.keyboard.up('KeyQ'); await wait(1500);
  log('[3] player L after cut:', await ev(() => JSON.stringify(player.arms.LEFT)), '| boss arms', await bossArms());

  // 4) 触手腕を装着すると間合いが伸び、当たると引き寄せられる
  await ev(() => { bossSetArm(bossMan, 'RIGHT', makeArmState(ARM.TENTACLE, { hp: 55 })); setEnemyState(bossMan, E.IDLE); bossMan.stun = 0; bossMan.cooldown = 0; player.hp = 100; });
  log('[4] attackRange with tentacle', await ev(() => attackRangeOf(bossMan).toFixed(2)), 'base', await ev(() => CONFIG.enemyAttackRange));
  await o.faceBoss(3.2);
  const d0 = await ev(() => playerPos.distanceTo(bossMan.group.position));
  for (let i = 0; i < 60 && (await ev(() => player.hp)) >= 100; i++) await wait(50);
  const d1 = await ev(() => playerPos.distanceTo(bossMan.group.position));
  log('[4] tentacle hit from', d0.toFixed(2), 'm -> pulled to', d1.toFixed(2), 'm, hp', await ev(() => player.hp));
  await page.screenshot({ path: __dirname + '/shots/equip_tent.png' });
  log('errors', JSON.stringify(o.errors));
  await o.browser.close();
})();
