# 合成テストデータ（実際の LevelLab の書き出しではない）

- `two-rooms.synthetic.v7.json`：取り込みが「ステージ専用の処理なし」で動くかを確かめるため、実データ（`../pressure-restoration.v7.json`）の
  形（`version: 7` / `floors[].items[].mock` / `progression`）に合わせて手で作った小さなマップ。
  ID・題名・配置・部屋の数が実データと違い、`mock.source` と `mock.origin2D` を持たない（エディタだけで作った新規マップ相当）。
- **合成データなので、別の実際の LevelLab マップとの互換性を証明するものではない。**
