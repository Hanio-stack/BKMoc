// 全テストを順に実行する。各テストは期待と違う結果が1件でもあれば終了コード1で終わる
const { spawnSync } = require('child_process');
const tests = ['t_down', 't_eat', 't_rise', 't_equip', 't_reset', 't_reg'];
const failed = [];
for (const t of tests) {
  console.log('=== ' + t);
  const r = spawnSync('node', [__dirname + '/' + t + '.js'], { encoding: 'utf8', timeout: 300000 });
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  if (r.status !== 0) { failed.push(t); console.log('!! ' + t + ' 失敗（終了コード ' + r.status + (r.error ? ' / ' + r.error.message : '') + '）'); }
}
console.log(failed.length ? '失敗: ' + failed.join(', ') : 'すべて成功');
process.exit(failed.length ? 1 : 0);
