// 全テストを順に実行して、ログを出す。各テストは最後に errors [] を出せば成功
const { execFileSync } = require('child_process');
const tests = ['t_eat', 't_rise', 't_just', 't_equip', 't_down', 't_reset', 't_reg'];
let failed = 0;
for (const t of tests) {
  console.log('=== ' + t);
  try {
    const out = execFileSync('node', [__dirname + '/' + t + '.js'], { encoding: 'utf8', timeout: 240000 });
    process.stdout.write(out);
    if (!/errors \[\]|^\[\]$/m.test(out)) { failed++; console.log('!! ページでエラーが出ました'); }
  } catch (e) { failed++; console.log('!! 失敗: ' + e.message); }
}
console.log(failed ? failed + ' 件失敗' : 'すべて完了');
process.exit(failed ? 1 : 0);
