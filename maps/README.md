# LevelLab のマップを BKMoc で遊ぶ

LevelLab（マップ制作ツール）で作って書き出した **プロジェクト JSON をそのまま** BKMoc で読み込み、
セーフルームの受付研究員から選んで遊べる。マップごとの変換コードは書かない（`levellab.js` の取り込みが全マップ共通）。

## 2つの入れ方

| | 公開ステージ | ローカル取り込み |
|---|---|---|
| 用途 | みんなが遊ぶステージ | 作った直後の試遊 |
| 置き場所 | このフォルダ（Git 管理） | そのブラウザの localStorage だけ |
| 別のブラウザ・別のアカウント | 同じ内容になる | 出ない |
| ID | `ll-<ID>` | `local-<ID>`（ラベルに「[ローカル]」） |
| 更新 | 公開し直して Push | 同じ JSON を読み込み直す |

### ローカル取り込み（すぐ試す）

1. LevelLab で JSON を書き出す。
2. BKMoc を開き、H でセーフルームへ。受付研究員に話しかけ（F）、「LevelLab の JSON を読み込む（試遊）」を選んでファイルを選ぶ。
   画面に JSON ファイルをドラッグ＆ドロップしてもよい。
3. 右上に結果（登録できたか・警告・エラー）が出る。登録できれば受付の一覧に「[ローカル] …」が並ぶので、選んで大型扉から入る。
4. LevelLab で直したら、同じように読み込み直す → 同じステージが更新される（ほかのステージは変わらない）。
   区画の中にいるときに更新した場合は、入り直したときに反映される。

ブラウザのコンソールでも `levelLabImportText(文字列, 'ファイル名')` で取り込める。消すときは `levelLabRemoveLocal('local-…')`。

### 公開ステージ（みんなに配る）

```powershell
node tools/levellab-publish.js <書き出した.json> <公開名>
```

- `maps/levellab/<公開名>.js`（書き出した JSON を `BK_publishLevelLab(...)` で包んだだけのファイル）ができ、
  `maps/manifest.js` の一覧に足される。中身の JSON は書き換えない。
- 同じ公開名で実行し直すとファイルが置き換わる（＝公開ステージの更新）。
- `index.html` の `?v=` を上げてから Push する（GitHub Pages のキャッシュ対策。`window.BK_ASSET_V` も同じ値）。
- node が無いときは手で作れる：`maps/levellab/<公開名>.js` の1行目に `BK_publishLevelLab("levellab/<公開名>.js", `、
  続けて JSON をそのまま貼り、最後に `);` を付ける。`maps/manifest.js` の一覧に `"levellab/<公開名>.js",` を足す。

JSON ではなく JS で包んでいるのは、`start index.html`（file://）で開いたときもブラウザが読めるようにするため。

## ID の決まり

- ID は `mock.source.id`（LevelLab に取り込んだ元の BKMoc ステージの ID）か、無ければ題名から作る。英数字と `-` `_` だけ。
- 公開は `ll-`、ローカルは `local-` を前に付ける。同梱のステージ（`safe` / `1-1` / `1-2`）とは決して重ならない。
- 同じ ID を「更新」の指定なしで登録しようとすると拒否する（上書きしない）。更新は版（version）が上がる。

## 読み込む LevelLab の形式（version 7）

実データ：`tests/fixtures/levellab/pressure-restoration.v7.json`（供給圧力復旧区画）。

**エディタ上の今の状態を正とする。**

| LevelLab | BKMoc | 使うもの |
|---|---|---|
| `floors[0].items[]` の `rect`（`mock.type: space`） | 部屋・ダクトなど | 位置と大きさは `x, y, w, h`（`mock.origin2D` を原点、1 = 1m、y は南向き）、種類・高さ・色合い・名前は `mock.raw` |
| `corridor` | 通路 | 線分 `x1,y1 – x2,y2` と `width`。両端を 1m 伸ばしてつながる部屋と重ねる |
| `route` | 通路（折れ線） | `points` を区間ごとの通路にする。曲がり角は幅の半分だけ伸ばして重ねる |
| `gas` | 血液凝固ガス | 範囲 |
| `icon` + `mock.type: door` | 扉 | 中心はアイコンの位置、向きは `raw.axis`、幅は `mock.width`。開く条件は `mock.requires`（`any` なら「どれか」）か progression の `links[].rules` |
| `valve` | バルブ | 位置はアイコン。色・旗・放送・開く扉は `raw`。回せる条件は `mock.requires`。エディタで動かした場合は配管を引き直す |
| `enemy` | 敵 | 位置・腕・遅れ・強敵。`mock.roomId` と `mock.wave` で戦闘とウェーブにまとめる（下） |
| `corpse` / `arm` / `supply` / `prop` | 死体 / 床の腕 / 予備腕の支給口 / 置物 | 位置はアイコン、ほかは `raw`。`arm` の `mock.replenish` と照合の `tag` は「壊れたら補充する番号付きの腕」 |
| `check` | 照合装置（番号付きの腕の提出） | 本体は近くの `inspector` / `crusher` の置物。無ければアイコンの位置に置く |
| `spawn` / `goal` | 開始地点 / セーフルームへ戻る扉 | アイコンの位置 |
| `progression.flags` | 戦闘の ID | `cleared:<戦闘>`（`roomId` の部屋の戦闘） |
| `progression.links` | 扉の開く条件 | `mapDoorId` の扉に `rules`（配列の配列＝どれか1組を満たす） |
| `progression.events` | 戦闘の放送・開始条件 | `note` が開始の放送、`triggerFlagId` が始まる条件 |
| `mock.source` | エディタが持たない設定 | ミッションの文言と順番、チェックポイント（開始地点以外）、霧、明るさ、話者、最終扉の名前など |

戦闘のまとめ方：敵は `mock.roomId`（無ければ立っている部屋）ごとに1つの戦闘。ID はその部屋の `cleared:` フラグ、無ければ `enc_<部屋>`。
ウェーブが2つ以上か、`mock.source` でアリーナとされていればアリーナ（ウェーブ戦）、それ以外は入ると湧く通路戦。

条件の書き方（扉・バルブ・戦闘で共通）：`valve:A`（バルブA）／`cleared:戦闘ID`／`done:ミッションID`／`flag:名前`／`valves:数`。

ミッション：`mock.source.missions` があればそれを使う（種類 `valves` / `armCheck` / `arena`）。照合装置が `parallel: true` なら並行ミッション
（順番を待たずに進められる）。`mock.source` が無ければ、バルブ → 照合（並行）→ 終点の部屋の手前のアリーナ、の順で組み立てる。

## 扱えないもの（黙って省略しない）

取り込みの結果は `BK_LEVELLAB.reports`（受付から読み込んだときは画面右上）とコンソールに出る。

- **エラー（登録しない）**：形式の版が違う／階層が2つ以上／`verticals`・`switchLinks`／開始地点・ゴール・ゴールの扉が無い／
  部屋の外の敵・開始地点／条件が指す戦闘・バルブ・ミッションが無い（永遠に満たせない）／バルブが開く扉が無い／
  照合装置の腕がマップに無い／ミッションの種類が未対応
- **警告（登録はする）**：知らない要素・属性・置物・腕の種類／`manualOpenings`／`graph`／部屋が無い戦闘（敵の位置で代わりの部屋を使う）／
  番号付きの腕の下に台座が無い（床に置く）／全バルブで開く扉が分からない など
- **注記**：エディタで動かした部屋・バルブ、`mock.source` にあってエディタに無い空間（使わない）など

新しい種類の要素に対応するときは `levellab.js` の変換（`convertLevelLabV7`）に足す。形式の版が上がったら `LEVELLAB_CONVERTERS` に版ごとの変換を足す。
