// 体スキル阿修羅：ライジングに入ると追加の腕をしまい（生える演出の逆再生）、
// 終わるとまた生える。ライジングで本体の腕を付け替えても阿修羅の腕は変わらない
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  // 追加の腕の様子（order 順）
  const arms = () => ev(() => asuraArms.map((xa) => ({
    order: xa.order, kind: xa.st.kind, hp: xa.st.hp, lost: xa.st.lost,
    k: +asuraGrowK(xa).toFixed(3), body: xa.pivot.visible, fp: xa.hand.visible,
    color: xa.bodyMesh.material.color.getHexString(),
  })));
  const full = () => o.waitFor(() => asuraArms.length === 4 && asuraArms.every((xa) => Math.abs(asuraGrowK(xa) - 1) < 1e-6), 3000);
  // ページ内で毎フレーム生え具合を記録する（ヘッドレスはフレームが粗いので外からの観測では途中を取りこぼす）
  const startLog = () => ev(() => {
    window.__ak = [];
    const f = () => { window.__ak.push({ s: state, k: asuraArms.map((xa) => asuraGrowK(xa)) }); if (window.__ak.length < 400) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const getLog = () => ev(() => window.__ak.slice());
  // 各腕が条件を最初に満たしたフレーム番号
  const firstFrame = (log, pred) => [0, 1, 2, 3].map((i) => log.findIndex((r) => pred(r.k[i])));
  const stowed = () => o.waitFor(() => asuraArms.length === 4 && asuraArms.every((xa) => asuraGrowK(xa) === 0), 3000);

  o.section('阿修羅を使う：4本生える');
  await page.keyboard.press('KeyG'); await wait(300);
  await ev(() => { yaw = 0; pitch = 0; player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); });
  await page.keyboard.press('Digit4'); await wait(100);
  await page.keyboard.press('KeyZ');
  o.expect('4本とも生えきる', await full(), true);
  const before = await arms();
  o.expect('一人称の手が4本とも見える', before.map((a) => a.fp), [true, true, true, true]);
  o.expect('追加の腕は拳', before.map((a) => a.kind), ['fist', 'fist', 'fist', 'fist']);
  await page.screenshot({ path: __dirname + '/shots/asura_0_human.png' });

  o.section('ライジングに入ると腕をしまう（逆再生）');
  await startLog();
  await page.keyboard.down('KeyQ');
  await o.waitFor(() => state !== S.HUMAN, 2000);
  await o.waitFor(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))), 2000);   // 2フレーム描かせる
  o.expect('ライジング中は一人称の追加の手は出ない', (await arms()).map((a) => a.fp), [false, false, false, false]);
  o.expect('しまいきる', await stowed(), true);
  {
    const log = (await getLog()).filter((r) => r.s !== 'HUMAN');
    o.expectTrue('しまっている途中のフレームがある（一気に消えない）', log.some((r) => r.k.some((v) => v > 0 && v < 1)), log.length);
    const z = firstFrame(log, (v) => v === 0);
    o.expectTrue('後から生えた腕から先にしまう（しまいきる順が 4本目→1本目）', z.every((f) => f >= 0) && z[3] <= z[2] && z[2] <= z[1] && z[1] <= z[0] && z[3] < z[0], z);
    o.expectTrue('しまう直前に一度ふくらむ（生える演出の行き過ぎを逆再生）', log.some((r) => r.k.some((v) => v > 1.01)), null);
  }
  o.expect('三人称の体からも消える', (await arms()).map((a) => a.body), [false, false, false, false]);
  await page.screenshot({ path: __dirname + '/shots/asura_2_stowed.png' });
  // スクリーンショット用：しまっている途中の見た目


  o.section('ライジング中に本体の右腕を銃腕に付け替える');
  const corpseOk = await ev(() => {
    const c = createCorpse(playerPos.x + 0.6, playerPos.z - 3.2, 0, { arms: { LEFT: makeArmState(ARM.TENTACLE), RIGHT: makeArmState(ARM.GUN) } });
    const cc = c || corpses[corpses.length - 1];
    cc.armEls.RIGHT.id = 'asGun';
    return !!cc;
  });
  o.expect('死体を置いた', corpseOk, true);
  await wait(300);
  o.expect('死体の銃腕の□を狙えた', await o.aimAtEl('#asGun'), true);
  await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  o.expect('本体の右腕は銃腕になった', await o.waitFor(() => player.arms.RIGHT.kind === 'gun' && !graftArms.length, 5000), true);
  const during = await arms();
  o.expect('阿修羅の腕の種類は変わらない', during.map((a) => a.kind), before.map((a) => a.kind));
  o.expect('阿修羅の腕の見た目（色）も変わらない', during.map((a) => a.color), before.map((a) => a.color));
  o.expect('阿修羅の腕の耐久も変わらない', during.map((a) => a.hp), before.map((a) => a.hp));

  o.section('ライジングが終わるとまた生える');
  await startLog();
  await page.keyboard.up('KeyQ');
  o.expect('人間モードに戻る', await o.waitFor(() => state === S.HUMAN, 2000), true);
  await wait(250);
  await page.screenshot({ path: __dirname + '/shots/asura_3_regrow.png' });
  o.expect('4本とも生えきる', await full(), true);
  {
    const log = (await getLog());
    o.expect('ライジング中は生えない（生えはじめるのは人間モードに戻ってから）', log.filter((r) => r.s !== 'HUMAN').every((r) => r.k.every((v) => v === 0)), true);
    const hum = log.filter((r) => r.s === 'HUMAN');
    o.expectTrue('生えている途中のフレームがある', hum.some((r) => r.k.some((v) => v > 0 && v < 1)), hum.length);
    const g = firstFrame(hum, (v) => v > 0);
    o.expectTrue('最初に生えた腕から順に生える（生えはじめる順が 1本目→4本目）', g.every((f) => f >= 0) && g[0] <= g[1] && g[1] <= g[2] && g[2] <= g[3] && g[0] < g[3], g);
  }
  const after = await arms();
  o.expect('一人称の手が4本とも見える', after.map((a) => a.fp), [true, true, true, true]);
  o.expect('生え直しても種類は拳のまま', after.map((a) => a.kind), before.map((a) => a.kind));
  o.expect('生え直しても見た目（色）は同じ', after.map((a) => a.color), before.map((a) => a.color));
  await page.screenshot({ path: __dirname + '/shots/asura_4_back.png' });

  o.section('一瞬だけライジング → 途中から生え直す');
  await page.keyboard.down('KeyQ'); await wait(250); await page.keyboard.up('KeyQ');
  const tap = await ev(() => asuraT);
  const fullT = await ev(() => 3 * CONFIG.asuraGrowStagger + CONFIG.asuraGrowTime);
  o.expectTrue('少しだけしまった（しまいきってはいない）', tap < fullT && tap > 0, [+tap.toFixed(3), fullT]);
  o.expect('また生えきる', await full(), true);

  o.section('生え直した腕で攻撃できる（本体の右は銃、左は拳）');
  // 雑魚の回避は乱数で起きるので、ここでは避けないように固定する
  await ev(() => { asuraCombo = 0; Math.random = () => 0.99; });
  // 本体のパンチで押し下がっても追加の腕が届く近さに置く（押し下がりは本体の腕の仕様）
  const place = () => ev(() => { const en = enemies[0]; en.group.position.set(playerPos.x, 0, playerPos.z - 1.3); yaw = 0; pitch = 0; setEnemyState(en, E.IDLE); en.cooldown = 99; });
  await place();
  await page.mouse.down({ button: 'left' }); await wait(40); await page.mouse.up({ button: 'left' });
  o.expect('左の追加の腕が続いて殴る', await o.waitFor(() => asuraArms.some((xa) => xa.side === 'LEFT' && xa.act && xa.act.type === 'punch'), 2000), true);
  o.expect('追加の腕の攻撃が当たる', await o.waitFor(() => asuraCombo > 0, 2000), true);
  await o.waitFor(() => asuraArms.every((xa) => !xa.act) && canCancelNow(), 3000);
  await place();
  await page.mouse.down({ button: 'right' }); await wait(40); await page.mouse.up({ button: 'right' });
  o.expect('右の追加の腕は銃ではなく拳で続く', await o.waitFor(() => asuraArms.some((xa) => xa.side === 'RIGHT' && xa.act && xa.act.type === 'punch'), 2000), true);
  await o.finish();
})();
