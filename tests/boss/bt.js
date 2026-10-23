// ボス戦テストの共通処理。
// expect() は node:assert/strict で期待する状態と比べ、✓/✗ を出す。
// 失敗しても最後まで続けて全部の結果を出し、finish() で1件でも失敗があれば終了コード1にする。
// ページで例外が出ていないことも finish() で必ず確かめる
const assert = require('node:assert/strict');
const { open } = require('./h');

async function setup(opts) {
  const o = await open(Object.assign({ w: 1280, h: 720 }, opts || {}));
  const { page } = o;
  o.failures = 0; o.passed = 0;
  o.ev = (f, a) => page.evaluate(f, a);
  o.wait = (ms) => page.waitForTimeout(ms);

  // 期待どおりか（深い比較）
  o.expect = (label, actual, expected) => {
    try {
      assert.deepStrictEqual(actual, expected);
      o.passed++; console.log('  ✓ ' + label + '  [' + JSON.stringify(actual) + ']');
    } catch (e) {
      o.failures++; console.log('  ✗ ' + label + '  実際=' + JSON.stringify(actual) + ' 期待=' + JSON.stringify(expected));
    }
  };
  // 条件が成り立つか（数値の範囲など）
  o.expectTrue = (label, cond, info) => {
    try {
      assert.ok(cond);
      o.passed++; console.log('  ✓ ' + label + (info !== undefined ? '  [' + JSON.stringify(info) + ']' : ''));
    } catch (e) {
      o.failures++; console.log('  ✗ ' + label + (info !== undefined ? '  実際=' + JSON.stringify(info) : ''));
    }
  };
  o.section = (t) => console.log('— ' + t);
  o.finish = async () => {
    o.expect('ページで例外・コンソールエラーが出ていない', o.errors, []);
    await o.browser.close();
    console.log(`結果: ${o.passed} 件OK / ${o.failures} 件NG`);
    process.exit(o.failures ? 1 : 0);
  };

  // ダクトの男の状態の移り変わりを記録する（setEnemyState を包む）
  await o.ev(() => {
    window.__bossStates = [];
    const orig = setEnemyState;
    setEnemyState = function (en, s) { if (en.boss) window.__bossStates.push(s); return orig(en, s); };
  });
  // 検証室の敵を、入った時点の並びで覚えておく（__L）。倒れた敵は LAB.enemies から抜けて
  // 添字がずれるので、テストは __L[i] で同じ敵を指す
  await o.ev(() => {
    const orig = startLab;
    startLab = function () { orig(); window.__L = LAB.enemies.slice(); };
  });
  o.clearStates = () => o.ev(() => { window.__bossStates = []; });
  o.states = () => o.ev(() => window.__bossStates.slice());

  // ボス戦開始（部屋Aの中に立つ）。男はしばらく何もしない
  o.startBoss = async () => {
    await page.keyboard.press('KeyB'); await o.wait(200);
    await o.ev(() => { playerPos.set(-21, 0, -34); });
    await o.wait(300);
    await o.ev(() => { bossMan.cooldown = 99; bossMan.riseCd = 99; bossMan.kickCd = 99; bossMan.gunCd = 99; });
  };
  // 男の正面 d m に立って男の方を向く
  o.faceBoss = async (d) => o.ev((d) => {
    const b = bossMan.group.position;
    playerPos.set(b.x, 0, b.z + d);
    yaw = 0; pitch = -0.05;
  }, d);
  // 条件が成り立つまで待つ（ms まで）
  o.waitFor = async (fn, ms, arg) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 5000)) {
      if (await o.ev(fn, arg)) return true;
      await o.wait(50);
    }
    return false;
  };
  // □（要素）が画面中央に来て選ばれるまで視点を合わせる
  o.aimAtEl = async (sel) => {
    // 遅いマシンでは□の位置が数フレーム遅れて更新されるので、毎回2フレーム描かせてから見直す
    for (let i = 0; i < 70; i++) {
      const r = await o.ev((sel) => {
        const el = document.querySelector(sel);
        if (!el || el.classList.contains('hidden')) return null;
        return { x: parseFloat(el.style.left), y: parseFloat(el.style.top), sel: el.classList.contains('selected') };
      }, sel);
      if (!r) { await o.wait(80); continue; }
      const dx = r.x - 640, dy = r.y - 360;
      if (Math.hypot(dx, dy) < 12 && r.sel) return true;
      await o.ev(([dx, dy]) => { yaw -= dx * 0.0016; pitch -= dy * 0.0016; }, [dx, dy]);
      await o.ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    return false;
  };
  // 頭モードでダクトを抜けて、次の部屋（BOSS.next）に入ったことにする
  o.headToNextRoom = async () => {
    await o.ev(() => {
      const r = ARENA.rooms[BOSS.next];
      state = S.HEAD; headH = 0.3; spineGroup.visible = true;
      playerPos.set((r.x0 + r.x1) / 2, 0, (ARENA.z0 + ARENA.z1) / 2 + 5);
    });
    await o.wait(400);
  };
  // 人間に戻って、隠れている男を見つけたことにする（先制攻撃）
  o.findBoss = async () => {
    await o.ev(() => { state = S.HUMAN; spineGroup.visible = false; headH = 0; bossFound(true); });
    await o.wait(600);
    await o.ev(() => { bossMan.cooldown = 99; bossMan.riseCd = 99; bossMan.kickCd = 99; bossMan.gunCd = 99; });
  };
  // 男の部位の□に id を振る（aimAtEl で狙うため）
  o.tagTarget = (key, id) => o.ev(([key, id]) => {
    const t = targetEntries.find((t) => t.enemy === bossMan && t.key === key);
    t.el.id = id;
  }, [key, id]);
  // ギミック検証室に入る（Tを押す）。敵はしばらく攻撃しない
  o.lab = async () => {
    await page.keyboard.press('KeyT'); await o.wait(400);
    await o.ev(() => { for (const e of LAB.enemies) e.cooldown = 99; });
  };
  // クロスヘアをワールドの点に向ける（目の高さから）
  o.lookAt = (p) => o.ev((p) => {
    const dx = p.x - playerPos.x, dy = p.y - (playerPos.y + EYE), dz = p.z - playerPos.z;
    yaw = Math.atan2(-dx, -dz);
    pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }, p);
  // 敵の弱点の印のワールド座標
  o.weakPos = (i) => o.ev((i) => {
    const en = (window.__L || LAB.enemies)[i];
    const v = new THREE.Vector3();
    weakWorld(en, v);
    return { x: v.x, y: v.y, z: v.z };
  }, i);
  // 次の行動が出せるまで待つ（攻撃の途中・ヒットストップ・手首アイテムのクールダウン）
  o.ready = () => o.waitFor(() => canCancelNow() && hitstop <= 0 &&
    wristCool.LEFT <= 0 && wristCool.RIGHT <= 0 && gunCool.LEFT <= 0 && gunCool.RIGHT <= 0 &&
    !player.attack, 4000);
  // Qを押してライジングに入り切るまで待つ
  o.rise = async () => {
    await page.keyboard.down('KeyQ');
    await o.waitFor(() => state === S.RISING, 4000);
    await o.wait(250);
  };
  // クリック（短押し）
  o.click = async (btn) => { await page.mouse.down({ button: btn }); await o.wait(40); await page.mouse.up({ button: btn }); };
  // 長押し
  o.hold = async (btn, ms) => { await page.mouse.down({ button: btn }); await o.wait(ms); await page.mouse.up({ button: btn }); };
  return o;
}
module.exports = { setup };
