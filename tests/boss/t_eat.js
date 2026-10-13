const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const log = (...a) => console.log(...a);
  await o.startBoss();
  // --- ケース1：耐久60の右腕を奪わせる（男は弱っている＝食べる）---
  await ev(() => { bossMan.hp = bossMan.maxHp * 0.5; player.arms.RIGHT.hp = 60; player.arms.LEFT.lost = true; updateArmVisuals(); });
  await o.faceBoss(2.5);
  await ev(() => { bossMan.riseCd = 0; });
  for (let i = 0; i < 40 && (await ev(() => bossMan.state)) !== 'BOSS_EAT'; i++) await wait(100);
  log('state', await ev(() => bossMan.state), 'eat', await ev(() => bossMan.eat && JSON.stringify(bossMan.eat.armState)), 'playerR lost', await ev(() => player.arms.RIGHT.lost));
  const hp0 = await ev(() => bossMan.hp);
  for (let i = 0; i < 30 && (await ev(() => bossMan.eat.p)) < 0.5; i++) await wait(100);
  const p = await ev(() => bossMan.eat.p), hp1 = await ev(() => bossMan.hp);
  log('p', p.toFixed(2), 'boss hp', hp0.toFixed(1), '->', hp1.toFixed(1), 'sub:', await ev(() => subtitleEl.textContent));
  await page.screenshot({ path: __dirname + '/shots/eat_mid.png' });
  // ライジングで取り返す（右クリック＝右手）
  await page.keyboard.down('KeyQ'); await wait(600);
  const aimed = await o.aimAtEl('.shoulder-target.eat');
  const pAt = await ev(() => bossMan.eat ? bossMan.eat.p : -1);
  await page.screenshot({ path: __dirname + '/shots/eat_aim.png' });
  await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  await wait(200);
  log('aimed', aimed, 'p at cut', pAt.toFixed(3), 'boss', await ev(() => bossMan.state), 'eat', await ev(() => !!bossMan.eat), 'sub:', await ev(() => subtitleEl.textContent));
  await page.keyboard.up('KeyQ'); await wait(1500);
  const hpAfter = await ev(() => bossMan.hp);
  await wait(1500);
  log('player R', await ev(() => JSON.stringify(player.arms.RIGHT)), 'expected hp', Math.max(1, Math.round(60 - 100 * 0.2 * pAt)));
  log('boss hp after retrieve', hpAfter.toFixed(1), '1.5s later', (await ev(() => bossMan.hp)).toFixed(1));
  // --- ケース2：食べ切らせる ---
  await ev(() => { bossMan.eatCd = 0; bossMan.riseCd = 0; bossMan.eatHealed = 0; bossMan.hp = bossMan.maxHp * 0.5; player.arms.LEFT = makeArmState(ARM.GUN, { hp: 80 }); player.arms.RIGHT.lost = true; updateArmVisuals(); });
  await o.faceBoss(2.5);
  for (let i = 0; i < 40 && (await ev(() => bossMan.state)) !== 'BOSS_EAT'; i++) await wait(100);
  const subs = new Set();
  const hpA = await ev(() => bossMan.hp);
  for (let i = 0; i < 80 && (await ev(() => !!bossMan.eat)); i++) { subs.add(await ev(() => subtitleEl.classList.contains('hidden') ? '' : subtitleEl.textContent)); await wait(100); }
  await wait(300);
  subs.add(await ev(() => subtitleEl.textContent));
  log('full eat: boss hp', hpA.toFixed(1), '->', (await ev(() => bossMan.hp)).toFixed(1), 'healed', (await ev(() => bossMan.eatHealed)).toFixed(1), 'state', await ev(() => bossMan.state));
  log('subs:', [...subs].filter(Boolean).join(' / '));
  log('eat target visible?', await ev(() => !document.querySelector('.shoulder-target.eat').classList.contains('hidden')));
  // --- ケース3：食べている間に殴る ---
  await ev(() => { bossMan.eatCd = 0; bossMan.riseCd = 0; bossMan.eatHealed = 0; bossMan.hp = bossMan.maxHp * 0.5; player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); });
  await o.faceBoss(2.5);
  for (let i = 0; i < 40 && (await ev(() => bossMan.state)) !== 'BOSS_EAT'; i++) await wait(100);
  await ev(() => { playerPos.set(bossMan.group.position.x, 0, bossMan.group.position.z + 1.6); });
  const left = await ev(() => player.arms.LEFT.lost ? 'RIGHT' : 'LEFT');
  await page.mouse.down({ button: left === 'LEFT' ? 'left' : 'right' }); await wait(60); await page.mouse.up({ button: left === 'LEFT' ? 'left' : 'right' });
  await wait(400);
  log('hit while eating: state', await ev(() => bossMan.state), 'sub:', await ev(() => subtitleEl.textContent), 'queue', await ev(() => subtitleQueue.length));
  // スタンさせると腕を落とす
  await ev(() => { applyStun(bossMan, 999); });
  await wait(1200);
  log('stunned: state', await ev(() => bossMan.state), 'eat', await ev(() => !!bossMan.eat), 'ground arms', await ev(() => JSON.stringify(severedParts.map(p => p.armState && p.armState.hp))));
  log('errors', JSON.stringify(o.errors));
  await o.browser.close();
})();
