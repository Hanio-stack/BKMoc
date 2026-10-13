// HP0 とラウンド進行：R1・R2 は自動で逃げる／R3 だけフィニッシャースタン→首切り or 蹴りで決着
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  // 男が体を捨てたときに作られた死体を覚えておく
  await ev(() => { const orig = bossLeaveBody; bossLeaveBody = function (en) { orig(en); window.__leftBody = BOSS.spawned[BOSS.spawned.length - 1]; }; });
  const snap = () => ev(() => ({ phase: BOSS.phase, round: BOSS.round, state: bossMan.state }));
  // 開始直後は待機（IDLE）か歩き出し（MOVE）のどちらか
  const startSnap = async () => { const s = await snap(); if (s.state === 'MOVE') s.state = 'IDLE'; return s; };

  // HP をほぼ削った状態で1発殴って HP0 にする
  const lethalPunch = async () => {
    await o.faceBoss(1.8);
    await ev(() => { bossMan.hp = 10; setEnemyState(bossMan, E.IDLE); bossMan.cooldown = 99; });
    await o.clearStates();
    await page.mouse.down({ button: 'left' }); await wait(40); await page.mouse.up({ button: 'left' });
    return o.waitFor(() => bossMan.hp <= 0, 3000);
  };

  // R1・R2 の HP0：BOSS_DOWN を経由せずに逃げて、次の部屋へ進めるか
  const autoFleeRound = async (round) => {
    o.section(`R${round}：HP0 で自動逃走`);
    o.expect(`R${round} 開始時の状態（IDLE/MOVE）`, await startSnap(), { phase: 'FIGHT', round, state: 'IDLE' });
    o.expect(`R${round} 開始時のアーマー（poise）は0`, await ev(() => bossMan.poise), 0);
    await ev(() => { window.__leftBody = null; });
    o.expect('殴って HP0 になった', await lethalPunch(), true);
    await wait(200);
    const st = await o.states();
    o.expectTrue('HP0 で BOSS_DOWN を経由しない', !st.includes('BOSS_DOWN'), st);
    o.expect('HP0 直後は FLEE（首が伸びて頭が抜ける途中）', (await snap()).state, 'FLEE');
    o.expect('フィニッシャースタンの□（首）は出ていない', await ev(() => partTargetable(bossMan, 'HEAD')), false);
    o.expect('頭がダクトへ向かっている（FLEE）', await o.waitFor(() => BOSS.phase === 'FLEE' && fleeHead.visible, 3000), true);
    o.expect('体が死体として残った（男のいた場所に死体がある）', await ev(() => {
      const c = window.__leftBody;
      return !!c && corpses.indexOf(c) >= 0 && c.group.position.distanceTo(bossMan.group.position) < 0.5;
    }), true);
    o.expect('本体は隠れている', await ev(() => bossMan.group.visible), false);
    o.expect('逃走が終わって次の部屋で待つ（WAIT）', await o.waitFor(() => BOSS.phase === 'WAIT', 6000), true);
    o.expect('逃げた頭は消えた', await ev(() => fleeHead.visible || !!BOSS.flee), false);
    const next = await ev(() => BOSS.next);
    o.expect('次の部屋の番号', next, round);   // R1→部屋B(1)、R2→部屋C(2)
    // 次の部屋へ
    await o.headToNextRoom();
    o.expect('次の部屋に入るとかくれんぼ（HIDE）', await snap(), { phase: 'HIDE', round: round + 1, state: 'HIDDEN' });
  };

  // ===== R1 =====
  await o.startBoss();
  await autoFleeRound(1);

  // ===== R2：通常スタンでは首を斬れない =====
  await o.findBoss();
  o.section('R2：通常スタンでは首が斬れない');
  o.expect('R2 は新しい体（両腕と首が付いている）', await ev(() =>
    ['LEFT', 'RIGHT'].every((k) => bossMan.parts[k].parent === bossMan.pivotRoot) && bossMan.parts.HEAD.visible), true);
  await ev(() => { applyStun(bossMan, 999); });
  o.expect('通常スタン', (await snap()).state, 'STUNNED');
  await o.faceBoss(3.0);
  await page.keyboard.down('KeyQ'); await wait(700);
  const tg = await ev(() => Object.fromEntries(targetEntries.filter((t) => t.enemy === bossMan)
    .map((t) => [t.key, !t.el.classList.contains('hidden')])));
  o.expect('ライジング中の□：腕は出る・首は出ない', tg, { LEFT: true, RIGHT: true, HEAD: false });
  // □を経由せずに首の切断を直接呼んでも斬れない
  await ev(() => { cutPart(targetEntries.find((t) => t.enemy === bossMan && t.key === 'HEAD'), 'LEFT'); });
  await wait(200);
  o.expect('首の切断を呼んでも状態は変わらない', (await snap()).state, 'STUNNED');
  o.expect('頭は付いたまま', await ev(() => bossMan.parts.HEAD.visible && bossMan.parts.HEAD.parent === bossMan.pivotRoot), true);
  await page.keyboard.up('KeyQ'); await wait(600);
  await ev(() => { setEnemyState(bossMan, E.IDLE); bossMan.stun = 0; });
  await autoFleeRound(2);

  // ===== R3：かくれんぼで見つけられずジャンプスケア → 開幕 =====
  o.section('R3：ジャンプスケアから開幕');
  await ev(() => { state = S.HUMAN; spineGroup.visible = false; headH = 0; BOSS.timer = 0.05; });
  o.expect('ジャンプスケア後に R3 開始', await o.waitFor(() => BOSS.phase === 'FIGHT', 8000), true);
  await ev(() => { bossMan.cooldown = 99; bossMan.riseCd = 99; bossMan.kickCd = 99; bossMan.gunCd = 99; });
  o.expect('R3 開始時の状態（IDLE/MOVE）', await startSnap(), { phase: 'FIGHT', round: 3, state: 'IDLE' });

  o.section('R3：HP0 でフィニッシャースタン → 放置しても逃げない');
  o.expect('殴って HP0 になった', await lethalPunch(), true);
  o.expect('BOSS_DOWN に入る', await o.waitFor(() => bossMan.state === E.BOSS_DOWN, 2000), true);
  await wait(3000);
  o.expect('3秒放置しても BOSS_DOWN のまま', await snap(), { phase: 'FIGHT', round: 3, state: 'BOSS_DOWN' });
  o.expect('頭は逃げていない', await ev(() => !fleeHead.visible && !BOSS.flee && bossMan.parts.HEAD.visible), true);

  o.section('R3：ライジングで首を斬ってクリア');
  await o.faceBoss(3.2);
  await page.keyboard.down('KeyQ'); await wait(700);
  o.expect('首の□が出ている', await ev(() => !targetEntries.find((t) => t.enemy === bossMan && t.key === 'HEAD').el.classList.contains('hidden')), true);
  await o.tagTarget('HEAD', 'tgHead');
  o.expect('首の□を狙えた', await o.aimAtEl('#tgHead'), true);
  await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
  await wait(300);
  await page.keyboard.up('KeyQ');
  o.expect('首切りで CLEAR', (await snap()).phase, 'CLEAR');
  o.expect('頭がダクトへ逃げる', await ev(() => fleeHead.visible), true);
  o.expect('逃げ切るとボスHPバーが消える', await o.waitFor(() => bossUi.hud.classList.contains('hidden') && !fleeHead.visible, 6000), true);

  // ===== もう一度 R3 まで進めて、今度は蹴りのフィニッシャーで決着 =====
  o.section('もう一度 R3 まで進めて、両腕なしで Space の蹴りフィニッシャー');
  await o.startBoss();
  for (const r of [1, 2]) {
    await lethalPunch();
    await o.waitFor(() => BOSS.phase === 'WAIT', 8000);
    await o.headToNextRoom();
    await o.findBoss();
  }
  o.expect('R3 に到達', await startSnap(), { phase: 'FIGHT', round: 3, state: 'IDLE' });
  await lethalPunch();
  o.expect('BOSS_DOWN に入る', await o.waitFor(() => bossMan.state === E.BOSS_DOWN, 2000), true);
  await ev(() => { player.arms.LEFT.lost = true; player.arms.RIGHT.lost = true; updateArmVisuals(); player.resource = 1; });
  await o.faceBoss(2.2);
  // 止めの一撃（殴り）が終わって次の行動を受け付けるまで待つ
  o.expect('殴りの動作が終わった', await o.waitFor(() => player.attack === null && canCancelNow(), 3000), true);
  await o.clearStates();
  await page.keyboard.press('Space');
  o.expect('蹴りのフィニッシャーが始まる', await o.waitFor(() => player.attack && player.attack.bossKick, 2000), true);
  o.expect('蹴り飛ばされる（BOSS_KICKED）', await o.waitFor(() => bossMan.state === E.BOSS_KICKED, 2000), true);
  o.expect('蹴りで CLEAR', await o.waitFor(() => BOSS.phase === 'CLEAR', 3000), true);
  o.expect('体は死体として残り、本体は隠れる', await o.waitFor(() => bossMan.state === E.FLEE && !bossMan.group.visible, 3000), true);
  o.expect('逃げ切るとボスHPバーが消える', await o.waitFor(() => bossUi.hud.classList.contains('hidden') && !fleeHead.visible, 6000), true);
  o.expect('フィニッシャーは1回だけ（BOSS_KICKED は1度）', (await o.states()).filter((s) => s === 'BOSS_KICKED').length, 1);
  await o.finish();
})();
