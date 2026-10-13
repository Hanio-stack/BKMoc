const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const log = (...a) => console.log(...a);
  await o.startBoss();
  const arms = () => ev(() => (player.arms.LEFT.lost ? 'x' : 'o') + (player.arms.RIGHT.lost ? 'x' : 'o'));
  const reset = async () => { await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); player.resource = player.resMax; player.hp = 100; updateArmVisuals(); bossClearEat(bossMan); setEnemyState(bossMan, E.IDLE); bossMan.riseCd = 99; bossMan.cooldown = 99; }); await o.faceBoss(2.6); await wait(300); };
  const startRise = () => ev(() => { bossMan.riseCd = 0; bossMan.cooldown = 99; });
  const waitState = async (s, max) => { for (let i = 0; i < (max || 40) && (await ev(() => bossMan.state)) !== s; i++) await wait(50); return ev(() => bossMan.state); };

  // 1) 何もしない → 腕を取られる。スローにならない（worldTime が実時間どおり進む）
  await reset(); await startRise(); await waitState('BOSS_RISE');
  const w0 = await ev(() => [worldTime, performance.now()]);
  await wait(600);
  const w1 = await ev(() => [worldTime, performance.now()]);
  log('[1] no slow during boss rise: world/real =', ((w1[0] - w0[0]) / ((w1[1] - w0[1]) / 1000)).toFixed(2), 'slowTimer', await ev(() => slowTimer), 'timeScaleRising?', await ev(() => state));
  await wait(1200);
  log('[1] arms after taking no action:', await arms());

  // 2) ジャスト窓でドッジ → 腕は無事・リソース+1
  await reset(); await startRise(); await waitState('BOSS_RISE');
  for (let i = 0; i < 60 && !(await ev(() => isJustTiming(bossMan))); i++) await wait(20);
  const r0 = await ev(() => player.resource);
  await ev(() => { player.resource = 2; });
  await page.keyboard.press('ShiftLeft');
  await wait(1200);
  log('[2] just dodge: arms', await arms(), 'resource 2 ->', await ev(() => player.resource), 'slowTimer was set?', await ev(() => slowScaleOverride));

  // 3) 予備動作中にキック → 止まる
  await reset(); await startRise(); await waitState('BOSS_RISE');
  await wait(300);
  await page.keyboard.press('Space');
  await wait(400);
  log('[3] kick interrupt: boss', await ev(() => bossMan.state), 'arms', await arms());
  await wait(1200);
  log('[3] later arms', await arms());

  // 4) 間合いの外へ逃げる
  await reset(); await startRise(); await waitState('BOSS_RISE');
  await ev(() => { playerPos.z += 3.0; });
  await wait(1500);
  log('[4] escape range: arms', await arms());

  // 5) 振り抜いた後のキックでは止まらない（もう取られている）
  await reset(); await startRise(); await waitState('BOSS_RISE');
  for (let i = 0; i < 80 && !(await ev(() => bossMan.riseDone)); i++) await wait(20);
  await page.keyboard.press('Space'); await wait(300);
  log('[5] late kick: arms', await arms(), 'boss', await ev(() => bossMan.state));
  log('errors', JSON.stringify(o.errors));
  await o.browser.close();
})();
