const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const log = (...a) => console.log(...a);
  await o.startBoss();
  const info = () => ev(() => 'phase=' + BOSS.phase + ' round=' + BOSS.round + ' state=' + bossMan.state + ' hp=' + Math.round(bossMan.hp) + ' flee=' + !!BOSS.flee + ' fleeHeadVis=' + fleeHead.visible);

  // ===== R1：殴ってHP0 → フィニッシャースタン → 殴る＝蹴りのフィニッシャー =====
  await o.faceBoss(1.8);
  await ev(() => { bossMan.hp = 15; bossMan.cooldown = 99; });
  await page.mouse.down({ button: 'left' }); await wait(60); await page.mouse.up({ button: 'left' });
  await wait(500);
  log('[R1] after lethal punch:', await info(), '| sub:', await ev(() => subtitleEl.textContent));
  // 少し待っても勝手に逃げない
  await wait(2500);
  log('[R1] 2.5s later still:', await info());
  // 首の□が出る（ライジング）
  await page.keyboard.down('KeyQ'); await wait(700);
  log('[R1] down targets:', await ev(() => targetEntries.filter(t => t.enemy === bossMan).map(t => t.key + ':' + (t.el.classList.contains('hidden') ? 'h' : 'S')).join(' ')));
  await page.screenshot({ path: __dirname + '/shots/down_rise.png' });
  await page.keyboard.up('KeyQ'); await wait(500);
  // 殴る → 蹴りのフィニッシャー（連打しても1回だけ）
  await o.faceBoss(2.0);
  const php = await ev(() => player.arms.LEFT.hp);
  for (let i = 0; i < 4; i++) { await page.mouse.down({ button: 'left' }); await wait(40); await page.mouse.up({ button: 'left' }); await wait(60); }
  await wait(250);
  await page.screenshot({ path: __dirname + '/shots/kick_fin.png' });
  log('[R1] finisher started:', await ev(() => player.attack && player.attack.bossKick), 'arm hp unchanged', php, '->', await ev(() => player.arms.LEFT.hp));
  await wait(400);
  await page.screenshot({ path: __dirname + '/shots/kick_fin2.png' });
  await wait(1500);
  log('[R1] after kick:', await info(), '| corpses in arena', await ev(() => BOSS.spawned.length), '| sub:', await ev(() => subtitleEl.textContent));
  await wait(1500);
  log('[R1] head arrived:', await info());

  // ===== 追う：頭モードでダクトを抜けて部屋Bへ =====
  await ev(() => { state = S.HEAD; headH = 0.3; spineGroup.visible = true; playerPos.set(0, 0, -40); });
  await wait(400);
  log('[R2] hide:', await info(), 'hideBody', await ev(() => !!BOSS.hideBody));
  // 見つけて殴る（乗っ取りではなく、人間に戻ってから殴る想定：直接 bossFound）
  await ev(() => { state = S.HUMAN; spineGroup.visible = false; bossFound(true); });
  await wait(600);
  log('[R2] fight:', await info(), 'boss body restored:', await ev(() => ['LEFT', 'RIGHT'].map(k => bossMan.parts[k].parent === bossMan.pivotRoot).join(',') + ' head ' + bossMan.parts.HEAD.visible));
  // HP0 → ライジングで首を斬る
  await ev(() => { bossMan.cooldown = 99; bossMan.riseCd = 99; applyDamage(bossMan, 9999); });
  await o.faceBoss(3.2);
  await page.keyboard.down('KeyQ'); await wait(700);
  const hi = await ev(() => targetEntries.findIndex(t => t.enemy === bossMan && t.key === 'HEAD'));
  await ev((i) => { targetEntries[i].el.id = 'tgH'; }, hi);
  log('[R2] aimed head', await o.aimAtEl('#tgH'));
  await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
  await wait(300);
  await page.screenshot({ path: __dirname + '/shots/head_cut.png' });
  await page.keyboard.up('KeyQ');
  await wait(2500);
  log('[R2] after head cut:', await info());

  // ===== R3：かくれんぼで見つからずジャンプスケア → 開幕 → HP0 → キック(Space) =====
  await ev(() => { state = S.HEAD; headH = 0.3; spineGroup.visible = true; playerPos.set(20, 0, -40); });
  await wait(400);
  log('[R3] hide:', await info());
  await ev(() => { state = S.HUMAN; spineGroup.visible = false; BOSS.timer = 0.05; });
  await wait(4000);
  log('[R3] after jumpscare:', await info());
  await ev(() => { bossMan.cooldown = 99; bossMan.riseCd = 99; applyDamage(bossMan, 9999); player.arms.LEFT.lost = true; player.arms.RIGHT.lost = true; updateArmVisuals(); player.resource = 1; });
  await o.faceBoss(2.0);
  await page.keyboard.press('Space');     // 両腕が無くてもキックで決着できる
  await wait(2500);
  log('[R3] after kick finisher:', await info(), '| hud hidden', await ev(() => bossUi.hud.classList.contains('hidden')), '| sub:', await ev(() => subtitleEl.textContent));
  await wait(1500);
  log('[R3] end:', await info(), '| objective', await ev(() => currentObjective().text));
  log('errors', JSON.stringify(o.errors));
  await o.browser.close();
})();
