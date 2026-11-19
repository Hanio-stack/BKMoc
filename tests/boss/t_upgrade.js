// XP・アップグレード台・頭スキル（ビーム／バルカン）・ジェットパック・チップ・保存・ステージ登録のテスト。
// 操作はキー入力（F・E・Q・Space・WASD）で行い、確かめたい数値だけページから読む
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const key = async (k, ms) => { await page.keyboard.press(k); await wait(ms || 150); };
  const hold = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  const tp = (x, z, yd, pd) => ev(([x, z, yd, pd]) => {
    const L = STG.L; playerPos.set(L.X(x), 0, L.Z(z)); yaw = yd * Math.PI / 180; pitch = (pd || 0) * Math.PI / 180;
  }, [x, z, yd, pd]);
  const pickLabel = async (want) => {
    await o.waitFor((w) => (STG.pick ? STG.pick.label : null) === w, want === undefined ? 300 : 6000, want === undefined ? null : want);
    return ev(() => STG.pick ? STG.pick.label : null);
  };
  const save = () => ev(() => BKUpg.dump());
  const toSafe = async () => { await key('KeyH', 100); await o.waitFor(() => !STG.fade && STG.area === 'safe', 10000); await wait(300); };
  const benchFront = () => tp(2.8, -4.4, -90, -6);
  const openBench = async () => { await benchFront(); await pickLabel('アップグレード台を使う'); await key('KeyF', 300); await o.waitFor(() => !!UPG.bench, 3000); };
  const closeBench = async () => { await key('KeyQ', 100); await o.waitFor(() => !UPG.bench, 4000); };
  // 画面の項目を選ぶ（タブ i・項目 j）
  const benchSelect = async (tab, idx) => {
    for (let k = 0; k < 4 && await ev(() => UPG.bench.tab) !== tab; k++) await key('KeyD', 80);
    for (let k = 0; k < 6 && await ev(() => UPG.bench.idx) !== idx; k++) await key('KeyS', 80);
  };
  // ハブの敵を1体、正面 d m に立たせる（攻撃してこない）
  const enemyAhead = (d) => ev((d) => {
    const en = enemies.find((e) => !e.boss && e.state !== E.DEAD && e.group.visible);
    en.cooldown = 99; en.state = E.IDLE || en.state;
    en.hp = en.maxHp; en.stun = 0;
    en.group.position.set(playerPos.x, 0, playerPos.z - d);
    yaw = 0; pitch = state === S.HEAD ? -0.12 : 0.04;
    window.__en = en;
    return true;
  }, d);
  // カメラの正面が敵の胴に向くまで視点を合わせる（ライジング中は首のカメラが上にあるので）
  const aimCam = async () => {
    if (await ev(() => state === S.HEAD)) return;    // 頭モードは三人称。正面に立たせてあるのでそのまま
    for (let i = 0; i < 12; i++) {
      await ev(() => {
        const t = window.__en.group.position.clone(); t.y += 1.3;
        const c = camera.position, dx = t.x - c.x, dz = t.z - c.z;
        yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(t.y - c.y, Math.hypot(dx, dz));
      });
      await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
  };
  const freezeEnemy = () => ev(() => { const en = window.__en; en.cooldown = 99; en.group.position.set(playerPos.x, 0, playerPos.z - 4); });

  o.section('準備：セーブを初期化');
  await ev(() => BKUpg.reset());
  o.expect('初期のセーブ', await save(), { version: 1, xp: 0, totalXp: 0, owned: {}, headSkill: null, chipsOwned: [], chipsEquipped: [null, null], collected: {} });

  /* ================= Test A：セーフルーム ================= */
  o.section('A：セーフルーム・受付・ステージ一覧・帰還');
  await toSafe();
  o.expect('セーフルームにいる', await ev(() => STG.area), 'safe');
  await tp(-5.2, 0, 90); await pickLabel('会話する');
  await key('KeyF', 300);
  o.expect('受付のステージ一覧', await ev(() => STG.dialog && STG.dialog.spec.choices.map((c) => c.label)), ['DEMO STAGE 1-1', 'DEMO STAGE 1-2', '戻る']);
  await key('KeyF', 200);
  await tp(0, -5.4, 0); await pickLabel('試験区画へ進む'); await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 10000);
  o.expect('1-1 に入れる', await ev(() => STG.area), '1-1');
  await toSafe();
  o.expect('セーフルームへ戻れる', await ev(() => STG.area), 'safe');

  o.section('A：アップグレード台（Fで起動・専用カメラ・3つの画面・退出）');
  await benchFront();
  o.expect('台の前でプロンプト', await pickLabel('アップグレード台を使う'), 'アップグレード台を使う');
  const eye0 = await ev(() => camera.position.toArray());
  await key('KeyF', 1600);
  o.expect('台が開く・画面が出る・戦闘の表示は隠れる', await ev(() => [!!UPG.bench, !upgUi.panel.classList.contains('hidden'), document.body.classList.contains('upg-open')]), [true, true, true]);
  o.expect('台の頭が置かれる', await ev(() => UPG.benchProp.head.visible), true);
  const camHead = () => ev(() => +camera.position.distanceTo(UPG.benchProp.headWorld()).toFixed(2));
  const dMain = await camHead();
  o.expectTrue('MAIN：カメラが頭の正面 1.0〜1.6m', dMain > 1.0 && dMain < 1.6, dMain);
  o.expectTrue('カメラは頭の正面側（台の内側）', await ev(() => { const bp = UPG.benchProp; const loc = bp.g.worldToLocal(camera.position.clone()); return loc.z > 0.8; }));
  await hold('KeyW', 300);
  o.expect('台を使っているあいだは歩けない', await ev(() => canMove()), false);
  await key('KeyD', 1200);
  o.expect('UPGRADE：改造の画面（ジェットパック）', await ev(() => UPG.bench.view), 'upgrade:jetpack');
  o.expectTrue('UPGRADE：部品に寄る（背中側）', await ev(() => { const bp = UPG.benchProp; return bp.g.worldToLocal(camera.position.clone()).z < -0.2; }));
  await key('KeyD', 1200);
  o.expect('CHIP：チップの画面', await ev(() => UPG.bench.view), 'chip');
  o.expectTrue('CHIP：後頭部の上から見る', await ev(() => { const bp = UPG.benchProp; const l = bp.g.worldToLocal(camera.position.clone()); return l.z < -0.3 && l.y > 1.6; }));
  await key('KeyD', 600);
  o.expect('MAIN に戻る', await ev(() => UPG.bench.view), 'main');
  await key('KeyE', 200);
  o.expect('台の操作中は頭スキルが出ない', await ev(() => [UPG.beam.on, UPG.vulcan.on]), [false, false]);
  await closeBench();
  await wait(200);
  o.expect('Q で閉じる（画面と頭が消える）', await ev(() => [!!UPG.bench, upgUi.panel.classList.contains('hidden'), UPG.benchProp.head.visible, document.body.classList.contains('upg-open')]), [false, true, false, false]);
  o.expectTrue('カメラはプレイヤーの目に戻る', await ev((e) => camera.position.distanceTo(new THREE.Vector3(...e)) < 0.05, eye0));
  o.expect('また歩ける', await ev(() => canMove()), true);
  // ESC（マウスロックが外れた）でも閉じる
  await openBench();
  await ev(() => { document.body.requestPointerLock(); });     // ESC と同じ：ゲームの画面からロックが外れる
  await wait(200);
  o.expect('ロックが外れると台も閉じる（取り残さない）', await ev(() => [!!UPG.bench, document.body.classList.contains('upg-open')]), [false, false]);
  await ev(() => { renderer.domElement.requestPointerLock(); });
  await wait(200);

  /* ================= Test B：XP と購入 ================= */
  o.section('B：敵を倒すと XP（1体につき1回）');
  await key('KeyG', 400);
  await enemyAhead(3);
  const xp0 = (await save()).xp;
  await ev(() => applyDamage(window.__en, 999));
  await wait(200);
  o.expect('倒すと +250 XP（通常の敵）', (await save()).xp - xp0, 250);
  o.expect('XP の通知が出る', await ev(() => [!upgUi.toast.classList.contains('hidden'), upgUi.toast.querySelector('b').textContent]), [true, '+250 XP']);
  await ev(() => { applyDamage(window.__en, 999); upgOnEnemyKilled(window.__en); killEnemy(window.__en); });
  o.expect('同じ敵から二重に入らない', (await save()).xp - xp0, 250);
  await key('KeyG', 400);
  await ev(() => { const en = window.__en; applyDamage(en, 999); });
  o.expect('生き返った敵（G でやり直し）からはまた入る', (await save()).xp - xp0, 500);
  // ステージを出ると敵は片付くが、XP は入らない
  await ev(() => { stageEnterArea('1-1'); });
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 10000);
  await tp(30, -22, 0); await wait(600);
  await o.waitFor(() => STG.enemies.length > 0, 6000);
  const nAlive = await ev(() => STG.enemies.filter((e) => e.state !== E.DEAD).length);
  const xpBefore = (await save()).xp;
  await toSafe();
  o.expectTrue('ステージの敵がいた', nAlive > 0, nAlive);
  o.expect('ステージを出て敵が消えても XP は入らない', (await save()).xp, xpBefore);
  o.expect('強い敵・ボスの XP は別の値', await ev(() => [upgEnemyType({ strong: true }), UPG_CFG.xp.strong > UPG_CFG.xp.normal, UPG_CFG.xp.boss > UPG_CFG.xp.strong]), ['strong', true, true]);

  o.section('B：購入（XP不足・購入・二重購入の防止）');
  await openBench();
  o.expect('画面に XP 残高', await ev(() => upgUi.xp.textContent), 'XP ' + xpBefore.toLocaleString('en-US'));
  await benchSelect(1, 0);
  o.expect('ジェットパックは XP不足', await ev(() => upgUi.list.children[0].querySelector('.st').textContent), 'XP不足');
  await key('KeyF', 300);
  o.expect('XP不足では買えない（XP も減らない）', [await ev(() => UPG.save.owned.jetpack || false), (await save()).xp], [false, xpBefore]);
  o.expectTrue('理由が出る', (await ev(() => upgUi.msg.textContent)).indexOf('XPが足りません') >= 0);
  await ev(() => BKUpg.grant(40000));
  await key('KeyW', 80); await key('KeyS', 120);   // 表示を更新
  o.expect('購入可', await ev(() => upgUi.list.children[0].querySelector('.st').textContent), '購入可');
  const xpB = (await save()).xp;
  await key('KeyF', 60); await key('KeyF', 60); await key('KeyF', 60); await key('Enter', 60);
  o.expect('連打しても 10,000 だけ減る', (await save()).xp, xpB - 10000);
  o.expect('装着の演出中', await ev(() => UPG.bench.anim && UPG.bench.anim.kind), 'install');
  o.expect('演出中はロボットアームが動く', await ev(() => !!UPG.benchProp.arms[1].target), true);
  await o.waitFor(() => !UPG.bench.anim, 4000);
  o.expect('購入済・頭に部品が付く', await ev(() => [UPG.save.owned.jetpack, UPG.benchProp.parts.jetpack.visible, upgUi.list.children[0].querySelector('.st').textContent]), [true, true, '購入済']);
  await key('KeyF', 300);
  o.expect('買ってある物は二重に買えない', (await save()).xp, xpB - 10000);
  // ビームとバルカンも買う（最初の頭スキルが E に入る）
  await key('KeyS', 100); await key('KeyF', 100); await o.waitFor(() => !UPG.bench.anim, 4000);
  await key('KeyS', 100); await key('KeyF', 100); await o.waitFor(() => !UPG.bench.anim, 4000);
  o.expect('3つとも購入・E にはビーム', await ev(() => [UPG.save.owned.beam, UPG.save.owned.vulcan, UPG.save.headSkill]), [true, true, 'beam']);
  o.expect('XP 残高', (await save()).xp, xpB - 40000);
  await key('KeyF', 300);
  o.expect('バルカンを E に割り当て（無料）', [await ev(() => UPG.save.headSkill), (await save()).xp], ['vulcan', xpB - 40000]);
  o.expect('同時には装備できない（E は1つ）', await ev(() => UPG.save.headSkill), 'vulcan');
  await key('KeyW', 100); await key('KeyF', 300);
  o.expect('ビームに戻す', await ev(() => UPG.save.headSkill), 'beam');
  o.expect('装備中の頭スキルが本体の画面に出る', await ev(() => { UPG.bench.tab = 0; upgRenderPanel(); return upgUi.info.textContent.indexOf('頭スキル（E）： 目からビーム') >= 0; }), true);
  await closeBench();

  /* ================= Test C：頭スキル（人間・ライジング・頭モード） ================= */
  await key('KeyG', 400);
  const beamTest = async (mode) => {
    await ev(() => { UPG.beam.cd = 0; UPG.beam.spent = false; });
    await enemyAhead(4);
    await aimCam();
    const hp0 = await ev(() => window.__en.hp);
    await page.keyboard.down('KeyE');
    await o.waitFor(() => UPG.beam.on, 1500);
    await wait(500);
    const mid = await ev(() => [UPG.beam.on, window.__en.hp]);
    await page.keyboard.up('KeyE');
    await wait(120);
    const after = await ev(() => [UPG.beam.on, UPG.beam.cd > 29, window.__en.hp]);
    o.expect(mode + '：E でビームが出る', mid[0], true);
    o.expectTrue(mode + '：敵の HP が減る', mid[1] < hp0, [hp0, mid[1]]);
    o.expect(mode + '：E を離すと止まり、クールタイムに入る', [after[0], after[1]], [false, true]);
    await wait(300);
    o.expect(mode + '：止めたあとは HP が減らない', await ev(() => window.__en.hp), after[2]);
  };
  const vulcanTest = async (mode) => {
    await enemyAhead(4);
    await aimCam();
    const before = await ev(() => [window.__en.hp, window.__en.stun]);
    await page.keyboard.down('KeyE');
    await wait(350);
    const mid = await ev(() => [UPG.vulcan.on, window.__en.hp, window.__en.stun, UPG.vulcan.shots]);
    await page.keyboard.up('KeyE');
    await wait(150);
    const s1 = await ev(() => UPG.vulcan.shots);
    await wait(250);
    o.expect(mode + '：E でバルカンが連射', mid[0], true);
    o.expectTrue(mode + '：スタン値が増える', mid[2] > before[1], [before[1], mid[2]]);
    o.expect(mode + '：HP は減らない', mid[1], before[0]);
    o.expect(mode + '：E を離すと止まる', [await ev(() => UPG.vulcan.on), await ev(() => UPG.vulcan.shots)], [false, s1]);
  };
  const rising = async () => { await page.keyboard.down('KeyQ'); await o.waitFor(() => state === 'RISING', 4000); await wait(200); };
  const unrise = async () => { await page.keyboard.up('KeyQ'); await o.waitFor(() => state === 'HUMAN', 4000); await wait(200); };
  const toHead = async () => { await page.keyboard.down('KeyQ'); await o.waitFor(() => state === 'RISING', 4000); await key('Space', 200); await page.keyboard.up('KeyQ'); await o.waitFor(() => state === 'HEAD', 4000); await wait(400); };

  o.section('C：ビーム（人間・ライジング・頭モード）');
  await beamTest('人間');
  await ev(() => { window.__en.hp = window.__en.maxHp; });
  await page.keyboard.down('KeyE'); await wait(400); await page.keyboard.up('KeyE');
  o.expect('クールタイム中は出ない', await ev(() => [UPG.beam.on, window.__en.hp === window.__en.maxHp]), [false, true]);
  const cd1 = await ev(() => UPG.beam.cd);
  await rising();
  o.expectTrue('ライジングしてもクールタイムはリセットされない', await ev(() => UPG.beam.cd) <= cd1 && await ev(() => UPG.beam.cd) > 25);
  await beamTest('ライジング');
  await unrise();
  await toHead();
  await beamTest('頭モード');
  o.expect('頭モード：ビームの見た目（目からの光）', await ev(() => UPG.beam.fx.outer.length), 2);
  await ev(() => { stageEnterArea('safe'); });
  await o.waitFor(() => !STG.fade && STG.area === 'safe', 10000);
  await key('KeyG', 400);

  o.section('C：バルカン（人間・ライジング・頭モード）');
  await ev(() => { UPG.save.headSkill = 'vulcan'; });
  await vulcanTest('人間');
  await rising(); await vulcanTest('ライジング'); await unrise();
  await toHead(); await vulcanTest('頭モード');
  await key('KeyG', 400);

  o.section('C：割り当てた方だけ・Q のライジング・腕がなくても使える');
  await ev(() => { UPG.save.headSkill = 'vulcan'; UPG.beam.cd = 0; UPG.beam.spent = false; });
  await enemyAhead(4);
  await page.keyboard.down('KeyE'); await wait(300);
  o.expect('バルカンを割り当てているとビームは出ない', await ev(() => [UPG.beam.on, UPG.vulcan.on]), [false, true]);
  await page.keyboard.down('KeyQ'); await o.waitFor(() => state === 'RISING', 4000);
  o.expect('E を押したままでも Q でライジングできる', await ev(() => state), 'RISING');
  await page.keyboard.up('KeyQ'); await o.waitFor(() => state === 'HUMAN', 4000);
  await page.keyboard.up('KeyE'); await wait(200);
  await ev(() => { damageArm('LEFT', 999); damageArm('RIGHT', 999); });
  o.expect('両腕がない', await ev(() => [player.arms.LEFT.lost, player.arms.RIGHT.lost]), [true, true]);
  await vulcanTest('両腕なし（人間）');
  await ev(() => { UPG.save.headSkill = 'beam'; });
  await beamTest('両腕なし（人間）');
  await key('KeyG', 400);

  /* ================= Test D：ジェットパック ================= */
  o.section('D：ジェットパック');
  const airTime = async () => {
    await toHead();
    await page.keyboard.down('Space');
    const t0 = Date.now();
    let maxH = 0;
    await wait(100);
    while (Date.now() - t0 < 4000) {
      const [g, h] = await ev(() => [headGrounded, headH]);
      maxH = Math.max(maxH, h);
      if (g && Date.now() - t0 > 200) break;
      await wait(40);
    }
    const t = Date.now() - t0;
    await page.keyboard.up('Space');
    await wait(300);
    return { t, maxH };
  };
  await ev(() => { UPG.save.owned.jetpack = false; });
  const a0 = await airTime();
  o.expectTrue('未購入：長押ししても普通のジャンプ（滞空 1 秒未満）', a0.t < 1000, a0);
  await key('KeyG', 400);
  await ev(() => { UPG.save.owned.jetpack = true; UPG.jet.fuel = UPG_CFG.jet.fuel; });
  const a1 = await airTime();
  o.expectTrue('購入後：跳んでから長押しで飛ぶ（滞空が長い）', a1.t > 1500, a1);
  o.expectTrue('燃料が切れると落ちる（無限には飛べない）', a1.t < 3800, a1);
  o.expect('燃料を使い切った', await ev(() => UPG.jet.fuel < 0.3), true);
  await wait(2500);
  o.expect('地上で燃料が回復する', await ev(() => UPG.jet.fuel > 1.0), true);
  o.expect('人間モードではジェットパックは関係ない（Space はキック）', await ev(() => { state; return UPG.jet.flying; }), false);
  await key('KeyG', 400);

  /* ================= Test E：チップ ================= */
  o.section('E：チップを拾う（1-1 の隠し部屋）');
  await ev(() => { stageEnterArea('1-1'); });
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 10000);
  await ev(() => { for (const id in STG.enc) STG.enc[id].state = 'cleared'; });
  await tp(-6.8, -55.6, 180, -25);
  o.expect('チップが置いてある', await ev(() => STG.L.chipPickups.map((c) => [c.chip, c.g.visible])), [['adrenaline', true]]);
  o.expect('F で拾うプロンプト', await pickLabel('チップを回収する（アドレナリン）'), 'チップを回収する（アドレナリン）');
  await key('KeyF', 300);
  o.expect('所持品に入る・保存される', [await ev(() => UPG.save.chipsOwned), (await save()).collected], [['adrenaline'], { '1-1': ['chip-hr1'] }]);
  await wait(200);
  o.expect('拾ったら消える', await ev(() => STG.L.chipPickups[0].g.visible), false);
  await toSafe();
  await ev(() => { stageEnterArea('1-1'); });
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 10000);
  await ev(() => { for (const id in STG.enc) STG.enc[id].state = 'cleared'; });
  await tp(-6.8, -55.6, 180, -25); await wait(400);
  o.expect('入り直しても同じチップは出ない（無限に取れない）', [await ev(() => STG.L.chipPickups[0].g.visible), await pickLabel(null)], [false, null]);
  // 1-2 のチップ（オキシトシン・セロトニン）
  await ev(() => { stageEnterArea('1-2'); });
  await o.waitFor(() => !STG.fade && STG.area === '1-2', 10000);
  await ev(() => { for (const id in STG.enc) STG.enc[id].state = 'cleared'; });
  await tp(8.4, -4.0, 180, -25);
  await pickLabel('チップを回収する（オキシトシン）'); await key('KeyF', 200);
  await tp(-35.4, -11.2, 0, -25);
  await pickLabel('チップを回収する（セロトニン）'); await key('KeyF', 200);
  o.expect('3種類とも回収', await ev(() => UPG.save.chipsOwned.slice().sort()), ['adrenaline', 'oxytocin', 'serotonin']);
  await toSafe();

  o.section('E：アップグレード台で装着（最大2枚）');
  await openBench();
  await benchSelect(2, 0);
  await key('KeyF', 100); await o.waitFor(() => !UPG.bench.anim, 3000);
  await key('KeyS', 100); await key('KeyF', 100); await o.waitFor(() => !UPG.bench.anim, 3000);
  o.expect('2枚装着（スロットにチップが見える）', await ev(() => [UPG.save.chipsEquipped, UPG.benchProp.parts.slots.userData.chips.map((c) => c.chip.visible)]), [['adrenaline', 'oxytocin'], [true, true]]);
  await key('KeyS', 100); await key('KeyF', 300);
  o.expect('3枚目は付けられない', await ev(() => [UPG.save.chipsEquipped, upgUi.msg.textContent.indexOf('スロットが空いていません') >= 0]), [['adrenaline', 'oxytocin'], true]);
  o.expect('同じチップを2枠に付けられない', await ev(() => upgEquipChip('adrenaline')), 'already');
  await closeBench();

  o.section('E：アドレナリン（体・腕の HP が低いほど攻撃力が上がる）');
  await key('KeyG', 400);
  const hitFor = (bodyHp, armHp) => ev(([b, a]) => {
    player.hp = b; player.arms.LEFT = makeArmState(ARM.FIST, { hp: a }); player.arms.RIGHT = makeArmState(ARM.FIST, { hp: a }); updateArmVisuals();
    const en = window.__en; en.hp = 100; applyDamage(en, 10); return +(100 - en.hp).toFixed(2);
  }, [bodyHp, armHp]);
  await enemyAhead(4);
  o.expect('満タンでは等倍（10）', await hitFor(100, 100), 10);
  o.expect('体50・腕50で 1.4 倍（14）', await hitFor(50, 50), 14);
  o.expect('体10・腕10で 1.72 倍（17.2）', await hitFor(10, 10), 17.2);
  o.expect('HP0・腕なしでも計算が壊れない', await ev(() => { player.hp = 0; player.arms.LEFT.lost = player.arms.RIGHT.lost = true; const m = upgAttackMul(); player.hp = 100; return [isFinite(m), +m.toFixed(2)]; }), [true, 1.8]);

  o.section('E：オキシトシン（移動速度↑・被ダメージ↑）');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); player.hp = 100; });
  o.expect('移動速度 1.3 倍', await ev(() => +(moveSpeedNow() / CONFIG.moveSpeed).toFixed(2)), 1.3);
  o.expect('被ダメージ 1.5 倍（10 → 15）', await ev(() => { player.hp = 100; player.guard = false; damagePlayer(10); return 100 - player.hp; }), 15);
  // 実際に歩いた距離も速い
  const walk = async () => { await key('KeyG', 400); const z0 = await ev(() => playerPos.z); await hold('KeyW', 600); return ev((z0) => Math.abs(playerPos.z - z0), z0); };
  const fast = await walk();
  await ev(() => upgUnequipChip('oxytocin'));
  const slow = await walk();
  o.expectTrue('W で歩くと速い（外すと戻る）', fast > slow * 1.15, [fast, slow]);
  o.expect('外すと被ダメージも等倍', await ev(() => { player.hp = 100; damagePlayer(10); return 100 - player.hp; }), 10);
  await ev(() => { player.hp = 100; upgEquipChip('oxytocin'); });

  o.section('E：セロトニン（腕が壊れるとき確率で回避して全回復）');
  await ev(() => { upgUnequipChip('oxytocin'); upgEquipChip('serotonin'); window.__rolls = 0; });
  await ev(() => BKUpg.setRng(() => { window.__rolls++; return 0.0; }));
  o.expect('当たり：腕は壊れず HP が全回復', await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST, { hp: 20 }); damageArm('LEFT', 999); return [player.arms.LEFT.lost, player.arms.LEFT.hp, window.__rolls]; }), [false, 100, 1]);
  await ev(() => BKUpg.setRng(() => { window.__rolls++; return 0.99; }));
  o.expect('外れ：腕は壊れる（抽選は1回）', await ev(() => { window.__rolls = 0; player.arms.RIGHT = makeArmState(ARM.FIST, { hp: 20 }); damageArm('RIGHT', 999); return [player.arms.RIGHT.lost, window.__rolls]; }), [true, 1]);
  o.expect('壊れた腕にもう一度ダメージ：抽選しない', await ev(() => { window.__rolls = 0; damageArm('RIGHT', 50); return window.__rolls; }), 0);
  await ev(() => { upgUnequipChip('serotonin'); BKUpg.setRng(null); window.__rolls = 0; });
  o.expect('外すと効果なし（壊れる）', await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST, { hp: 20 }); damageArm('LEFT', 999); return player.arms.LEFT.lost; }), true);
  await ev(() => { upgEquipChip('oxytocin'); });

  /* ================= 保存（再読み込み・死亡・ステージ移動） ================= */
  o.section('保存：死亡・ステージ移動・再読み込みに耐える');
  const snap = await save();
  await ev(() => { stageEnterArea('1-1'); });
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 10000);
  await ev(() => { player.hp = 0; });
  await o.waitFor(() => STG.dead > 0, 4000);
  await o.waitFor(() => !STG.fade && !(STG.dead > 0) && player.hp > 0, 12000);
  o.expect('死んで復帰しても同じ', await save(), snap);
  await key('KeyG', 400);
  o.expect('G（resetAll）でも消えない', await save(), snap);
  await page.reload();
  await wait(1500);
  await page.click('#startOverlay');
  await wait(600);
  o.expect('再読み込み後も同じ', await save(), snap);
  o.expect('再読み込み後も E の割り当てとチップ', await ev(() => [UPG.save.headSkill, UPG.save.chipsEquipped]), [snap.headSkill, snap.chipsEquipped]);
  // 壊れたセーブでも起動する
  await ev(() => localStorage.setItem('bk.player', '{ broken json'));
  await page.reload(); await wait(1500); await page.click('#startOverlay'); await wait(500);
  o.expect('壊れたセーブ → 初期値で起動', await ev(() => [UPG.save.xp, UPG.save.version]), [0, 1]);
  await ev(() => localStorage.setItem('bk.player', JSON.stringify({ version: 1, xp: -5, owned: { beam: true, hack: true }, headSkill: 'vulcan', chipsOwned: ['adrenaline', 'x'], chipsEquipped: ['adrenaline', 'adrenaline'] })));
  await page.reload(); await wait(1500); await page.click('#startOverlay'); await wait(500);
  o.expect('不正な値は捨てる', await ev(() => [UPG.save.xp, UPG.save.owned, UPG.save.headSkill, UPG.save.chipsOwned, UPG.save.chipsEquipped]), [0, { beam: true }, null, ['adrenaline'], ['adrenaline', null]]);

  /* ================= ステージの登録（ID 重複・上書き防止） ================= */
  o.section('ステージ登録：ID 重複を拒否・更新は明示したときだけ・未対応要素は警告');
  o.expect('同梱のステージは問題なし', await ev(() => ['safe', '1-1', '1-2'].map((id) => validateStageDef(BK_STAGES[id]).errors.length + validateStageDef(BK_STAGES[id]).warnings.length)), [0, 0, 0]);
  o.expect('既存の ID（1-1）では登録できない', await ev(() => { const r = BK_registerStage({ id: '1-1', kind: 'stage', origin: [0, 0, 0], spawn: { x: 0, z: 0 }, spaces: [{ id: 'a', type: 'room', r: [-2, 2, -2, 2] }] }); return [r.ok, BK_STAGES['1-1'].title]; }), [false, '第三検体処理区画']);
  const mini = (id, extra) => Object.assign({ id, label: 'TEST ' + id, title: 'テスト ' + id, kind: 'stage', selectable: true, origin: [900, 0, 0], fog: { color: 0, near: 3, far: 30 }, ambient: { hemi: 0.5, dir: 0.2 },
    spawn: { x: 0, z: 2, yaw: 0 }, spaces: [{ id: 'r', type: 'room', r: [-4, 4, -4, 4], h: 4 }], goal: { door: 'g', x: 0, z: -3, r: 2 }, missions: [] }, extra || {});
  o.expect('新しい ID は2つとも登録できる', await ev((d) => [BK_registerStage(d[0]).ok, BK_registerStage(d[1]).ok], [mini('test-a'), mini('test-b', { origin: [960, 0, 0] })]), [true, true]);
  o.expect('受付の一覧に並ぶ', await ev(() => Object.keys(BK_STAGES).filter((k) => BK_STAGES[k].selectable)), ['1-1', '1-2', 'test-a', 'test-b']);
  o.expect('未対応の要素は警告に残る', await ev((d) => BK_registerStage(d).warnings.some((w) => w.indexOf('hologram') >= 0), mini('test-c', { hologram: [1] })), true);
  o.expect('更新の指定なしでは上書きしない', await ev((d) => [BK_registerStage(d).ok, BK_STAGES['test-a'].title], mini('test-a', { title: '別物' })), [false, 'テスト test-a']);
  o.expect('update と新しい version なら更新できる', await ev((d) => [BK_registerStage(d, { update: true }).ok, BK_STAGES['test-a'].title], mini('test-a', { title: '更新版', version: 2 })), [true, '更新版']);
  o.expect('壊れた定義は登録しない', await ev(() => BK_registerStage({ id: 'bad id', kind: 'stage' }).ok), false);
  await ev(() => { for (const k of ['test-a', 'test-b', 'test-c']) delete BK_STAGES[k]; window.BK_STAGE_LOG.length = 0; console.warn = console.warn; });
  // 登録時に出したコンソールのエラーは意図したもの
  o.errors.splice(0, o.errors.length, ...o.errors.filter((e) => e.indexOf('[BK stage') < 0));

  await o.finish();
})();
