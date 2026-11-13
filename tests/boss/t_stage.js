// ステージ（セーフルーム／DEMO STAGE 1-1）の通しテスト。
// セーフルームへの移動 → 受付でステージ選択 → 4つのミッション → ゴール → 再入場 → 死亡と復帰 → 既存モードへの回帰
// 移動はテレポートで短縮し、F・Space・Q などの操作はキー入力で行う
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const key = async (k, ms) => { await page.keyboard.press(k); await wait(ms || 150); };
  // ローカル座標でテレポート（yaw は度。0 = 北）
  const tp = (x, z, yd, pd) => ev(([x, z, yd, pd]) => {
    const L = STG.L; playerPos.set(L.X(x), 0, L.Z(z)); yaw = yd * Math.PI / 180; pitch = (pd || 0) * Math.PI / 180;
  }, [x, z, yd, pd]);
  // 照準の対象は毎フレーム決まるので、期待する値になるまで少し待ってから読む
  const pickLabel = async (want) => {
    await o.waitFor((w) => (STG.pick ? STG.pick.label : null) === w, want === undefined ? 300 : 6000, want === undefined ? null : want);
    return ev(() => STG.pick ? STG.pick.label : null);
  };
  const killEnc = (id) => ev((id) => {
    const rt = STG.enc[id];
    for (const en of rt.enemies) if (en.state !== E.DEAD) applyDamage(en, 9999);
  }, id);
  const possessDone = () => o.waitFor(() => !possess && state !== 'POSSESS', 9000);
  // 条件が成り立つまで W を押し続ける
  const walkUntil = async (fn, ms) => { await page.keyboard.down('KeyW'); await o.waitFor(fn, ms); await page.keyboard.up('KeyW'); };
  const toHead = async () => {
    await page.keyboard.down('KeyQ'); await wait(450);
    await key('Space', 200);
    await page.keyboard.up('KeyQ'); await wait(300);
  };

  o.section('モックからセーフルームへ（H）');
  await key('KeyH', 100);
  o.expectTrue('暗転が始まる', await ev(() => !!STG.fade));
  o.expect('暗転中は動けない', await ev(() => canMove()), false);
  await o.waitFor(() => !STG.fade, 12000);
  o.expect('セーフルームにいる', await ev(() => STG.area), 'safe');
  o.expect('入口の位置と向き', await ev(() => [+(playerPos.x - STG.L.X(0)).toFixed(1), +(playerPos.z - STG.L.Z(4.2)).toFixed(1), yaw]), [0, 0, 0]);

  o.section('セーフルーム：凝固ガスの中では頭モードでも出血しない');
  await toHead();
  o.expect('頭モード', await ev(() => state), 'HEAD');
  await wait(1500);
  o.expect('HPが減らない', await ev(() => player.hp), 100);
  // 自分の体（導火線で爆発する前）へ戻る
  await ev(() => { const c = corpses.find((c) => c.fuse !== null && Math.abs(c.group.position.x - playerPos.x) < 3); playerPos.x = c.group.position.x; playerPos.z = c.group.position.z + 1.5; yaw = 0; });
  await wait(250);
  o.expect('頭モードのプロンプトは乗っ取り', await pickLabel('身体に接着する'), '身体に接着する');
  await key('KeyF', 100); await possessDone();
  o.expect('体に戻る', await ev(() => state), 'HUMAN');

  o.section('受付で会話してステージを選ぶ');
  await tp(-5.2, 0, 90);
  await wait(250);
  o.expect('受付のプロンプト', await pickLabel('会話する'), '会話する');
  await key('KeyF', 200);
  o.expect('会話UIが開く', await ev(() => !document.getElementById('stageDialog').classList.contains('hidden')), true);
  o.expect('選択肢', await ev(() => [...document.querySelectorAll('#stageDialog li')].map((l) => l.textContent)), ['DEMO STAGE 1-1', '戻る']);
  o.expect('会話中は動けない', await ev(() => canMove()), false);
  await key('KeyS'); await key('KeyF');
  o.expect('戻るで閉じる（選択なし）', await ev(() => [STG.dialog, STG.selected]), [null, null]);
  await tp(0, -5.4, 0);
  await wait(250);
  o.expect('選ぶ前は大型扉に反応しない', await pickLabel(null), null);
  await tp(-5.2, 0, 90); await wait(250);
  await key('KeyF'); await key('KeyF');
  o.expect('1-1 を選んだ', await ev(() => STG.selected), '1-1');
  await tp(0, -5.4, 0); await wait(250);
  o.expect('大型扉のプロンプト', await pickLabel('試験区画へ進む'), '試験区画へ進む');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 12000);
  o.expect('1-1 に入った', await ev(() => STG.area), '1-1');
  o.expect('開始時の腕（左 拳 / 右 銃）', await ev(() => [player.arms.LEFT.kind, player.arms.RIGHT.kind]), ['fist', 'gun']);
  o.expect('最初の目標はバルブ', await ev(() => stageObjective().text.startsWith('3つのバルブを開いて')), true);
  o.expect('中央の扉は閉じている', await ev(() => STG.L.doors.dA.open), false);

  o.section('どの通路も端から端まで歩いて通れる（置き物で塞がっていない）');
  o.expect('塞がった通路がない', await ev(() => {
    const L = STG.L, bad = [];
    const saved = {};
    for (const id in L.doors) { saved[id] = [L.doors[id].open, L.doors[id].k]; L.doors[id].open = true; L.doors[id].k = 1; }
    for (const sp of L.spaces) {
      if (sp.type !== 'corridor' && sp.type !== 'duct') continue;
      const head = sp.type === 'duct';
      const st = 0.2, along = sp.type === 'duct' ? (sp.x1 - sp.x0 > sp.z1 - sp.z0) : sp.alongX;
      const a0 = along ? sp.x0 : sp.z0, a1 = along ? sp.x1 : sp.z1, b0 = along ? sp.z0 : sp.x0, b1 = along ? sp.z1 : sp.x1;
      const na = Math.ceil((a1 - a0) / st), nb = Math.ceil((b1 - b0) / st);
      const ok = (i, j) => { const a = a0 + i * st, b = b0 + j * st; return along ? stageWalkable(a, b, head) : stageWalkable(b, a, head); };
      const seen = new Set(), q = [];
      // 端から 1.2m 以内の歩ける点から始めて、反対の端 1.2m 以内まで届くか
      const edge = Math.round(1.2 / st);
      for (let i = 0; i <= edge; i++) for (let j = 0; j <= nb; j++) if (ok(i, j)) { seen.add(i + ',' + j); q.push([i, j]); }
      let reached = false;
      while (q.length) {
        const [i, j] = q.pop();
        if (i >= na - edge) { reached = true; break; }
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const I = i + di, J = j + dj, k = I + ',' + J;
          if (I < 0 || J < 0 || I > na || J > nb || seen.has(k) || !ok(I, J)) continue;
          seen.add(k); q.push([I, J]);
        }
      }
      if (!reached) bad.push(sp.id);
    }
    for (const id in saved) { L.doors[id].open = saved[id][0]; L.doors[id].k = saved[id][1]; }
    return bad;
  }), []);

  o.section('壁と通路：壁は抜けない・ダクトは頭だけが通れる');
  await tp(0, 3.5, -90);
  await page.keyboard.down('KeyW'); await wait(4000); await page.keyboard.up('KeyW');
  o.expectTrue('東の壁で止まる', await ev(() => playerPos.x - STG.L.X(0) <= 4.66), await ev(() => playerPos.x - STG.L.X(0)));
  await tp(-5, -46, 0);
  await page.keyboard.down('KeyW'); await wait(3000); await page.keyboard.up('KeyW');
  o.expectTrue('人間はダクトに入れない', await ev(() => playerPos.z - STG.L.Z(0) >= -47.7), await ev(() => playerPos.z - STG.L.Z(0)));
  await ev(() => { STG.prog.cleared.w1 = true; STG.enc.w1.state = 'cleared'; });
  await toHead();
  await walkUntil(() => playerPos.z - STG.L.Z(0) < -53.5, 8000);
  o.expectTrue('頭はダクトを抜けて隠し部屋へ', await ev(() => playerPos.z - STG.L.Z(0) < -53.2), await ev(() => playerPos.z - STG.L.Z(0)));
  o.expect('隠し部屋はガスで出血しない', await ev(() => stageBleedPaused()), true);
  await ev(() => { const c = corpses.find((c) => c.stage && Math.abs(c.group.position.x - STG.L.X(-5)) < 0.5 && Math.abs(c.group.position.z - STG.L.Z(-57)) < 0.5); playerPos.set(c.group.position.x + 1.2, 0, c.group.position.z); yaw = Math.PI / 2; });
  await wait(250);
  await key('KeyF', 100); await possessDone();
  o.expect('隠し部屋の強い体（触手＋拳）に乗り移る', await ev(() => [state, player.arms.LEFT.kind, player.arms.RIGHT.kind, player.resMax]), ['HUMAN', 'tentacle', 'fist', 6]);
  await wait(300);
  o.expect('人間の体で入ると点検扉が内側から開く', await ev(() => STG.L.doors.hr1d.open), true);

  o.section('通路戦：曲がり角の先で敵が出る');
  await tp(0, -23.8, 0); await wait(400);
  o.expect('戦闘が始まる', await ev(() => STG.enc.c02.state), 'active');
  await o.waitFor(() => STG.enc.c02.enemies.length === 2, 12000);
  o.expect('敵が2体', await ev(() => STG.enc.c02.enemies.length), 2);
  o.expectTrue('敵は区画の中にいる', await ev(() => STG.enc.c02.enemies.every((en) => inR(en.room, en.group.position.x, en.group.position.z))));
  await killEnc('c02');
  await o.waitFor(() => STG.enc.c02.state === 'cleared', 12000);
  o.expect('倒すと片付く', await ev(() => STG.prog.cleared.c02), true);

  o.section('ミッションA：バルブ（両腕が拳でないと回らない）');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.GUN); updateArmVisuals(); });
  await tp(-18, -50, 90); await wait(300);
  o.expect('バルブのプロンプト', await pickLabel('バルブを回す'), 'バルブを回す');
  await key('KeyF', 200);
  o.expect('銃腕では回らない', await ev(() => STG.busy), null);
  o.expect('理由が字幕に出る', await ev(() => document.getElementById('subtitle').textContent.indexOf('普通の腕でなければ力が入らない') >= 0), true);
  // 近くの両腕が拳の死体へ乗り移って回す
  await tp(-12, -43.4, 180); await wait(200);
  await toHead();
  await ev(() => { playerPos.set(STG.L.X(-12), 0, STG.L.Z(-39.6)); yaw = 0; });   // 死体の向こう側へ回る
  await wait(250);
  o.expect('両腕が拳の死体を選んでいる', await ev(() => { const c = STG.pick && STG.pick.corpse; return c ? [c.arms.LEFT.kind, c.arms.RIGHT.kind] : null; }), ['fist', 'fist']);
  await key('KeyF', 100); await possessDone();
  o.expect('乗り移って両腕が拳', await ev(() => [state, player.arms.LEFT.kind, player.arms.RIGHT.kind]), ['HUMAN', 'fist', 'fist']);
  await tp(-18, -50, 90); await wait(300);
  await key('KeyF', 100);
  await o.waitFor(() => STG.L.valves.A.spin > 0.15, 10000);
  o.expect('回している間は busy', await ev(() => STG.busy && STG.busy.kind), 'valve');
  o.expect('回している間は動けない', await ev(() => canMove()), false);
  o.expectTrue('両手がハンドルの近くにある', await ev(() => ['LEFT', 'RIGHT'].every((s) => { const p = new THREE.Vector3(); fpHands[s].userData.fist.getWorldPosition(p); return p.distanceTo(STG.L.valves.A.center) < 0.6; })));
  o.expectTrue('ハンドルが回っている', await ev(() => STG.L.valves.A.spin > 0.1));
  await o.waitFor(() => !STG.busy, 15000);
  o.expect('バルブAが開いた', await ev(() => [STG.prog.valves.A, STG.L.valves.A.lamp.material.color.getHex() !== 0x1c1412]), [true, true]);
  o.expect('扉はまだ閉じている', await ev(() => STG.L.doors.dA.open), false);

  o.section('アリーナ1：入ると扉が閉じ、ウェーブを倒すと開く');
  await tp(37.5, -46, -90); await wait(400);
  o.expect('アリーナ開始', await ev(() => STG.enc.arena1.state), 'active');
  await wait(400);
  o.expect('入口と出口が閉じる', await ev(() => [STG.L.doors.ar1W.open, STG.L.doors.ar1S.open]), [false, false]);
  await tp(55.6, -49, -90); await wait(300);
  await key('KeyF', 200);
  o.expect('戦闘中はバルブを回せない', await ev(() => STG.busy), null);
  for (let w = 0; w < 3; w++) {
    await o.waitFor(() => STG.enc.arena1.pending.length === 0, 12000);
    await killEnc('arena1'); await wait(700);
  }
  await o.waitFor(() => STG.enc.arena1.state === 'cleared', 12000);
  o.expect('3ウェーブを倒すと扉が開く', await ev(() => [STG.enc.arena1.state, STG.L.doors.ar1W.open, STG.L.doors.ar1S.open]), ['cleared', true, true]);
  o.expect('強敵が出ていた', await ev(() => STG.enc.arena1.enemies.some((en) => en.strong)), true);
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); });
  await tp(56.3, -49, -90); await wait(300);
  await key('KeyF', 100);
  await o.waitFor(() => !STG.busy, 15000);
  o.expect('バルブBが開いた', await ev(() => STG.prog.valves.B), true);

  o.section('バルブを2つ開けたあと中央に戻ると待ち伏せ');
  await tp(16, -40, 0); await wait(400);
  o.expect('中央で戦闘', await ev(() => STG.enc.hall.state), 'active');
  await o.waitFor(() => STG.enc.hall.pending.length === 0, 12000);
  await killEnc('hall');
  await o.waitFor(() => STG.enc.hall.state === 'cleared', 12000);

  o.section('バルブCを開くと処理槽から敵が出る → 3つで扉が開く');
  await ev(() => { STG.prog.cleared.pc1 = true; STG.enc.pc1.state = 'cleared'; });
  await tp(32, -15.6, 0); await wait(300);
  o.expect('目標の向きはバルブC（未開放で一番近い）', await ev(() => [+(stageObjective().goal.x - STG.L.X(32)).toFixed(1), +(stageObjective().goal.z - STG.L.Z(-14.45)).toFixed(1)]), [0, 0]);
  await ev(() => { yaw = Math.PI; });
  await wait(250);
  await key('KeyF', 100);
  await o.waitFor(() => !STG.busy, 15000);
  o.expect('バルブCが開いた', await ev(() => STG.prog.valves.C), true);
  await wait(300);
  o.expect('処理槽の敵が湧く', await ev(() => STG.enc.pc2.state), 'active');
  o.expect('3つで中央の扉が開く', await ev(() => [STG.prog.done.A, STG.L.doors.dA.open]), [true, true]);
  o.expect('目標が次へ（指定の腕）', await ev(() => stageObjective().text.indexOf('01') >= 0), true);
  await o.waitFor(() => STG.enc.pc2.pending.length === 0, 12000);
  await killEnc('pc2');

  o.section('ミッションB：指定番号の腕を照合装置へ');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); });
  await tp(8.2, -71.2, 90); await wait(300);
  o.expect('照合装置のプロンプト', await pickLabel('腕を提出する'), '腕を提出する');
  await key('KeyF', 200);
  o.expect('番号のない腕は受け付けない', await ev(() => [STG.busy, STG.prog.done.B]), [null, undefined]);
  o.expect('CRTに不一致', await ev(() => STG.L.armCrt.tex.userData.cv.toDataURL().length > 0), true);
  o.expect('01 の腕は保管室の台座にある', await ev(() => { const a = findTaggedArm('01'); return a.where; }), 'ground');
  o.expect('台座の腕に番号のステンシル', await ev(() => !!(STG.arm01.obj.userData.addons && STG.arm01.obj.userData.addons.tag)), true);
  // 保管室でライジングして取る（□＋右クリックと同じ処理）
  await tp(19, -90.4, 180); await wait(300);
  await ev(() => takeGroundArm({ part: STG.arm01 }, 'RIGHT'));
  await o.waitFor(() => graftArms.length === 0, 12000);
  o.expect('右手に 01 の腕', await ev(() => player.arms.RIGHT.tag), '01');
  o.expect('一人称の腕にも番号', await ev(() => !!fpHands.RIGHT.userData.addons.tag), true);
  await wait(400);
  o.expect('取ると保管室で待ち伏せ', await ev(() => STG.enc.sr.state), 'active');
  await o.waitFor(() => STG.enc.sr.pending.length === 0, 12000);
  await killEnc('sr');
  await o.waitFor(() => STG.enc.sr.state === 'cleared', 12000);
  o.expect('倒すと照合室への近道が開く', await ev(() => STG.L.doors.srd.open), true);
  // 戦闘で壊れたとき：予備が1本だけ補充される
  await ev(() => damageArm('RIGHT', 999));
  o.expect('腕が壊れて無くなる', await ev(() => findTaggedArm('01')), null);
  await o.waitFor(() => findTaggedArm('01'), 12000);
  o.expect('台座に予備が1本だけ補充される', await ev(() => severedParts.filter((p) => p.armState && p.armState.tag === '01').length), 1);
  await wait(1500);
  o.expect('補充は1本のまま（増えない）', await ev(() => severedParts.filter((p) => p.armState && p.armState.tag === '01').length), 1);
  await ev(() => takeGroundArm({ part: STG.arm01 }, 'LEFT'));
  await o.waitFor(() => graftArms.length === 0, 12000);
  await tp(8.2, -71.2, 90); await wait(300);
  await key('KeyF', 300);
  o.expect('提出中', await ev(() => STG.busy && STG.busy.what), 'crusher');
  o.expect('提出した腕は外れる', await ev(() => player.arms.LEFT.lost), true);
  await o.waitFor(() => !STG.busy, 10000);
  o.expect('受理されて扉Bが開く', await ev(() => [STG.prog.done.B, STG.L.doors.dB.open]), [true, true]);
  o.expect('01 の腕はもうどこにもない', await ev(() => findTaggedArm('01')), null);
  await wait(3000);
  o.expect('完了後は補充されない', await ev(() => findTaggedArm('01')), null);
  await tp(8.2, -71.2, 90); await wait(300);
  o.expect('完了後は再提出できない', await pickLabel(null), null);

  o.section('ミッションC：搬送ベルトの死体を乗り継ぐ');
  await tp(-12.8, -78, 90); await wait(300);
  await toHead();
  o.expect('東の足場はガス', await ev(() => stageBleedPaused()), true);
  for (let lane = 0; lane < 4; lane++) {
    // 次のベルトで、粉砕機から遠くて手が届く死体の正面へ寄る
    const ok = await ev((lane) => {
      const ln = STG.L.conv.lanes[lane];
      let best = null;
      for (const c of ln.bodies) {
        const dk = Math.abs(c.belt.z - ln.kIn);
        if (dk < 12) continue;
        if (!best || Math.abs(c.belt.z - playerPos.z) < Math.abs(best.belt.z - playerPos.z)) best = c;
      }
      if (!best) return false;
      playerPos.z = best.belt.z + ln.dir * 0.4;
      if (lane === 0) playerPos.x = STG.L.X(-13.65);   // 捨てた自分の体の向こう（足場の縁）へ
      yaw = Math.PI / 2;
      window.__target = best;
      return true;
    }, lane);
    await o.waitFor(() => STG.pick && STG.pick.corpse === window.__target, 4000);
    o.expect('レーン' + (lane + 1) + '：狙う死体が選ばれる', await ev(() => (STG.pick && STG.pick.corpse === window.__target) ||
      [state, STG.pick && STG.pick.label, +(playerPos.x - STG.L.X(0)).toFixed(2), +(playerPos.z - STG.L.Z(0)).toFixed(2), +(window.__target.group.position.z - STG.L.Z(0)).toFixed(2)]), true);
    if (lane === 0) o.expect('プロンプトは搬送体', await pickLabel('搬送体に接着する'), '搬送体に接着する');
    await key('KeyF', 100); await possessDone();
    o.expect('レーン' + (lane + 1) + '：固定されて運ばれる', await ev(() => state), 'STRAPPED');
    if (lane === 0) {
      const z0 = await ev(() => playerPos.z);
      await wait(1500);
      o.expectTrue('ベルトと一緒に動く', await ev((z0) => Math.abs(playerPos.z - z0) > 0.3, z0));
      o.expect('固定中は動けない・攻撃できない', await ev(() => [canMove(), stageBlocksMouse()]), [false, true]);
      o.expect('離脱のプロンプト', await ev(() => document.querySelector('#stagePrompt .txt').textContent), '離脱する');
    }
    await key('Space', 100); await o.waitFor(() => state === 'HEAD', 12000); await wait(300);
    o.expect('レーン' + (lane + 1) + '：Spaceで頭だけ離脱', await ev(() => [state, +playerPos.y.toFixed(1)]), ['HEAD', 0.9]);
  }
  // 最後は西の足場の受け取りの体へ
  await ev(() => { const c = corpses.find((c) => c.stage && !c.belt && Math.abs(c.group.position.x - STG.L.X(-32.4)) < 0.3 && Math.abs(c.group.position.z - STG.L.Z(-72)) < 0.3); playerPos.z = c.group.position.z; yaw = Math.PI / 2; window.__target = c; });
  await o.waitFor(() => STG.pick && STG.pick.corpse === window.__target, 4000);
  o.expect('受け取りの体を選んでいる', await ev(() => (STG.pick && STG.pick.corpse === window.__target) || [state, STG.pick && STG.pick.label,
    STG.pick && STG.pick.corpse && [+(STG.pick.corpse.group.position.x - STG.L.X(0)).toFixed(1), +(STG.pick.corpse.group.position.z - STG.L.Z(0)).toFixed(1), !!STG.pick.corpse.belt],
    +(playerPos.x - STG.L.X(0)).toFixed(2), +(playerPos.z - STG.L.Z(0)).toFixed(2), +playerPos.distanceTo(window.__target.group.position).toFixed(2)]), true);
  await key('KeyF', 100); await possessDone();
  await wait(300);
  o.expect('対岸に渡ってミッションC達成', await ev(() => [state, STG.prog.done.C, STG.L.doors.dC.open]), ['HUMAN', true, true]);

  o.section('アリーナ2');
  await tp(-53, -78, 90); await wait(400);
  o.expect('アリーナ2開始で扉が閉じる', await ev(() => [STG.enc.arena2.state, STG.L.doors.ar2E.open]), ['active', false]);
  for (let w = 0; w < 3; w++) {
    await o.waitFor(() => STG.enc.arena2.pending.length === 0, 12000);
    await killEnc('arena2'); await wait(700);
  }
  await o.waitFor(() => STG.enc.arena2.state === 'cleared', 12000);
  o.expect('倒すと開く', await ev(() => [STG.L.doors.ar2E.open, STG.L.doors.ar2N.open]), [true, true]);

  o.section('ミッションD：身体の組み立て');
  await ev(() => { player.arms.LEFT = makeArmState(ARM.TENTACLE); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); });
  await tp(-60.85, -117.6, 0); await wait(300);
  o.expect('左腕の掛け金', await pickLabel('左腕を掛ける'), '左腕を掛ける');
  await key('KeyF', 200);
  o.expect('触手腕は置けない', await ev(() => [STG.busy, STG.prog.slots.LEFT]), [null, null]);
  await tp(-62, -117.6, 0); await wait(300);
  o.expect('胴体', await pickLabel('胴体を据える'), '胴体を据える');
  await key('KeyF', 200);
  o.expect('両腕の前に胴体は置けない', await ev(() => STG.prog.slots.torso), false);
  await ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.GUN); updateArmVisuals(); });
  await tp(-60.85, -117.6, 0); await wait(300);
  await key('KeyF', 100); await o.waitFor(() => !STG.busy, 8000);
  o.expect('左腕を掛けた', await ev(() => [STG.prog.slots.LEFT && STG.prog.slots.LEFT.kind, player.arms.LEFT.lost]), ['fist', true]);
  await tp(-63.15, -117.6, 0); await wait(300);
  o.expect('右腕の掛け金', await pickLabel('右腕を掛ける'), '右腕を掛ける');
  await key('KeyF', 100); await o.waitFor(() => !STG.busy, 8000);
  o.expect('右腕を掛けた', await ev(() => STG.prog.slots.RIGHT && STG.prog.slots.RIGHT.kind), 'gun');
  // 死んでも台座の部品は消えない
  await ev(() => { player.hp = 0; });
  await o.waitFor(() => STG.dead === 0 && !STG.fade && state === 'HUMAN' && player.hp > 0, 8000);
  o.expect('死ぬとC達成後の地点へ戻る', await ev(() => [+(playerPos.x - STG.L.X(-36)).toFixed(1), +(playerPos.z - STG.L.Z(-78)).toFixed(1)]), [0, 0]);
  o.expect('台座の部品は残っている', await ev(() => [!!STG.prog.slots.LEFT, !!STG.prog.slots.RIGHT, !!STG.L.frame.hung.LEFT]), [true, true, true]);
  o.expect('倒したアリーナは開いたまま', await ev(() => STG.L.doors.ar2E.open), true);
  await tp(-62, -117.6, 0); await wait(300);
  await key('KeyF', 600);
  o.expect('胴体を据えると頭だけになる', await ev(() => [state, STG.prog.slots.torso]), ['HEAD', true]);
  o.expect('台座のまわりはガス', await ev(() => stageBleedPaused()), true);
  await o.waitFor(() => STG.pick && STG.pick.corpse, 12000);
  o.expect('完成した身体を選んでいる', await ev(() => STG.pick && STG.pick.label), '完成した身体に接着する');
  await key('KeyF', 100); await possessDone();
  o.expect('完成体で人間に戻り扉Dが開く', await ev(() => [state, player.arms.LEFT.kind, player.arms.RIGHT.kind, STG.prog.done.D, STG.L.doors.dD.open]),
    ['HUMAN', 'fist', 'gun', true, true]);
  o.expect('目標はゴール', await ev(() => stageObjective().text.slice(0, 5)), 'ゴール扉か');

  o.section('終盤：搬送棟の起動（任意）とゴール');
  await tp(-56, -146.0, 0); await wait(300);
  o.expect('スイッチ', await pickLabel('搬送棟を起動する'), '搬送棟を起動する');
  await key('KeyF', 100); await o.waitFor(() => STG.L.finaleRows.filter((r) => r.on > 0).length > 1, 12000);
  o.expect('照明が順に点く', await ev(() => STG.L.finaleRows.filter((r) => r.on > 0).length > 1), true);
  await tp(-76.5, -141, 90); await wait(300);
  o.expect('ゴール扉', await pickLabel('セーフルームへ戻る'), 'セーフルームへ戻る');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === 'safe', 12000);
  o.expect('セーフルームへ戻った（扉の前で振り返る）', await ev(() => [STG.area, +(playerPos.z - STG.L.Z(-4.2)).toFixed(1), +yaw.toFixed(2)]), ['safe', 0, 3.14]);
  o.expect('1-1 の敵・死体は残っていない', await ev(() => [enemies.filter((en) => en.stage).length, corpses.filter((c) => c.stage).length]), [0, 0]);

  o.section('再入場：ミッションと敵が初期状態に戻る');
  await tp(-5.2, 0, 90); await wait(250);
  await key('KeyF'); await key('KeyF');
  await tp(0, -5.4, 0); await wait(250);
  await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 12000);
  o.expect('進行が初期化', await ev(() => [Object.keys(STG.prog.valves).length, !!STG.prog.done.A, STG.L.doors.dA.open, STG.L.doors.dB.open]), [0, false, false, false]);
  o.expect('戦闘も初期化', await ev(() => STG.enc.c02.state), 'idle');
  o.expect('01 の腕が台座に戻る', await ev(() => findTaggedArm('01').where), 'ground');

  o.section('死亡と復帰：頭モードで出血死 → 開始地点へ');
  await tp(0, -10, 0);
  await toHead();
  await ev(() => { player.hp = 3; });
  await o.waitFor(() => headDead, 12000);
  o.expect('頭が潰れる', await ev(() => headDead), true);
  await o.waitFor(() => STG.fade, 12000);
  await o.waitFor(() => !STG.fade && state === 'HUMAN', 12000);
  o.expect('開始地点に人間の体で戻る', await ev(() => [state, player.hp, +(playerPos.z - STG.L.Z(3.5)).toFixed(1)]), ['HUMAN', 100, 0]);

  o.section('搬送中に粉砕機まで運ばれると死ぬ → C の前へ戻る');
  await ev(() => { STG.prog.done.A = STG.prog.done.B = true; STG.prog.opened.dA = STG.prog.opened.dB = true; syncGimmickVisuals(); });
  await ev(() => {
    const ln = STG.L.conv.lanes[0];
    const c = ln.bodies.slice().sort((a, b) => Math.abs(a.belt.z - ln.kIn) - Math.abs(b.belt.z - ln.kIn))[0];
    playerPos.set(STG.L.X(-10.5), 0, c.belt.z + ln.dir * 0.6); yaw = Math.PI / 2;
    window.__target = c;
  });
  await toHead();
  await ev(() => { playerPos.x = STG.L.X(-13.65); playerPos.z = window.__target.group.position.z; });
  await wait(150);
  await key('KeyF', 100); await possessDone();
  o.expect('固定された', await ev(() => state), 'STRAPPED');
  await o.waitFor(() => STG.crushed, 8000);
  o.expect('粉砕機に巻き込まれて死ぬ', await ev(() => STG.crushed), true);
  await o.waitFor(() => !STG.fade && !STG.crushed && state === 'HUMAN', 8000);
  o.expect('B 達成後の地点へ戻る', await ev(() => [+(playerPos.x - STG.L.X(-2)).toFixed(1), +(playerPos.z - STG.L.Z(-76)).toFixed(1)]), [0, 0]);
  o.expect('固定は解除されている', await ev(() => [STG.strap, corpses.filter((c) => c.occupied).length]), [null, 0]);

  o.section('既存のモードへ戻れる（回帰）');
  await key('KeyG', 400);
  o.expect('G でハブへ（ステージは片付く）', await ev(() => [STG.area, playerPos.x, playerPos.z, enemies.filter((en) => en.stage).length]), [null, 0, 6, 0]);
  o.expect('ハブの敵は元の4体', await ev(() => enemies.filter((en) => !en.boss).length), 4);
  o.expect('霧と床が元に戻る', await ev(() => [scene.fog.far, floor.visible]), [46, true]);
  await key('KeyH', 100);
  await o.waitFor(() => !STG.fade && STG.area === 'safe', 12000);
  await key('KeyV', 400);
  o.expect('セーフルームから V でデモへ', await ev(() => [STG.area, DEMO.active]), [null, true]);
  await key('KeyB', 400);
  o.expect('B でボスへ', await ev(() => [STG.area, DEMO.active, Math.round(playerPos.z)]), [null, false, -28]);
  await key('KeyT', 400);
  o.expect('T で検証室へ', await ev(() => LAB.active), true);
  await key('KeyG', 400);

  await o.finish();
})();
