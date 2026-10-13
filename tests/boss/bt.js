// ボス戦テスト用の共通処理
const { open } = require('./h');
async function setup(opts) {
  const o = await open(Object.assign({ w: 1280, h: 720 }, opts || {}));
  const { page } = o;
  o.ev = (f, a) => page.evaluate(f, a);
  o.wait = (ms) => page.waitForTimeout(ms);
  // ボス戦開始（部屋Aの中に立つ）
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
  // □（要素）が画面中央に来るまで視点を合わせる
  o.aimAtEl = async (sel) => {
    for (let i = 0; i < 25; i++) {
      const r = await o.ev((sel) => {
        const el = (typeof sel === 'string') ? document.querySelector(sel) : null;
        if (!el || el.classList.contains('hidden')) return null;
        return { x: parseFloat(el.style.left), y: parseFloat(el.style.top), sel: el.classList.contains('selected') };
      }, sel);
      if (!r) { await o.wait(80); continue; }
      const dx = r.x - 640, dy = r.y - 360;
      if (Math.hypot(dx, dy) < 12 && r.sel) return true;
      await o.ev(([dx, dy]) => { yaw -= dx * 0.0016; pitch -= dy * 0.0016; }, [dx, dy]);
      await o.wait(90);
    }
    return false;
  };
  return o;
}
module.exports = { setup };
