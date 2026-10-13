// G（リセット）／B（ボス戦へ）を色々な途中で押しても、何も残らずに最初の状態へ戻る
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  // 残っていてはいけないものを集める
  const leftovers = () => ev(() => ({
    phase: BOSS.phase, round: BOSS.round, state: bossMan.state, hp: bossMan.hp, maxHp: bossMan.maxHp, vis: bossMan.group.visible,
    poise: bossMan.poise, fleeRise: !!bossMan.fleeRise,
    eat: !!bossMan.eat, stolenFlying: stolenArms.length, bullets: bossBullets.length,
    flee: !!BOSS.flee, fleeHead: fleeHead.visible, sub: !subtitleEl.classList.contains('hidden'), queue: subtitleQueue.length,
    attack: !!player.attack, invuln: +player.invuln.toFixed(2), grafts: graftArms.length,
    eatTarget: !bossEatTargetEl.classList.contains('hidden'),
    bossArms: ['LEFT', 'RIGHT'].map((k) => bossMan.parts[k].parent === bossMan.pivotRoot ? bossMan.parts[k].userData.kind + (bossMan.parts[k].userData.armState ? '*' : '') : '-').join(','),
    head: bossMan.parts.HEAD.visible && bossMan.parts.HEAD.parent === bossMan.pivotRoot,
    stun: bossMan.stun, bonus: bossMan.bonusDamage, slow: +slowTimer.toFixed(2),
    playerArms: [player.arms.LEFT.lost, player.arms.RIGHT.lost].join(','),
  }));
  const clean = {
    phase: 'IDLE', round: 0, state: 'IDLE', hp: 500, maxHp: 500, vis: false, poise: 0, fleeRise: false,
    eat: false, stolenFlying: 0, bullets: 0, flee: false, fleeHead: false, sub: false, queue: 0,
    attack: false, invuln: 0, grafts: 0, eatTarget: false, bossArms: 'fist,fist', head: true,
    stun: 0, bonus: 0, slow: 0, playerArms: 'false,false',
  };
  const press = async (key, label) => {
    await ev(() => { bossMan.poise = 2; });   // 殴られて溜まったアーマーが残らないことも見る
    await page.keyboard.press(key); await wait(300);
    o.expect(`${key}：${label}の後に何も残らない`, await leftovers(), clean);
  };

  for (const key of ['KeyG', 'KeyB']) {
    o.section(key + ' で戻す');
    // a) 捕食中
    await o.startBoss();
    await ev(() => { bossMan.hp = bossMan.maxHp * 0.4; });
    await o.faceBoss(2.5);
    await ev(() => { bossMan.riseCd = 0; });
    o.expect('a) 捕食中になった', await o.waitFor(() => bossMan.state === E.BOSS_EAT, 6000), true);
    await wait(800);
    await press(key, '捕食中');
    // b) 奪った腕が飛んでいる途中
    await o.startBoss();
    await o.faceBoss(2.5);
    await ev(() => { bossMan.riseCd = 0; });
    o.expect('b) 奪った腕が飛んでいる', await o.waitFor(() => stolenArms.length > 0, 4000), true);
    await press(key, '腕が飛んでいる途中');
    // c) R1 の HP0 で首が抜けて自動で逃げる途中
    await o.startBoss();
    await o.faceBoss(1.8);
    await ev(() => { applyDamage(bossMan, 9999); });
    o.expect('c) R1 の HP0 で自動逃走中', await ev(() => ({ state: bossMan.state, fleeRise: !!bossMan.fleeRise })), { state: 'FLEE', fleeRise: true });
    await press(key, 'R1 自動逃走の途中');
    // d) R3 の蹴りのフィニッシャーの途中
    await o.startBoss();
    await o.faceBoss(1.8);
    await ev(() => { BOSS.round = 3; applyDamage(bossMan, 9999); });
    o.expect('d) R3 の HP0 でフィニッシャースタン', await ev(() => bossMan.state), 'BOSS_DOWN');
    await page.mouse.down({ button: 'left' }); await wait(40); await page.mouse.up({ button: 'left' });
    o.expect('d) 蹴りのフィニッシャー中', await o.waitFor(() => player.attack && player.attack.bossKick, 2000), true);
    await press(key, 'フィニッシャーの途中');
    // e) R3 で首を斬られて頭がダクトへ逃げている途中
    await o.startBoss();
    await o.faceBoss(1.8);
    await ev(() => { BOSS.round = 3; applyDamage(bossMan, 9999); bossHeadCut(bossMan); });
    await wait(400);
    o.expect('e) 頭が逃げている', await ev(() => ({ phase: BOSS.phase, head: fleeHead.visible })), { phase: 'CLEAR', head: true });
    await press(key, '頭が逃げている途中');
    // f) 銃を撃たれて弾が飛んでいる途中
    await o.startBoss();
    await ev(() => { bossSetArm(bossMan, 'LEFT', makeArmState(ARM.GUN)); bossMan.gunCd = 0; bossMan.cooldown = 0; });
    await o.faceBoss(8);
    o.expect('f) 弾が飛んでいる', await o.waitFor(() => bossBullets.length > 0, 4000), true);
    await press(key, '弾が飛んでいる途中');
  }
  o.section('リセット後にもう一度ボス戦を始めても普通に戦える');
  await o.startBoss();
  o.expect('開始時のアーマー（poise）は0', await ev(() => bossMan.poise), 0);
  await o.faceBoss(2.5);
  await ev(() => { bossMan.cooldown = 0; });
  o.expect('男が攻撃してくる', await o.waitFor(() => player.hp < 100, 5000), true);
  o.expect('戦闘中', await ev(() => BOSS.phase), 'FIGHT');
  await o.finish();
})();
