// 爆弾腕：実際のライジング・交換・乗っ取り・頭モード・パージで、ピンが抜ける／抜けないと爆発を確かめる
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const arm = (s) => ev((s) => JSON.parse(JSON.stringify(player.arms[s])), s);
  const stats = () => ev(() => ({ pulls: bombStats.pulls, blasts: bombStats.blasts }));
  const fresh = async () => {
    await page.keyboard.press('KeyT'); await wait(400);
    await ev(() => { for (const e of LAB.enemies) e.cooldown = 99; CONFIG.enemyDodgeChance = 0; CONFIG.enemyDodgeForceHits = 999; });
  };
  // 爆弾敵の腕をライジングで斬る（key は敵の腕、btn は自分の付く側）
  const cutEnemyArm = async (i, key, btn) => {
    await ev(([i]) => { const en = LAB.enemies[i]; en.cooldown = 99; applyStun(en, 999);
      playerPos.set(en.group.position.x, 0, en.group.position.z + 3.2); yaw = 0; pitch = -0.1; }, [i]);
    await o.ready();
    await o.rise();
    await ev(([i, key]) => { targetEntries.find((t) => t.enemy === LAB.enemies[i] && t.key === key).el.id = 'cut' + i + key; }, [i, key]);
    const ok = await o.aimAtEl('#cut' + i + key);
    await page.mouse.down({ button: btn }); await page.mouse.up({ button: btn });
    await wait(150);
    await page.keyboard.up('KeyQ');
    await o.waitFor(() => state === S.HUMAN, 3000);
    return ok;
  };
  await fresh();
  // 交換用の腕（床）から 2.4m 離れて、その腕を見下ろす。近すぎると□の狙いが行き過ぎる
  const faceSpare = (right) => ev((right) => {
    const p = severedParts.find((q) => q.lab && q.armState.kind === 'fist' && (right ? q.obj.position.x > LAB.cx : q.obj.position.x < LAB.cx));
    p.el.id = right ? 'spareR' : 'spareL';
    const t = p.obj.position;
    playerPos.set(t.x + (right ? -2.4 : 2.4), 0, t.z - 0.6);
    const dx = t.x - playerPos.x, dz = t.z - playerPos.z;
    yaw = Math.atan2(-dx, -dz); pitch = -0.55;
    return p.el.id;
  }, right);

  o.section('C1/C2：爆弾は腕の種類と別。拳腕・銃腕・触手腕に付く。チェーンとピンが見える');
  o.expect('爆弾付き拳腕の敵（左）・爆弾付き銃腕の敵（右）', await ev(() => [
    LAB.enemies[4].parts.LEFT.userData.kind + (LAB.enemies[4].parts.LEFT.userData.bomb ? '+bomb' : ''),
    LAB.enemies[5].parts.RIGHT.userData.kind + (LAB.enemies[5].parts.RIGHT.userData.bomb ? '+bomb' : '')]), ['fist+bomb', 'gun+bomb']);
  await ev(() => { playerPos.set(LAB.cx - 4.4, 0, LAB.cz - 1.5); yaw = 0.15; pitch = -0.08; });
  await wait(400);
  o.expect('敵のチェーンが見えている', await ev(() => [LAB.enemies[4].bombRig.LEFT.chain.group.visible, LAB.enemies[5].bombRig.RIGHT.chain.group.visible]), [true, true]);
  o.expect('安全ピンが刺さっている', await ev(() => LAB.enemies[4].parts.LEFT.userData.addons.bomb.userData.pin.visible), true);
  await page.screenshot({ path: __dirname + '/shots/bomb_enemy.png' });
  o.expect('触手腕にも付けられる（自分の腕・一人称に爆弾が見える）', await ev(() => {
    player.arms.LEFT = makeArmState(ARM.TENTACLE, { bomb: { armed: false } }); updateArmVisuals();
    const r = !!fpHands.LEFT.userData.addons.bomb;
    player.arms.LEFT = makeArmState(ARM.FIST); updateArmVisuals();
    return r;
  }), true);

  o.section('C3〜C5：直接奪うとピンが抜け、自分に付いてからも秒読みが続いて、設定した猶予で爆発');
  const s0 = await stats();
  const hp0 = await ev(() => player.hp);
  // ピンが抜けた瞬間と爆発の瞬間をワールド時間で記録する
  await ev(() => {
    window.__pinAt = null; window.__boomAt = null;
    const origSnaps = updateBombSnaps;
    updateBombSnaps = function (rdt) { const had = bombSnaps.length; origSnaps(rdt); if (had && !bombSnaps.length && window.__pinAt === null) window.__pinAt = worldTime; };
    const origBoom = explodeBomb;
    explodeBomb = function (pos, opts) { if (window.__boomAt === null) window.__boomAt = worldTime; return origBoom(pos, opts); };
  });
  o.expect('爆弾付き拳腕を斬れた', await cutEnemyArm(4, 'LEFT', 'left'), true);
  o.expect('ピンが抜けた', (await stats()).pulls - s0.pulls, 1);
  await o.waitFor(() => player.arms.LEFT.swapped && !graftArms.length, 3000);
  const attached = await arm('LEFT');
  o.expect('奪った腕は自分の左腕に付いた（爆弾は起爆待ち）', { swapped: attached.swapped, armed: attached.bomb && attached.bomb.armed }, { swapped: true, armed: true });
  o.expectTrue('吸着しても秒読みは続いている（残りが猶予より短い）', attached.bomb.fuse < await ev(() => CONFIG.bombFuse), attached.bomb.fuse);
  o.expect('HUDの左腕のランプが点滅（armed）', await ev(() => hudCircle.LEFT.el.classList.contains('armed')), true);
  await page.screenshot({ path: __dirname + '/shots/bomb_attached.png' });
  o.expect('爆発した', await o.waitFor(() => bombStats.blasts > 0 && window.__boomAt !== null, 8000), true);
  const t = await ev(() => ({ pin: window.__pinAt, boom: window.__boomAt, fuse: CONFIG.bombFuse }));
  o.expectTrue('ピンが抜けてから設定した猶予で爆発（±0.1s）', Math.abs((t.boom - t.pin) - t.fuse) < 0.1, +(t.boom - t.pin).toFixed(3));
  o.expect('自分の腕に付いたまま爆発（腕ごと吹き飛ぶ）', await ev(() => ({ attached: bombStats.last.attached, lost: player.arms.LEFT.lost, bomb: player.arms.LEFT.bomb })), { attached: true, lost: true, bomb: null });
  o.expectTrue('自分もダメージを受けた', (await ev(() => player.hp)) < hp0, await ev(() => player.hp));
  o.expect('爆発は1回だけ', (await stats()).blasts - s0.blasts, 1);

  o.section('C6：倒した爆弾腕の敵の死体を乗っ取ると起爆しない');
  await fresh();
  await ev(() => { const en = LAB.enemies[4]; applyDamage(en, 999); });
  const s1 = await stats();
  o.expect('死体の左腕は爆弾付き（ピンは刺さったまま）', await ev(() => { const c = corpses[corpses.length - 1]; return c.arms.LEFT.bomb; }), { armed: false });
  await ev(() => { const c = corpses[corpses.length - 1]; playerPos.set(c.group.position.x, 0, c.group.position.z + 3); yaw = 0; pitch = -0.3; });
  await o.rise();
  await ev(() => { const c = corpses[corpses.length - 1]; c.el.id = 'bombCorpse'; });
  o.expect('死体の首元を狙えた', await o.aimAtEl('#bombCorpse'), true);
  await page.keyboard.press('KeyF');
  await page.keyboard.up('KeyQ');
  o.expect('乗っ取った', await o.waitFor(() => state === S.HUMAN && player.arms.LEFT.swapped, 5000), true);
  await wait(2500);
  o.expect('ピンは抜けず爆発もしない', await stats(), s1);
  o.expect('左腕は爆弾付きのまま安全', (await arm('LEFT')).bomb, { armed: false });
  o.expect('一人称の胸へのチェーンが見えている', await ev(() => playerBombRig.fp.LEFT.group.visible), true);
  await page.screenshot({ path: __dirname + '/shots/bomb_possessed.png' });

  o.section('C7〜C9：別の腕と交換すると、捨てた爆弾腕が落ちた先で爆発する。離れれば無傷、敵は巻き込む');
  const s2 = await stats();
  await ev(() => { player.hp = 100; });
  await faceSpare(false);
  await o.ready();
  await o.rise();
  o.expect('交換用の腕を狙えた', await o.aimAtEl('#spareL'), true);
  await o.click('left'); await wait(200);
  await page.keyboard.up('KeyQ');
  await o.waitFor((n) => bombStats.pulls > n, 3000, s2.pulls);
  o.expect('捨てた爆弾腕のピンが抜けた', (await stats()).pulls - s2.pulls, 1);
  o.expect('左腕は新しい拳（爆弾なし）', await o.waitFor(() => !graftArms.length && player.arms.LEFT.bomb === null && !player.arms.LEFT.swapped, 3000), true);
  // 落ちた場所を覚えて、そこへ雑魚を1体連れてくる。自分は離れる
  await o.waitFor(() => severedParts.some((q) => q.armState && q.armState.bomb && q.phase === 'grounded'), 3000);
  const groundAt = await ev(() => { const p = severedParts.find((q) => q.armState && q.armState.bomb); return { x: p.obj.position.x, z: p.obj.position.z }; });
  await ev((g) => { const en = LAB.enemies[0]; en.group.position.set(g.x + 1.2, 0, g.z); en.cooldown = 99; setEnemyState(en, E.IDLE);
    // その場に立たせておく（自分の区画にプレイヤーがいなければ、家＝ここに留まる）
    en.room = { x0: 9999, x1: 9999, z0: 9999, z1: 9999 }; en.home.copy(en.group.position);
    playerPos.set(g.x + 7.5, 0, g.z - 0.5); }, groundAt);
  const hpFar = await ev(() => player.hp);
  o.expect('爆発した', await o.waitFor((n) => bombStats.blasts > n, 6000, s2.blasts), true);
  const last = await ev(() => bombStats.last);
  o.expectTrue('捨てた腕の位置で爆発した（0.5m以内）', Math.hypot(last.pos.x - groundAt.x, last.pos.z - groundAt.z) < 0.5, [+last.pos.x.toFixed(2), +last.pos.z.toFixed(2)]);
  o.expect('付いたままの爆発ではない', last.attached, false);
  o.expect('離れていれば無傷', await ev(() => player.hp), hpFar);
  o.expectTrue('近くの雑魚を巻き込んだ（HPが減った）', (await ev(() => LAB.enemies[0] ? LAB.enemies[0].hp : 0)) < 100, await ev(() => LAB.enemies[0] && LAB.enemies[0].hp));
  o.expect('床から捨てた腕は消えた', await ev(() => severedParts.some((q) => q.armState && q.armState.bomb)), false);

  o.section('C10：腕HP0では爆発しない（ピンも抜けない）');
  await fresh();
  await ev(() => { player.arms.RIGHT = makeArmState(ARM.FIST, { hp: CONFIG.armHitCost, bomb: { armed: false } }); updateArmVisuals(); });
  const s3 = await stats();
  await ev(() => { const en = LAB.enemies[0]; en.group.position.set(LAB.cx - 6, 0, LAB.cz + 4.4); playerPos.set(LAB.cx - 6, 0, LAB.cz + 6.2); yaw = 0; pitch = 0; setEnemyState(en, E.IDLE); });
  await o.ready();
  await o.click('right'); await wait(1800);
  o.expect('右腕は壊れた', (await arm('RIGHT')).lost, true);
  o.expect('爆弾も一緒に消えた', (await arm('RIGHT')).bomb, null);
  o.expect('ピンは抜けず爆発もしない', await stats(), s3);

  o.section('C11：頭モードへ移っても爆発しない。乗っ取り直しても安全なまま');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST, { bomb: { armed: false }, hp: 77 }); updateArmVisuals(); playerPos.set(LAB.cx, 0, LAB.cz + 12); yaw = 0; pitch = 0; });
  const s4 = await stats();
  await o.ready();
  await page.keyboard.down('KeyQ'); await wait(500);
  await page.keyboard.press('Space'); await wait(300);
  await page.keyboard.up('KeyQ');
  o.expect('頭モード', await ev(() => state), 'HEAD');
  o.expect('残した体の左腕は爆弾付きで安全', await ev(() => { const c = corpses[corpses.length - 1]; return c.arms.LEFT.bomb; }), { armed: false });
  o.expect('残した体のチェーンが見えている', await ev(() => { const c = corpses[corpses.length - 1]; return !!(c.bombRig && c.bombRig.LEFT.chain.group.visible); }), true);
  await page.screenshot({ path: __dirname + '/shots/bomb_headmode.png' });
  await page.keyboard.press('KeyF');
  o.expect('乗っ取り直した', await o.waitFor(() => state === S.HUMAN, 5000), true);
  await wait(2200);
  o.expect('爆弾は安全なまま・HPもそのまま', [(await arm('LEFT')).bomb, (await arm('LEFT')).hp], [{ armed: false }, 77]);
  o.expect('ピンは抜けず爆発もしない', await stats(), s4);

  o.section('C12/C13：手首をパージしても爆発しない。スキャナ付きの爆弾腕も正しく動く');
  await o.ready();
  await o.hold('left', 700); await wait(500);
  o.expect('パージした（爆弾は付いたまま安全）', [(await arm('LEFT')).purged, (await arm('LEFT')).bomb], [true, { armed: false }]);
  o.expect('ピンは抜けていない', await stats(), s4);
  await ev(() => { playerPos.set(LAB.cx - 2.5, 0, LAB.cz + 11.7); yaw = 0; pitch = -0.3; });
  await o.ready(); await o.click('left'); await wait(500);
  o.expect('爆弾腕にスキャナが付いた', [(await arm('LEFT')).wrist, (await arm('LEFT')).bomb], [{ id: 'scanner' }, { armed: false }]);
  await ev(() => { playerPos.set(LAB.cx + 6, 0, LAB.cz + 9); yaw = 0; pitch = -0.05; });
  const sc0 = await ev(() => scanStats.scans);
  await o.ready(); await o.click('left');
  await o.waitFor((n) => scanStats.scans > n && !scanRipples.length, 8000, sc0);
  o.expect('スキャンできる', (await ev(() => scanStats.scans)) - sc0, 1);
  o.expect('スキャンでピンは抜けない', await stats(), s4);
  // 交換すると、スキャナ付きの爆弾腕でもピンが抜けて爆発する
  await faceSpare(true);
  await o.ready();
  await o.rise();
  o.expect('交換用の腕を狙えた', await o.aimAtEl('#spareR'), true);
  await o.click('left'); await wait(200);
  await page.keyboard.up('KeyQ');
  await o.waitFor(() => severedParts.some((q) => q.armState && q.armState.wrist && q.armState.bomb), 3000);
  o.expect('捨てた腕はスキャナ付きでピンが抜けた', await ev(() => { const p = severedParts.find((q) => q.armState && q.armState.wrist && q.armState.bomb); return p && p.armState.bomb.armed; }), true);
  await ev(() => { playerPos.x -= 8; });
  o.expect('落ちた先で爆発した', await o.waitFor((n) => bombStats.blasts > n, 6000, s4.blasts), true);

  o.section('C14：二重起爆・秒読みの残り・消えた物への参照が残らない');
  await wait(800);
  o.expect('爆発の演出・ピン・チェーンが片付いた', await ev(() => ({ snaps: bombSnaps.length, pins: bombPins.length, blasts: bombBlasts.length })), { snaps: 0, pins: 0, blasts: 0 });
  o.expect('起爆待ちの爆弾がどこにも残っていない', await ev(() => {
    const armed = (st) => !!(st && st.bomb && st.bomb.armed);
    return ['LEFT', 'RIGHT'].some((s) => armed(player.arms[s])) || graftArms.some((g) => armed(g.armState)) ||
      severedParts.some((p) => armed(p.armState)) || corpses.some((c) => armed(c.arms.LEFT) || armed(c.arms.RIGHT));
  }), false);
  o.expect('シーンから外れた爆弾の見た目を追い続けていない', await ev(() => { updateBombVisuals(0.016); return [...bombVisuals].every((g) => inScene(g)); }), true);
  await page.keyboard.press('KeyG'); await wait(400);
  o.expect('リセット後に爆弾の演出が残らない', await ev(() => ({ snaps: bombSnaps.length, pins: bombPins.length, blasts: bombBlasts.length, lab: LAB.enemies.length })), { snaps: 0, pins: 0, blasts: 0, lab: 0 });
  o.expect('リセット後、敵のチェーンがシーンに残らない', await ev(() => { let n = 0; scene.traverse((x) => { if (x.geometry === _chainGeo && x.parent && x.parent.visible) n++; }); return n; }), 0);
  await o.finish();
})();
