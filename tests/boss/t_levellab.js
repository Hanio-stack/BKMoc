// LevelLab 連携のテスト。
// 実データ（tests/fixtures/levellab/pressure-restoration.v7.json）を公開ステージとして読み込み、
// 配置の再現・進行（扉の条件・バルブ・照合・アリーナ）・受付から選んでクリアして帰還・複数マップ・ID の衝突と更新・
// 未対応データの検出・ローカル取り込み（ファイル選択）・別ブラウザでの再現を確かめる。
// 合成データ（synthetic/）は「ステージ専用の処理が要らない」ことの確認用（実際の別マップとの互換性の証明ではない）
const { setup } = require('./bt');
const { open } = require('./h');
const fs = require('fs');
const path = require('path');
const FIX = path.join(__dirname, '..', 'fixtures', 'levellab');
const real = JSON.parse(fs.readFileSync(path.join(FIX, 'pressure-restoration.v7.json'), 'utf8'));
const synth = JSON.parse(fs.readFileSync(path.join(FIX, 'synthetic', 'two-rooms.synthetic.v7.json'), 'utf8'));

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
  const subtitle = () => ev(() => document.getElementById('subtitle').textContent);
  const killEnc = (id) => ev((id) => { const rt = STG.enc[id]; for (const en of rt.enemies) if (en.state !== E.DEAD) applyDamage(en, 9999); }, id);
  const clearEnc = async (id) => {
    for (let w = 0; w < 6; w++) {
      await o.waitFor((id) => STG.enc[id].pending.length === 0, 12000, id);
      await killEnc(id); await wait(500);
      if (await ev((id) => STG.enc[id].state === 'cleared', id)) break;
    }
    return ev((id) => STG.enc[id].state, id);
  };
  const fists = () => ev(() => { player.arms.LEFT = makeArmState(ARM.FIST); player.arms.RIGHT = makeArmState(ARM.FIST); updateArmVisuals(); player.hp = 100; });
  // バルブの正面に立って F
  const valveF = async (id) => {
    await ev((id) => { const v = STG.L.valves[id]; playerPos.set(v.stand.x, 0, v.stand.z); const dx = v.center.x - playerPos.x, dz = v.center.z - playerPos.z; yaw = Math.atan2(-dx, -dz); pitch = 0; }, id);
    await wait(300);
  };
  const doorOpen = (id) => ev((id) => !!(STG.L.doors[id] && STG.L.doors[id].open), id);
  const safe = async () => { await o.waitFor(() => !STG.fade && STG.area === 'safe', 12000); };
  const pickStage = async (label) => {
    await tp(-5.2, 0, 90); await pickLabel('会話する'); await key('KeyF', 300);
    const i = await ev((l) => STG.dialog.spec.choices.findIndex((c) => c.label === l), label);
    for (let k = 0; k < 10 && await ev(() => STG.dialog.idx) !== i; k++) await key('KeyS', 80);
    await key('KeyF', 200);
    await tp(0, -5.4, 0); await pickLabel('試験区画へ進む'); await key('KeyF', 100);
  };

  await ev(() => BK_LEVELLAB.ready);

  /* ================= 読み込み ================= */
  o.section('公開ステージ：実データ（供給圧力復旧区画）を読み込む');
  const rep = await ev(() => BK_LEVELLAB.reports.find((r) => r.file === 'levellab/pressure-restoration.js'));
  o.expect('エラーなしで登録される', [rep.ok, rep.errors, rep.id], [true, [], 'll-1-3']);
  o.expectTrue('警告と注記は記録されている（黙って省略しない）', rep.warnings.length >= 1 && rep.notes.length >= 1, { warnings: rep.warnings, notes: rep.notes.length });
  const wrap = fs.readFileSync(path.join(__dirname, '..', '..', 'maps', 'levellab', 'pressure-restoration.js'), 'utf8');
  const inner = JSON.parse(wrap.slice(wrap.indexOf(', {') + 2, wrap.lastIndexOf(');')));
  o.expect('公開ファイルの中身は書き出した JSON のまま（fixture と同一）', JSON.stringify(inner), JSON.stringify(real));
  o.expect('同梱のステージはそのまま', await ev(() => ['safe', '1-1', '1-2'].map((k) => [k, BK_STAGES[k].title, !!BK_STAGES[k].levellab])),
    [['safe', '第三区画 待機室', false], ['1-1', '第三検体処理区画', false], ['1-2', '第四検体処理区画', false]]);

  o.section('配置：エディタの座標・属性のとおりに変換される（実データと照合）');
  const def = await ev(() => JSON.parse(JSON.stringify(BK_STAGES['ll-1-3'])));
  const [ox, oy] = real.mock.origin2D;
  const items = real.floors[0].items;
  const rects = items.filter((i) => i.type === 'rect');
  const okRects = rects.every((i) => def.spaces.some((s) => Math.abs(s.r[0] - (i.x - ox)) < 1e-6 && Math.abs(s.r[1] - (i.x + i.w - ox)) < 1e-6 &&
    Math.abs(s.r[2] - (i.y - oy)) < 1e-6 && Math.abs(s.r[3] - (i.y + i.h - oy)) < 1e-6));
  o.expect('部屋（rect ' + rects.length + ' 件）はすべてエディタの位置と大きさ', okRects, true);
  const cor = items.filter((i) => i.type === 'corridor').length, routes = items.filter((i) => i.type === 'route');
  o.expectTrue('通路（corridor）と経路（route）はすべて空間になる', def.spaces.filter((s) => s.type === 'corridor').length >= cor + routes.length, [cor, routes.length]);
  const doorIcons = items.filter((i) => i.mock && i.mock.type === 'door');
  o.expect('扉 ' + doorIcons.length + ' 件：エディタの位置が扉の中心', doorIcons.every((i) => def.doors.some((d) => {
    const cx = (d.from + d.to) / 2, x = i.x - ox, z = i.y - oy;
    return d.axis === 'x' ? Math.abs(d.at - z) < 1e-6 && Math.abs(cx - x) < 1e-6 : Math.abs(d.at - x) < 1e-6 && Math.abs(cx - z) < 1e-6;
  })), true);
  const enemyIcons = items.filter((i) => i.mock && i.mock.type === 'enemy');
  const nEnemies = def.encounters.reduce((a, e) => a + (e.waves ? e.waves.flat().length : e.spawns.length), 0);
  o.expect('敵 ' + enemyIcons.length + ' 体がすべて戦闘に入る', nEnemies, enemyIcons.length);
  o.expect('バルブ3つはエディタの位置', def.valves.map((v) => [v.id, v.x, v.z]).sort(), items.filter((i) => i.mock && i.mock.type === 'valve').map((i) => [i.mock.raw.id, +(i.x - ox).toFixed(3), +(i.y - oy).toFixed(3)]).sort());
  o.expect('開始地点とゴールはエディタの位置', [[def.checkpoints[0].x, def.checkpoints[0].z], [def.goal.x, def.goal.z]],
    [[items.find((i) => i.mock && i.mock.type === 'spawn').x - ox, items.find((i) => i.mock && i.mock.type === 'spawn').y - oy], [items.find((i) => i.mock && i.mock.type === 'goal').x - ox, items.find((i) => i.mock && i.mock.type === 'goal').y - oy]]);
  o.expect('扉の開く条件は progression（と扉の requires）から', ['westGate', 'bShortcut', 'cGate', 'mainGate', 'finalOut'].map((id) => def.doors.find((d) => d.id === id).requires),
    [[['valve:A']], [['valve:B']], [['done:armA']], [['valve:A', 'valve:B', 'valve:C']], [['cleared:finalFight']]]);
  o.expect('戦闘：部屋ごと・ウェーブごと', def.encounters.filter((e) => ['aFight', 'bFight', 'finalFight'].includes(e.id)).map((e) => [e.id, e.type, e.waves.length, e.doors]),
    [['aFight', 'arena', 1, ['entrySeal']], ['bFight', 'arena', 2, ['bIn', 'bOut']], ['finalFight', 'arena', 2, ['finalIn', 'finalOut']]]);
  o.expect('最終試験は「全系統復旧」の後', def.encounters.find((e) => e.id === 'finalFight').cond, 'done:valves');
  o.expect('照合（適合腕A）は並行ミッション', def.missions.map((m) => [m.id, m.type, !!m.parallel]), [['valves', 'valves', false], ['armA', 'armCheck', true], ['final', 'arena', false]]);

  o.section('つながり：開始地点から全部の目的地・部屋へ歩いて行ける（扉をすべて開けた状態）');
  await ev(() => stageEnterArea('ll-1-3'));
  await o.waitFor(() => !STG.fade && STG.area === 'll-1-3', 12000);
  const reach = await ev(() => {
    const L = STG.L, def = STG.def;
    const save = {}; for (const id in L.doors) { save[id] = L.doors[id].open; setDoor(id, true, true); }
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const w of L.walk) { x0 = Math.min(x0, w.x0); z0 = Math.min(z0, w.z0); x1 = Math.max(x1, w.x1); z1 = Math.max(z1, w.z1); }
    const st = 0.4, nx = Math.ceil((x1 - x0) / st) + 1, nz = Math.ceil((z1 - z0) / st) + 1, seen = new Uint8Array(nx * nz);
    const cp = def.checkpoints[0], s0 = Math.round((L.Z(cp.z) - z0) / st) * nx + Math.round((L.X(cp.x) - x0) / st);
    const q = [s0]; seen[s0] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], i = c % nx, k = (c - i) / nx;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const I = i + a, K = k + b; if (I < 0 || K < 0 || I >= nx || K >= nz) continue;
        const n = K * nx + I; if (seen[n] || !stageWalkable(x0 + I * st, z0 + K * st, false)) continue; seen[n] = 1; q.push(n);
      }
    }
    const ok = (x, z) => { const i = Math.round((L.X(x) - x0) / st), k = Math.round((L.Z(z) - z0) / st); for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const n = (k + b) * nx + i + a; if (seen[n]) return true; } return false; };
    const bad = [];
    for (const v of def.valves) if (!ok(v.x, v.z)) bad.push('valve ' + v.id);
    if (!ok(def.armCheck.crusher.x, def.armCheck.crusher.z)) bad.push('check');
    for (const t of def.taggedArms) if (!ok(t.at.x, t.at.z)) bad.push('arm ' + t.tag);
    if (!ok(def.goal.x, def.goal.z)) bad.push('goal');
    for (const e of def.encounters) if (!(e.spawns || e.waves.flat()).some((s) => ok(s[0], s[1]))) bad.push('enc ' + e.id);
    for (const s of def.spaces) if (s.type !== 'duct' && !ok((s.r[0] + s.r[1]) / 2, (s.r[2] + s.r[3]) / 2)) bad.push('space ' + s.id);
    for (const id in save) setDoor(id, save[id], true);
    return bad;
  });
  o.expect('行けない所が無い', reach, []);
  await key('KeyH', 100); await safe();

  /* ================= 受付から選んでクリアして帰還 ================= */
  o.section('受付から選ぶ（キー操作）');
  await tp(-5.2, 0, 90); await pickLabel('会話する'); await key('KeyF', 300);
  o.expect('受付の一覧に並ぶ（同梱 → 公開 → 取り込み）', await ev(() => STG.dialog.spec.choices.map((c) => c.label)), ['DEMO STAGE 1-1', 'DEMO STAGE 1-2', 'DEMO STAGE 1-3', 'LevelLab の JSON を読み込む（試遊）', '戻る']);
  await key('KeyS', 60); await key('KeyS', 60); await key('KeyF', 200);
  await tp(0, -5.4, 0); await pickLabel('試験区画へ進む'); await key('KeyF', 100);
  await o.waitFor(() => !STG.fade && STG.area === 'll-1-3', 12000);
  o.expect('供給圧力復旧区画に入る（開始地点）', await ev(() => [STG.area, STG.def.title, +(playerPos.x - STG.L.X(STG.def.checkpoints[0].x)).toFixed(1), +(playerPos.z - STG.L.Z(STG.def.checkpoints[0].z)).toFixed(1)]), ['ll-1-3', '供給圧力復旧区画', 0, 0]);
  o.expect('敵がいない最初は静か・扉は閉じている', await ev(() => [STG.enemies.length, ['westGate', 'eastGate', 'mainGate', 'cGate'].map((id) => STG.L.doors[id].open)]), [0, [false, false, false, false]]);

  o.section('A：中央ホールの戦闘 → A弁');
  await fists();
  await valveF('A');
  o.expect('戦闘の前は A弁が回らない（理由を出す）', await pickLabel('バルブ（まだ回らない）'), 'バルブ（まだ回らない）');
  await key('KeyF', 300);
  o.expectTrue('「中央ホール 戦闘クリア」が必要と表示', (await subtitle()).indexOf('「中央ホール 戦闘クリア」が必要') >= 0, await subtitle());
  await tp(0, -12, 0); await wait(400);
  await o.waitFor(() => STG.enc.aFight.state === 'active', 6000);
  o.expect('中央ホールに入るとアリーナ（入口が閉まる）', await ev(() => [STG.enc.aFight.state, STG.L.doors.entrySeal.open]), ['active', false]);
  o.expect('倒しきる', await clearEnc('aFight'), 'cleared');
  await fists(); await valveF('A');
  await pickLabel('バルブを回す'); await key('KeyF', 100);
  await o.waitFor(() => !STG.busy && STG.prog.valves.A, 8000); await wait(600);
  o.expect('A弁 → 西・東の扉が開く', [await doorOpen('westGate'), await doorOpen('eastGate'), await doorOpen('mainGate')], [true, true, false]);

  o.section('B：ポンプ試験室（2ウェーブ）→ B弁 → 近道');
  await tp(-60, -15, 0); await wait(400);
  await o.waitFor(() => STG.enc.bFight.state === 'active', 6000);
  o.expect('アリーナで bIn・bOut が閉まる', await ev(() => [STG.L.doors.bIn.open, STG.L.doors.bOut.open]), [false, false]);
  o.expect('2ウェーブを倒す', await clearEnc('bFight'), 'cleared');
  await wait(600);
  o.expect('bOut が開く（条件 cleared:bFight）', await doorOpen('bOut'), true);
  await fists(); await valveF('B'); await pickLabel('バルブを回す'); await key('KeyF', 100);
  await o.waitFor(() => !STG.busy && STG.prog.valves.B, 8000); await wait(500);
  o.expect('B弁 → 中央ホールへの近道が開く', await doorOpen('bShortcut'), true);

  o.section('C：適合腕Aを探して照合（並行ミッション）→ C弁');
  await fists(); await valveF('C');
  o.expect('（C扉が閉じていて C弁へは入れないが）照合の前は C弁が回らない', await ev(() => [STG.L.doors.cGate.open, condOk(STG.def.valves.find((v) => v.id === 'C').cond)]), [false, false]);
  const at = def.taggedArms[0].at;
  await tp(at.x + 1.6, at.z, 90, -30); await wait(400);
  await o.waitFor(() => STG.enc.armGuard && STG.enc.armGuard.state === 'active', 6000);
  o.expect('適合腕A の部屋で守衛', await ev(() => STG.enc.armGuard.state), 'active');
  await clearEnc('armGuard');
  await ev(() => { takeGroundArm({ part: severedParts.find((p) => p.armState && p.armState.tag === 'A01') }, 'RIGHT'); });
  await o.waitFor(() => graftArms.length === 0, 8000);
  o.expect('右手に適合腕A', await ev(() => player.arms.RIGHT.tag), 'A01');
  const slot = await ev(() => [STG.L.crusher.slot.x - STG.L.X(0), STG.L.crusher.slot.z - STG.L.Z(0)]);
  await ev(([x, z]) => { playerPos.set(STG.L.X(x), 0, STG.L.Z(z + 1.6)); yaw = 0; pitch = -0.3; }, slot); await wait(400);
  o.expect('認証装置のプロンプト', await pickLabel('適合腕Aを搬入する'), '適合腕Aを搬入する');
  await key('KeyF', 100);
  await o.waitFor(() => !STG.busy && STG.prog.done.armA, 8000); await wait(700);
  o.expect('照合 → C扉が開く（valves の途中でも進められる）', [await ev(() => !!STG.prog.done.armA), await doorOpen('cGate'), await ev(() => currentMission().id)], [true, true, 'valves']);
  await tp(45, -27, 180); await wait(300);
  if (await ev(() => STG.enc.enc_cValve && STG.enc.enc_cValve.state === 'active')) await clearEnc('enc_cValve');
  await fists(); await valveF('C'); await pickLabel('バルブを回す'); await key('KeyF', 100);
  await o.waitFor(() => !STG.busy && STG.prog.valves.C, 8000); await wait(700);
  o.expect('3系統 → 最終扉が開く・valves 完了', [await doorOpen('mainGate'), await ev(() => !!STG.prog.done.valves)], [true, true]);

  o.section('最終試験（全系統復旧の後だけ始まる）→ ゴール → セーフルーム');
  await tp(4, -46, 0); await wait(400);
  await o.waitFor(() => STG.enc.finalFight.state === 'active', 6000);
  o.expect('最終試験が始まる', await ev(() => STG.enc.finalFight.state), 'active');
  o.expect('倒しきる', await clearEnc('finalFight'), 'cleared');
  await wait(800);
  o.expect('最終ミッション完了・搬出通路が開く', [await ev(() => !!STG.prog.done.final), await doorOpen('finalOut')], [true, true]);
  await tp(def.goal.x, def.goal.z + 1.6, 0); await wait(300);
  o.expect('ゴール扉', await pickLabel('セーフルームへ戻る'), 'セーフルームへ戻る');
  await key('KeyF', 100); await safe();
  o.expect('セーフルームへ帰還', await ev(() => STG.area), 'safe');
  o.expect('入り直すと初期化（同じマップでまた遊べる）', await ev(() => { stageEnterArea('ll-1-3'); return [Object.keys(STG.prog.done).length, Object.keys(STG.prog.valves).length]; }), [0, 0]);
  await o.waitFor(() => !STG.fade && STG.area === 'll-1-3', 12000);
  await key('KeyH', 100); await safe();

  /* ================= 汎用性：別の ID・配置・構成（合成データ） ================= */
  o.section('別のマップ（合成データ：mock.source なし）も同じ取り込みで遊べる');
  const rs = await ev((j) => { const r = levelLabRegister(j, { source: 'public', file: 'synthetic' }); return [r.ok, r.id, r.errors, r.warnings]; }, synth);
  o.expect('登録できる（ID は題名から）', [rs[0], /^ll-map/.test(rs[1]), rs[2]], [true, true, []]);
  const sid = rs[1];
  o.expect('2つ目の公開ステージ：別の場所に置かれ、1-3 はそのまま', await ev((sid) => [BK_STAGES[sid].origin[0] !== BK_STAGES['ll-1-3'].origin[0], BK_STAGES['ll-1-3'].title, BK_STAGES[sid].missions.map((m) => m.type), BK_STAGES[sid].lockDoor], sid), [true, '供給圧力復旧区画', ['valves'], 'gateB']);
  await pickStage(await ev((sid) => BK_STAGES[sid].label, sid));
  await o.waitFor((sid) => !STG.fade && STG.area === sid, 12000, sid);
  o.expect('合成マップに入る', await ev(() => STG.def.title), '合成テスト区画');
  // 弁室の真ん中へ（座標は変換結果から：mock.origin2D が無いので開始地点が原点）
  await ev(() => { const r = STG.def.spaces.find((s) => s.id === 'roomB').r; playerPos.set(STG.L.X((r[0] + r[1]) / 2), 0, STG.L.Z((r[2] + r[3]) / 2)); });
  await wait(400);
  await o.waitFor(() => STG.enc.fightB && STG.enc.fightB.state === 'active', 6000);
  o.expect('弁室の戦闘（cleared:fightB）', await clearEnc('fightB'), 'cleared');
  await fists(); await valveF('V1'); await pickLabel('バルブを回す'); await key('KeyF', 100);
  await o.waitFor(() => !STG.busy && STG.prog.valves.V1, 8000); await wait(700);
  o.expect('V1 → gateB が開く', await doorOpen('gateB'), true);
  await ev(() => { const g = STG.def.goal; playerPos.set(STG.L.X(g.x), 0, STG.L.Z(g.z + 1.6)); yaw = 0; });
  await wait(300);
  await pickLabel('セーフルームへ戻る'); await key('KeyF', 100); await safe();
  o.expect('合成マップもクリアして帰還', await ev(() => STG.area), 'safe');

  o.section('ID の衝突・更新');
  o.expect('同じ公開マップをもう一度登録すると拒否（上書きしない）', await ev((j) => { const r = levelLabRegister(j, { source: 'public', file: 'again' }); return [r.ok, BK_STAGES['ll-1-3'].version]; }, real), [false, 1]);
  o.expect('mock.source.id が同梱と同じ「1-1」でも、同梱の 1-1 は上書きされない', await ev((j) => { const c = JSON.parse(JSON.stringify(j)); c.mock.source.id = '1-1'; const r = levelLabRegister(c, { source: 'public', file: 'clash' }); const ok = [r.ok, r.id, BK_STAGES['1-1'].title]; delete BK_STAGES[r.id]; return ok; }, real), [true, 'll-1-1', '第三検体処理区画']);
  o.expect('明示的な更新は同じ ID のまま置き換わる（version が上がる・ほかは変わらない）', await ev(([j, sid]) => { const c = JSON.parse(JSON.stringify(j)); c.floors[0].items.find((i) => i.id === 'rB').mock.raw.name = '弁室（改）'; const r = levelLabRegister(c, { source: 'public', update: true }); return [r.ok, BK_STAGES[sid].version, BK_STAGES[sid].spaces.find((s) => s.id === 'roomB').name, BK_STAGES['ll-1-3'].version]; }, [synth, sid]), [true, 2, '弁室（改）', 1]);

  o.section('未対応・不正なデータの検出（進行に要るものはエラーで登録しない）');
  const bad = (mut) => ev(([j, mut]) => { const c = JSON.parse(JSON.stringify(j)); new Function('c', mut)(c); const r = levelLabConvert(c, { idPrefix: 'x-' }); return { ok: r.ok, errors: r.errors, warnings: r.warnings }; }, [synth, mut]);
  const has = (list, s) => list.some((m) => m.indexOf(s) >= 0);
  let r;
  r = await bad("c.version = 6;"); o.expect('形式 version 6 は拒否', [r.ok, has(r.errors, 'version 6')], [false, true]);
  r = await bad("c.switchLinks = [{ from: 'x', to: 'y' }];"); o.expect('switchLinks（スイッチ連動）はエラー', [r.ok, has(r.errors, 'switchLinks')], [false, true]);
  r = await bad("c.floors.push({ id: 'f2', items: [{ id: 'z', type: 'rect', x: 0, y: 0, w: 4, h: 4 }] });"); o.expect('2階以上はエラー', [r.ok, has(r.errors, '2階以上')], [false, true]);
  r = await bad("c.floors[0].items = c.floors[0].items.filter((i) => i.id !== 'gl');"); o.expect('ゴールが無いとエラー', [r.ok, has(r.errors, 'ゴール')], [false, true]);
  r = await bad("c.floors[0].items.find((i) => i.id === 'e1').x = 80;"); o.expect('部屋の外の敵はエラー', [r.ok, has(r.errors, '部屋・通路の外')], [false, true]);
  r = await bad("c.floors[0].items.find((i) => i.id === 'v1').mock.requires = ['cleared:nothing'];"); o.expect('無い戦闘を待つ条件はエラー（永遠に開かない）', [r.ok, has(r.errors, '戦闘「nothing」が無い')], [false, true]);
  r = await bad("c.floors[0].items.push({ id: 'q', type: 'polygon', points: [] }); c.floors[0].items.find((i) => i.id === 'pr').mock.raw.type = 'hologram';");
  o.expect('知らない要素・置物は警告（登録はできる）', [r.ok, has(r.warnings, 'polygon'), has(r.warnings, 'hologram')], [true, true, true]);
  r = await bad("c.floors[0].items.find((i) => i.id === 'e2').mock.raw.arms = ['laser', 'fist'];"); o.expect('知らない腕の種類は警告', [r.ok, has(r.warnings, 'laser')], [true, true]);

  o.section('ローカル取り込み：受付から JSON ファイルを選ぶ（このブラウザだけ・ID は local-）');
  const save0 = await ev(() => BKUpg.dump());
  const tmp = path.join(require('os').tmpdir(), 'bk-ll-synthetic.json');
  fs.writeFileSync(tmp, JSON.stringify(synth));
  await tp(-5.2, 0, 90); await pickLabel('会話する'); await key('KeyF', 300);
  const n = await ev(() => STG.dialog.spec.choices.findIndex((c) => c.label.indexOf('LevelLab の JSON') === 0));
  for (let k = 0; k < 10 && await ev(() => STG.dialog.idx) !== n; k++) await key('KeyS', 80);
  o.expect('受付に「LevelLab の JSON を読み込む」', await ev(() => STG.dialog.spec.choices[STG.dialog.idx].label), 'LevelLab の JSON を読み込む（試遊）');
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), key('KeyF', 100)]);
  await fc.setFiles(tmp);
  await o.waitFor(() => BK_LEVELLAB.lastReport && BK_LEVELLAB.lastReport.source === 'local', 5000);
  const lr = await ev(() => BK_LEVELLAB.lastReport);
  o.expect('取り込める（local- の ID・ラベルに [ローカル]）', [lr.ok, /^local-map/.test(lr.id), await ev((id) => BK_STAGES[id].label.indexOf('[ローカル]') === 0, lr.id)], [true, true, true]);
  o.expect('公開の同じマップ（ll-）とは別のステージ', await ev(([a, b]) => [!!BK_STAGES[a], !!BK_STAGES[b], a !== b], [lr.id, sid]), [true, true, true]);
  o.expect('結果の表示が出る', await ev(() => !document.getElementById('llReport').classList.contains('hidden')), true);
  // LevelLab で直して読み込み直す → 更新
  const synth2 = JSON.parse(JSON.stringify(synth)); synth2.floors[0].items.find((i) => i.id === 'rA').mock.raw.name = '前室（修正版）';
  fs.writeFileSync(tmp, JSON.stringify(synth2));
  await ev((t) => levelLabImportText(t, 'bk-ll-synthetic.json'), JSON.stringify(synth2));
  o.expect('読み込み直すと更新（ほかのステージは変わらない）', await ev(([id, sid]) => [BK_STAGES[id].version, BK_STAGES[id].spaces.find((s) => s.id === 'roomA').name, BK_STAGES[sid].spaces.find((s) => s.id === 'roomA').name, BK_STAGES['ll-1-3'].version], [lr.id, sid]), [2, '前室（修正版）', '前室', 1]);
  o.expect('アップグレードのセーブはそのまま', await ev(() => BKUpg.dump()), save0);
  await page.reload(); await wait(1500); await page.click('#startOverlay'); await wait(500);
  await ev(() => BK_LEVELLAB.ready);
  o.expect('再読み込み後：ローカルは残る・公開はそのまま', await ev((id) => [!!BK_STAGES[id], BK_STAGES[id] && BK_STAGES[id].spaces.find((s) => s.id === 'roomA').name, !!BK_STAGES['ll-1-3'], BK_STAGES['ll-1-3'].version], lr.id), [true, '前室（修正版）', true, 1]);
  await ev((id) => levelLabRemoveLocal(id), lr.id);
  o.expect('ローカルを消せる', await ev((id) => [!!BK_STAGES[id], Object.keys(JSON.parse(localStorage.getItem('bk.levellab.local') || '{}')).length], lr.id), [false, 0]);

  o.section('別のブラウザ（まっさらなプロファイル）でも公開マップは同じ内容');
  const d1 = await ev(() => JSON.stringify(BK_STAGES['ll-1-3']));
  const o2 = await open({ w: 640, h: 360 });
  await o2.page.evaluate(() => BK_LEVELLAB.ready);
  const d2 = await o2.page.evaluate(() => [JSON.stringify(BK_STAGES['ll-1-3']), localStorage.getItem('bk.levellab.local'), localStorage.getItem('bk.player')]);
  await o2.browser.close();
  o.expect('変換結果が完全に同じ（ローカル保存なし）', [d2[0] === d1, d2[1], d2[2]], [true, null, null]);
  o.expect('2つ目のブラウザでもエラーなし', o2.errors, []);

  // 意図したエラー（不正データの検出・重複登録）のコンソール出力を除く
  o.errors.splice(0, o.errors.length, ...o.errors.filter((e) => e.indexOf('[LevelLab') < 0 && e.indexOf('[BK stage') < 0));
  await o.finish();
})();
