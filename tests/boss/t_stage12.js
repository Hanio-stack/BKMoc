// DEMO STAGE 1-2 の通しテスト。セーフルームで選ぶ → M1〜M6 → ゴール → 再入場 → 死亡と復帰 → 1-1 との分離・回帰
// 移動はテレポートで短縮し、F・Space・Q などの操作はキー入力で行う
const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  const key = async (k, ms) => { await page.keyboard.press(k); await wait(ms || 150); };
  const tp = (x, z, yd, pd) => ev(([x, z, yd, pd]) => {
    const L = STG.L; playerPos.set(L.X(x), 0, L.Z(z)); yaw = yd * Math.PI / 180; pitch = (pd || 0) * Math.PI / 180;
  }, [x, z, yd, pd]);
  const pickLabel = async (want) => {
    await o.waitFor((w) => (STG.pick ? STG.pick.label : null) === w, want === undefined ? 300 : 6000, want === undefined ? null : want);
    return ev(() => STG.pick ? STG.pick.label : null);
  };
  const possessDone = () => o.waitFor(() => !possess && state !== 'POSSESS', 12000);
  const killEnc = (id) => ev((id) => { const rt = STG.enc[id]; for (const en of rt.enemies) if (en.state !== E.DEAD) applyDamage(en, 9999); }, id);
  const clearArena = async (id) => {
    for (let w = 0; w < 5; w++) {
      await o.waitFor((id) => STG.enc[id].pending.length === 0, 12000, id);
      await killEnc(id); await wait(700);
      if (await ev((id) => STG.enc[id].state === 'cleared', id)) break;
    }
    await o.waitFor((id) => STG.enc[id].state === 'cleared', 12000, id);
  };
  const toHead = async () => {
    await page.keyboard.down('KeyQ'); await o.waitFor(() => state === 'RISING', 6000);
    await key('Space', 200);
    await page.keyboard.up('KeyQ'); await o.waitFor(() => state === 'HEAD', 6000);
  };
  const subtitle = () => ev(() => document.getElementById('subtitle').textContent);
  const fists = () => ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); });
  const take = async (tag, side) => {
    await ev(([tag, side]) => { takeGroundArm({ part: severedParts.find((p) => p.armState && p.armState.tag === tag) }, side); }, [tag, side]);
    await o.waitFor(() => graftArms.length === 0, 8000);
  };

  o.section('セーフルーム：受付で 1-1 / 1-2 を選べる');
  await key('KeyH', 100);
  await o.waitFor(() => !STG.fade && STG.area === 'safe', 6000);
  await tp(-5.2, 0, 90);
  o.expect('受付', await pickLabel('会話する'), '会話する');
  await key('KeyF', 200);
  o.expect('選択肢', await ev(() => [...document.querySelectorAll('#stageDialog li')].map((l) => l.textContent)), ['DEMO STAGE 1-1', 'DEMO STAGE 1-2', '戻る']);
  await key('KeyS'); await key('KeyF');
  o.expect('1-2 を選んだ', await ev(() => STG.selected), '1-2');
  await tp(0, -5.4, 0);
  o.expect('大型扉', await pickLabel('試験区画へ進む'), '試験区画へ進む');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === '1-2', 8000);
  o.expect('1-2 に入った', await ev(() => [STG.area, STG.def.title]), ['1-2', '第四検体処理区画']);
  await o.waitFor(() => document.getElementById('subtitle').textContent.indexOf('右腕') >= 0, 15000);
  o.expect('研究員の指示（M1）', (await subtitle()).indexOf('指定番号の右腕を回収し') >= 0, true);
  o.expect('目標は右腕01', await ev(() => stageObjective().text), '指定番号 右腕01 の腕を探して装着する');
  o.expect('配管区画への扉は閉じている', await ev(() => STG.L.doors.dE.open), false);
  o.expect('主搬送棟は暗い', await ev(() => STG.L.mega.lines.every((l) => l.lit === 0)), true);

  o.section('どの通路も端から端まで通れる');
  o.expect('塞がった通路がない', await ev(() => {
    const L = STG.L, bad = [], saved = {};
    for (const id in L.doors) { saved[id] = [L.doors[id].open, L.doors[id].k]; L.doors[id].open = true; L.doors[id].k = 1; }
    for (const sp of L.spaces) {
      if (sp.type !== 'corridor' && sp.type !== 'duct' && sp.type !== 'catwalk') continue;
      const head = sp.type === 'duct', st = 0.2, along = (sp.x1 - sp.x0) > (sp.z1 - sp.z0);
      const a0 = along ? sp.x0 : sp.z0, a1 = along ? sp.x1 : sp.z1, b0 = along ? sp.z0 : sp.x0, b1 = along ? sp.z1 : sp.x1;
      const na = Math.ceil((a1 - a0) / st), nb = Math.ceil((b1 - b0) / st);
      const ok = (i, j) => { const a = a0 + i * st, b = b0 + j * st; return along ? stageWalkable(a, b, head) : stageWalkable(b, a, head); };
      const seen = new Set(), q = [], edge = Math.round(1.2 / st);
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

  o.section('M1：右腕01（番号と左右を照合・壊れたら1本だけ補充・粉砕せず保管）');
  await tp(9.6, -29.5, -90);
  o.expect('検査装置のプロンプト', await pickLabel('右腕を搬入する'), '右腕を搬入する');
  await key('KeyF', 200);
  o.expect('番号のない腕は受け付けない', await ev(() => [STG.busy, !!STG.prog.done.M1]), [null, false]);
  await ev(() => { STG.prog.cleared.w1 = STG.prog.cleared.w2 = true; STG.enc.w1.state = STG.enc.w2.state = 'cleared'; });
  await tp(-41, -45, 0);
  await take('R02', 'RIGHT');
  o.expect('違う番号の腕（R02）', await ev(() => player.arms.RIGHT.tag), 'R02');
  await tp(9.6, -29.5, -90); await pickLabel('右腕を搬入する');
  await key('KeyF', 300);
  o.expect('指定外の番号は警告', (await subtitle()).indexOf('指定外の検体番号') >= 0, true);
  await tp(-42, -57.6, 180);
  o.expect('右腕01 は保管庫の台座にある', await ev(() => findTaggedArm('R01').where), 'ground');
  await take('R01', 'LEFT');
  o.expect('左手に付けた右腕01（番号と左右は腕に残る）', await ev(() => [player.arms.LEFT.tag, player.arms.LEFT.side]), ['R01', 'RIGHT']);
  await o.waitFor(() => STG.enc.sr.state === 'active', 6000);
  o.expect('取ると保管庫で待ち伏せ', await ev(() => STG.enc.sr.state), 'active');
  await o.waitFor(() => STG.enc.sr.pending.length === 0, 12000);
  await killEnc('sr');
  await tp(9.6, -29.5, -90); await pickLabel('右腕を搬入する');
  await key('KeyF', 300);
  o.expect('左手のままでは「右腕として装着」', (await subtitle()).indexOf('右腕として装着') >= 0, true);
  await ev(() => damageArm('LEFT', 999));
  o.expect('戦闘で壊れて無くなる', await ev(() => findTaggedArm('R01')), null);
  await o.waitFor(() => findTaggedArm('R01'), 15000);
  o.expect('台座に予備が1本だけ', await ev(() => severedParts.filter((p) => p.armState && p.armState.tag === 'R01').length), 1);
  await wait(1500);
  o.expect('増えない', await ev(() => severedParts.filter((p) => p.armState && p.armState.tag === 'R01').length), 1);
  await tp(-42, -57.6, 180);
  await take('R01', 'RIGHT');
  o.expect('右手に右腕01', await ev(() => player.arms.RIGHT.tag), 'R01');
  await tp(9.6, -29.5, -90); await pickLabel('右腕を搬入する');
  await key('KeyF', 100);
  o.expect('搬入中', await ev(() => STG.busy && STG.busy.what), 'crusher');
  await o.waitFor(() => !STG.busy, 15000);
  o.expect('M1 達成・腕は保管（粉砕しない）・扉が開く', await ev(() => [!!STG.prog.done.M1, !!STG.prog.stored.R01, STG.prog.stored.R01 && STG.prog.stored.R01.tag, !!STG.L.crusher.shown, STG.L.doors.dE.open]),
    [true, true, 'R01', true, true]);
  o.expect('提出した腕は外れる', await ev(() => player.arms.RIGHT.lost), true);
  o.expect('完了後は補充されない', await ev(() => { STG.tagRespawn.R01 = 99; return true; }), true);
  await wait(800);
  o.expect('（右腕01 は装置の中だけ）', await ev(() => findTaggedArm('R01')), null);

  o.section('M2：3つのバルブ（それぞれ環境が変わる）');
  await o.waitFor(() => document.getElementById('subtitle').textContent.indexOf('調整弁') >= 0, 15000);
  o.expect('研究員の指示（M2）', (await subtitle()).indexOf('3か所の調整弁を開放') >= 0, true);
  await ev(() => { STG.prog.cleared.jx = true; STG.enc.jx.state = 'cleared'; });
  await ev(() => { player.arms.RIGHT = makeArmState(ARM.GUN); updateArmVisuals(); });
  await tp(61.4, -19, -90);
  o.expect('バルブA', await pickLabel('バルブを回す'), 'バルブを回す');
  await key('KeyF', 300);
  o.expect('銃腕では回らない', await ev(() => STG.busy), null);
  await fists();
  await key('KeyF', 100);
  await o.waitFor(() => !STG.busy, 20000);
  o.expect('A：エアロックが開く', await ev(() => [STG.prog.valves.A, STG.L.doors.dAir.open, STG.L.L ? 0 : 1]), [true, true, 1]);
  await tp(30, 6, 90); await wait(400);
  o.expect('A：開いた搬入路で戦闘', await ev(() => STG.enc.a3.state), 'active');
  await o.waitFor(() => STG.enc.a3.pending.length === 0, 12000);
  await killEnc('a3');
  await ev(() => { STG.prog.cleared.vb = true; STG.enc.vb.state = 'cleared'; });
  const bag0 = await ev(() => STG.L.mega.lines[12].phase);
  await tp(38.4, -55, -90);
  await pickLabel('バルブを回す');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.busy, 20000);
  o.expect('B：隔壁扉が開く', await ev(() => [STG.prog.valves.B, STG.L.doors.dB2.open]), [true, true]);
  await wait(1200);
  o.expect('B：主搬送棟の一部が動き出す（ほかは止まったまま）', await ev((p0) => [STG.L.mega.lines[12].phase !== p0, STG.L.mega.lines[12].lit > 0, STG.L.mega.lines[0].lit], bag0), [true, true, 0]);
  await tp(42.4, -72, -90);
  await pickLabel('バルブを回す');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.busy, 20000);
  o.expect('C：隔壁が開き敵が流入（アリーナ）', await ev(() => [STG.prog.valves.C, STG.enc.vcAr.state]), [true, 'active']);
  await wait(300);
  o.expect('戦闘中は扉が閉じる', await ev(() => [STG.L.doors.dB2.open, STG.L.doors.dBulk.open]), [false, false]);
  await clearArena('vcAr');
  o.expect('倒すと隔壁と扉が開く', await ev(() => [STG.L.doors.dB2.open, STG.L.doors.dBulk.open]), [true, true]);
  o.expect('M2 達成・搬送区画の扉が開く', await ev(() => [!!STG.prog.done.M2, STG.L.doors.dCore.open]), [true, true]);

  o.section('M3：搬送中の検体12を回収');
  await tp(1.5, -90, -90);
  await toHead();
  await ev(() => { playerPos.x = STG.L.X(2.6); });
  const hop = async (lane, mustTag) => {
    const ok = await ev(([lane, mustTag]) => {
      const ln = STG.L.conv.lanes[lane];
      let best = null;
      for (const c of ln.bodies) {
        if (mustTag && c.bodyTag !== mustTag) continue;
        if (!mustTag && STG.def.specimen && c.bodyTag === STG.def.specimen.tag) continue;
        const ahead = ln.dir < 0 ? c.belt.z - ln.kIn : ln.kIn - c.belt.z;
        if (ahead < (mustTag ? 4 : 12)) continue;
        if (!best || Math.abs(c.belt.z - playerPos.z) < Math.abs(best.belt.z - playerPos.z)) best = c;
      }
      if (!best) return false;
      playerPos.z = best.belt.z + ln.dir * 0.4; yaw = -Math.PI / 2; window.__t = best;
      return true;
    }, [lane, mustTag || null]);
    if (!ok) return false;
    await o.waitFor(() => STG.pick && STG.pick.corpse === window.__t, 5000);
    const okPick = await ev(() => !!(STG.pick && STG.pick.corpse === window.__t));
    await key('KeyF', 100); await possessDone();
    return okPick;
  };
  o.expect('レーン1に乗る', await hop(0), true);
  o.expect('固定された', await ev(() => state), 'STRAPPED');
  await key('Space', 100); await o.waitFor(() => state === 'HEAD', 5000); await wait(200);
  o.expect('レーン2に乗る', await hop(1), true);
  await key('Space', 100); await o.waitFor(() => state === 'HEAD', 5000); await wait(200);
  // 検体12が手の届く所に来るまで待つ（1体だけ）
  o.expect('検体12は1体だけ', await ev(() => corpses.filter((c) => c.bodyTag === '12').length), 1);
  o.expect('胸に検体番号', await ev(() => corpses.find((c) => c.bodyTag === '12').body.children.some((m) => m.geometry && m.geometry.parameters && m.geometry.parameters.width === 0.42)), true);
  await o.waitFor(() => { const c = corpses.find((c) => c.bodyTag === '12'); const ln = c && c.belt && c.belt.lane; return c && ln && (c.belt.z - ln.kIn) > 4; }, 40000);
  o.expect('検体12の表示', await ev(() => { const c = corpses.find((c) => c.bodyTag === '12'); playerPos.z = c.belt.z; yaw = -Math.PI / 2; return true; }), true);
  await o.waitFor(() => STG.pick && STG.pick.corpse && STG.pick.corpse.bodyTag === '12', 5000);
  o.expect('検体12のプロンプト', await ev(() => STG.pick && STG.pick.label), '検体12に接着する');
  await key('KeyF', 100); await possessDone();
  o.expect('検体12で運ばれる', await ev(() => [state, player.bodyTag]), ['STRAPPED', '12']);
  o.expect('目標：搬出口まで', await ev(() => stageObjective().text.indexOf('搬出口') >= 0), true);
  await o.waitFor(() => state === 'HUMAN', 60000);
  o.expect('仕分け機で拘束が外れ、検体12の体で動ける', await ev(() => [state, player.bodyTag, +(playerPos.x - STG.L.X(19.5)).toFixed(1)]), ['HUMAN', '12', 0]);
  o.expect('検体12は自分だけ（重複なし）', await ev(() => corpses.filter((c) => c.bodyTag === '12').length), 0);
  await tp(33.6 + 1.6, -100, 90);
  o.expect('登録装置', await pickLabel('検体を登録する'), '検体を登録する');
  await key('KeyF', 400);
  o.expect('M3 達成', await ev(() => !!STG.prog.done.M3), true);

  o.section('M4：右腕01・左腕03・検体12で身体を完成させる');
  await o.waitFor(() => document.getElementById('subtitle').textContent.indexOf('指定された部位') >= 0, 15000);
  o.expect('研究員の指示（M4）', (await subtitle()).indexOf('指定された部位を装着し') >= 0, true);
  o.expect('目標は左腕03 を探す', await ev(() => stageObjective().text.indexOf('左腕03') >= 0), true);
  await tp(44, -106.4, 0);
  o.expect('胴体は両腕の前には置けない', await pickLabel('胴体を据える'), '胴体を据える');
  await key('KeyF', 200);
  o.expect('（置かれない）', await ev(() => STG.prog.slots.torso), false);
  await tp(45.15, -106.4, 0);
  o.expect('左腕の掛け金', await pickLabel('左腕03を掛ける'), '左腕03を掛ける');
  await key('KeyF', 200);
  o.expect('番号のない拳は置けない', await ev(() => STG.prog.slots.LEFT), null);
  await tp(63.5, -105, 180); await wait(300);
  o.expect('部品保管庫で戦闘', await ev(() => STG.enc.ps.state), 'active');
  await o.waitFor(() => STG.enc.ps.pending.length === 0, 12000);
  await killEnc('ps');
  await take('L03', 'LEFT');
  o.expect('左手に左腕03', await ev(() => [player.arms.LEFT.tag, player.arms.LEFT.side]), ['L03', 'LEFT']);
  await tp(45.15, -106.4, 0);
  await pickLabel('左腕03を掛ける');
  await key('KeyF', 100); await o.waitFor(() => !STG.busy, 10000);
  o.expect('左腕03 を掛けた（ランプ点灯）', await ev(() => [STG.prog.slots.LEFT && STG.prog.slots.LEFT.tag, STG.L.frame.lamps.LEFT.material.color.getHex()]), ['L03', 0x3aff7a]);
  await tp(42.85, -106.4, 0);
  o.expect('右腕は保管中の右腕01', await pickLabel('保管中の右腕01を取り付ける'), '保管中の右腕01を取り付ける');
  await key('KeyF', 100); await o.waitFor(() => !STG.busy, 10000);
  o.expect('右腕01 を取り付けた（ケースは空に）', await ev(() => [STG.prog.slots.RIGHT && STG.prog.slots.RIGHT.tag, STG.L.crusher.shown, STG.L.frame.lamps.RIGHT.material.color.getHex()]), ['R01', null, 0x3aff7a]);
  // 死んでも台座の部品は残り、検体12の体で戻る
  await ev(() => { player.hp = 0; });
  await o.waitFor(() => STG.dead === 0 && !STG.fade && state === 'HUMAN' && player.hp > 0, 12000);
  o.expect('M3 後の地点へ検体12の体で戻る', await ev(() => [player.bodyTag, +(playerPos.x - STG.L.X(35)).toFixed(1), +(playerPos.z - STG.L.Z(-98)).toFixed(1)]), ['12', 0, 0]);
  o.expect('台座の部品は残る', await ev(() => [!!STG.prog.slots.LEFT, !!STG.prog.slots.RIGHT]), [true, true]);
  await tp(44, -106.4, 0);
  await pickLabel('胴体を据える');
  await key('KeyF', 400);
  o.expect('胴体を据えると頭だけ（ガスの中）', await ev(() => [state, STG.prog.slots.torso, stageBleedPaused()]), ['HEAD', true, true]);
  await o.waitFor(() => STG.pick && STG.pick.corpse && STG.pick.corpse.assembled, 6000);
  await key('KeyF', 100); await possessDone();
  o.expect('完成した体：左腕03・右腕01・検体12', await ev(() => [state, player.arms.LEFT.tag, player.arms.RIGHT.tag, player.bodyTag]), ['HUMAN', 'L03', 'R01', '12']);
  o.expect('M4 達成・試験場への扉', await ev(() => [!!STG.prog.done.M4, STG.L.doors.dArena.open]), [true, true]);
  o.expect('研究員の放送', (await subtitle()).indexOf('接合状態を確認しました') >= 0, true);

  o.section('M5：適合試験（途中で体を替えてもウェーブは続く）');
  await tp(32, -118.5, 0); await wait(400);
  o.expect('試験開始・扉が閉じる', await ev(() => [STG.enc.trial.state, STG.L.doors.arS.open, STG.L.doors.arW.open]), ['active', false, false]);
  o.expect('研究員の放送', (await subtitle()).indexOf('運動機能試験を開始します') >= 0, true);
  await o.waitFor(() => STG.enc.trial.pending.length === 0, 12000);
  await killEnc('trial'); await wait(700);
  // 戦闘の途中で体を捨てて、試験場の死体に乗り換える
  await tp(-5.5, -118.5, 135);
  await toHead();
  await ev(() => { const c = corpses.find((c) => c.stage && Math.abs(c.group.position.x - STG.L.X(-7.5)) < 0.3 && Math.abs(c.group.position.z - STG.L.Z(-116.5)) < 0.3); playerPos.set(c.group.position.x + 1.6, 0, c.group.position.z - 1.4); yaw = Math.atan2(1.6, -1.4); });
  await o.waitFor(() => STG.pick && STG.pick.corpse, 5000);
  await key('KeyF', 100); await possessDone();
  o.expect('別の体に乗り換えた', await ev(() => [state, player.bodyTag]), ['HUMAN', null]);
  o.expect('試験は続いている', await ev(() => [STG.enc.trial.state, !STG.prog.done.M5]), ['active', true]);
  await clearArena('trial');
  o.expect('3ウェーブを倒すと M5 達成・扉が開く', await ev(() => [!!STG.prog.done.M5, STG.L.doors.arW.open]), [true, true]);
  o.expect('強敵が出ていた', await ev(() => STG.enc.trial.enemies.some((en) => en.strong)), true);

  o.section('M6：主搬送系統の起動（敵は出ない）');
  await tp(-20.5, -84.4, 180);
  o.expect('大型スイッチ', await pickLabel('主搬送系統を起動する'), '主搬送系統を起動する');
  const nEn = await ev(() => STG.enemies.length);
  await key('KeyF', 100);
  o.expect('起動した', await ev(() => STG.L.mega.on), true);
  await o.waitFor(() => STG.L.mega.lines.filter((l) => l.lit > 0.5).length >= 4, 20000);
  const lit1 = await ev(() => STG.L.mega.lines.filter((l) => l.lit > 0.5).length);
  o.expectTrue('照明が順に点いていく（まだ全部ではない）', lit1 < 16, lit1);
  await o.waitFor(() => STG.L.mega.done, 60000);
  o.expect('全ラインが点灯して動く', await ev(() => STG.L.mega.lines.every((l) => l.lit > 0.99 && l.run > 0.5)), true);
  o.expect('部位の種類', await ev(() => [...new Set(STG.L.mega.lines.map((l) => l.def.kind))].sort()), ['corpse', 'head', 'larm', 'leg', 'rarm', 'torso']);
  o.expectTrue('霧が晴れて奥まで見える', await ev(() => scene.fog.far > 90), await ev(() => scene.fog.far));
  o.expect('敵は出ない（戦闘も始まらない）', await ev(() => [STG.enemies.filter((en) => en.state !== E.DEAD).length,
    Object.keys(STG.enc).filter((k) => STG.enc[k].state === 'active').length]), [0, 0]);
  void nEn;
  o.expect('M6 達成・最後の放送', [await ev(() => !!STG.prog.done.M6), (await subtitle()).indexOf('正常稼働を確認') >= 0], [true, true]);
  await tp(-22, -88, 90);
  o.expect('ゴール扉', await pickLabel('セーフルームへ戻る'), 'セーフルームへ戻る');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === 'safe', 8000);
  o.expect('セーフルームへ戻った', await ev(() => [STG.area, enemies.filter((en) => en.stage).length, corpses.filter((c) => c.stage).length]), ['safe', 0, 0]);
  o.expect('霧が元に戻る', await ev(() => [scene.fog.far, camera.far]), [34, 60]);

  o.section('再入場：1-2 は初期状態に戻る／1-1 とは状態が混ざらない');
  await tp(-5.2, 0, 90); await pickLabel('会話する');
  await key('KeyF'); await key('KeyS'); await key('KeyF');
  await tp(0, -5.4, 0); await pickLabel('試験区画へ進む');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === '1-2', 8000);
  o.expect('1-2 の進行が初期化', await ev(() => [Object.keys(STG.prog.done).length, Object.keys(STG.prog.stored).length, Object.keys(STG.prog.valves).length,
    STG.L.doors.dE.open, STG.L.doors.dCore.open, STG.L.mega.on, STG.L.mega.lines.every((l) => l.lit === 0), !!STG.L.crusher.shown]),
    [0, 0, 0, false, false, false, true, false]);
  o.expect('右腕01 と検体12 が戻る', await ev(() => [findTaggedArm('R01').where, corpses.filter((c) => c.bodyTag === '12').length]), ['ground', 1]);
  o.expect('組立台のランプも消える', await ev(() => STG.L.frame.lamps.LEFT.material.color.getHex()), 0x3a1410);
  await key('KeyH', 100);
  await o.waitFor(() => !STG.fade && STG.area === 'safe', 8000);
  await tp(-5.2, 0, 90); await pickLabel('会話する');
  await key('KeyF'); await key('KeyF');
  await tp(0, -5.4, 0); await pickLabel('試験区画へ進む');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === '1-1', 8000);
  o.expect('1-1 も選べて、1-1 の進行は独立', await ev(() => [STG.area, STG.def.missions[0].id, Object.keys(STG.prog.done).length, STG.L.doors.dA.open]), ['1-1', 'A', 0, false]);
  o.expect('1-1 の目標', await ev(() => stageObjective().text.startsWith('3つのバルブを開いて')), true);

  o.section('回帰：G でハブ・B でボス');
  await key('KeyG', 400);
  o.expect('ハブ', await ev(() => [STG.area, playerPos.x, playerPos.z, enemies.filter((en) => !en.boss).length]), [null, 0, 6, 4]);
  await key('KeyB', 400);
  o.expect('ボス', await ev(() => [STG.area, Math.round(playerPos.z)]), [null, -28]);
  await key('KeyG', 400);

  await o.finish();
})();
