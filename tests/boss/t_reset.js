const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const log = (...a) => console.log(...a);
  // 残っていてはいけないものを数える
  const leftovers = () => ev(() => JSON.stringify({
    phase: BOSS.phase, state: bossMan.state, hp: bossMan.hp, vis: bossMan.group.visible,
    eat: !!bossMan.eat, stolenFlying: stolenArms.length, bullets: bossBullets.length,
    flee: !!BOSS.flee, fleeHead: fleeHead.visible, sub: !subtitleEl.classList.contains('hidden'), queue: subtitleQueue.length,
    attack: !!player.attack, invuln: +player.invuln.toFixed(2), grafts: graftArms.length,
    eatTarget: !bossEatTargetEl.classList.contains('hidden'),
    bossArms: ['LEFT', 'RIGHT'].map(k => bossMan.parts[k].parent === bossMan.pivotRoot ? bossMan.parts[k].userData.kind + (bossMan.parts[k].userData.armState ? '*' : '') : '-').join(','),
    head: bossMan.parts.HEAD.visible && bossMan.parts.HEAD.parent === bossMan.pivotRoot,
    stun: bossMan.stun, bonus: bossMan.bonusDamage, slow: +slowTimer.toFixed(2),
    playerArms: [player.arms.LEFT.lost, player.arms.RIGHT.lost].join(','),
  }));
  for (const key of ['KeyG', 'KeyB']) {
    // a) 捕食中
    await o.startBoss();
    await ev(() => { bossMan.hp = bossMan.maxHp * 0.4; });
    await o.faceBoss(2.5);
    await ev(() => { bossMan.riseCd = 0; });
    for (let i = 0; i < 60 && (await ev(() => bossMan.state)) !== 'BOSS_EAT'; i++) await wait(80);
    await wait(800);
    log(key, 'a) during eat     ', await ev(() => bossMan.state));
    await page.keyboard.press(key); await wait(300);
    log(key, 'a) after reset    ', await leftovers());
    // b) 奪った腕が飛んでいる途中
    await o.startBoss();
    await o.faceBoss(2.5);
    await ev(() => { bossMan.riseCd = 0; });
    for (let i = 0; i < 80 && (await ev(() => stolenArms.length)) === 0; i++) await wait(25);
    log(key, 'b) arm flying     ', await ev(() => stolenArms.length));
    await page.keyboard.press(key); await wait(300);
    log(key, 'b) after reset    ', await leftovers());
    // c) 蹴りのフィニッシャーの途中
    await o.startBoss();
    await o.faceBoss(1.8);
    await ev(() => { applyDamage(bossMan, 9999); });
    await page.mouse.down({ button: 'left' }); await wait(40); await page.mouse.up({ button: 'left' });
    await wait(250);
    log(key, 'c) mid finisher   ', await ev(() => player.attack && player.attack.bossKick), await ev(() => bossMan.state));
    await page.keyboard.press(key); await wait(300);
    log(key, 'c) after reset    ', await leftovers());
    // d) 頭がダクトへ逃げている途中
    await o.startBoss();
    await o.faceBoss(1.8);
    await ev(() => { applyDamage(bossMan, 9999); bossHeadCut(bossMan); });
    await wait(400);
    log(key, 'd) fleeing        ', await ev(() => BOSS.phase + ' ' + fleeHead.visible));
    await page.keyboard.press(key); await wait(300);
    log(key, 'd) after reset    ', await leftovers());
    // e) 銃を撃たれて弾が飛んでいる途中
    await o.startBoss();
    await ev(() => { bossSetArm(bossMan, 'LEFT', makeArmState(ARM.GUN)); bossMan.gunCd = 0; bossMan.cooldown = 0; });
    await o.faceBoss(8);
    for (let i = 0; i < 80 && (await ev(() => bossBullets.length)) === 0; i++) await wait(25);
    log(key, 'e) bullet flying  ', await ev(() => bossBullets.length));
    await page.keyboard.press(key); await wait(300);
    log(key, 'e) after reset    ', await leftovers());
  }
  // リセット後にもう一度ボス戦を始めても普通に戦える
  await o.startBoss();
  await o.faceBoss(2.5);
  await ev(() => { bossMan.cooldown = 0; });
  await wait(2500);
  log('restart ok:', await ev(() => BOSS.phase + ' ' + bossMan.state + ' php ' + player.hp));
  log('errors', JSON.stringify(o.errors));
  await o.browser.close();
})();
