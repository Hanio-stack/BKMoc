const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const log = (...a) => console.log(...a);
  // 雑魚：スタン → 掴みフィニッシャー
  const en0 = 0;
  await ev(() => { const en = enemies[0]; playerPos.set(en.group.position.x, 0, en.group.position.z + 1.8); yaw = 0; applyStun(en, 999); });
  await wait(200);
  log('grunt stunned', await ev(() => enemies[0].state));
  await page.mouse.down({ button: 'left' }); await wait(40); await page.mouse.up({ button: 'left' });
  await wait(1600);
  log('grunt after punch on stun (grab finisher):', await ev(() => enemies[0].state + ' headless=' + enemies[0].headless + ' corpses=' + corpses.length));
  // 雑魚：スタン中は首の□が出る（ライジングで首を斬れる）
  await page.keyboard.press('KeyG'); await wait(300);
  await ev(() => { const en = enemies[1]; playerPos.set(en.group.position.x, 0, en.group.position.z + 3); yaw = 0; applyStun(en, 999); });
  await page.keyboard.down('KeyQ'); await wait(700);
  log('grunt targets in rising:', await ev(() => targetEntries.filter(t => t.enemy === enemies[1]).map(t => t.key + ':' + (t.el.classList.contains('hidden') ? 'h' : 'S')).join(' ')));
  const hi = await ev(() => targetEntries.findIndex(t => t.enemy === enemies[1] && t.key === 'HEAD'));
  await ev((i) => { targetEntries[i].el.id = 'gH'; }, hi);
  log('aim', await o.aimAtEl('#gH'));
  await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
  await wait(300); await page.keyboard.up('KeyQ'); await wait(800);
  log('grunt head cut:', await ev(() => enemies[1].state + ' headless=' + enemies[1].headless));
  // 雑魚：通常攻撃のジャスト窓は今までどおり
  await page.keyboard.press('KeyG'); await wait(300);
  log('isJust grunt windup end:', await ev(() => { const en = enemies[0]; setEnemyState(en, E.WINDUP); en.t = CONFIG.enemyWindup - 0.05; const a = isJustTiming(en); en.t = 0.1; const b = isJustTiming(en); setEnemyState(en, E.IDLE); return a + '/' + b; }));
  // デモ：開始してウェーブが出る
  await page.keyboard.press('KeyV'); await wait(800);
  await page.keyboard.down('KeyW'); await wait(2500); await page.keyboard.up('KeyW'); await wait(1500);
  log('demo:', await ev(() => DEMO.phase + ' wave ' + DEMO.wave + ' live ' + DEMO.spawned.length));
  log('errors', JSON.stringify(o.errors));
  await o.browser.close();
})();
