// 回帰：雑魚のスタン→掴みフィニッシャー／ライジングで首切り／ジャスト窓／デモ
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;

  o.section('雑魚：スタン中に殴ると掴みフィニッシャー');
  await ev(() => { const en = enemies[0]; playerPos.set(en.group.position.x, 0, en.group.position.z + 1.8); yaw = 0; applyStun(en, 999); });
  await wait(200);
  o.expect('雑魚がスタン', await ev(() => enemies[0].state), 'STUNNED');
  const c0 = await ev(() => corpses.length);
  await page.mouse.down({ button: 'left' }); await wait(40); await page.mouse.up({ button: 'left' });
  await o.waitFor(() => enemies[0].state === E.DEAD && enemies[0].headless, 5000);
  o.expect('掴みフィニッシャーで首が取れて倒れる', await ev(() => ({ state: enemies[0].state, headless: enemies[0].headless })), { state: 'DEAD', headless: true });
  o.expect('死体が1つ増える', await ev(() => corpses.length), c0 + 1);

  o.section('雑魚：スタン中はライジングで首を斬れる');
  await page.keyboard.press('KeyG'); await wait(300);
  await ev(() => { const en = enemies[1]; playerPos.set(en.group.position.x, 0, en.group.position.z + 3); yaw = 0; applyStun(en, 999); });
  await page.keyboard.down('KeyQ'); await wait(700);
  const tg = await ev(() => Object.fromEntries(targetEntries.filter((t) => t.enemy === enemies[1]).map((t) => [t.key, !t.el.classList.contains('hidden')])));
  o.expect('□：腕も首も出る', tg, { LEFT: true, RIGHT: true, HEAD: true });
  await ev(() => { targetEntries.find((t) => t.enemy === enemies[1] && t.key === 'HEAD').el.id = 'gH'; });
  o.expect('首の□を狙えた', await o.aimAtEl('#gH'), true);
  await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
  await wait(300); await page.keyboard.up('KeyQ'); await wait(800);
  o.expect('首を斬って倒す', await ev(() => ({ state: enemies[1].state, headless: enemies[1].headless })), { state: 'DEAD', headless: true });

  o.section('雑魚：通常攻撃のジャスト窓は今までどおり（予備動作の終わり際だけ）');
  await page.keyboard.press('KeyG'); await wait(300);
  o.expect('終わり際=ジャスト／出だし=ジャストでない', await ev(() => { const en = enemies[0]; setEnemyState(en, E.WINDUP); en.t = CONFIG.enemyWindup - 0.05; const a = isJustTiming(en); en.t = 0.1; const b = isJustTiming(en); setEnemyState(en, E.IDLE); return [a, b]; }), [true, false]);

  o.section('デモ：開始して敵が出る');
  await page.keyboard.press('KeyV'); await wait(800);
  await page.keyboard.down('KeyW'); await wait(2500); await page.keyboard.up('KeyW'); await wait(1500);
  o.expect('デモが戦闘中', await ev(() => DEMO.phase), 'FIGHT');
  o.expectTrue('敵が出ている', (await ev(() => DEMO.spawned.length)) > 0, await ev(() => DEMO.spawned.length));
  await o.finish();
})();
