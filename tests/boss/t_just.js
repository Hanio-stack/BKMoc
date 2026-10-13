const { setup } = require('./bt');
(async () => {
  const o = await setup();
  const { page, ev, wait } = o;
  await o.startBoss();
  await ev(() => { player.resource = 2; });
  await o.faceBoss(2.6); await wait(300);
  await ev(() => { bossMan.riseCd = 0; });
  // ジャスト窓に入った瞬間にページ内でドッジを押す（テストの遅延を除く）
  const r = await ev(() => new Promise((res) => {
    const iv = setInterval(() => {
      if (isJustTiming(bossMan)) {
        clearInterval(iv);
        const before = player.resource;
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
        res({ before, after: player.resource, slow: slowTimer, t: bossMan.t, state: bossMan.state });
      }
    }, 5);
  }));
  console.log(JSON.stringify(r));
  await wait(1200);
  console.log('arms', await ev(() => [player.arms.LEFT.lost, player.arms.RIGHT.lost].join(',')));
  console.log(o.errors);
  await o.browser.close();
})();
