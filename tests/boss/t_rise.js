// 男のライジング（腕を奪う）：スローにならない／ジャスト回避・予備動作中のキック・間合いの外で防げる
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  await o.startBoss();
  const arms = () => ev(() => (player.arms.LEFT.lost ? 'x' : 'o') + (player.arms.RIGHT.lost ? 'x' : 'o'));
  // 前の項目で奪われて飛んでいる腕も片付ける（届くと食べ始めてしまう）
  const reset = async () => { await ev(() => { for (const a of stolenArms) scene.remove(a.obj); stolenArms = []; player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); player.resource = player.resMax; player.hp = 100; updateArmVisuals(); bossClearEat(bossMan); setEnemyState(bossMan, E.IDLE); bossMan.riseCd = 99; bossMan.cooldown = 99; }); await o.faceBoss(2.6); await wait(300); };
  const startRise = async () => {
    await ev(() => { bossMan.riseCd = 0; bossMan.cooldown = 99; });
    const ok = await o.waitFor(() => bossMan.state === E.BOSS_RISE, 3000);
    o.expectTrue('男のライジングが始まる', ok, await ev(() => ({ state: bossMan.state, t: +bossMan.t.toFixed(2), eat: !!bossMan.eat, stolen: stolenArms.length, riseCd: bossMan.riseCd })));
    return ok;
  };

  o.section('1) 何もしないと腕を1本取られる。スローにならない');
  await reset();
  await startRise();
  const w0 = await ev(() => [worldTime, performance.now()]);
  await wait(600);
  const w1 = await ev(() => [worldTime, performance.now()]);
  const ratio = (w1[0] - w0[0]) / ((w1[1] - w0[1]) / 1000);
  o.expectTrue('ゲーム内時間が実時間どおり進む（スローなし）', ratio > 0.8, +ratio.toFixed(2));
  o.expect('スロー演出は掛かっていない', await ev(() => slowTimer), 0);
  o.expect('プレイヤーはライジング状態にならない', await ev(() => state), 'HUMAN');
  await wait(1200);
  o.expectTrue('腕を1本取られた', ['xo', 'ox'].includes(await arms()), await arms());

  o.section('2) ジャスト窓でドッジ → 腕は無事・リソース+1');
  await reset();
  await startRise();
  // ジャスト窓に入った瞬間にページ内でドッジを押す（テスト側の遅延を除く）
  const r = await ev(() => new Promise((res) => {
    const iv = setInterval(() => {
      if (isJustTiming(bossMan)) {
        clearInterval(iv);
        player.resource = player.resMax - 1;
        const before = player.resource;
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
        res({ before, after: player.resource, state: bossMan.state });
      }
    }, 5);
  }));
  o.expect('ジャスト窓は男のライジングの終わり際', r.state, 'BOSS_RISE');
  o.expect('リソースが1増える', r.after, r.before + 1);
  await wait(1200);
  o.expect('両腕とも無事', await arms(), 'oo');

  o.section('3) 予備動作中にキック → 止まる');
  await reset();
  await startRise();
  await wait(300);
  await page.keyboard.press('Space');
  await wait(400);
  o.expectTrue('男のライジングが止まる', (await ev(() => bossMan.state)) !== 'BOSS_RISE', await ev(() => bossMan.state));
  await wait(1200);
  o.expect('両腕とも無事', await arms(), 'oo');

  o.section('4) 間合いの外へ逃げる');
  await reset();
  await startRise();
  await ev(() => { playerPos.z += 3.0; });
  await wait(1500);
  o.expect('両腕とも無事', await arms(), 'oo');

  o.section('5) 振り抜いた後のキックでは間に合わない');
  await reset();
  await startRise();
  await o.waitFor(() => bossMan.riseDone, 3000);
  await page.keyboard.press('Space'); await wait(300);
  o.expectTrue('腕を1本取られた', ['xo', 'ox'].includes(await arms()), await arms());
  await o.finish();
})();
