// テスト用にページを開く共通処理（Playwright / Chromium）
// cdnjs に繋がらない環境でも動くよう、three.js は npm の three@0.128.0 を差し替えて読む。
// Chromium の場所は PW_CHROMIUM で指定できる（未指定なら Playwright 標準）
const { chromium } = require('playwright');
const path = require('path');
require('fs').mkdirSync(path.join(__dirname, 'shots'), { recursive: true });   // スクリーンショットの置き場（git管理外）
const ROOT = path.resolve(__dirname, '../..');
const THREE_JS = require.resolve('three/build/three.min.js');
async function open(opts = {}) {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const vw = opts.w || 960, vh = opts.h || 540;
  // PW_DPR：描画解像度の倍率。遅いマシンでフレームが落ちて実時間とずれるときに下げる（例 0.5）
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: +process.env.PW_DPR || 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e) + ' @ ' + String(e.stack).split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/cdnjs\.cloudflare\.com.*three.*\.js/, r => r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }));
  // ヘッドレスではポインタロックと全画面が使えないので、ロックできたことにする
  await page.addInitScript(() => {
    let el = null;
    Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return el; } });
    Element.prototype.requestPointerLock = function () { el = this; document.dispatchEvent(new Event('pointerlockchange')); };
    Element.prototype.requestFullscreen = function () { return Promise.reject(); };
  });
  await page.goto('file://' + (opts.root || ROOT) + '/index.html');
  await page.waitForTimeout(1500);
  await page.click('#startOverlay');
  await page.waitForTimeout(500);
  return { browser, ctx, page, errors };
}
module.exports = { open };
