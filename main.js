'use strict';

/* =========================================================
   BK Combat Flow Mock (3D)

   人間モード（HUMAN・一人称）:
     L/R Click        パンチ（左/右）
     L/R Click 長押し パージ（手首射出・各腕1回のみ）
     Space            キック（リソース1／ジャストキック）
     Shift            ドッジ（ジャストドッジは消費なし＋1回復）
     Ctrl 長押し      ガード（腕を斜めに構える。受けるダメージは半減して腕が受ける）
                      ※開始のクリックで全画面になり、Ctrl+W などのブラウザの
                        ショートカットはゲームが受け取る（Chrome / Edge）
     ※全アクション（パンチ・パージ・キック・ドッジ・ライジング）は
       進行中のアクションをキャンセルして出せる。
       キャンセルできるのは近接の「振り抜き（アニメーションの攻撃終わり）」以降。
       発生中は上書きできないので、出した攻撃は必ず一度は判定が出る。
       掴みフィニッシャーとドッジの移動中はキャンセルできない。
     ※パンチだけ先行入力がある。振り抜き前に押した左右のパンチは
       inputBufferTime のあいだ覚えておき、キャンセルできた瞬間に出る。
       → 左右を交互に叩くと、入力を食われずに 0.18s 間隔で繋がる。
       キックとドッジは「押した瞬間」でジャストを判定する設計なので、
       あとから出ると判定がずれる。先行入力の対象にしていない。
     Q 長押し        ライジング（いつでも可）
     Z                体スキル（体ごとに1回だけ。下の「体スキル」参照）
     ※キック／ドッジのリソース（青い丸）の数は体ごとに 2〜6 のランダム。
       死体を乗っ取るとその体の数になる（満タンで始まる）。最初の体だけ3つ。
       自分が捨てた体は数も残りもそのまま残る。死体の TAKE BODY に数が出る
     F                落ちている/浮いている腕と交換
     G                リセット
     Tab              今の目的を左上に表示／もう一度押すと消える
                      （上中央のコンパスは常に出ていて、赤い丸がゴールの方角）

   掴みフィニッシャー（パンチの延長・専用入力もUIもない）:
     パンチが「スタン中の敵」に当たると、殴った側の腕が自動で敵の頭を掴んで握り潰す。
     HPを削り切って倒しただけでは出ない（CONFIG.finisherOnKill:false）。
     どちらの死に方でも死体は残るので、頭モード／ライジングでそのまま乗っ取れる。
     発動条件はどちらも CONFIG の finisherOnStun / finisherOnKill で切り替えられる。
     パージ済み（拳がない）の腕では発動せず通常の弱攻撃。その腕で倒した場合は
     従来どおり頭が破裂する（保険。銃腕など近接以外で倒す場合と同じ経路）。

   触手のフィニッシャー（薙ぎ払いの延長・こちらも専用入力はない）:
     触手腕の薙ぎ払いが「スタン中の敵」に当たると、頭に触手を刺して引っ張り、
     首から頭を引き抜く。発動条件は拳の掴みと同じ（finisherOnStun / finisherOnKill）。
     違うのは間合い。拳は敵を懐（finisherPullDist 2.0m）まで引き寄せるが、
     触手は腕の長さ（tentFinPullDist 3.0m）のままで仕留めるので、残った死体が
     死体の爆発半径（corpseBurstRadius 2.5m）の外に落ちる。
     引き抜いた頭は床に転がる（ライジングで斬り落とした頭と同じ扱い）。

   腕の組み合わせ（片方で拘束 ＋ もう片方で殴る／撃つ）:
     触手で刺して拘束している敵には、もう片方の腕の攻撃が全部通る。
     振り回す・ぶつける・叩きつける・投げるだけが拘束の使い道ではない。
       銃   : gunTetherDamageMul 倍のダメージ（PINNED SHOT）。
              動けない的なので確定で当たる＝組み合わせたぶんの見返り
       拳   : 通常どおりのダメージ（PINNED HIT）。
              拘束半径＝刺した距離なので、至近で刺したときだけ届く
       触手 : 薙ぎ払いも通る（PINNED SWEEP）。両腕が触手なら
              「片手で掴んで片手で薙ぐ」が成立する
     拘束中はのけぞらせない（位置は updateTentacle が持っているので、
     ここで姿勢を奪うと拘束が壊れる）。代わりにスタンは溜まり続け、
     上限の手前で止まる。溜め切ってから静かに離すとその場で崩れるので
     （BREAK!）、そのまま掴みフィニッシャーへ繋がる。
     投げた場合は従来どおり着地で必ずスタンする。

   腕の耐久（HP）:
     腕それぞれに HP がある（armMaxHp）。近接をヒットさせるごとに減り、
     銃腕は1発撃つごとに減る。0 になった腕は肉片になって消え、その側は
     何もできなくなる（キックとライジングは腕を使わないので可能）。
     掴みフィニッシャーでは減らない。敵から奪った腕は必ずフル HP。
     → 定期的に敵の腕を奪う必要が出る。

   銃腕（GUN）:
     クリックで1発、長押しで gunInterval ごとに連射。パージはできない。
     弾は gunDamage / gunStun。倒しても掴みは出ず、頭が破裂して死体になる。
     最初は敵だけが持っている（ENEMY_SPOTS 参照）。奪えば自分の腕になる。

   敵の死体の爆発:
     倒した敵の死体は首元が点滅し、corpseFuse 秒（ワールド時間）で爆発して消える。
     爆発は半径内のプレイヤーと敵にダメージ（敵は倒れると死体になるので連鎖する）。
     爆発前に乗っ取れば普通に使える（乗っ取り演出に入った時点で止まる）。乗っ取ると死体の腕がそのまま自分の腕になる
     （斬って奪った腕は欠けている）。最初から置いてある死体と自分が捨てた体は爆発しない。

   ライジング（RISING・Qを押している間だけ）:
     脊柱が伸びてワールドがスローになる。その場から動けない（移動はオミット）
     Qを離すとゴムのように縮んで人間モードへ戻る
     蜘蛛脚は普段は頭の中に格納されている。
     周囲 risingInteractRange 内のスタン中の敵の四肢と、死体の首元に□が出る。
     □にクロスヘアを合わせても脊柱が伸びているだけで、蜘蛛脚は頭の中のまま。
     クリックで斬る瞬間だけ脚が飛び出して薙ぎ、振り終わると格納される
     斬撃は敵のHPを削らない（腕を奪うだけ。倒すのは人間モードの仕事）
     左クリック       蜘蛛脚で斬撃。斬った腕は自分の左手に付く
     右クリック       蜘蛛脚で斬撃。斬った腕は自分の右手に付く
                      （対面だと敵の左右が鏡になって読めないので、
                        押したボタンの側に付くことで左右を確定させる）
     F                □が死体なら首が飛んで乗っ取る。それ以外は腕と交換
     Space            体を切り離して頭モードへ（切り離した体は死体として残る）

   頭モード（HEAD・三人称）:
     丸い頭に蜘蛛脚、脊柱がしっぽのように付いている状態
     WASD             移動
     Space            ジャンプ
     F                5m以内の死体に乗り移る
     攻撃はできない

   死体（CORPSE）:
     首から上がない、地面に座った体。頭モード（近接）と
     ライジング（□にクロスヘア）のどちらからもFで乗っ取れる
     乗っ取ると脊柱を首元に突き刺して装着し、その体で人間モードになる
     ライジング中は死体の腕にも□が出て、スタン中の敵と同じように斬って奪える
     （こちらも左クリックなら左手、右クリックなら右手に付く）

   ダメージの受け方:
     人間モードで敵から受けるダメージは体（中央）だけに入る。
     腕のHPが減るのは自分で攻撃したとき（近接のヒット・射撃・触手）だけ。
     ガード中（Ctrl）は受けるダメージを guardDamageMul 倍にして、残っている腕
     それぞれに入れる（両腕あれば両方に同じ量）。体には入らない。
     両腕とも無ければガードにならず、普通に体へ入る。
     ガード中は攻撃・キックは出せない。ドッジは出せる（構えを解いて避ける）。

   体スキル（BODY SKILL・Z）:
     体ごとに1回だけ使えるスキルが付いている。使うとその体ではもう使えない（使い捨て）。
     使えるときは中央の体アイコンの縁が光り、アイコンの絵がスキルの種類を表す。
     死体を乗っ取るとその体のスキルが手に入る（本番は死体ごとに設定。モックはランダム）。
     自分が捨てた体は使用済みかどうかも含めてそのまま残る。
       阿修羅（ASURA） 3時・2時／9時・10時の位置に腕が2本ずつ生えて6本腕になる。
                       左右のクリックで攻撃すると、同じ側の追加の腕も少し遅れて同じ攻撃を出す。
                       追加の腕は生えたときの腕の種類をコピーし、以後ライジングで腕を
                       交換しても変わらない。耐久は腕ごとに減るが、HUDには出さない。
       回復（HEAL）    緑のエフェクトとともに体のHPを全回復する。

   部屋（ROOMS）:
     敵は自分の部屋にプレイヤーがいる間だけ追う。出れば追うのをやめて
     初期位置へ戻る。検証用に「1体の部屋」と「3体の部屋」がある

   デモステージ（DEMO・Vで入る）:
     ハブから離れた場所にある一本道の廊下。前へ進むと部屋ごとに敵が湧き、
     全滅させるまで奥の門（赤い壁）が開かない。5ウェーブで突き当り。
     デモ中の敵は部屋判定を持たず、常にプレイヤーを追う。
     Gでリセットするとデモの敵は消えてハブへ戻る
   ========================================================= */

/* ---------- 調整用CONFIG ---------- */
const CONFIG = {
  /* --- ライジング（Q長押しで脊柱を伸ばす）--- */
  risingInteractRange: 7.0,    // スタン中の敵・死体に□が出る半径(m)
                               // ※ライジング中は移動不可（実装負荷軽減のためオミット）
  spineLength: 0.75,           // 伸びる脊柱の長さ(m)
  spineSegments: 9,
  severEnterTime: 0.28,        // 伸びきるまで(s)
  severExitTime: 0.18,         // Qを離してから戻るまで(s)
  risingSnapBack: 0.32,        // 戻るときに縮みすぎる量（ゴム感）
  slowMotionScale: 0.2,        // ライジング中のワールド速度（カメラ操作は影響を受けない）
  risingCutDamage: 0,          // 腕を斬ったときに敵へ入るダメージ。
                               // 0＝腕が減るだけでHPは減らない（斬撃で倒せない）
  targetRadiusPx: 120,         // □を選択するクロスヘアからの画面距離(px)
                               // ※高さ720px基準。実際の判定は画面高さに比例させるので
                               // 解像度が変わっても見た目の幅は同じになる
  fovNormal: 75,
  // 首越しカメラ。伸びた首を肩の代わりにした肩越し構図：
  // 頭の右後ろ・頭より少し低い位置から前を見て、首と頭が画面左に入る
  neckCamBack: 0.72,           // 頭からの後ろ(m)
  neckCamSide: 0.56,           // 頭からの右(m)。頭を画面左へ寄せて中央を空ける
  neckCamHeight: -0.16,        // 頭からの高さ(m)。負＝頭より下から首越しに見る
  fovNeck: 84,
  // 入りの演出（実時間）。何度も使う操作なので短く・止まらずに
  neckCamSlideTime: 0.30,      // 一人称→首越しの位置へ寄るまで(s)
  neckCamClimbStart: 0.06,     // 高さだけ頭から遅れて追う：追い始め(s)
  neckCamClimbEnd: 0.50,       //   追いつく(s)。この間、頭が先に上へ抜けて首を見上げる
  neckCamBulge: 0.35,          // 寄る途中だけ後ろへ膨らむ量(m)。首を画に入れるため

  /* --- 頭モード（ライジング中にSpaceで体を切り離す）--- */
  headBleedDuration: 10.0,     // 頭モードは出血で死ぬ。HP100を使い切るまで(s)
  headBleedTick: 0.25,         // 減る間隔(s)。1回 = playerMaxHp/(duration/tick) = 2.5
                               // ※時間制限ではなくHPなので、敵に殴られたぶんだけ早く死ぬ
  bloodDecalStepFar: 0.55,     // 血痕を落とす移動距離(m)。HP満タン時
  bloodDecalStepNear: 0.20,    // 同・瀕死時。減るほど間隔が詰まって出血が濃くなる
  bloodDecalLife: 16.0,        // 血痕が消えるまで(s)
  bloodDecalMax: 150,          // 同時に置ける血痕の数（超えた古い順に消える）
  headMoveSpeed: 6.6,          // 死体が爆発する前に届くようキビキビ動かす（旧4.4）
  headJumpSpeed: 16.5,
  headGravity: 52,             // 上昇中の重力。速度に合わせて締める
  headFallGravity: 78,         // 下降中はさらに強くしてふわつかせない
  headRestHeight: 1.06,        // 蜘蛛脚で立っているときの頭の高さ(m)
                               // ※これを下げると脚先が床に埋まる。
                               //   待機だけでなく、歩行アニメで脚が伸びたときで合わせてある
  headDetachPop: 3.6,          // 切り離した瞬間の跳ね（上）
  headDetachBack: 0.8,         // 切り離した瞬間に頭が後ろへ退く距離(m)
                               // ※0だと頭が自分の死体の中に埋まり、
                               //   後方カメラも死体で埋まる
  headCamDistance: 2.6,        // 三人称カメラ
  headCamHeight: 1.30,
  headTailLength: 1.5,         // しっぽになった脊柱の伸び倍率

  /* --- 死体 / 乗っ取り --- */
  corpseInteractDistance: 5.0, // 頭モードで[F]が出る距離(m)
  possessDuration: 1.15,       // 乗っ取り演出の長さ(s)
  possessStabAt: 0.55,         // 脊柱が首元に突き刺さるタイミング(0-1)

  /* --- 蜘蛛脚（ライジング中に首元から左右3本ずつ生える）--- */
  spiderLegsPerSide: 3,
  spiderLegSeg: [0.72, 0.78, 0.58],  // 根本→先端の各節の長さ(m)。合計2.08m
  spiderLegThick: 0.075,
  spiderLegFan: 0.46,          // 3本の前後への開き(rad)
  spiderLegTilt: 0.95,         // 第1関節の外向き傾き(rad)
  spiderLegBend: 1.95,         // 第2関節の折れ(rad)
  spiderLegClaw: 0.72,         // 第3関節の折れ(rad)
  spiderIdleSway: 0.10,        // 待機時の揺れ幅(rad)
  // 斬撃中は脚を伸ばして胸の高さで薙ぐ（値は待機ポーズからの差分）
  spiderSlashTilt: 0.42,
  spiderSlashBend: -1.60,
  spiderSlashClaw: -0.55,
  spiderSlashWindup: 0.30,     // 振りかぶりに使う割合(0-1)
  spiderSlashBack: 0.50,        // 後ろへ振りかぶる角度(rad)
  spiderSlashSweep: 3.0,        // 振りかぶり位置から前へ薙ぐ総量(rad)
                                // 約中間で脚先が真正面を通る
  spiderSwingTime: 0.34,       // 切断時の見た目だけの振り(s)

  /* --- 蜘蛛脚の展開 --- */
  spiderRiseScale: 0.76,       // ライジング中だけ脚を小さくする（頭モードは1.0のまま）
                               // ※頭モードの脚は体を支えている＝縮めると床に埋まる
  // 脚が視界（カメラと□の間）を塞がないようにするフェード。
  // 脚の付け根は頭＝カメラのすぐ手前にあるので、これが無いと必ず何本か画面を横切る。
  // 「カメラに近い」かつ「画面中央（＝狙っている□の方向）にある」節だけを消す。
  //   → 画面の端で構図を作っている脚はそのまま残り、邪魔な分だけ消える
  legFadeNear: 0.62,           // これより近ければ消える側(m)
  legFadeFar: 2.00,            // これより遠ければ距離だけで不透明(m)
  legFadeCenterPx: 300,        // 画面中心からこの距離より内側は消える(px・高さ720基準)
  legFadeEdgePx: 560,          // これより外側は消さない(px・同上)
  legSlashDeploySpeed: 40,     // 斬撃で脚が飛び出す速さ(1/s)。約0.05秒で伸びきる
  legDeploySpeed: 9,           // 格納の速さ(1/s)。斬り終わってから約0.3秒で頭の中へ戻る
                               // ※脚の向きは常に体の向き基準で真下へ垂れる。
                               //   ターゲット方向への軸補正は入れていない

  /* --- 敵を倒したときの頭の破裂 --- */
  headBurstPieces: 12,
  headBurstSpeed: 5.0,
  headBurstGravity: 26,

  /* --- 切断された部位 --- */
  partDriftSpeed: 0.9,         // 体から離れる速度(m/s・ワールド時間)
  partDriftUp: 0.55,           // 上方向成分
  partDriftDamp: 0.65,         // 減衰(毎秒)
  partFloatDuration: 4,        // モード終了後、落下するまでの秒数
  partDropGravity: 30,

  /* --- 斬った腕の自動装着（グラフト）---
     浮かせて拾わせると、複数敵を切ったときに腕と□が滞空して取りづらくなる。
     斬った瞬間に体へ吸い寄せて交換する。                                 */
  armGraftTime: 0.42,          // 斬ってから体につくまで(s)
  armGraftWindup: 0.30,        // うち「タメ」に使う割合(0-1)
  armGraftBack: 0.65,          // タメで一度引く距離(m)
  armGraftSpin: 26,            // 飛んでいる間の回転(rad/s)
  armGraftSwell: 0.35,         // 飛んでいる間の膚らみ
  armGraftHitstop: 0.13,
  armGraftShake: 0.38,
  armEjectSpeed: 5.0,          // 外れた古い腕が弾け飛ぶ速さ
  armEjectGibs: 9,             // 床の腕が肉片になるときの破片数
  armEjectGibSpeed: 2.6,       // その肉片の飛び散る速さ
  armDropLife: 3.0,            // 捨てた腕が床に残る秒数（ワールド時間）。過ぎると肉片になる
  armDropBlinkLead: 1.2,       // 残りこの秒数から点滅して「もう消える」と知らせる
  armEjectForward: 0.9,        // 射出に混ぜる前方成分。真横だと視界外へ飛んで拾えない
  armGibLife: 3.0,             // 腕から出た肉片が消えるまで(s)。交換のたびに床に溜めない

  /* --- 頭切断（ライジングでのフィニッシュ）--- */
  headCutHitstop: 0.45,
  headCutShake: 0.9,

  /* --- 掴みフィニッシャー（パンチの延長・自動発動）---
     発動条件は resolvePunch() 参照。プレイヤーは演出中に動けず無敵。
     ワールドは掴んでいる間だけスローになり、拳の動きだけ等速で見せる。      */
  finisherOnStun: true,        // スタン中の敵を殴ったら掴む
  finisherOnKill: false,       // そのパンチでHPが0になるときも掴む。
                               // false＝倒すだけでは掴まず、従来の頭破裂で死ぬ
                               // （死体は同じようにできるので乗っ取りには影響なし）
  finisherReach: 0.16,         // 拳が頭に届くまで(s)
  finisherHold: 0.42,          // 掴んで引き寄せている時間(s)
  finisherRecover: 0.38,       // 潰したあとの硬直(s)
  finisherSlowScale: 0.28,     // 掴んでいる間のワールド速度
  finisherPullDist: 2.0,       // 掴んでいる間の敵（原点）との距離(m)
                               // ※敵は前のめりなので頭はこの約1.1m手前、目の高さ付近に来る。
                               //   これより近い敵は腕の長さぶん押し戻す
  finisherPullSpeed: 7.0,      // 引き寄せ速度(m/s・実時間)
  finisherLean: 0.45,          // 掴まれた敵の前のめり(rad)。スタン姿勢0.35からの続き
  finisherHitstop: 0.36,
  finisherShake: 1.0,
  finisherBurstSpeedMul: 1.8,  // 破裂の勢い（通常の頭破裂に対する倍率）

  /* --- 腕の耐久 --- */
  armMaxHp: 100,
  armHitCost: 20,              // 近接をヒットさせるごとに減る量
  armLostPieces: 7,            // 腕が肉片になるときの破片数

  /* --- 銃腕 --- */
  gunDamage: 10,
  gunStun: 6,                  // ダメージ(10)より低くして、銃は「HP軸」に寄せる
  gunInterval: 0.25,           // 連射間隔(s)
  gunShotCost: 5,              // 1発ごとに腕HPが減る量
  gunBulletSpeed: 44,
  gunRange: 26,
  gunRecoil: 0.16,             // 一人称の腕の跳ね上がり(m)
  // 当たり判定。敵の体を「足元+0.95〜+1.95」の縦線分として見て、
  // 弾が1フレームで通った線分との最短距離で当たりを取る。
  // 高さを固定した1点で見ていると、触手で持ち上げた敵や投げた敵に当たらない
  gunHitRadius: 0.85,          // 当たり半径(m)。縦線分で見るぶん、
                               // 以前の「胸の1点・半径0.9」より当たる体積は広い
  gunHitRadiusHeld: 1.05,      // 拘束中／投げられて飛んでいる敵の当たり半径(m)。
                               // 暴れて速く動くぶん、こちらは甘く見る
  gunTetherDamageMul: 1.6,     // 触手で拘束している敵を撃ったときのダメージ倍率。
                               // 動けない的を撃っている＝腕を組み合わせた見返り
  gunTetherHitstop: 0.04,      // 同・ヒットストップ（通常の射撃は0.02）
  purgeHitRadius: 0.95,        // パージした手首の当たり半径(m)

  /* --- 触手腕（TENTACLE）---
     手首から先が3本の触手になっている腕。普段は根元が腕の中に引っ込んでいて、
     外に出ている先端だけがクネクネ動く。
       短押し : 左右2コンボの薙ぎ払い（パンチより射程が長く・速く・弱い＝牽制）
       長押し : クロスヘア方向へ触手を伸ばし、当たった敵に刺して拘束。
                刺したまま視点を振ると敵が振り回され、勢いが乗った状態で
                離すとその方向へ投げ飛ばせる。                               */
  tentSegs: 11,                // 触手1本の節の数（一人称の手元）
  tentBeamSegs: 48,            // 伸ばした触手（ワールド側）の節の数。
                               // 最大10mまで伸びるので粒が切れない数が要る
  tentLength: 0.80,            // 触手1本の全長(m)。手首から出ていない分は腕の中
  tentIdleOut: 0.44,           // 待機時に手首から出ている長さ(m)。
                               // 「3本あること」が一目で分かる長さが要るので、
                               // 引っ込ませすぎない（残り0.36mが腕の中）
  tentSpread: 0.062,           // 3本の根元の広がり(m)
  tentIdleWave: 0.10,          // 待機のうねり幅(m)。先端ほど大きく振れる
  tentIdleSpeed: 2.3,          // 待機のうねりの速さ。ランダムではなく位相差で生物感を出す
  tentIdleBreath: 0.7,         // 呼吸（ゆっくり伸び縮みする）の速さ(rad/s)
  tentIdleAccent: 1.6,         // たまに1本だけ大きくうねる量（0で無効）
  // 節の遅延追従。根元は理想位置へすぐ、先端ほど遅れて寄るので
  // 根元から先端へ波が伝わる＝鞭に見える
  tentFollowRoot: 60,          // 根元の追従の速さ(1/s)。ほぼ即時
  tentFollowTip: 11,           // 先端の追従の速さ(1/s)。小さいほど遅れて鞭感が出る

  /* 薙ぎ払い（短押し・左右2コンボ）
     判定は「前方扇の即時判定」ではなく、アニメと同じ角度を毎フレーム進めて
     刃の通った帯だけを薙ぐ（tentSweepPose / updateTentacleSweep）。
     途中で入ってきた敵も巻き込めるし、1段目と2段目で判定の左右が分かれる  */
  tentSweepStartup: 0.09,      // 振りかぶり。ここは判定なし
  tentSweepActive: 0.22,       // 薙ぎ抜き＝判定が出ている時間。尺を使って「薙いだ」と読ませる
  tentSweepCancel: 0.24,       // キャンセル可能点（発生からの時間）。
                               // アニメ尺とは別に持たせて、長い振りでもテンポを保つ
  tentSweepRecover: 0.26,      // 硬直
  tentSweepRange: 4.2,         // 射程。パンチ(2.4)より長い中距離
  tentSweepSpan: 78,           // 振り抜きで刃が向く角度(deg)。
                               // 振りかぶり側(-35度)から この角度まで薙ぎ払う
  tentSweepBand: 16,           // 刃の太さ(deg)。この幅ぶん左右に余裕を持たせる。
                               // 「横に広い」は帯の太さではなく薙いだ総角度(約100度)で出す
  tentSweepHitWindup: 0.20,    // 判定が振りかぶり側へ戻る量(tentSweepSpan比)。
                               // 見た目(0.45)より浅くして、1段目と2段目で
                               // 当たる側がはっきり分かれるようにしてある
  tentSweepDamage: 9,          // パンチ(20)の半分以下＝削り役
  tentSweepStun: 14,
  tentSweepHitCost: 8,         // ヒット1体ごとに減る腕HP
  tentSweepComboReset: 1.1,    // これだけ振らないと1段目に戻る(s)
  tentSweepBuffer: 0.38,       // 薙ぎ払いの先行入力を覚えておく長さ(s)。
                               // 振りが長いぶんキャンセル可能点(0.33s)も遅いので、
                               // 拳の inputBufferTime(0.25s)のままだと2段目が食われる
  tentSweepArc: 1.2,           // 見た目の薙ぎ幅(m)。振りかぶり→反対側へ抜ける
  tentSweepOut: 1.1,           // 薙ぎのあいだ伸びる長さ(m)

  /* 刺突（長押し）*/
  tentHoldTime: 0.17,          // これだけ押したら伸ばしはじめる(s)。パージ(0.22)より速い
  tentMaxRange: 10.0,          // 最大射程(m)
  tentExtendSpeed: 34,         // 伸びる速さ(m/s)。10mまで約0.3s
  tentRetractSpeed: 26,        // 戻る速さ(m/s)
  tentHitRadius: 0.95,         // 触手の軸から敵の体までこの距離なら刺さる(m)。
                               // 体は足元〜頭の縦カプセルとして見る
  tentStabDamage: 6,
  tentStabStun: 10,
  tentStabCost: 10,            // 刺した瞬間に減る腕HP
  tentStabHitstop: 0.16,       // 刺さった瞬間の停止(s)。通常ヒット(0.07)の倍以上
  tentStabShake: 0.5,
  tentStabYank: 4.0,           // 刺さった瞬間だけ手前へ食い込ませる速度(m/s)。
                               // 引き寄せ続けるのではなく、1回だけ「ぐっ」と来る
  tentStabYankDist: 0.35,      // 同・拘束半径をこのぶん詰める(m)
  tentFovPunch: 9,             // 刺さった瞬間の寄り(deg)
  tentFovTime: 0.38,           // 寄りが戻るまで(s)

  /* 拘束中の疑似物理（実時間で動かす。本物の物理は入れていない）
     刺した距離をそのまま拘束半径にする＝手元へ引き寄せない。
     刺さった位置で、ロープのように振り回す                                */
  tentHoldMinDist: 1.2,        // 拘束半径の下限(m)。至近で刺しても顔面に来ない
  tentPullSpring: 58,          // 目標位置へ引っ張るバネ定数
  tentPullDamp: 9.0,           // 減衰。小さいほど遅れて付いてくる＝振り回し感が出る
  tentSwingGain: 1.05,         // 視点の振り（目標位置の移動速度）を敵の速度に足す倍率
  tentSwingBoost: 18,          // この速さ(m/s)まで振ると上乗せが倍になる（大振りのご褒美）
  tentMaxSpeed: 34,            // 拘束中の敵の速度上限(m/s)。
                               // 遠くで刺すほど同じ視点の振りでも速度が出る（てこの原理）
  tentHoldMaxTime: 4.0,        // 拘束の上限(s)。腕が持たないので自動で外れる
  tentHoldDrain: 9,            // 拘束中に減る腕HP(毎秒)

  /* 振り回した敵をぶつける */
  tentSmashMin: 8.0,           // この速度以上でぶつけるとダメージになる(m/s)
  tentSmashRadius: 1.35,       // 敵同士がぶつかったとみなす距離(m)
  tentSmashDamage: 1.5,        // ぶつけられた側のダメージ ＝ 速度 × これ
  tentSmashDamageMax: 34,
  tentSmashSelf: 0.45,         // ぶつけた（刺さっている）側が受ける割合
  tentSmashKnock: 0.55,        // ぶつけられた敵が貰う速度の割合
  tentSmashLoss: 0.45,         // ぶつけた側が失う速度の割合
  tentSmashCd: 0.5,            // 同じ相手に連続で当たらない間隔(s)

  /* 解除時の投げ */
  tentThrowMin: 4.0,           // この速度未満で離すと、ただ外れる(m/s)
  tentThrowMul: 1.0,           // 離したときに残す速度の倍率
  tentThrowUp: 3.6,            // 投げに混ぜる上方向(m/s)。勢いに応じて 0.5〜1.5倍される。
                               // 放物線を描かせないと「転がった」ようにしか見えない
  tentThrowGravity: 18,        // 投げ中だけの重力。本来の重力(30)より軽くして滞空を伸ばす
  tentThrowDrag: 0.8,          // 横方向の減速(毎秒)。飛びすぎを抑える
  tentThrowDamage: 2.1,        // 着地ダメージ ＝ そのときの速度 × これ。
                               // 吹き飛びに上限を付けたぶん着地速度が落ちるので、
                               // 大振りの見返り（約35）が前と変わらないよう係数で戻してある
  tentThrowDamageMax: 36,
  tentThrowWallDamage: 20,     // 壁に叩きつけたときの上限ダメージ

  /* 拘束したまま地面へ叩きつける
     上に振ってから振り下ろすと、離さないまま投げの着地(SLAM)と同じ手応えが出る。
     「上に振る → 振り下ろす」という操作がそのまま技になる。
     落下速度だけを見るので、ただ降ろしただけでは鳴らない                  */
  tentGroundMin: 7.0,          // この落下速度以上で地面に当てたらダメージ(m/s)
  tentGroundDamage: 1.1,       // ダメージ ＝ 落下速度 × これ。
                               // 投げの着地(1.7)より低い。離さないまま何度も出せるので、
                               // 1回の重さは投げに譲って「繋がる」側に寄せてある
  tentGroundDamageMax: 26,
  tentGroundStun: 26,          // 1回ごとに入るスタン値。
                               // 拘束中はスタンで状態を奪えないので上限の手前で止める
  tentGroundBounce: 0.28,      // 叩きつけたあとに跳ね返る割合。横の勢いは殺さない

  /* フィニッシャー（薙ぎ払いの延長・自動発動）
     発動条件は拳の掴みと同じ（finisherOnStun / finisherOnKill）。
     3本の触手を頭に刺して引っ張り、首から頭を引き抜く。
     拳が「引き寄せて潰す」なら、こちらは「腕の長さのまま引き抜く」       */
  tentFinStab: 0.18,           // 触手が頭まで伸びて刺さるまで(s)
  tentFinPull: 0.46,           // 刺したまま引っ張っている時間(s)。首が伸びる
  tentFinRip: 0.30,            // 引き抜いたあとの硬直(s)
  tentFinSlowScale: 0.26,      // 引っ張っている間のワールド速度
  tentFinPullDist: 3.0,        // 引っ張っている間の敵（原点）との距離(m)。
                               // 拳(2.0)より遠い＝懐に入れずに仕留める。
                               // 死体が爆発半径(2.5m)の外に残るのが触手側の取り分
  tentFinPullSpeed: 6.0,       // その距離へ寄せる／押し戻す速さ(m/s・実時間)
  tentFinNeck: 0.62,           // 引っ張られて首が伸びる量(m)
  tentFinLean: 0.52,           // 引っ張られた敵の前のめり(rad)
  tentFinHeadSpeed: 7.5,       // 引き抜いた頭が自分の方へ飛ぶ速さの上限(m/s)。
                               // 実際の速さは「飛ぶ距離 ÷ tentFinHeadHang」なので、
                               // どの間合いで決めても目の前に落ちてくる
  tentFinHeadHang: 0.45,       // その頭が落ちはじめるまで(s)
  tentFinHitstop: 0.34,
  tentFinShake: 0.95,
  tentFinGibs: 9,              // 首から飛ぶ肉片の数
  tentFinGibSpeed: 4.2,

  /* --- 吹き飛びの上限（投げ・ぶつけ・叩きつけ共通）---
     速度を切り落とすのではなく、ソフトキャップから上を圧縮して上限へ漸近させる。
     弱い〜中くらいの投げは素のままなので、振った量が結果に出る気持ちよさは残り、
     大振りだけが「それ以上は伸びない」。画面外へ消えるのを止めるのが目的なので、
     水平（飛距離）と上方向（打ち上げ）を別々に抑えている                   */
  knockSoftSpeed: 15.0,        // 水平はここまで素通し(m/s)
  knockMaxSpeed: 24.0,         // 水平の上限。どれだけ振ってもこれは超えない(m/s)
  knockSoftUp: 5.0,            // 上方向のソフトキャップ(m/s)
  knockMaxUp: 9.0,             // 同・上限。これ以上打ち上げると画面の外へ出る
  knockMaxDist: 15.0,          // プレイヤーからこの距離を越えたら空中で減速しはじめる(m)
  knockFarDrag: 3.0,           // 越えている間に足す減速(毎秒)。霧の中まで転がるのを止める

  /* --- 倒した敵の死体の爆発 --- */
  corpseFuse: 3.0,             // 爆発までの秒数（ワールド時間。ライジング中は伸びる）
  corpseBlinkLead: 2.4,        // 残りこの秒数から体が点滅しはじめる（それまでは静かに横たわる）
  corpseBurstPieces: 16,
  corpseBurstSpeed: 6.5,
  corpseBurstRadius: 2.5,      // 爆発ダメージの半径(m)。フィニッシャーで引き寄せた死体は必ず範囲内
  corpseBurstDamagePlayer: 12, // 敵の一撃と同じ
  corpseBurstDamageEnemy: 30,
  corpseBurstStunEnemy: 20,

  /* --- プレイヤー --- */
  moveSpeed: 4,
  mouseSensitivity: 0.0022,
  playerMaxHp: 100,

  /* --- 近接攻撃 --- */
  punchStartup: 0.08,
  punchRecover: 0.28,
  punchRange: 2.4,
  punchAngle: 70,
  purgeHoldTime: 0.22,
  purgeRange: 12,
  purgeSpeed: 26,
  attackDamage: 20,
  attackStun: 40,
  purgeGibs: 6,                // パージした手が消えるときの肉片数
  purgedArmDamage: 8,
  purgedArmStun: 15,

  /* --- アクションキャンセル ---
     punchActive / kickActive は「発生してから振り抜くまで」＝
     アニメーションで拳・足が伸びきるまでの時間。
     この瞬間からあとの硬直だけが他のアクションでキャンセルできる。
     一人称の見た目もこの値でピークを作っているので、ここを動かすと
     アニメーションの振り抜きとキャンセル可能点が一緒に動く。          */
  punchActive: 0.10,           // パンチ：発生0.08 → 振り抜き0.18 → 終わり0.36
  kickActive: 0.14,            // キック：発生0.12 → 振り抜き0.26 → 終わり0.47
  inputBufferTime: 0.25,       // パンチの先行入力を覚えておく長さ(s)
                               // ※振り抜きまでの最長待ち(0.18s)より少しだけ長い。
                               //   これ以上伸ばすと、押していないパンチが
                               //   ドッジやフィニッシャーのあとに漏れて出る

  /* --- ガード（Ctrl長押し）--- */
  guardDamageMul: 0.5,         // ガード中に受けるダメージの倍率。これが残っている腕それぞれに入る
  guardRaiseTime: 0.10,        // 構えるまで(s)。押した瞬間からガードは効く（見た目だけの補間）
  guardMoveMul: 0.5,           // ガード中の移動速度の倍率

  /* --- キック / ドッジ --- */
  // リソースの数（青い丸）は体ごとに違う。乗っ取った体で resourceMin〜resourceMax の
  // ランダム（本番は死体ごとに設定する想定）。最初の体だけ resourceStart で固定
  resourceStart: 3,
  resourceMin: 2,
  resourceMax: 6,
  resourceRegenTime: 3.0,
  kickStartup: 0.12,
  kickRecover: 0.35,
  kickRange: 2.8,
  kickAngle: 75,
  kickStun: 10,                // 素キック。スタンの主な供給源はパンチ（腕コスト）とジャストにする
  kickInterruptStun: 15,
  kickJustStun: 25,
  dodgeDistance: 4.0,
  dodgeDuration: 0.26,
  dodgeRecover: 0.18,
  justDodgeSlowScale: 0.35,
  justDodgeSlowTime: 0.5,

  /* --- 敵 --- */
  enemyMaxHp: 100,
  enemyStunThreshold: 100,
  enemyStunDecay: 4.8,
  enemyStunDuration: 6.0,
  // スタンした敵に重なっている敵を押しのける。
  // 重なったままだと、ライジングの□が画面上で団子になって
  // 狙った腕を選べなくなる（□は遮蔽を見ないので、奥の腕も同じ場所に出る）
  stunShoveRadius: 2.2,        // この距離まで離す(m)。肩幅1.36mの倍近く取れば□は分かれる
  stunShoveMax: 1.8,           // 1回の押しのけで動かす上限(m)。完全に重なっていても飛びすぎない
  stunShoveEase: 0.10,         // 押しのけの時定数(s)。小さいほどキビキビ弾かれる
  enemyMoveSpeed: 1.9,
  enemyAttackRange: 2.2,
  enemyWindup: 0.75,
  enemyJustWindow: 0.17,
  enemyActive: 0.10,
  enemyRecovery: 0.5,
  enemyAttackCooldown: 1.6,
  enemyHitReactTime: 0.35,
  enemyDamageToPlayer: 12,
  enemyDodgeChance: 0.25,
  enemyDodgeForceHits: 3,
  enemyDodgeDistance: 4.0,
  enemyDodgeTime: 0.45,

  /* --- ボス：ダクトの男 ---
     通常の敵と同じAIをベースに、キックによるキャンセルとライジングでの
     腕奪取を足したもの。3部屋を逃げながら3ラウンド戦う。            */
  bossHpMul: 3,                  // 通常の敵の何倍のHPか
  bossKickChance: 0.38,          // プレイヤーがパンチを出したときキックで潰してくる確率
  bossKickCooldown: 2.6,         // 次にキックで潰してくるまでの最短(s)
  bossKickStartup: 0.30,         // 足を上げてから当たるまで。
                                 // パンチのキャンセル可能点(0.18s＋ヒットストップ)より
                                 // 十分あとに来るようにしてある＝見てからドッジで避けられる
  bossKickDamage: 8,
  bossKickStagger: 0.42,         // 潰されたあと何も出せない時間(s)
  bossRiseCooldown: 7.5,         // ライジング（腕狙い）の間隔(s)
  bossRiseWindup: 1.15,          // 腕を狙っている時間。この間にドッジ／キック／離脱する
  bossRiseRange: 3.6,            // この距離から出ると外れる
  bossRiseRecover: 0.75,
  bossStolenArmDamage: 4,        // 奪った腕1本ごとに一撃が増える
  bossHideTime: 10.0,            // かくれんぼの制限時間(s)
  bossPreemptiveDamage: 0.40,    // 先制攻撃で削れる割合（最大HP比）
  bossJumpscareDelay: 1.35,      // カウント0からジャンプスケアまでの「間」(s)
  bossJumpscareTurn: 0.20,       // カメラが後ろを向くまで(s)
  bossJumpscareHold: 1.05,       // 顔アップの長さ(s)
  bossFleeRise: 0.55,            // 倒したあと首が伸びるまで(s)
  bossFleeTravel: 1.6,           // 頭がダクトへ飛び込むまで(s)
  bossRoundCorpses: 14,          // 第1ラウンドの部屋に置く死体
  bossHideCorpses: 22,           // かくれんぼ部屋に置く死体
  bossBurstKeep: 3,              // ラウンド開始時に残す死体（腕と体の補給を絞る）
  bossBurstInterval: 0.055,      // 死体が連鎖爆散する間隔(s)

  /* --- 体スキル（Zで発動・体ごとに1回）--- */
  asuraGrowTime: 0.55,         // 追加の腕が生えきるまで(s)
  asuraGrowStagger: 0.10,      // 腕ごとに生えはじめをずらす(s)。4本が順ににょきにょき出る
  asuraFollowDelay: 0.07,      // 本体の腕が攻撃してから追加の腕が続くまでの間隔(s)。
                               // 3時(9時)がこの値、2時(10時)がこの倍で出る
  asuraAimDist: 2.2,           // 追加の腕の手先が向く点（カメラの前方この距離の画面中央）(m)。
                               // 近いほど内向きに寝て、画面の真ん中を塞ぐ
  asuraArmScale: 0.8,          // 追加の腕の太さと長さ（本体の腕に対する倍率）。視界を塞ぎすぎないように
  asuraDamageMul: 1.0,         // 追加の腕の攻撃のダメージ／スタン倍率（本体の腕の何倍か）
  asuraHitstop: 0.035,         // 追加の腕のヒットストップ。本体(0.07)の半分＝連打のテンポを殺さない
  healFxTime: 1.3,             // 回復エフェクトの長さ(s)

  /* --- 演出 --- */
  hitstopNormal: 0.07,
  hitstopTrade: 0.13,
  hitstopInterrupt: 0.17,
  hitstopJustKick: 0.37,
  shakeJustKick: 0.5,
  shakeInterrupt: 0.22,
  shakeNormal: 0.08,
};

/* ---------- プレイヤー状態 ---------- */
const S = {
  HUMAN: 'HUMAN',
  RISE_IN: 'RISE_IN',     // 脊柱が伸びる遷移中（Q押下中）
  RISING: 'RISING',       // ライジング本体（Q押下中）
  RISE_OUT: 'RISE_OUT',   // Qを離して脊柱が縮む遷移中
  HEAD: 'HEAD',           // 頭モード（体を切り離した状態）
  POSSESS: 'POSSESS',     // 死体に乗り移る演出中
};
let state = S.HUMAN;

/* ---------- 敵状態 ---------- */
const E = {
  IDLE: 'IDLE', MOVE: 'MOVE', WINDUP: 'WINDUP', ACTIVE: 'ACTIVE',
  RECOVERY: 'RECOVERY', HIT: 'HIT', DODGE: 'DODGE', STUNNED: 'STUNNED',
  GRABBED: 'GRABBED',   // 掴みフィニッシャーで頭を掴まれている（何もできない）
  TETHER: 'TETHER',     // 触手で刺されて拘束されている（位置は updateTentacle が持つ）
  THROWN: 'THROWN',     // 触手の解除で投げ飛ばされて飛んでいる
  DEAD: 'DEAD',
  // --- ダクトの男だけが使う状態 ---
  BOSS_KICK: 'BOSS_KICK',   // プレイヤーの攻撃をキックで潰しに来ている
  BOSS_RISE: 'BOSS_RISE',   // ライジングでプレイヤーの腕を狙っている
  HIDDEN: 'HIDDEN',         // 死体のフリをして隠れている
  FLEE: 'FLEE',             // 倒されて頭モードでダクトへ逃げている
};

const EYE = 1.7;
const NECK_BASE = 1.52; // 体側の首の付け根

/* ---------- Three.js基本 ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c0e);
scene.fog = new THREE.Fog(0x0a0c0e, 16, 46);

const camera = new THREE.PerspectiveCamera(
  CONFIG.fovNormal, window.innerWidth / window.innerHeight, 0.05, 100);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
let worldTime = 0;

/* ---------- ライト・床 ---------- */
// 明るさはボス戦のかくれんぼで落とすので、基準値を覚えておく
const hemiLight = new THREE.HemisphereLight(0x9aa5b1, 0x14161a, 0.9);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(5, 10, 4);
scene.add(dirLight);
const LIGHT_BASE = { hemi: 0.9, dir: 0.7, fogNear: 16, fogFar: 46 };

// 床はボスアリーナ（z -49..-31）まで伸ばす
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 120),
  new THREE.MeshLambertMaterial({ color: 0x15181c }));
floor.rotation.x = -Math.PI / 2;
floor.position.z = -20;
scene.add(floor);
const grid = new THREE.GridHelper(120, 120, 0x2c3238, 0x1c2126);
grid.position.z = -20;
scene.add(grid);

/* ---------- 部屋 ----------
   矩形。敵は自分の部屋にプレイヤーがいる間だけ追う。
   壁は低いレールだけで、当たり判定はない（視界を遮らない）           */
const ROOMS = [
  { name: 'ROOM 1', x0: -17, x1: -5, z0: -12, z1: 0, color: 0x1b2230 },   // 1体
  { name: 'ROOM 2', x0: 5, x1: 19, z0: -13, z1: 1, color: 0x2a1c22 },     // 3体
];
function playerInRoom(r) {
  return playerPos.x >= r.x0 && playerPos.x <= r.x1 && playerPos.z >= r.z0 && playerPos.z <= r.z1;
}
function currentRoom() {
  // ARENA_ROOMS はボスモジュール側で定義。呼ばれるのは animate() なので参照できる
  return ROOMS.find(playerInRoom) || ARENA_ROOMS.find(playerInRoom) || null;
}
for (const r of ROOMS) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color: r.color }));
  tile.rotation.x = -Math.PI / 2;
  tile.position.set((r.x0 + r.x1) / 2, 0.01, (r.z0 + r.z1) / 2);
  scene.add(tile);
  const railMat = new THREE.MeshLambertMaterial({ color: 0x4a525c });
  const rails = [
    [w, 0.05, (r.x0 + r.x1) / 2, r.z0], [w, 0.05, (r.x0 + r.x1) / 2, r.z1],
    [0.05, d, r.x0, (r.z0 + r.z1) / 2], [0.05, d, r.x1, (r.z0 + r.z1) / 2],
  ];
  for (const [sx, sz, x, z] of rails) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.25, sz), railMat);
    m.position.set(x, 0.125, z);
    scene.add(m);
  }
}

/* ---------- 色 ---------- */
const COLOR_PLAYER_ARM = 0xe8e4da;
const COLOR_ENEMY_ARM = 0xb5493f;
const COLOR_GUN_ARM = 0x6b6f7a;      // 銃腕の本体
const COLOR_GUN_BARREL = 0x2a2c31;
const COLOR_FLESH = 0x8d3a33;
const COLOR_CORPSE_HOT = 0xff5a3c;   // 導火線が点滅するときの体の色
const COLOR_TENTACLE = 0x9c4a52;     // 触手腕の肉（やや紫寄りの赤）
const COLOR_TENTACLE_TIP = 0xc2707a; // 触手の先端。根元より明るくして「出ている部分」を立てる

/* ---------- 腕の種類と状態 ---------- */
const ARM = { FIST: 'fist', GUN: 'gun', TENTACLE: 'tentacle' };
// kind: 拳か銃か / hp: 耐久 / purged: 手首を撃った / swapped: 敵から奪った腕 /
// lost: 耐久0で消えた（または最初から無い）。lost の腕は何もできない
function makeArmState(kind, opts) {
  return Object.assign({ kind: kind || ARM.FIST, hp: CONFIG.armMaxHp,
                         purged: false, swapped: false, lost: false }, opts || {});
}
function cloneArmState(a) { return Object.assign({}, a); }

/* ---------- 体スキル ----------
   体ごとに1回だけ使えるスキル。kind: 種類 / used: 使用済み。
   死体（createCorpse）とプレイヤーの体が1つずつ持ち、乗っ取ると体ごと入れ替わる。
   本番では死体ごとに設定する想定。モックではランダムに割り当てる              */
const SKILL = { ASURA: 'asura', HEAL: 'heal' };
const SKILL_LIST = [SKILL.ASURA, SKILL.HEAL];
const SKILL_LABEL = { asura: 'ASURA', heal: 'HEAL' };
function makeBodySkill(kind) {
  return { kind: kind || SKILL_LIST[Math.floor(Math.random() * SKILL_LIST.length)], used: false };
}
// 体のリソース（ドッジ／キック）の数。体スキルと同じく体ごとに決まる
function randomBodyResource() {
  return CONFIG.resourceMin +
    Math.floor(Math.random() * (CONFIG.resourceMax - CONFIG.resourceMin + 1));
}

/* ---------- プレイヤー ---------- */
const playerPos = new THREE.Vector3(0, 0, 6);
let yaw = 0, pitch = 0;

const player = {
  hp: CONFIG.playerMaxHp,
  resource: CONFIG.resourceStart,
  resMax: CONFIG.resourceStart,       // 今の体のリソースの数（体ごとに違う）
  resourceCharge: 0,
  arms: { LEFT: makeArmState(ARM.FIST), RIGHT: makeArmState(ARM.FIST) },
  skill: makeBodySkill(),             // 今の体の体スキル
  gunRecoil: { LEFT: 0, RIGHT: 0 },   // 一人称の銃腕の反動(0-1)
  attack: null,
  recoverT: 0,
  dodgeT: 0,
  dodgeDir: new THREE.Vector3(),
  invuln: 0,
  stagger: 0,          // ボスのキックで潰されている時間。canCancelNow() が見る
  guard: false,        // ガード中（Ctrl長押し）。updateGuard() が毎フレーム決める
};

const playerGroup = new THREE.Group();
{
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.28, 1.05, 12),
    new THREE.MeshLambertMaterial({ color: 0x46505c }));
  torso.position.y = 1.05;
  playerGroup.add(torso);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2e343c }));
  legs.position.y = 0.28;
  playerGroup.add(legs);
}
function makePlayerArm(x) {
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.75, 0.13),
    new THREE.MeshLambertMaterial({ color: COLOR_PLAYER_ARM }));
  arm.position.set(x, 1.18, 0);
  playerGroup.add(arm);
  return arm;
}
const playerArmL = makePlayerArm(-0.45);
const playerArmR = makePlayerArm(0.45);
scene.add(playerGroup);

// 一人称の手
function makeFpHand(sign) {
  const g = new THREE.Group();
  const fore = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: COLOR_PLAYER_ARM }));
  fore.position.z = -0.25; g.add(fore);
  const fist = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.17, 0.17),
    new THREE.MeshLambertMaterial({ color: COLOR_PLAYER_ARM }));
  fist.position.z = -0.55; g.add(fist);
  // 銃腕のときだけ見える銃身
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.36, 8),
    new THREE.MeshLambertMaterial({ color: COLOR_GUN_BARREL }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.66; barrel.visible = false; g.add(barrel);
  // 触手腕のときだけ見える、手首から先の3本。
  // リグは組まず、節の座標を updateTentacleArms() が毎フレーム直接打ち込む。
  // 手首より奥（腕の中）に入った節は非表示にして「引っ込んでいる」ように見せる。
  const tentacles = [];
  for (let i = 0; i < 3; i++) {
    const segs = [];
    for (let k = 0; k < CONFIG.tentSegs; k++) {
      const t = k / (CONFIG.tentSegs - 1);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.055 * (1 - t * 0.5), 7, 5),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(COLOR_TENTACLE).lerp(new THREE.Color(COLOR_TENTACLE_TIP), t) }));
      m.visible = false;
      g.add(m);
      segs.push(m);
    }
    // 位相をずらして、3本が同じ動きにならないようにする。
    // cur = 実際に描く位置（遅れて追従する）、ideal = その瞬間の理想位置
    tentacles.push({
      segs, phase: i * 2.1, lane: i - 1, init: false,
      cur: segs.map(() => new THREE.Vector3()),
      ideal: segs.map(() => new THREE.Vector3()),
    });
  }
  // 手首の袖。触手の根元を飲み込んで、腕と触手の継ぎ目を隠す
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.09, 0.16, 10),
    new THREE.MeshLambertMaterial({ color: COLOR_TENTACLE }));
  cuff.rotation.x = Math.PI / 2;
  // 手首(z=-0.50)の手前に置く。ここより奥に出すと触手を飲み込んでしまう
  cuff.position.z = -0.43; cuff.visible = false; g.add(cuff);
  g.userData = { fore, fist, barrel, tentacles, cuff, sign };
  scene.add(g);
  return g;
}
const fpHands = { LEFT: makeFpHand(-1), RIGHT: makeFpHand(1) };

const fpFoot = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.18, 0.5),
  new THREE.MeshLambertMaterial({ color: 0x3a4048 }));
fpFoot.visible = false;
scene.add(fpFoot);

// プレイヤーの頭
const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 16, 12),
  new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
scene.add(headMesh);
const headPos = new THREE.Vector3();

// 伸びる脊柱（肌は伸びず、椎骨だけが露出する想定の仮表現）
const spineGroup = new THREE.Group();
const spineSegs = [];
for (let i = 0; i < CONFIG.spineSegments; i++) {
  const seg = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.045, 0.085),
    new THREE.MeshLambertMaterial({ color: 0xd9d2c4 }));
  spineGroup.add(seg);
  spineSegs.push(seg);
}
spineGroup.visible = false;
scene.add(spineGroup);

/* ---------- 蜘蛛脚（左右3本ずつ・ライジングと頭モードで使う）----------
   各脚は root -> j0 -> j1 -> j2 の3節チェーン。
   root をワールド座標で首元に置き、関節の回転だけでポーズを作る。  */
const spiderGroup = new THREE.Group();
const spiderLegs = [];
{
  const segLen = CONFIG.spiderLegSeg;
  for (const sign of [-1, 1]) {
    for (let i = 0; i < CONFIG.spiderLegsPerSide; i++) {
      const root = new THREE.Group();
      const joints = [];
      const segs = [];        // フェード用に節のメッシュを持っておく
      let attach = root;
      for (let s = 0; s < segLen.length; s++) {
        const j = new THREE.Group();
        j.rotation.order = 'YZX';
        const th = CONFIG.spiderLegThick * (1 - s * 0.22);
        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(th, segLen[s], th),
          new THREE.MeshLambertMaterial({ color: s === segLen.length - 1 ? 0xd9d2c4 : 0x272d34 }));
        seg.position.y = segLen[s] / 2;
        j.add(seg);
        attach.add(j);
        const next = new THREE.Group();
        next.position.y = segLen[s];
        j.add(next);
        attach = next;
        joints.push(j);
        segs.push(seg);
      }
      spiderGroup.add(root);
      spiderLegs.push({ root, joints, segs, tip: attach, sign, index: i,
                        phase: i * 1.7 + (sign > 0 ? 0.9 : 0) });
    }
  }
}
spiderGroup.visible = false;
scene.add(spiderGroup);

/* ---------- 敵 ---------- */
const enemies = [];

function createEnemy(x, z, leftKind, rightKind) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const pivotRoot = new THREE.Group();
  group.add(pivotRoot);

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.15, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x5c5464 }));
  torso.position.y = 1.35;
  pivotRoot.add(torso);

  // 頭は切断できるようピボットで包む
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 2.12, 0);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x827a8c });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), headMat);
  headPivot.add(head);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff3322, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  headPivot.add(glow);
  pivotRoot.add(headPivot);

  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.78, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x3a3542 }));
  legs.position.y = 0.4;
  pivotRoot.add(legs);

  function makeArm(px, kind) {
    const pivot = new THREE.Group();
    pivot.position.set(px, 1.82, 0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.95, 0.2),
      new THREE.MeshLambertMaterial({ color: kind === ARM.GUN ? COLOR_GUN_ARM : COLOR_ENEMY_ARM }));
    mesh.position.y = -0.48;
    pivot.add(mesh);
    if (kind === ARM.GUN) {
      // 銃身。腕の先に前向き（ローカル+Z＝敵の正面）
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.42, 8),
        new THREE.MeshLambertMaterial({ color: COLOR_GUN_BARREL }));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, -0.92, 0.18);
      pivot.add(barrel);
    }
    pivot.userData.kind = kind;
    pivotRoot.add(pivot);
    return pivot;
  }
  // ローカル-X = この体の「右手」。キーと解剖の左右を一致させておくと、
  // 斬った腕がそのまま自分の同じ側の腕に置き換わる
  const parts = { RIGHT: makeArm(-0.68, rightKind), LEFT: makeArm(0.68, leftKind), HEAD: headPivot };

  scene.add(group);
  const enemy = {
    group, pivotRoot, torso, head, headPivot, headMat, glow, parts,
    hp: CONFIG.enemyMaxHp, maxHp: CONFIG.enemyMaxHp, stun: 0,
    boss: false, torsoColor: 0x5c5464, headColor: 0x827a8c,
    state: E.IDLE, t: 0,
    cooldown: 1.0 + Math.random(),
    consecutiveHits: 0, hitFlash: 0,
    dodgeDir: new THREE.Vector3(),
    shoveDir: new THREE.Vector3(), shoveLeft: 0,   // スタン時の押しのけ（残り距離）
    swayPhase: Math.random() * Math.PI * 2,
    activeHitDone: false,
    headless: false,
    fallT: 0,
    grabK: 0,          // 掴まれ具合(0-1)。updateFinisher() が実時間で更新する
    tentGrab: false,   // 触手のフィニッシャーで掴まれている（拳とは姿勢が違う）
    tetherVel: new THREE.Vector3(),   // 触手で拘束中の速度(m/s)。離したらそのまま投げ速度になる
    throwVel: null,                   // 投げられて飛んでいる間の速度
    throwSpin: 0,
    smashCd: 0,                       // 触手でぶつけられた直後の無敵(s)。毎フレーム当たらないように
  };
  enemies.push(enemy);
  return enemy;
}

// 敵の初期配置。生成と resetAll() の両方がこの1箇所を見る。
// プレイヤーは (0, 6) に -Z を向いて出るので、前方に弧状に並べて
// 到達タイミングがずれるように距離を変えてある。
// [x, z, 左腕の種類, 右腕の種類, 部屋index]。銃腕は最初は敵だけが持つ（敵AIは銃を使わない。奪う対象）
// プレイヤーは (0, 6) に -Z を向いて出る。左前が1体の部屋、右前が3体の部屋
const ENEMY_SPOTS = [
  [-11, -6, ARM.FIST, ARM.GUN, 0],    // ROOM 1（1体）
  [12, -4, ARM.FIST, ARM.FIST, 1],    // ROOM 2（3体）
  [9, -8, ARM.FIST, ARM.GUN, 1],
  [15, -9, ARM.GUN, ARM.GUN, 1],
];
for (const s of ENEMY_SPOTS) {
  const en = createEnemy(s[0], s[1], s[2], s[3]);
  en.room = ROOMS[s[4]];
  en.home = new THREE.Vector3(s[0], 0, s[1]);
}

/* ---------- 敵UI ---------- */
const targetEntries = [];
// ボスは後から生成するので、□とバーの作り方はここに集約しておく
function buildEnemyUi(enemy) {
  for (const key of ['LEFT', 'RIGHT', 'HEAD']) {
    const el = document.createElement('div');
    el.className = 'shoulder-target hidden' + (key === 'HEAD' ? ' head' : '');
    document.body.appendChild(el);
    targetEntries.push({ enemy, key, pivot: enemy.parts[key], el });
  }
  const bars = document.createElement('div');
  bars.className = 'enemy-bars';
  bars.innerHTML =
    '<div class="eb hp"><i></i></div><div class="eb stun"><i></i></div><div class="state"></div>';
  document.body.appendChild(bars);
  enemy.ui = {
    root: bars,
    hp: bars.querySelector('.eb.hp > i'),
    stun: bars.querySelector('.eb.stun > i'),
    state: bars.querySelector('.state'),
  };
}
for (const enemy of enemies) buildEnemyUi(enemy);

/* =========================================================
   死体（CORPSE）
   首から上がない、地面に座った体。乗っ取ると新しいプレイヤーの体になる。
   ========================================================= */
const corpses = [];
const CORPSE_SPOTS = [[-3, 2, 0.8], [3, 1, -1.2], [-1, 10, 2.4]];   // どの部屋にも入らない中央通路

// opts:
//   enemyStyle: 敵の体の色にする
//   arms: { LEFT: armState|null, RIGHT: armState|null } 乗っ取ったときに自分の腕になる。
//         null は欠けている（斬って奪った腕）。省略時はフルHPの拳
//   fuse: 爆発までの秒数（ワールド時間）。null なら爆発しない
//   skill: 体スキル { kind, used }。省略時はランダム（自分が捨てた体は使用済みかも引き継ぐ）
//   resMax: リソースの数。省略時は resourceMin〜resourceMax のランダム
//   resource: 乗っ取ったときの残り。省略時は満タン（自分が捨てた体だけ捨てた時点の残り）
//   extraArms: 阿修羅の追加の腕（自分が捨てた体だけ）。乗っ取り直すと生え直す
function createCorpse(x, z, rotY, opts) {
  opts = opts || {};
  const enemyStyle = !!opts.enemyStyle;
  const arms = {
    LEFT: opts.arms && 'LEFT' in opts.arms ? opts.arms.LEFT : makeArmState(ARM.FIST),
    RIGHT: opts.arms && 'RIGHT' in opts.arms ? opts.arms.RIGHT : makeArmState(ARM.FIST),
  };
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY || 0;

  // 胴体は少し後ろへもたれさせ、脚は前へ投げ出す
  const body = new THREE.Group();
  body.rotation.x = -0.30;
  group.add(body);

  // 敵の死体は腕が赤いので、自分の置き去りと区別がつく
  const mat = new THREE.MeshLambertMaterial({ color: enemyStyle ? 0x554d5e : 0x5f5a68 });
  const limbColor = enemyStyle ? COLOR_ENEMY_ARM : 0x7d7686;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.00, 0.42), mat);
  torso.position.y = 0.84;
  body.add(torso);

  // 首の切断面（爆発する死体はここが点滅する）
  const stump = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.21, 0.14, 10),
    new THREE.MeshLambertMaterial({ color: COLOR_FLESH }));
  stump.position.y = 1.39;
  body.add(stump);

  // 首元（インタラクト地点）
  const neck = new THREE.Group();
  neck.position.y = 1.46;
  body.add(neck);

  // 腕は肩を原点にしたピボットにまとめる（ライジングで斬って奪えるように）
  const armPivots = { LEFT: null, RIGHT: null };
  for (const sx of [-1, 1]) {
    const key = sx < 0 ? 'RIGHT' : 'LEFT';   // ローカル-X = この体の右手（敵と同じ規約）
    const a = arms[key];
    if (!a || a.lost) continue;   // 欠けている腕は描かない
    const isGun = a.kind === ARM.GUN;
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.56, 1.07, 0.10);          // 肩
    pivot.rotation.z = sx * 0.20;
    pivot.userData.kind = a.kind;
    // 腕のマテリアルは左右で共有しない。共有すると、片腕を斬ったときに
    // dropCorpseBlinkMats() が体に残っている側も導火線の点滅から外してしまう
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.82, 0.17),
      new THREE.MeshLambertMaterial({ color: isGun ? COLOR_GUN_ARM : limbColor }));
    arm.position.y = -0.41;
    if (a.purged) { arm.scale.y = 0.65; arm.position.y = -0.27; }
    pivot.add(arm);
    if (isGun) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 0.36, 8),
        new THREE.MeshLambertMaterial({ color: COLOR_GUN_BARREL }));
      barrel.position.set(sx * 0.12, -0.77, 0);
      pivot.add(barrel);
    }
    body.add(pivot);
    armPivots[key] = pivot;
  }
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.98), mat);
  legs.position.set(0, 0.16, 0.54);
  group.add(legs);

  scene.add(group);

  const el = document.createElement('div');
  el.className = 'shoulder-target corpse hidden';
  document.body.appendChild(el);
  // 腕の□（スタン中の敵の腕と同じ見た目）
  const armEls = { LEFT: null, RIGHT: null };
  for (const key of ['LEFT', 'RIGHT']) {
    if (!armPivots[key]) continue;
    const ae = document.createElement('div');
    ae.className = 'shoulder-target hidden';
    document.body.appendChild(ae);
    armEls[key] = ae;
  }
  const skill = opts.skill ? Object.assign({}, opts.skill) : makeBodySkill();
  const resMax = opts.resMax || randomBodyResource();
  const prompt = document.createElement('div');
  prompt.className = 'chest-prompt hidden';
  // 文字は出さない。Fキーと、体スキルの絵（HUDと同じ）とリソースの数の点だけ。
  // 絵は HUD_ICON がまだ定義される前に呼ばれることがあるので、最初に表示するときに入れる
  prompt.innerHTML = '<span class="key">F</span>' +
    '<span class="skill-ico' + (skill.used ? ' used' : '') + '"></span>' +
    '<span class="res-tag">' + '<i></i>'.repeat(resMax) + '</span>';
  document.body.appendChild(prompt);

  // 爆発が近いことを体ぜんぶで示すため、死体のマテリアルを集めておく。
  // 死体ごとに new しているので、ここを書き換えても他の死体には影響しない。
  // 首の切断面(stump)だけは点滅＋膨らみを別に持っているので外す
  const blinkMats = [], blinkBase = [];
  group.traverse((o) => {
    if (!o.material || o === stump || blinkMats.indexOf(o.material) >= 0) return;
    blinkMats.push(o.material);
    blinkBase.push(o.material.color.getHex());
  });

  const c = {
    group, body, neck, stump, el, prompt, arms, armPivots, armEls, blinkMats, blinkBase,
    fuse: (typeof opts.fuse === 'number') ? opts.fuse : null,
    // hp が数値なら「中古の体」。乗っ取ってもこのHPまでしか戻らない。
    // 敵の死体や最初から置いてある体は null ＝ 全快の新品
    hp: (typeof opts.hp === 'number') ? opts.hp : null,
    skill,
    resMax,
    resource: (typeof opts.resource === 'number') ? Math.min(resMax, opts.resource) : resMax,
    extraArms: opts.extraArms || null,
    blinkPhase: 0,
  };
  corpses.push(c);
  return c;
}

// 敵の今の腕から、死体が持つ腕を作る。斬られて無い腕は null（乗っ取ると欠けたまま）
function armsFromEnemy(en) {
  const out = {};
  for (const key of ['LEFT', 'RIGHT']) {
    const attached = en.parts[key].parent === en.pivotRoot;
    out[key] = attached ? makeArmState(en.parts[key].userData.kind, { swapped: true }) : null;
  }
  return out;
}

// 死体から外した部位を点滅の対象から抜く。
// 抜かないと、吸着中の腕が元の死体の導火線に合わせて赤く明滅する
function dropCorpseBlinkMats(c, root) {
  root.traverse((o) => {
    const i = o.material ? c.blinkMats.indexOf(o.material) : -1;
    if (i < 0) return;
    o.material.color.setHex(c.blinkBase[i]);
    c.blinkMats.splice(i, 1);
    c.blinkBase.splice(i, 1);
  });
}

// 導火線の点滅。on=false で元の色に戻す
function setCorpseBlink(c, on, urgency) {
  for (let i = 0; i < c.blinkMats.length; i++) {
    c.blinkMats[i].color.setHex(on ? COLOR_CORPSE_HOT : c.blinkBase[i]);
  }
  c.stump.material.color.setHex(on ? 0xff9a80 : COLOR_FLESH);
  const sc = on ? 1 + 0.25 * urgency : 1;
  c.stump.scale.set(sc, 1, sc);
}

/* ---------- 倒した敵の死体の爆発 ---------- */
// 血肉の破片。頭破裂の派生で色を赤寄りにする
// life を渡すと、その秒数で消える肉片になる（腕の交換のように何度も出るもの用）
function spawnFleshBurst(pos, count, speed, bias, life) {
  for (let i = 0; i < count; i++) {
    const sz = 0.05 + Math.random() * 0.09;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(sz, sz * (0.6 + Math.random()), sz),
      new THREE.MeshLambertMaterial({ color: (i % 4 === 0) ? 0x5c5464 : COLOR_FLESH,
                                      transparent: !!life }));
    m.position.copy(pos);
    scene.add(m);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.3, Math.random() - 0.5);
    if (bias) dir.addScaledVector(bias, 0.8);
    dir.normalize();
    debris.push({
      obj: m,
      vel: dir.multiplyScalar(speed * (0.5 + Math.random() * 0.8)),
      spin: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18),
      rest: false,
      // 個体ごとに少しずらす。全部が同じ瞬間に消えると「片付いた」感が出る
      life: life ? life * (0.85 + Math.random() * 0.3) : null,
    });
  }
}

function explodeCorpse(c) {
  const at = new THREE.Vector3();
  c.neck.getWorldPosition(at); at.y -= 0.5;
  spawnFleshBurst(at, CONFIG.corpseBurstPieces, CONFIG.corpseBurstSpeed);
  if (selectedTarget && (selectedTarget.kind === 'corpse' || selectedTarget.kind === 'corpseArm') &&
      selectedTarget.corpse === c) selectedTarget = null;
  const origin = c.group.position.clone();
  removeCorpse(c);
  addShake(0.35);
  doFlash(0.30, '#ff7a66');
  showFeedback('BODY BURST', '#ff8f7a', 30);

  // --- 爆発ダメージ（水平距離） ---
  const r = CONFIG.corpseBurstRadius;
  const dp = Math.hypot(playerPos.x - origin.x, playerPos.z - origin.z);
  if (dp <= r) {
    if (player.invuln > 0) {
      if (!inFinisher()) showFeedback('DODGE', '#9ce8ff', 24);
    } else if (damagePlayer(CONFIG.corpseBurstDamagePlayer) === 'body') {
      doFlash(0.5, '#ff3b30');
      addShake(0.6);
      addHitstop(0.06);
      showFeedback(player.hp <= 0 ? 'YOU DOWN — [G] RESET' : 'BURST HIT', '#ff6b5e', 34);
    }
  }
  for (const en of enemies) {
    // 掴んでいる敵は手の中なので巻き込まない（フィニッシャーが途中で壊れる）
    if (en.state === E.DEAD || en.state === E.GRABBED) continue;
    const d = Math.hypot(en.group.position.x - origin.x, en.group.position.z - origin.z);
    if (d > r) continue;
    applyStun(en, CONFIG.corpseBurstStunEnemy);
    applyDamage(en, CONFIG.corpseBurstDamageEnemy);   // 倒れれば死体になり、連鎖する
    if (en.state !== E.DEAD && en.state !== E.STUNNED) enterHitReact(en, 1.3);
  }
}

// wdt: ワールド時間。ライジング中はスローのぶん猶予が伸びる
function updateCorpseFuses(wdt) {
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i];
    if (c.fuse === null) continue;
    c.fuse -= wdt;
    if (c.fuse <= 0) { explodeCorpse(c); continue; }
    // 導火線が長い体（自分が捨てた体）は、しばらく静かに横たわってから点滅に入る。
    // 落ちた瞬間から点滅していると「もう消える」と読めて、奪いに行く間が作れない
    if (c.fuse > CONFIG.corpseBlinkLead) { setCorpseBlink(c, false, 0); continue; }
    // 残り時間が短いほど速く点滅する
    const urgency = 1 - c.fuse / CONFIG.corpseBlinkLead;
    c.blinkPhase += wdt * (4 + urgency * 22);
    setCorpseBlink(c, Math.sin(c.blinkPhase) > 0, urgency);
  }
}

/* ---------- 倒したときに飛び散る頭の破片 ---------- */
let debris = [];
// speedMul: 勢いの倍率。bias: 破片を寄せる方向（掴みフィニッシャーは自分から離れる向き）
function spawnHeadBurst(pos, speedMul, bias) {
  const mul = speedMul || 1;
  for (let i = 0; i < CONFIG.headBurstPieces; i++) {
    const s = 0.06 + Math.random() * 0.07;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshLambertMaterial({ color: (i % 3 === 0) ? 0x8d3a33 : 0x9a92a4 }));
    m.position.copy(pos);
    scene.add(m);
    const dir = new THREE.Vector3(
      Math.random() - 0.5, Math.random() * 0.8 + 0.35, Math.random() - 0.5);
    if (bias) dir.addScaledVector(bias, 0.9);
    dir.normalize();
    debris.push({
      obj: m,
      vel: dir.multiplyScalar(CONFIG.headBurstSpeed * mul * (0.6 + Math.random() * 0.7)),
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16),
      rest: false,
    });
  }
}

/* ---------- 血痕デカール ----------
   頭モードで移動した軌跡に残る。床は y=0 の平面なのでわずかに浮かせ、
   高さを個体ごとにばらして重なったときのZファイトを避けている。
   数が増えるので寿命付き＋上限つきのリングバッファ。                 */
const decalGeo = new THREE.CircleGeometry(1, 12);
let bloodDecals = [];

function spawnBloodDecal(x, z, size, alpha) {
  const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
    color: 0x5e0c09, transparent: true, opacity: alpha,
    depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.random() * Math.PI * 2;
  m.position.set(x + (Math.random() - 0.5) * 0.18, 0.012 + Math.random() * 0.006,
                 z + (Math.random() - 0.5) * 0.18);
  m.scale.set(size * (0.8 + Math.random() * 0.4), size * (0.8 + Math.random() * 0.4), 1);
  scene.add(m);
  bloodDecals.push({ obj: m, life: CONFIG.bloodDecalLife, alpha });
  while (bloodDecals.length > CONFIG.bloodDecalMax) {
    const old = bloodDecals.shift();
    scene.remove(old.obj); old.obj.material.dispose();
  }
}

function clearBloodDecals() {
  for (const d of bloodDecals) { scene.remove(d.obj); d.obj.material.dispose(); }
  bloodDecals = [];
}

// rdt: 実時間。スローの影響を受けずに消えていく
function updateBloodDecals(rdt) {
  for (let i = bloodDecals.length - 1; i >= 0; i--) {
    const d = bloodDecals[i];
    d.life -= rdt;
    if (d.life <= 0) {
      scene.remove(d.obj); d.obj.material.dispose();
      bloodDecals.splice(i, 1); continue;
    }
    // 最後の1/3だけフェードアウト
    d.obj.material.opacity = d.alpha * Math.min(1, d.life / (CONFIG.bloodDecalLife / 3));
  }
}

function clearDebris() {
  for (const d of debris) scene.remove(d.obj);
  debris = [];
}

function removeCorpse(c) {
  scene.remove(c.group);
  c.el.remove();
  for (const key of ['LEFT', 'RIGHT']) if (c.armEls[key]) c.armEls[key].remove();
  c.prompt.remove();
  const i = corpses.indexOf(c);
  if (i >= 0) corpses.splice(i, 1);
}

function resetCorpses() {
  while (corpses.length) removeCorpse(corpses[0]);
  for (const s of CORPSE_SPOTS) createCorpse(s[0], s[1], s[2]);
}
resetCorpses();

/* ---------- 切断された部位 / パージ手首 ---------- */
let severedParts = []; // { obj, key, vel:Vector3, phase, dropAt, spin } … 今は頭だけ
let graftArms = [];    // 体へ吸着中の腕 { obj, key, t, from, pull, landed }
let projectiles = [];

/* ---------- ライジング / 頭モード制御 ---------- */
let risingBlend = 0;           // 0=人間, 1=脊柱が伸びきった状態
let riseCamT = 0;              // ライジング開始からの実時間（カメラ演出用。戻り中は止める）
let selectedTarget = null;     // { kind:'part'|'corpse', ... }
let risingSlashSide = 'RIGHT'; // 蜘蛛脚を左右交互に振るための状態
let legSwing = null;           // 振りの進行 { side, t }
let legDeploy = 0;             // 蜘蛛脚の展開具合 0=頭の中に格納 / 1=展開
let headH = 0;                 // 頭モードの地面からの高さ
let headVy = 0;                // 頭モードの上下速度
let headGrounded = false;
let headBleedT = 0;            // 出血ダメージの刻み用タイマー(s)
let headDead = false;          // 頭モードで力尽きた（頭が潰れた）
let bleedDist = 0;             // 最後に血痕を落としてからの移動距離(m)
let bleedTicks = 0;            // 出血の刻み数（静止中の滴りを間引くのに使う）
const lastBleedPos = new THREE.Vector3();
let possess = null;            // 乗っ取り演出 { corpse, t, from, stabbed }
const possessHeadPos = new THREE.Vector3();

/* ---------- 演出制御 ---------- */
let hitstop = 0, shake = 0, slowTimer = 0, slowScaleOverride = 1;

/* ---------- 入力 ---------- */
const keys = {};
const mouseHold = { LEFT: null, RIGHT: null };
const gunHold = { LEFT: false, RIGHT: false };   // 銃腕の長押し
const gunCool = { LEFT: 0, RIGHT: 0 };           // 次の弾までの残り(s)
const locked = () => document.pointerLockElement === renderer.domElement;

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();   // Tabはフォーカス移動を止める
  // Ctrl（ガード）を握ったまま押したキーをブラウザのショートカットにしない
  // （Ctrl+D のブックマーク、Ctrl+S の保存など）。Ctrl+W だけはブラウザが
  // 横取りできないので、下の beforeunload で閉じる前に確認を出す
  if (e.ctrlKey && locked()) e.preventDefault();
  if (!locked() || e.repeat) return;

  // 操作説明を開いているあいだは、ページ送りと閉じる以外の入力を通さない
  if (manualOpen) {
    if (e.code === 'KeyF' || e.code === 'Escape') closeManual();
    else if (e.code === 'KeyA') manualTurn(-1);
    else if (e.code === 'KeyD') manualTurn(1);
    return;
  }

  // 目的の表示を開閉する（普段は隠れている）
  if (e.code === 'Tab') { toggleObjective(); return; }

  if (e.code === 'KeyG') { resetAll(); return; }
  if (e.code === 'KeyB') { warpToBoss(); return; }
  if (e.code === 'KeyV') { startDemo(); return; }
  // 腕の付け替え（プロトタイプ検証用）。1=拳 / 2=銃 / 3=触手
  if (e.code === 'Digit1') { equipArms(ARM.FIST); return; }
  if (e.code === 'Digit2') { equipArms(ARM.GUN); return; }
  if (e.code === 'Digit3') { equipArms(ARM.TENTACLE); return; }
  // 体スキルの付け替え（プロトタイプ検証用）。4=阿修羅 / 5=回復。未使用に戻る
  if (e.code === 'Digit4') { setBodySkill(SKILL.ASURA); return; }
  if (e.code === 'Digit5') { setBodySkill(SKILL.HEAL); return; }

  // 体スキル。体ごとに1回だけ
  if (e.code === 'KeyZ') { useBodySkill(); return; }

  // Qは長押し。押している間だけライジングし、離すとゴムのように戻る
  if (e.code === 'KeyQ') {
    if (state === S.HUMAN) startRising();
    return;
  }

  if (e.code === 'KeyF') {
    // 頭モード：近くの死体に乗り移る。死体がなければ看板を読む
    if (state === S.HEAD) {
      const c = findCorpseNearby();
      if (c) { startPossess(c); return; }
      if (signInRange()) openManual();
      return;
    }
    // ライジング：□が死体なら首が飛んで乗り移る
    // 腕は□＋クリックで取るので、Fは「体を取る」だけに絞ってある
    if (selectedTarget && selectedTarget.kind === 'corpse') {
      startPossess(selectedTarget.corpse); return;
    }
    // 人間モード：棚の横の看板に近ければ操作説明を開く
    if (state === S.HUMAN && signInRange()) openManual();
    return;
  }

  if (e.code === 'Space') {
    if (state === S.HUMAN) doKick();
    else if (state === S.RISE_IN || state === S.RISING) enterHeadMode();
    else if (state === S.HEAD && headGrounded && !headDead) {
      headVy = CONFIG.headJumpSpeed;
      headGrounded = false;
    }
    return;
  }

  if (state === S.HUMAN) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') doDodge();
  }
});
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  // Qを離したらライジング終了（頭モードに入ったあとは無関係）
  if (e.code === 'KeyQ' && (state === S.RISE_IN || state === S.RISING)) exitRising();
});

document.addEventListener('mousedown', (e) => {
  if (!locked() || manualOpen) return;
  const side = e.button === 0 ? 'LEFT' : e.button === 2 ? 'RIGHT' : null;
  if (!side) return;

  if (state === S.RISE_IN || state === S.RISING) {
    // 押したボタンの側が、そのまま奪った腕の付く側になる。
    // 対面していると敵の左右と自分の左右が鏡になって読めないので、
    // 「右クリックで斬ったら右手」と入力側で決めてしまう。
    if (selectedTarget && selectedTarget.kind === 'part') {
      triggerLegSwing();
      cutPart(selectedTarget.entry, side);
    } else if (selectedTarget && selectedTarget.kind === 'corpseArm') {
      triggerLegSwing();
      cutCorpseArm(selectedTarget, side);
    } else if (selectedTarget && selectedTarget.kind === 'groundArm') {
      triggerLegSwing();
      takeGroundArm(selectedTarget, side);
    } else if (selectedTarget && selectedTarget.kind === 'rackArm') {
      triggerLegSwing();
      takeRackArm(selectedTarget, side);
    }
    return;
  }
  if (state !== S.HUMAN) return;
  if (player.guard) return;          // ガード中は殴れない（構えを解けば出る）
  const arm = player.arms[side];
  if (arm.lost) {
    // 本体の腕が無くても、阿修羅の追加の腕が残っていればそっちが殴る
    if (canCancelNow() && asuraTrigger(side)) return;
    showFeedback('NO ARM', '#8b8f88', 22); return;
  }
  if (arm.kind === ARM.GUN) {
    // 銃腕：押した瞬間に1発、押している間は連射（パージ・パンチはない）
    gunHold[side] = true;
    tryShoot(side);
    return;
  }
  // 触手腕も「短押し＝攻撃／長押し＝特殊」なので同じ長押し判定に乗せる。
  // 消化のフラグ(purged)だけ共用して、何が出たかは tent で分ける
  mouseHold[side] = { t: 0, purged: false, tent: arm.kind === ARM.TENTACLE };
});

document.addEventListener('mouseup', (e) => {
  const side = e.button === 0 ? 'LEFT' : e.button === 2 ? 'RIGHT' : null;
  if (!side) return;
  gunHold[side] = false;
  // 触手で拘束していたら、離した瞬間が「投げ」の判定になる
  if (tentHold && tentHold.side === side) releaseTentacle();
  const h = mouseHold[side];
  mouseHold[side] = null;
  if (!h) return;
  if (!h.purged && state === S.HUMAN) doPunch(side);
});

document.addEventListener('mousemove', (e) => {
  if (!locked() || BOSS.camLock || manualOpen) return;   // ジャンプスケア／操作説明中は視点を奪う
  yaw -= e.movementX * CONFIG.mouseSensitivity;
  pitch -= e.movementY * CONFIG.mouseSensitivity;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

const startOverlay = document.getElementById('startOverlay');
// 開始と同時に全画面にして、キーボードをロックする。
// Ctrl+W（タブを閉じる）・Ctrl+T・Ctrl+N などはブラウザが先に取ってしまい、
// 普段はページから止められない。全画面中だけ Keyboard Lock でページに渡してもらえる
// （Chrome / Edge）。ガード（Ctrl）を握ったまま WASD で歩けるようにするため。
// Escape はロックしない＝これまでどおり ESC でマウスと全画面が解除される
const LOCK_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyT', 'KeyN', 'KeyF', 'KeyG',
  'KeyB', 'KeyV', 'KeyZ', 'KeyX', 'KeyC', 'Tab', 'Space',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
];
startOverlay.addEventListener('click', () => {
  const root = document.documentElement;
  if (!document.fullscreenElement && root.requestFullscreen) {
    root.requestFullscreen().then(() => {
      if (navigator.keyboard && navigator.keyboard.lock) {
        navigator.keyboard.lock(LOCK_KEYS).catch(() => {});
      }
    }).catch(() => {});   // 全画面を断られても普通に遊べる（Ctrl+W だけ確認ダイアログで守る）
  }
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  startOverlay.classList.toggle('hidden', locked());
  if (!locked() && manualOpen) closeManual();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- UI参照 ---------- */
const ui = {
  state: document.getElementById('hudState'),
  target: document.getElementById('hudTarget'),
  room: document.getElementById('hudRoom'),
  arms: document.getElementById('hudArms'),
  enemy: document.getElementById('hudEnemy'),
  slowOverlay: document.getElementById('slowOverlay'),
  flash: document.getElementById('flash'),
  hud: document.getElementById('playerHud'),
  resPips: document.getElementById('resPips'),
  // 丸アイコン（左右腕 / 中央＝体・頭）。fill は上から下へ減る
  circles: {
    LEFT: document.getElementById('circleArmL'),
    RIGHT: document.getElementById('circleArmR'),
    CORE: document.getElementById('circleCore'),
  },
};
// 丸の中身（fill / アイコン）を引きやすいようにまとめておく
const hudCircle = {};
for (const key of ['LEFT', 'RIGHT', 'CORE']) {
  const el = ui.circles[key];
  hudCircle[key] = { el, fill: el.querySelector('.fill'), icon: el.querySelector('.icon'), iconKey: '' };
}
ui.skillRing = document.getElementById('skillRing');
ui.skillKey = document.getElementById('skillKey');
let hudSkillFire = 0;      // 体スキルを使った直後、縁の光が弾けて消える演出の残り(s)

/* ---------- HUDのアイコン ----------
   丸の中に描く記号化したイラスト。数字の代わりにここで「何の腕／体か」を読ませる。
   残量は丸の塗り（fill）が受け持つ。
   全部同じ描き方にそろえる：48x48、白の線（太さ3・角丸）、塗りは要所だけ。
   色は CSS（currentColor）。暗い縁取りは CSS の drop-shadow で付ける            */
const HUD_ICON = {
  // 拳：握った指の段と、横に回した親指
  fist: '<rect x="13" y="12" width="22" height="18" rx="5"/>' +
        '<path d="M20 12v7M27 12v7"/><path d="M13 24h9a3 3 0 0 1 0 6"/>' +
        '<path d="M17 30v8M31 30v8"/>',
  // パージ済み：手首から先がない（ぎざぎざの断面）
  purged: '<path d="M17 40V22l3.5 3 3.5-4 3.5 4 3.5-3v18"/>' +
          '<rect x="15" y="8" width="18" height="10" rx="4" stroke-dasharray="3 3" opacity="0.55"/>',
  // 銃腕：拳銃のシルエット（銃身・グリップ・銃口）
  gun: '<path d="M7 17h28v8H22l-3 11h-7l2.5-11H7z"/><path d="M35 21h5"/>' +
       '<path d="M17 25v3h4"/>',
  // 触手腕：袖から3本がうねって出る
  tentacle: '<rect x="14" y="33" width="20" height="7" rx="3"/>' +
            '<path d="M19 33c-5-6 4-10-1-20"/><path d="M24 33c4-7-4-12 1-22"/>' +
            '<path d="M29 33c5-6-3-10 3-18"/>' +
            '<circle cx="18" cy="13" r="1.8" class="f"/><circle cx="25" cy="11" r="1.8" class="f"/>' +
            '<circle cx="32" cy="15" r="1.8" class="f"/>',
  // 失った腕：破線の腕に×
  lost: '<path d="M18 12v26M30 12v26" stroke-dasharray="3 4" opacity="0.5"/>' +
        '<path d="M15 17l18 18M33 17L15 35"/>',
  // 頭モード：丸い頭、蜘蛛脚、しっぽの脊柱
  head: '<circle cx="24" cy="17" r="8"/><path d="M18 22l-7 6-2 8M30 22l7 6 2 8"/>' +
        '<path d="M21 24l-3 7v6M27 24l3 7v6"/><path d="M24 25v4" stroke-dasharray="2 2"/>',
  // 体（スキルの絵の土台）：首の断面がある胴
  body: '<path d="M13 19q0-4 5-4h12q5 0 5 4l-3 18H16z"/><path d="M21.5 15v-3h5v3"/>',
  // 阿修羅：胴から左右3本ずつ腕が伸びる
  asura: '<path d="M18.5 20q0-3 3-3h5q3 0 3 3l-1.5 15h-8z"/><path d="M22 17v-3h4v3"/>' +
         '<path d="M19 21L9 14M19 24H7M19 28l-9 6M29 21l10-7M29 24h12M29 28l9 6"/>' +
         '<circle cx="9" cy="14" r="2" class="f"/><circle cx="7" cy="24" r="2" class="f"/>' +
         '<circle cx="10" cy="34" r="2" class="f"/><circle cx="39" cy="14" r="2" class="f"/>' +
         '<circle cx="41" cy="24" r="2" class="f"/><circle cx="38" cy="34" r="2" class="f"/>',
  // 回復：胴の真ん中に十字
  heal: '<path d="M13 19q0-4 5-4h12q5 0 5 4l-3 18H16z"/><path d="M21.5 15v-3h5v3"/>' +
        '<path d="M24 20.5v11M18.5 26h11" stroke-width="3.6"/>',
};
function setHudIcon(c, key) {
  if (c.iconKey === key) return;      // 毎フレーム書き換えない
  c.iconKey = key;
  c.icon.innerHTML = '<svg viewBox="0 0 48 48">' + HUD_ICON[key] + '</svg>';
}
// リソースの丸。数は体ごとに違うので、体が変わったら作り直す（中央ぞろえは CSS の flex）
const pips = [];
function buildPips(n) {
  if (pips.length === n) return;
  while (pips.length > n) pips.pop().remove();
  while (pips.length < n) {
    const p = document.createElement('div');
    p.className = 'pip'; p.innerHTML = '<i></i>';
    ui.resPips.appendChild(p); pips.push(p);
  }
}
buildPips(player.resMax);

/* ---------- プレイヤーHUD ----------
   左右下＝腕HP、中央下＝体HP（頭モードでは頭HP）。丸は上から下へ減る。
   その下のリソース（ドッジ／キック）は左から減る。
   毎フレーム呼ぶので、腕の付け替えや頭モードの出血も勝手に追従する。   */
function updatePlayerHud() {
  const headMode = (state === S.HEAD || state === S.POSSESS);
  ui.hud.classList.toggle('head', headMode);

  // --- 体 / 頭 ---
  // 体のアイコンは体スキルの絵。使えるうちは縁が光る（OWのウルトのように）
  const hp = Math.max(0, player.hp);
  const core = hudCircle.CORE;
  const sk = player.skill;
  const ready = !headMode && !!sk && !sk.used;
  core.fill.style.setProperty('--hp', (hp / CONFIG.playerMaxHp * 100) + '%');
  setHudIcon(core, headMode ? 'head' : (sk ? sk.kind : 'body'));
  core.el.classList.toggle('head', headMode);
  core.el.classList.toggle('low', hp <= CONFIG.playerMaxHp * 0.3);
  core.el.classList.toggle('ready', ready);
  ui.skillRing.classList.toggle('on', ready);
  ui.skillKey.classList.toggle('on', ready);
  ui.skillRing.classList.toggle('fire', hudSkillFire > 0 && !headMode);

  // --- 腕（頭モードでは丸ごと非表示なので更新だけしておく）---
  for (const side of ['LEFT', 'RIGHT']) {
    const st = player.arms[side];
    const c = hudCircle[side];
    const isGun = st.kind === ARM.GUN;
    const isTent = st.kind === ARM.TENTACLE;
    c.fill.style.setProperty('--hp', (st.lost ? 0 : st.hp / CONFIG.armMaxHp * 100) + '%');
    setHudIcon(c, st.lost ? 'lost' : isGun ? 'gun' : isTent ? 'tentacle'
                                    : (st.purged ? 'purged' : 'fist'));
    c.el.classList.toggle('lost', st.lost);
    c.el.classList.toggle('purged', st.purged && !st.lost);
    c.el.classList.toggle('swapped', st.swapped && !isGun && !isTent && !st.lost);
    c.el.classList.toggle('gun', isGun && !st.lost);
    c.el.classList.toggle('tent', isTent && !st.lost);
    c.el.classList.toggle('low', !st.lost && st.hp <= CONFIG.armHitCost);
  }

  // --- リソース：左から減る（残りは右詰め）---
  buildPips(player.resMax);
  const firstFull = player.resMax - player.resource;
  for (let i = 0; i < pips.length; i++) {
    const full = i >= firstFull;
    const charging = (i === firstFull - 1);
    pips[i].classList.toggle('full', full);
    pips[i].firstChild.style.height = charging
      ? (player.resourceCharge / CONFIG.resourceRegenTime * 100) + '%' : '0%';
  }
  // 頭モードではキックもドッジも出せないので、リソースの丸ごと出さない
  ui.resPips.classList.toggle('hidden', headMode);
}

/* ---------- 字幕（画面中央下）----------
   ボス戦で敵が話すとき、主人公が話すときなどに使う。
   say('ダクトの男：また来たのか', 3.0) のように「話者：せりふ」で渡すと
   話者の名前だけ色が付く（主人公は PLAYER_SPEAKER の名前で渡すと別の色）。
   「：」がなければ地の文としてそのまま出す。dur 秒で消える              */
const PLAYER_SPEAKER = '主人公';
const subtitleEl = document.getElementById('subtitle');
let subtitleT = 0;
function say(text, dur) {
  subtitleEl.textContent = '';
  const m = /^([^：]{1,12})：(.*)$/.exec(text);
  if (m) {
    const spk = document.createElement('span');
    spk.className = 'spk' + (m[1] === PLAYER_SPEAKER ? ' me' : '');
    spk.textContent = m[1];
    subtitleEl.append(spk, m[2]);
  } else {
    subtitleEl.textContent = text;
  }
  subtitleEl.classList.remove('hidden');
  subtitleEl.style.opacity = '1';
  subtitleT = dur || 2.6;
}
function hideSubtitle() {
  subtitleT = 0;
  subtitleEl.classList.add('hidden');
}
function updateSubtitle(rdt) {
  if (subtitleT <= 0) return;
  subtitleT -= rdt;
  subtitleEl.style.opacity = String(Math.min(1, subtitleT / 0.4));
  if (subtitleT <= 0) subtitleEl.classList.add('hidden');
}

/* ---------- 演出ヘルパ ---------- */
// 状況を文字で伝えるポップアップ（RISING / NEW BODY / BODY BURST など）は出さない方針。
// 指示のない文字は画面に出さない（ローカライズの手間を増やさない）。
// 呼び出し側はそのまま残してあるので、デバッグで見たいときはここに表示処理を戻す
function showFeedback() {}
let flashTimer = 0, flashPower = 0;
function doFlash(power, color) {
  flashPower = power; flashTimer = 0.18;
  ui.flash.style.background = color || '#fff';
}
function addShake(v) { shake = Math.max(shake, v); }
function addHitstop(v) { hitstop = Math.max(hitstop, v); }

// 近接の振り。peak（振り抜き＝キャンセル可能点）で 1 になり、end で 0 に戻る。
// 出は速く、戻りはゆっくり＝硬直が長く見える
function swingCurve(t, peak, end) {
  if (t < peak) { const u = t / peak; return 1 - (1 - u) * (1 - u); }
  return Math.max(0, 1 - (t - peak) / Math.max(0.01, end - peak));
}

/* =========================================================
   プレイヤー行動（人間モード）
   ========================================================= */
/* --- アクションキャンセル ---------------------------------------------
   パンチ・パージ・キック・ドッジ・ライジングは全部「進行中のアクションを
   キャンセルして出す」ことができる。キャンセルできるのは

     ・攻撃（パンチ／キック）… 振り抜き = アニメーションの攻撃終わり以降
                               （= startup + punchActive / kickActive）
     ・パージ／ドッジ後の硬直(recoverT) … いつでも
     ・掴みフィニッシャー … 不可
     ・ドッジの移動中(dodgeT) … 不可

   発生(startup)中は上書きできないので、「出した攻撃は必ず一度は判定が出る」
   ことが保証される（暴発したパンチを無かったことにはできない）。         */
function cancelPointOf(atk) {
  if (atk.type === 'punch') {
    // 触手はアニメの薙ぎ尺(tentSweepActive)より早くキャンセルできる。
    // 「長く振る」と「テンポよく2回振る」を両立させるために分けてある
    return atk.startup + (atk.tent ? CONFIG.tentSweepCancel : CONFIG.punchActive);
  }
  if (atk.type === 'kick') return atk.startup + CONFIG.kickActive;
  return Infinity;   // finisher は最後までキャンセル不可
}
function canCancelNow() {
  if (state !== S.HUMAN || player.hp <= 0 || player.dodgeT > 0) return false;
  if (player.stagger > 0) return false;   // ボスのキックで潰されている間は何も出せない
  if (player.attack === null) return true;   // 硬直(recoverT)だけならいつでも
  return player.attack.t >= cancelPointOf(player.attack);
}
// キャンセル受付中かどうか（HUD表示用。何も出していないときは false）
function inCancelWindow() {
  return player.attack !== null && player.attack.t >= cancelPointOf(player.attack);
}
function cancelCurrentAction() {
  player.attack = null;      // 硬直を打ち切る（発生中はここへ来ない）
  player.recoverT = 0;
  punchBuffer = null;        // 別のアクションを出した時点で溜めていたパンチは捨てる
}

/* --- パンチの先行入力 -------------------------------------------------
   振り抜き前（＝まだキャンセルできない時間）に押した左右のパンチを覚えておき、
   キャンセルできるようになった瞬間に自動で出す。
   これがないと、左右を交互に叩いたときに「早く押しすぎた入力」が消えて、
   毎回キャンセル可能点を目押しさせられる。

   覚えるのはパンチだけ。キックとドッジは「押した瞬間」の敵の状態で
   ジャストを確定させているので（doKick の justHits / doDodge の just）、
   あとから出すと押したタイミングと結果がズレる。                        */
let punchBuffer = null;      // { side, t }

function startPunch(side) {
  cancelCurrentAction();
  if (player.arms[side].kind === ARM.TENTACLE) {
    // 触手の薙ぎ払い。1段目は片側へ、2段目は反対側へ。
    // 一定時間振らなければ1段目に戻すので、連打すると必ず左右交互になる
    if (worldTime - tentComboAt > CONFIG.tentSweepComboReset) tentComboStep = 0;
    tentComboAt = worldTime;
    const dir = (tentComboStep === 0) ? 1 : -1;
    tentComboStep = (tentComboStep + 1) % 2;
    player.attack = { side, type: 'punch', tent: true, dir, t: 0,
                      startup: CONFIG.tentSweepStartup, resolved: false,
                      hitSet: new Set(),   // 1回の振りで同じ敵を2度薙がない
                      hits: 0, prevAng: undefined };
  } else {
    player.attack = { side, type: 'punch', t: 0, startup: CONFIG.punchStartup, resolved: false };
  }
  asuraTrigger(side);     // 阿修羅：同じ側の追加の腕も少し遅れて続く
  bossTryCounterKick();   // ダクトの男はここに割り込んでくる
}

function updatePunchBuffer(dt) {
  const b = punchBuffer;
  if (!b) return;
  b.t += dt;
  // 人間モードから出た（ライジング・頭モード・乗っ取り）なら溜めていた入力は捨てる
  // 触手は振りが長いぶんキャンセル可能点も遅いので、覚えておく時間を伸ばす
  const limit = (player.arms[b.side].kind === ARM.TENTACLE)
    ? CONFIG.tentSweepBuffer : CONFIG.inputBufferTime;
  if (b.t > limit || state !== S.HUMAN) { punchBuffer = null; return; }
  const arm = player.arms[b.side];
  if (arm.lost || arm.kind === ARM.GUN) { punchBuffer = null; return; }  // 待つ間に腕が変わった
  if (!canCancelNow()) return;
  punchBuffer = null;
  startPunch(b.side);
}

function inFinisher() {
  return player.attack !== null && player.attack.type === 'finisher';
}

// 移動できる状態と、そのときの速度
// ライジング中（RISE_IN / RISING / RISE_OUT）はその場に固定。
// 掴みフィニッシャー中も足を止める（敵を引き寄せる演出なので自分が動くと崩れる）
function canMove() {
  if (manualOpen) return false;        // 操作説明を読んでいるあいだは足を止める
  if (inFinisher()) return false;
  return state === S.HUMAN || state === S.HEAD;
}

function moveSpeedNow() {
  if (state === S.HEAD) return CONFIG.headMoveSpeed;
  return CONFIG.moveSpeed * (player.guard ? CONFIG.guardMoveMul : 1);
}

function findTargetEnemy(range, angleDeg) {
  const eye = new THREE.Vector3(playerPos.x, playerPos.y + EYE, playerPos.z);
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  let best = null, bestD = Infinity;
  for (const en of enemies) {
    if (en.state === E.DEAD || en.state === E.FLEE) continue;
    const to = en.group.position.clone().sub(eye); to.y = 0;
    const d = to.length();
    if (d > range) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, to.normalize().dot(fwd)))) * 180 / Math.PI;
    if (ang > angleDeg) continue;
    if (d < bestD) { best = en; bestD = d; }
  }
  return best;
}

// 頭モードで乗り移れる死体（近接のみ。クロスヘアは見ない）
function findCorpseNearby() {
  if (state !== S.HEAD || headDead) return null;   // 潰れた頭は乗り移れない
  let best = null, bestD = Infinity;
  for (const c of corpses) {
    const d = playerPos.distanceTo(c.group.position);
    if (d <= CONFIG.corpseInteractDistance && d < bestD) { best = c; bestD = d; }
  }
  return best;
}

/* =========================================================
   腕の耐久
   近接ヒットと射撃で減る。0 で肉片になって消える（掴みフィニッシャーは減らない）
   ========================================================= */
function damageArm(side, amount) {
  const arm = player.arms[side];
  if (arm.lost) return;
  arm.hp = Math.max(0, arm.hp - amount);
  if (arm.hp <= 0) loseArm(side);
  updateArmVisuals();
}

function loseArm(side) {
  const arm = player.arms[side];
  arm.lost = true; arm.hp = 0;
  gunHold[side] = false;
  // 肉片は一人称の手の位置から散る
  const hand = fpHands[side];
  const at = new THREE.Vector3();
  hand.userData.fist.getWorldPosition(at);
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0.2, -Math.cos(yaw)).normalize();
  spawnFleshBurst(at, CONFIG.armLostPieces, 3.2, fwd);
  addShake(0.35);
  doFlash(0.35, '#ff6a5a');
  showFeedback(side[0] + ' ARM GONE', '#ff6b5e', 36);
}

// 両腕とも使えない（拳も銃もない）か
function noUsableArm() {
  return player.arms.LEFT.lost && player.arms.RIGHT.lost;
}

/* =========================================================
   ガード（Ctrl長押し）と被ダメージ
   体へのダメージ（敵の攻撃・死体の爆発・ボスのキック）は全部 damagePlayer() を通す。
   ガード中は guardDamageMul 倍にして、残っている腕それぞれに同じ量を入れる。
   体には入らない。両腕とも無ければガードにならず体へ入る。
   頭モードの出血は体のHPそのものなのでここを通さない。
   ========================================================= */
let guardBlend = 0;        // 構えの見た目(0-1)
let guardHitT = 0;         // ガードで受けた直後の腕の押し込み(s)

function guardHeld() { return !!(keys.ControlLeft || keys.ControlRight); }

// 毎フレーム、今ガードしているかを決める
function updateGuard(rdt) {
  let want = guardHeld() && state === S.HUMAN && player.hp > 0 && locked() && !manualOpen &&
             player.dodgeT <= 0 && player.stagger <= 0 && !inFinisher() && !tentHold;
  if (want && !player.guard && player.attack) {
    // 出している攻撃は振り抜き以降ならキャンセルして構える。発生中は振り抜くまで待つ
    if (canCancelNow()) cancelCurrentAction(); else want = false;
  }
  if (want && !player.guard) {
    // 構えた瞬間に、握っていたクリック（長押し・連射・先行入力）を捨てる
    punchBuffer = null;
    mouseHold.LEFT = null; mouseHold.RIGHT = null;
    gunHold.LEFT = false; gunHold.RIGHT = false;
  }
  player.guard = want;
  const target = want ? 1 : 0;
  const step = rdt / CONFIG.guardRaiseTime;
  guardBlend = guardBlend < target ? Math.min(target, guardBlend + step) : Math.max(target, guardBlend - step);
  if (guardHitT > 0) guardHitT = Math.max(0, guardHitT - rdt);
}

// 返り値: 'guard' = 腕が受けた / 'body' = 体（頭モードなら頭）が受けた
function damagePlayer(amount) {
  if (player.guard && state === S.HUMAN) {
    const sides = ['LEFT', 'RIGHT'].filter((s) => !player.arms[s].lost);
    if (sides.length) {
      const dmg = amount * CONFIG.guardDamageMul;
      // 先に出す。腕が壊れたときの「ARM GONE」が上に出るように
      showFeedback('GUARD  -' + Math.round(dmg), '#b8d4ee', 28);
      for (const s of sides) damageArm(s, dmg);
      guardHitT = 0.22;
      addHitstop(0.05);
      addShake(0.18);
      doFlash(0.18, '#9fc4e8');
      return 'guard';
    }
  }
  player.hp = Math.max(0, player.hp - amount);
  return 'body';
}

// ガードの一人称の構え。両腕を斜めに倒して顔の前で交差させる。
// dir は前腕の向き（カメラ基準）。左右で少しずらして X に重ねる
const GUARD_POSE = {
  // 交差点は画面の下寄り。顔の前に上げきると、構えたまま敵の動きが見えない
  LEFT: { pos: [-0.34, -0.40, -0.42], dir: [0.85, 0.40, -0.35] },
  RIGHT: { pos: [0.34, -0.36, -0.46], dir: [-0.85, 0.34, -0.40] },
};
const _gPos = new THREE.Vector3();
const _gDir = new THREE.Vector3();
const _gQ = new THREE.Quaternion();
const _gFwd = new THREE.Vector3(0, 0, -1);
function applyGuardPose(hand, side) {
  if (guardBlend <= 0) return;
  const g = guardBlend * guardBlend * (3 - 2 * guardBlend);
  const P = GUARD_POSE[side];
  _gDir.set(P.dir[0], P.dir[1], P.dir[2]).normalize();
  // 受けた直後は腕ごと手前へ押し込まれる
  _gPos.set(P.pos[0], P.pos[1] - guardHitT * 0.15, P.pos[2] + guardHitT * 0.35);
  _gPos.applyQuaternion(camera.quaternion).add(camera.position);
  _gQ.setFromUnitVectors(_gFwd, _gDir).premultiply(camera.quaternion);
  hand.position.lerp(_gPos, g);
  hand.quaternion.slerp(_gQ, g);
}

// 全画面にできなかった（断られた・Keyboard Lock の無いブラウザ）ときの保険。
// Ctrl+W がページに届かないので、遊んでいる間はブラウザに「閉じますか？」を出させる
window.addEventListener('beforeunload', (e) => {
  if (!locked()) return;
  e.preventDefault();
  e.returnValue = '';
});

/* =========================================================
   銃腕
   player.attack を占有しない（もう片方の腕のパンチと同時に撃てる）。
   撃てないのは人間モード以外・フィニッシャー中・ドッジ中・死亡時。
   ========================================================= */
function canShoot(side) {
  const arm = player.arms[side];
  return state === S.HUMAN && player.hp > 0 && !inFinisher() &&
         player.dodgeT <= 0 && !arm.lost && arm.kind === ARM.GUN && gunCool[side] <= 0;
}

function tryShoot(side) {
  if (!canShoot(side)) return;
  gunCool[side] = CONFIG.gunInterval;
  const eye = new THREE.Vector3(playerPos.x, playerPos.y + EYE - 0.15, playerPos.z);
  const fwd = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const offset = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    .multiplyScalar(side === 'LEFT' ? -0.28 : 0.28);
  spawnBullet(eye.add(offset).addScaledVector(fwd, 0.7), fwd, side);
  player.gunRecoil[side] = 1;
  addShake(0.06);
  damageArm(side, CONFIG.gunShotCost);
  asuraTrigger(side);     // 阿修羅：同じ側の追加の腕も続けて撃つ
}

// 弾を1発出す。本体の銃腕と阿修羅の追加の腕で共用
function spawnBullet(pos, dir, side, extra) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.38),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
  mesh.position.copy(pos);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  scene.add(mesh);
  projectiles.push({
    obj: mesh, side, kind: 'bullet', extra: !!extra,
    vel: dir.clone().multiplyScalar(CONFIG.gunBulletSpeed), travelled: 0, dead: false,
  });
}

/* --- 飛び道具の当たり判定に使う体の縦線分（足元からの高さ）---
   刺突（TENT_BODY_Y）と同じ見立て。足元を基準にしているので、
   触手で持ち上げられた敵・投げられて飛んでいる敵にもそのまま付いていく  */
const PROJ_BODY_LO = 0.95, PROJ_BODY_HI = 1.95;

/* --- 線分(p0→p1)と線分(q0→q1)の最短距離の二乗 ---
   弾は1フレームで0.7m以上進むので、点と点で見ると敵の横をすり抜ける。
   「弾が通った線分」と「体の縦線分」で見れば、速い弾でも空振りしない。
   _segHit.t は弾側のパラメータ(0-1)＝線分のどこで当たったか。
   手前に居る敵を優先するのに使う                                      */
const _segHit = { d2: 0, t: 0 };
function segSegDistSq(p0x, p0y, p0z, p1x, p1y, p1z,
                      q0x, q0y, q0z, q1x, q1y, q1z) {
  const ux = p1x - p0x, uy = p1y - p0y, uz = p1z - p0z;
  const vx = q1x - q0x, vy = q1y - q0y, vz = q1z - q0z;
  const wx = p0x - q0x, wy = p0y - q0y, wz = p0z - q0z;
  const a = ux * ux + uy * uy + uz * uz;
  const b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz;
  const e = vx * wx + vy * wy + vz * wz;
  const D = a * c - b * b;
  let sc = (D < 1e-8) ? 0 : (b * e - c * d) / D;
  sc = Math.max(0, Math.min(1, sc));
  // 端で打ち切ったぶん、相手側→自分側ともう一度取り直す（クランプ後の最短点）
  let tc = (c > 1e-8) ? (e + b * sc) / c : 0;
  tc = Math.max(0, Math.min(1, tc));
  sc = (a > 1e-8) ? Math.max(0, Math.min(1, (b * tc - d) / a)) : 0;
  const dx = wx + ux * sc - vx * tc;
  const dy = wy + uy * sc - vy * tc;
  const dz = wz + uz * sc - vz * tc;
  _segHit.d2 = dx * dx + dy * dy + dz * dz;
  _segHit.t = sc;
  return _segHit;
}

// もう片方の腕の触手で拘束している最中の敵か（＝腕を組み合わせて撃っているか）
function isPinnedByTentacle(en) {
  return !!(tentHold && tentHold.enemy === en && en.state === E.TETHER);
}

function resolveBullet(p, en) {
  // 触手で拘束している敵を撃つ＝腕の組み合わせの本線。
  // 動けない的を撃っているぶんダメージを上げて、組み合わせた見返りをはっきりさせる
  const pinned = isPinnedByTentacle(en);
  const dmg = CONFIG.gunDamage * (pinned ? CONFIG.gunTetherDamageMul : 1);
  applyDamage(en, dmg);
  // 拘束中は姿勢を奪えない（崩すと拘束が壊れる）が、スタンは溜まる。
  // 溜め切ってから離すと、その場で崩れて掴みに繋がる（releaseTentacle）
  applyStun(en, CONFIG.gunStun);
  // 当たった点で必ず肉片を飛ばす。血が出ないと「通っていない」と読まれる
  spawnFleshBurst(p.obj.position, pinned ? 4 : 2, 2.2, null, 0.4);
  // 1発ごとにのけぞらせると射撃だけで完封できるので、のけぞりは無し。回避判定だけ通す
  if (pinned) {
    addHitstop(CONFIG.gunTetherHitstop);
    addShake(0.18);
    doFlash(0.16, '#ffc2cf');
    showFeedback('PINNED SHOT  -' + Math.round(dmg), '#ff9bb0', 30);
  } else {
    addHitstop(0.02);
    showFeedback('SHOT  -' + Math.round(dmg), '#ffe9a0', 22);
  }
  // 阿修羅の追加の腕の弾は回避の判定に数えない（asuraHit と同じ理由）
  if (!p.extra) checkEnemyEscape(en);
}

function doPunch(side) {
  const arm = player.arms[side];
  if (arm.lost || arm.kind === ARM.GUN) return;   // 殴れない腕は先行入力もしない
  // まだキャンセルできない＝振り抜き前。捨てずに覚えておく（最後に押した側が勝つ）
  if (!canCancelNow()) { punchBuffer = { side, t: 0 }; return; }
  startPunch(side);
}

// 返り値: 実際にパージが出たか。
// 出なかったときに長押し側で「入力を消化した」ことにすると、
// パージもパンチも出ないまま入力が消える（ドッジ中・フィニッシャー中に長押しした場合）
function doPurge(side) {
  if (!canCancelNow()) return false;
  const arm = player.arms[side];
  if (arm.purged || arm.lost || arm.kind === ARM.GUN) return false;  // 銃腕は撃てない
  cancelCurrentAction();
  player.arms[side].purged = true;

  const eye = new THREE.Vector3(playerPos.x, playerPos.y + EYE - 0.15, playerPos.z);
  const fwd = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const offset = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    .multiplyScalar(side === 'LEFT' ? -0.3 : 0.3);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.17, 0.34),
    new THREE.MeshLambertMaterial({ color: COLOR_PLAYER_ARM }));
  mesh.position.copy(eye).add(offset);
  scene.add(mesh);
  projectiles.push({ obj: mesh, side, vel: fwd.clone().multiplyScalar(CONFIG.purgeSpeed), travelled: 0, dead: false });
  player.recoverT = CONFIG.punchRecover;
  updateArmVisuals();
  showFeedback('PURGE ' + side[0], '#a8d8ff', 26);
  return true;
}

function doKick() {
  // 溜めていたパンチは捨てる。押し直した本人の最新の意思を優先しないと、
  // 「パンチを溜めた直後にキックへ切り替えた」ときに先にパンチが出てしまい、
  // そのパンチの発生ぶんキックがさらに遅れる（先行入力が防御を殺す）
  punchBuffer = null;
  // 振り抜き以降のパンチ／キックは上書きできる。発生中とフィニッシャーは不可
  if (!canCancelNow() || player.guard) return;   // ガード中はキックも出さない
  if (player.resource < 1) { showFeedback('NO RESOURCE', '#8b8f88', 22); return; }
  cancelCurrentAction();
  player.resource -= 1;
  // ジャストかどうかは「押した瞬間」で確定させる。
  // 発生(kickStartup 0.12s)を待ってから見ると、敵の頭上の白い印（ジャスト）と
  // 正解タイミングが 0.12s ずれ、「表示を見てから押す」と間に合わなくなる。
  // ドッジ側は即時に見ているので、これで両方の正解が揃う。
  const justHits = new Set();
  for (const en of enemies) if (isJustTiming(en)) justHits.add(en);
  player.attack = {
    side: 'KICK', type: 'kick', t: 0,
    startup: CONFIG.kickStartup, resolved: false, justHits,
  };
}

function doDodge() {
  punchBuffer = null;          // 同上。ドッジに切り替えた以上、溜めたパンチは出さない
  // 振り抜き以降のパンチ／キックは上書きできる。ドッジ中とフィニッシャーは不可
  if (!canCancelNow()) return;
  const just = enemies.some((en) => isJustTiming(en));
  if (!just && player.resource < 1) { showFeedback('NO RESOURCE', '#8b8f88', 22); return; }
  cancelCurrentAction();
  if (just) {
    player.resource = Math.min(player.resMax, player.resource + 1);
    slowTimer = CONFIG.justDodgeSlowTime;
    slowScaleOverride = CONFIG.justDodgeSlowScale;
    showFeedback('JUST DODGE!', '#9ce8ff', 38);
    doFlash(0.25, '#9ce8ff');
  } else {
    player.resource -= 1;
  }
  const f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const r = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const dir = (f !== 0 || r !== 0)
    ? fwd.multiplyScalar(f).add(right.multiplyScalar(r)).normalize()
    : fwd.multiplyScalar(-1);
  player.dodgeDir.copy(dir);
  player.dodgeT = CONFIG.dodgeDuration;
  player.invuln = Math.max(player.invuln, CONFIG.dodgeDuration);
}

/* --- 蜘蛛脚の振り（切断と同時に再生される）--- */
function triggerLegSwing() {
  legSwing = { side: risingSlashSide, t: 0 };
  risingSlashSide = (risingSlashSide === 'LEFT') ? 'RIGHT' : 'LEFT'; // 左右交互に振る
}

function isJustTiming(en) {
  return en.state === E.WINDUP && en.t >= CONFIG.enemyWindup - CONFIG.enemyJustWindow;
}

function resolveAttack(atk) {
  if (atk.type === 'kick') {
    const en = findTargetEnemy(CONFIG.kickRange, CONFIG.kickAngle);
    if (!en) { showFeedback('WHIFF', '#6e7268', 22); return; }
    if (en.state === E.DODGE) { showFeedback('MISS', '#6e7268', 22); return; }
    resolveKick(en, atk);
    return;
  }
  // 触手の薙ぎ払いは「刃の通った帯」を毎フレーム見るので、ここでは何もしない
  // （判定は updateTentacleSweep）
  if (atk.tent) return;
  const en = findTargetEnemy(CONFIG.punchRange, CONFIG.punchAngle);
  if (!en) return;
  if (en.state === E.DODGE) { showFeedback('MISS', '#6e7268', 22); return; }
  resolvePunch(en, atk.side);
}

function resolvePunch(en, side) {
  // 死体のフリをしている男を殴った＝かくれんぼの先制攻撃
  if (en.boss && en.state === E.HIDDEN) {
    damageArm(side, CONFIG.armHitCost);
    bossFound(true);
    return;
  }
  const purged = player.arms[side].purged;
  const dmg = purged ? CONFIG.purgedArmDamage : CONFIG.attackDamage;
  const stun = purged ? CONFIG.purgedArmStun : CONFIG.attackStun;
  const attacking = (en.state === E.WINDUP || en.state === E.ACTIVE);

  // --- 掴みフィニッシャーへの分岐（パンチの延長。専用入力もUIもない）---
  // 拳のある腕で「スタン中の敵」を殴ったらダメージを入れる代わりに頭を掴んで潰す。
  // 倒すのは finisherCrush() 側。掴みはスタンの見返りなので、
  // ただHPを削り切っただけでは出さない（finisherOnKill:false）。
  // パージ済みの腕は掴めないので従来どおり弱攻撃（倒せば頭破裂の保険が働く）。
  // ボスは掴めない（掴みは即死なので3倍HPが意味を失う）。
  // スタンさせた見返りはライジングで腕を斬れること側に寄せてある
  if (!purged && !en.boss && en.state !== E.DEAD &&
      ((CONFIG.finisherOnStun && en.state === E.STUNNED) ||
       (CONFIG.finisherOnKill && en.hp - dmg <= 0))) {
    startFinisher(en, side);
    return;
  }

  applyDamage(en, dmg);
  applyStun(en, stun);

  if (attacking) {
    addHitstop(CONFIG.hitstopTrade);
    addShake(CONFIG.shakeNormal * 1.6);
    showFeedback('TRADE!', '#ffb45e', 30);
  } else if (en.state === E.TETHER) {
    // 片方の腕の触手で拘束している敵を、もう片方の拳で殴った。
    // のけぞらせない（位置は触手側が持っている）が、ダメージとスタンは入る
    addHitstop(CONFIG.hitstopNormal);
    addShake(CONFIG.shakeNormal);
    doFlash(0.16, '#ffc2cf');
    showFeedback('PINNED HIT  -' + Math.round(dmg), '#ff9bb0', 32);
  } else if (en.state !== E.DEAD && en.state !== E.STUNNED) {
    enterHitReact(en);
    addHitstop(CONFIG.hitstopNormal);
    addShake(CONFIG.shakeNormal);
    showFeedback(purged ? 'WEAK HIT' : 'HIT', purged ? '#8b8f88' : '#e8e4da', purged ? 22 : 26);
  } else {
    addHitstop(CONFIG.hitstopNormal);
    addShake(CONFIG.shakeNormal);
    showFeedback('HIT', '#e8e4da', 26);
  }
  // ヒットした近接だけ腕が削れる（空振りは減らない）。
  // 消えたときの表示がHITに上書きされないよう最後に呼ぶ
  damageArm(side, CONFIG.armHitCost);
  checkEnemyEscape(en);
}

function resolveKick(en, atk) {
  if (en.state === E.DEAD) return;
  if (en.boss && en.state === E.HIDDEN) { bossFound(true); return; }

  // 押した瞬間にジャスト窓に入っていたなら、
  // 発生までに敵が ACTIVE へ進んでいてもジャストキックにする。
  const wasJust = (atk && atk.justHits) ? atk.justHits.has(en) : isJustTiming(en);
  if (wasJust) {
    applyStun(en, CONFIG.kickJustStun);
    enterHitReact(en, 1.5);
    addHitstop(CONFIG.hitstopJustKick);
    addShake(CONFIG.shakeJustKick);
    doFlash(0.55, '#ffe9a0');
    showFeedback('JUST KICK!', '#ffd75e', 46);
    en.consecutiveHits = 0;
    return;
  }

  switch (en.state) {
    case E.WINDUP: {
      applyStun(en, CONFIG.kickInterruptStun);
      enterHitReact(en, 1.2);
      addHitstop(CONFIG.hitstopInterrupt);
      addShake(CONFIG.shakeInterrupt);
      doFlash(0.2, '#ffd9a0');
      showFeedback('INTERRUPT', '#ffb45e', 34);
      checkEnemyEscape(en);
      break;
    }
    case E.BOSS_RISE: {
      // 腕を刈りに来ているライジングは、キックだけが止められる
      applyStun(en, CONFIG.kickInterruptStun);
      en.riseDone = true;
      en.riseCd = CONFIG.bossRiseCooldown * 0.6;
      enterHitReact(en, 1.3, true);   // アーマーを貫く
      addHitstop(CONFIG.hitstopInterrupt);
      addShake(CONFIG.shakeInterrupt);
      doFlash(0.25, '#9ce8ff');
      showFeedback('ARM SAVED!', '#9ce8ff', 38);
      break;
    }
    case E.ACTIVE:
    case E.RECOVERY: {
      applyStun(en, CONFIG.kickStun);
      addHitstop(0.04);
      showFeedback('TOO LATE', '#6e7268', 28);
      break;
    }
    default: {
      applyStun(en, CONFIG.kickStun);
      if (en.state !== E.STUNNED) enterHitReact(en);
      addHitstop(CONFIG.hitstopNormal);
      addShake(CONFIG.shakeNormal);
      showFeedback('KICK', '#e8e4da', 26);
      checkEnemyEscape(en);
      break;
    }
  }
}

/* =========================================================
   掴みフィニッシャー
   resolvePunch() から自動で入る。プレイヤーは type:'finisher' の攻撃中として
   扱い（他のアクションでキャンセル不可・移動不可・無敵）、敵は GRABBED になる。
   進行は実時間(dt)で数え、ワールドだけ slowTimer でスローにする。
     [0, reach)            拳が頭へ伸びる
     [reach, reach+hold)   掴んで引き寄せる。頭が拳側へ寄る
     reach+hold            握り潰す → 頭破裂 → killEnemy()（首なし死体）
     (..., +recover)       硬直して拳が戻る
   ========================================================= */
const _fHead = new THREE.Vector3();
const _fTo = new THREE.Vector3();

function finisherTotal() {
  return CONFIG.finisherReach + CONFIG.finisherHold + CONFIG.finisherRecover;
}

function startFinisher(en, side) {
  setEnemyState(en, E.GRABBED);
  en.grabK = 0;
  en.tentGrab = false;       // 拳の掴み（握り潰す）。触手の引き抜きとは姿勢が違う
  en.consecutiveHits = 0;
  en.activeHitDone = false;
  en.parts.HEAD.getWorldPosition(_fHead);
  player.attack = {
    side, type: 'finisher', t: 0, enemy: en, crushed: false,
    lastHead: _fHead.clone(),   // 頭が消えたあとも拳の目標として使う
  };
  player.invuln = Math.max(player.invuln, finisherTotal());
  slowTimer = CONFIG.finisherReach + CONFIG.finisherHold;
  slowScaleOverride = CONFIG.finisherSlowScale;
  addHitstop(0.05);
  addShake(0.15);
  showFeedback('GRAB', '#ffd75e', 30);
}

// dt: 実時間（ヒットストップ中は0）
function updateFinisher(atk, dt) {
  const en = atk.enemy;
  const reach = CONFIG.finisherReach, hold = CONFIG.finisherHold;

  // 別の要因で敵が GRABBED でなくなった（リセットなど）ら潰す工程を飛ばして戻る
  if (!atk.crushed && en.state !== E.GRABBED) {
    atk.crushed = true;
    atk.t = Math.max(atk.t, reach + hold);
  }

  if (atk.t < reach) {
    const k = atk.t / reach;
    en.grabK = 1 - (1 - k) * (1 - k);
  } else if (atk.t < reach + hold) {
    en.grabK = 1;
    // 敵の体を腕の長さの距離まで引き寄せる／押し戻す
    // （実時間で動かすのでスローに引きずられない）。顔も正面に向かせる
    _fTo.copy(playerPos).sub(en.group.position); _fTo.y = 0;
    const d = _fTo.length();
    if (d > 0.001) {
      const diff = d - CONFIG.finisherPullDist;
      if (Math.abs(diff) > 0.01) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), CONFIG.finisherPullSpeed * dt);
        en.group.position.addScaledVector(_fTo.clone().divideScalar(d), step);
      }
      const targetYaw = Math.atan2(_fTo.x, _fTo.z);
      let dy = targetYaw - en.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      en.group.rotation.y += dy * Math.min(1, dt * 14);
    }
    // 頭を拳の側（敵ローカル+Z＝プレイヤー側）へ引っ張る。潰す直前ほど強く
    const k = (atk.t - reach) / hold;
    const tug = Math.sin(clock.elapsedTime * 38) * 0.03 * k;
    en.parts.HEAD.position.set(tug, 2.12 - 0.15 * k, 0.25 * k);
    en.parts.HEAD.getWorldPosition(atk.lastHead);
  } else if (!atk.crushed) {
    finisherCrush(atk);
  }

  if (atk.t >= finisherTotal()) player.attack = null;
}

function finisherCrush(atk) {
  atk.crushed = true;
  const en = atk.enemy;
  if (en.state !== E.GRABBED) return;

  en.parts.HEAD.getWorldPosition(_fHead);
  atk.lastHead.copy(_fHead);
  // 破片は自分から離れる向きへ。顔に飛んでこないので視界が汚れない
  _fTo.copy(en.group.position).sub(playerPos); _fTo.y = 0;
  if (_fTo.lengthSq() < 0.001) _fTo.set(0, 0, 1);
  _fTo.normalize();
  spawnHeadBurst(_fHead, CONFIG.finisherBurstSpeedMul, _fTo);

  // 頭は破裂済みとして倒す。killEnemy() は headless なら破裂を重ねない
  en.headless = true;
  en.parts.HEAD.visible = false;
  en.parts.HEAD.position.set(0, 2.12, 0);
  en.grabK = 0;
  applyDamage(en, 999);

  addHitstop(CONFIG.finisherHitstop);
  addShake(CONFIG.finisherShake);
  doFlash(0.9, '#ffd0c0');
  showFeedback('CRUSHED', '#ff8f7a', 50);   // killEnemy() の DOWN を上書き
}

/* =========================================================
   敵ロジック
   ========================================================= */
function applyDamage(en, dmg) {
  if (en.state === E.DEAD || en.state === E.FLEE) return;
  en.hp -= dmg;
  en.hitFlash = 0.12;
  if (en.hp <= 0) {
    en.hp = 0;
    // ボスは死体にならない。首が伸びてダクトへ逃げる
    if (en.boss) bossDefeated(en); else killEnemy(en);
  }
}

function applyStun(en, v) {
  if (en.state === E.DEAD || en.state === E.STUNNED || en.state === E.GRABBED) return;
  // 投げられて飛んでいる間は崩れない。投げの着地で改めてスタンさせる
  if (en.state === E.THROWN) return;
  // 触手で拘束中も崩れない（位置を触手側が持っているので、ここでスタン姿勢に
  // 入れると拘束が壊れる）。ただし溜まったスタンは残す＝もう片方の腕で
  // 削ったぶんが、離した／投げた後の「崩れる」に繋がる
  if (en.state === E.TETHER) {
    en.stun = Math.min(CONFIG.enemyStunThreshold - 1, en.stun + v);
    return;
  }
  en.stun += v;
  if (en.stun >= CONFIG.enemyStunThreshold) {
    en.stun = CONFIG.enemyStunThreshold;
    // アーマー中はその場で崩れない。溜まったスタンは技を出し切ってから効く
    // （updateBossState が技の終わりで拾う）
    if (en.state === E.BOSS_KICK || en.state === E.BOSS_RISE) return;
    enterStun(en);
  }
}

function setEnemyState(en, s) { en.state = s; en.t = 0; }

function enterHitReact(en, scale, force) {
  if (en.state === E.DEAD || en.state === E.STUNNED || en.state === E.GRABBED) return;
  if (en.state === E.TETHER || en.state === E.THROWN) return;   // 同上
  // ダクトの男のキック／腕狩りはパンチでは崩れない。
  // これが無いと、パンチの発生(0.08s)がキックの発生(0.22s)より速いので、
  // 潰しに来たキックが必ず自分のパンチで潰し返され、一度も成立しない。
  // 崩せるのはキック（resolveKick が force で呼ぶ）だけ
  if ((en.state === E.BOSS_KICK || en.state === E.BOSS_RISE) && !force) return;
  en.hitReactScale = scale || 1;
  setEnemyState(en, E.HIT);
  const away = en.group.position.clone().sub(playerPos); away.y = 0;
  if (away.lengthSq() > 0.001) en.group.position.add(away.normalize().multiplyScalar(0.35 * (scale || 1)));
}

function enterStun(en) {
  setEnemyState(en, E.STUNNED);
  shoveAwayFrom(en);
  showFeedback('STUN!', '#ffe98a', 34);
  addShake(0.2);
}

// スタンした敵に重なっている敵を押しのけて、□が重ならない距離を作る。
// 動かすのは周りだけ。スタンさせた本人はプレイヤーが狙っている的なので動かさない。
const _shoveAway = new THREE.Vector3();
function shoveAwayFrom(src) {
  for (const en of enemies) {
    if (en === src) continue;
    // 死体／掴み中／ボスの armor 技は動かさない（見た目と判定が破綻する）
    if (en.state === E.DEAD || en.state === E.GRABBED ||
        en.state === E.TETHER || en.state === E.THROWN ||
        en.state === E.HIDDEN || en.state === E.FLEE ||
        en.state === E.BOSS_KICK || en.state === E.BOSS_RISE) continue;
    _shoveAway.copy(en.group.position).sub(src.group.position); _shoveAway.y = 0;
    const d = _shoveAway.length();
    if (d > CONFIG.stunShoveRadius) continue;
    if (d < 0.001) {
      // ぴったり重なっていると逃げる向きが決まらないので、
      // プレイヤーから見た左右どちらかへ逃がす（奥/手前だと画面上で分かれない）
      _shoveAway.copy(src.group.position).sub(playerPos); _shoveAway.y = 0;
      if (_shoveAway.lengthSq() < 0.001) _shoveAway.set(0, 0, 1);
      _shoveAway.normalize();
      _shoveAway.set(_shoveAway.z, 0, -_shoveAway.x);
      if (Math.random() < 0.5) _shoveAway.negate();
    } else _shoveAway.divideScalar(d);
    // 近いほど強く。ちょうど stunShoveRadius まで離す量に抑える
    en.shoveDir.copy(_shoveAway);
    en.shoveLeft = Math.min(CONFIG.stunShoveRadius - d, CONFIG.stunShoveMax);
    // 状態は触らない。振りかぶっていた敵はそのまま振るが、
    // 離された分 hitPlayer() の距離チェックで空振りする。
    // ここで中断までさせると、スタンの見返りが
    // 「ライジングで腕を斬れる」以外にも広がってしまう
  }
}

// 押しのけの消化。残り距離を指数で詰めるので、最初に速く・最後にすっと止まる。
// dt は実時間。スタンの直後にQを押されても、スローに引きずられて
// □がゆっくり滑るのを防ぐ（フィニッシャーの引き寄せと同じ理屈）
function updateShove(en, dt) {
  if (en.shoveLeft <= 0) return;
  const step = en.shoveLeft * (1 - Math.exp(-dt / CONFIG.stunShoveEase));
  en.group.position.addScaledVector(en.shoveDir, step);
  en.shoveLeft -= step;
  if (en.shoveLeft < 0.01) en.shoveLeft = 0;
}

function killEnemy(en) {
  setEnemyState(en, E.DEAD);
  en.fallT = 0;
  en.glow.material.opacity = 0;

  // 頭が破裂し、残った体はその場に「死体」として置き換わる。
  // これで倒した敵の体を奪える。
  const burstAt = new THREE.Vector3();
  (en.headless ? en.torso : en.head).getWorldPosition(burstAt);
  if (!en.headless) {
    spawnHeadBurst(burstAt);
    en.headless = true;
    en.parts.HEAD.visible = false;
  }
  en.group.visible = false;
  createCorpse(en.group.position.x, en.group.position.z, en.group.rotation.y,
    { enemyStyle: true, arms: armsFromEnemy(en), fuse: CONFIG.corpseFuse });

  addHitstop(0.18);
  addShake(0.5);
  doFlash(0.45, '#ffd0c0');
  showFeedback('DOWN', '#ff8f7a', 32);
}

function checkEnemyEscape(en) {
  if (en.state === E.DEAD || en.state === E.STUNNED || en.state === E.GRABBED) return;
  if (en.state === E.TETHER || en.state === E.THROWN) return;
  if (en.state === E.BOSS_KICK || en.state === E.BOSS_RISE ||
      en.state === E.HIDDEN || en.state === E.FLEE) return;
  en.consecutiveHits++;
  if (en.consecutiveHits >= CONFIG.enemyDodgeForceHits || Math.random() < CONFIG.enemyDodgeChance) {
    en.consecutiveHits = 0;
    const away = en.group.position.clone().sub(playerPos); away.y = 0;
    if (away.lengthSq() < 0.001) away.set(0, 0, 1);
    en.dodgeDir.copy(away.normalize());
    setEnemyState(en, E.DODGE);
  }
}

// ライジング中は敵の足を止める。
// スローがかかっていても寄ってきるのは変わらないので、
// 斬っている最中に別の敵が重なりに来て、□が団子になってしまう。
// 止めるのは移動だけ。攻撃はスローのまま進むので、遅い時間の緊張は残る。
// 押しのけ（updateShove）も止めない——あれは重なりをほどく側の動きだから
function enemiesHalted() {
  return state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT;
}

function updateEnemy(en, wdt, rdt) {
  en.t += wdt;
  if (en.hitFlash > 0) en.hitFlash -= wdt;
  if (en.smashCd > 0) en.smashCd -= rdt;   // 触手の衝突クールダウンは実時間
  if (en.state !== E.STUNNED && en.state !== E.DEAD && en.state !== E.GRABBED &&
      en.state !== E.TETHER && en.state !== E.THROWN &&
      en.state !== E.BOSS_KICK && en.state !== E.BOSS_RISE) {
    // アーマー中は減らさない。止められない技の最中に入れたスタンが
    // そのまま蒸発すると、殴り返す意味が完全に無くなる
    en.stun = Math.max(0, en.stun - CONFIG.enemyStunDecay * wdt);
  }
  if (en.state !== E.DEAD && en.state !== E.GRABBED &&
      en.state !== E.TETHER && en.state !== E.THROWN) updateShove(en, rdt);

  const toPlayer = playerPos.clone().sub(en.group.position); toPlayer.y = 0;
  const dist = toPlayer.length();
  if (dist > 0.001 && en.state !== E.DEAD && en.state !== E.THROWN &&
      en.state !== E.HIDDEN && en.state !== E.FLEE) {
    const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
    en.group.rotation.y += (targetYaw - en.group.rotation.y) * Math.min(1, wdt * 6);
  }

  // ダクトの男だけの状態（キック割り込み／腕狙いのライジング／隠れ／逃走）
  if (en.boss && updateBossState(en, wdt)) {
    updateEnemyVisual(en, wdt);
    updateBossRig(en, wdt);
    return;
  }

  switch (en.state) {
    case E.IDLE:
    case E.MOVE: {
      en.cooldown -= wdt;
      // 自分の部屋にプレイヤーがいないときは追わず、初期位置へ歩いて戻る
      if (en.room && !playerInRoom(en.room)) {
        const toHome = en.home.clone().sub(en.group.position); toHome.y = 0;
        const hd = toHome.length();
        if (hd > 0.1) {
          setEnemyStateSoft(en, E.MOVE);
          if (!enemiesHalted()) {
            const step = Math.min(CONFIG.enemyMoveSpeed * wdt, hd);
            en.group.position.add(toHome.normalize().multiplyScalar(step));
          }
        } else setEnemyStateSoft(en, E.IDLE);
        break;
      }
      if (dist > CONFIG.enemyAttackRange) {
        setEnemyStateSoft(en, E.MOVE);
        if (!enemiesHalted()) {
          const step = Math.min(CONFIG.enemyMoveSpeed * wdt, dist - CONFIG.enemyAttackRange + 0.05);
          en.group.position.add(toPlayer.normalize().multiplyScalar(step));
        }
      } else {
        setEnemyStateSoft(en, E.IDLE);
        if (en.cooldown <= 0) setEnemyState(en, E.WINDUP);
      }
      break;
    }
    case E.WINDUP: if (en.t >= CONFIG.enemyWindup) setEnemyState(en, E.ACTIVE); break;
    case E.ACTIVE: {
      if (!en.activeHitDone) { en.activeHitDone = true; hitPlayer(en); }
      if (en.t >= CONFIG.enemyActive) { en.activeHitDone = false; setEnemyState(en, E.RECOVERY); }
      break;
    }
    case E.RECOVERY:
      if (en.t >= CONFIG.enemyRecovery) { en.cooldown = CONFIG.enemyAttackCooldown; setEnemyState(en, E.IDLE); }
      break;
    case E.HIT:
      if (en.t >= CONFIG.enemyHitReactTime * (en.hitReactScale || 1)) {
        en.cooldown = Math.max(en.cooldown, 0.5);
        en.activeHitDone = false;
        setEnemyState(en, E.IDLE);
      }
      break;
    case E.DODGE: {
      const k = Math.min(1, en.t / CONFIG.enemyDodgeTime);
      if (!enemiesHalted()) {
        const step = CONFIG.enemyDodgeDistance * wdt / CONFIG.enemyDodgeTime * (1 - k * 0.5);
        en.group.position.add(en.dodgeDir.clone().multiplyScalar(step));
      }
      if (en.t >= CONFIG.enemyDodgeTime) { en.cooldown = 0.6; setEnemyState(en, E.IDLE); }
      break;
    }
    case E.STUNNED:
      // ライジング中はスタンが解けない（切っている途中で演出が切れるのを防ぐ）
      if (state === S.HUMAN && en.t >= CONFIG.enemyStunDuration) {
        en.stun = 0; en.consecutiveHits = 0; en.cooldown = 1.0;
        setEnemyState(en, E.IDLE);
      }
      break;
    case E.GRABBED:
      // 掴まれている間は何もしない。進行と解放は updateFinisher() が持つ
      break;
    case E.TETHER:
      // 触手に刺されている間は何もしない。位置と解放は updateTentacle() が持つ
      break;
    case E.THROWN:
      // 投げられて飛んでいる。落下と着地は実時間で見る（スローに引きずられると
      // 「投げた」勢いが死ぬ）
      updateThrownEnemy(en, rdt);
      break;
    case E.DEAD: en.fallT = Math.min(1, en.fallT + wdt * 2.2); break;
  }
  updateEnemyVisual(en, wdt);
  if (en.boss) updateBossRig(en, wdt);
}

function setEnemyStateSoft(en, s) { if (en.state !== s) { en.state = s; en.t = 0; } }

function hitPlayer(en) {
  if (playerPos.distanceTo(en.group.position) > CONFIG.enemyAttackRange + 0.8) return;
  if (player.invuln > 0) {
    if (!inFinisher()) showFeedback('DODGE', '#9ce8ff', 24);  // 掴み中の無敵は無言
    return;
  }
  if (damagePlayer(CONFIG.enemyDamageToPlayer + (en.bonusDamage || 0)) === 'guard') return;
  doFlash(0.4, '#ff3b30');
  addShake(0.3);
  addHitstop(0.05);
  if (player.hp <= 0) showFeedback('YOU DOWN — [G] RESET', '#ff6b5e', 30);
}

function updateEnemyVisual(en, wdt) {
  const p = en.pivotRoot;
  const sway = Math.sin(worldTime * 0.8 + en.swayPhase) * 0.03;

  if (en.state === E.DEAD) {
    p.rotation.x += (-Math.PI / 2 - p.rotation.x) * Math.min(1, wdt * 6);
    p.position.y += (0.05 - p.position.y) * Math.min(1, wdt * 6);
    p.rotation.z += (0 - p.rotation.z) * Math.min(1, wdt * 6);
  } else if (en.state === E.HIT) {
    const k = 1 - Math.min(1, en.t / (CONFIG.enemyHitReactTime * (en.hitReactScale || 1)));
    p.rotation.x = -0.45 * k * (en.hitReactScale || 1);
    p.rotation.z = 0.12 * k;
    p.position.y = 0;
  } else if (en.state === E.STUNNED) {
    p.rotation.x += (0.35 - p.rotation.x) * Math.min(1, wdt * 8);
    p.rotation.z = Math.sin(worldTime * 4 + en.swayPhase) * 0.12;
    p.position.y = Math.sin(worldTime * 3) * 0.03;
  } else if (en.state === E.GRABBED && en.tentGrab) {
    // 触手が頭に刺さって引っ張られている。拳の掴みより深く前のめりになり、
    // 引かれるぶん踵が浮く（拳は逆に押し込まれて沈む）。
    // 掴み返そうとして腕が頭の方へ上がる
    const g = en.grabK;
    p.rotation.x = 0.30 + (CONFIG.tentFinLean - 0.30) * g;
    p.rotation.z = Math.sin(clock.elapsedTime * 27) * 0.10 * g;
    p.position.y = 0.10 * g;
    for (const s of ['LEFT', 'RIGHT']) {
      const arm = en.parts[s];
      if (arm.parent === p) {
        arm.rotation.x += (-1.5 * g - arm.rotation.x) * 0.25;
        arm.rotation.z = Math.sin(clock.elapsedTime * 19 + (s === 'LEFT' ? 0 : 2.1)) * 0.32 * g;
      }
    }
  } else if (en.state === E.GRABBED) {
    // 頭を掴まれて前のめりに引きずられる。grabK は実時間で進むのでスローでも遅れない
    const g = en.grabK;
    p.rotation.x = 0.35 + (CONFIG.finisherLean - 0.35) * g;
    p.rotation.z = Math.sin(clock.elapsedTime * 34) * 0.05 * g;
    p.position.y = -0.04 * g;
    for (const s of ['LEFT', 'RIGHT']) {
      const arm = en.parts[s];
      if (arm.parent === p) arm.rotation.x += (-0.5 * g - arm.rotation.x) * 0.25;  // 腕がばたつく
    }
  } else if (en.state === E.TETHER) {
    // 触手に刺されて暴れている。前のめりで手足がばたつく。
    // 実時間(clock)で震わせるので、拘束中の体感がスローに引きずられない
    p.rotation.x += (0.30 - p.rotation.x) * Math.min(1, wdt * 10);
    p.rotation.z = Math.sin(clock.elapsedTime * 21 + en.swayPhase) * 0.18;
    p.position.y = 0;
    for (const s of ['LEFT', 'RIGHT']) {
      const arm = en.parts[s];
      if (arm.parent === p) {
        arm.rotation.x = -0.9 + Math.sin(clock.elapsedTime * 17 + (s === 'LEFT' ? 0 : 2.1)) * 0.7;
      }
    }
  } else if (en.state === E.THROWN) {
    // 投げられて回転しながら飛ぶ。角度は巻き戻して溜め込まない
    p.rotation.x = (p.rotation.x + (en.throwSpin || 7) * wdt) % (Math.PI * 2);
    p.rotation.z = Math.sin(clock.elapsedTime * 9) * 0.4;
    p.position.y = 0;
  } else if (en.state === E.WINDUP) {
    const k = Math.min(1, en.t / CONFIG.enemyWindup);
    p.rotation.x += (-0.22 * k - p.rotation.x) * Math.min(1, wdt * 10);
    p.rotation.z = 0; p.position.y = 0;
    for (const s of ['LEFT', 'RIGHT']) {
      const arm = en.parts[s];
      if (arm.parent === p) arm.rotation.x = -1.4 * k;
    }
  } else if (en.state === E.ACTIVE) {
    p.rotation.x += (0.5 - p.rotation.x) * Math.min(1, wdt * 30);
    for (const s of ['LEFT', 'RIGHT']) {
      const arm = en.parts[s];
      if (arm.parent === p) arm.rotation.x = 0.9;
    }
  } else if (en.state === E.DODGE) {
    p.rotation.x += (-0.3 - p.rotation.x) * Math.min(1, wdt * 12);
  } else if (en.state === E.BOSS_KICK) {
    // 踏み込んで蹴る。腕は後ろへ振る
    const k = Math.min(1, en.t / CONFIG.bossKickStartup);
    p.rotation.x += (0.55 * k - p.rotation.x) * Math.min(1, wdt * 26);
    p.position.y = -0.10 * k;
    for (const sd of ['LEFT', 'RIGHT']) {
      const arm = en.parts[sd];
      if (arm.parent === p) arm.rotation.x += (0.7 - arm.rotation.x) * Math.min(1, wdt * 16);
    }
  } else if (en.state === E.BOSS_RISE) {
    // 首を伸ばして反り返る。腕は下げたまま（刈るのは刃）
    p.rotation.x += (-0.16 - p.rotation.x) * Math.min(1, wdt * 8);
    p.rotation.z = Math.sin(worldTime * 9) * 0.03;
    p.position.y += (0 - p.position.y) * Math.min(1, wdt * 8);
    for (const sd of ['LEFT', 'RIGHT']) {
      const arm = en.parts[sd];
      if (arm.parent === p) arm.rotation.x += (0 - arm.rotation.x) * Math.min(1, wdt * 8);
    }
  } else if (en.state === E.HIDDEN || en.state === E.FLEE) {
    // 姿勢はボス側（かくれんぼ／ジャンプスケア／逃走）が持つので触らない
  } else {
    p.rotation.x += (0 - p.rotation.x) * Math.min(1, wdt * 8);
    p.rotation.z += (sway - p.rotation.z) * Math.min(1, wdt * 6);
    p.position.y += (0 - p.position.y) * Math.min(1, wdt * 8);
    for (const s of ['LEFT', 'RIGHT']) {
      const arm = en.parts[s];
      if (arm.parent === p) arm.rotation.x += (0 - arm.rotation.x) * Math.min(1, wdt * 8);
    }
  }

  en.torso.material.color.setHex(en.hitFlash > 0 ? 0xffffff : en.torsoColor);

  // スタン中の頭の赤い光（人間モード＋一定距離以内のみ）
  let glowOpacity = 0;
  if (en.state === E.STUNNED && !en.headless) {
    // 赤い光 = この距離ならQでライジングに入れる、という合図
    const near = playerPos.distanceTo(en.group.position) <= CONFIG.risingInteractRange;
    if (near || state !== S.HUMAN) {
      glowOpacity = 0.45 + Math.sin(worldTime * 7) * 0.18;
      en.headMat.color.setHex(0xff5544);
    } else en.headMat.color.setHex(en.headColor);
  } else en.headMat.color.setHex(en.headColor);
  en.glow.material.opacity += (glowOpacity - en.glow.material.opacity) * 0.3;
}

/* =========================================================
   ライジングモード（RISING）
   ・Qを押している間だけ。発動条件はない
   ・スロー＋その場に固定（移動はオミット）・蜘蛛脚は□を狙ったときだけ頭から出る
   ========================================================= */
function startRising() {
  punchBuffer = null;          // 同上
  // ライジングもキャンセル行動。振り抜き以降のパンチ／キックから直接入れる
  if (!canCancelNow()) return;
  cancelCurrentAction();
  state = S.RISE_IN;
  selectedTarget = null;
  spineGroup.visible = true;
  riseCamT = 0;
  showFeedback('RISING', '#ffe98a', 26);
}

// 浮いている部位に一斉落下時刻をセットする。
// ライジングを抜ける経路はQを離す・頭モードへ・乗っ取りの3つあるので、
// どれから1つでも漏れると部位が永久に浮いたままになる。
function scheduleSeveredDrop() {
  const dropAt = worldTime + CONFIG.partFloatDuration;
  for (const p of severedParts) if (p.dropAt === null) p.dropAt = dropAt;
}

function exitRising() {
  state = S.RISE_OUT;
  selectedTarget = null;
  hideTargets();
  legSwing = null;
  scheduleSeveredDrop();
}

function finishRising() {
  state = S.HUMAN;
  spineGroup.visible = false;
  risingBlend = 0;
}

/* =========================================================
   頭モード（HEAD）
   ライジング中にSpaceで脊柱から下を切り離す。
   切り離した体はその場に死体として残る。
   ========================================================= */
function enterHeadMode() {
  if (state !== S.RISE_IN && state !== S.RISING) return;
  // 体は立っていた場所に残る。
  // 死体はローカル+Z側へ脚を投げ出すので（敵の rotation.y と同じ向き）、
  // プレイヤーの前方（ローカル-Z）に合わせるには yaw を反転させる。
  // これを忘れると脚が後ろへ伸び、後方へ退いた頭を巻き込む。
  // 捨てた体は導火線付き。放っておくと爆発するので
  //   ・置き土産の爆弾として使える
  //   ・「捨てて拾い直して全快」を無限に繰り返せなくなる
  // 導火線は敵の死体と同じ corpseFuse。
  // hp を持たせるので、拾い直しても捨てた時点のHPまでしか戻らない
  // （「捨てて拾い直すだけで全快」の無限ループ潰し）
  createCorpse(playerPos.x, playerPos.z, yaw + Math.PI, {
    arms: { LEFT: cloneArmState(player.arms.LEFT), RIGHT: cloneArmState(player.arms.RIGHT) },
    fuse: CONFIG.corpseFuse, hp: player.hp,
    skill: player.skill,                 // 使用済みかどうかも体と一緒に残る
    resMax: player.resMax, resource: player.resource,   // リソースの数と残りも体に残る
    extraArms: stashAsuraArms(),         // 阿修羅の腕は体に付いたまま（拾い直すと生え直す）
  });
  // 頭は後ろへ跳ぶ。同じ座標のままだと自分の死体の中に埋まり、
  // 切り離した直後の一番見せたい瞬間が死体で埋まってしまう。
  playerPos.x += Math.sin(yaw) * CONFIG.headDetachBack;
  playerPos.z += Math.cos(yaw) * CONFIG.headDetachBack;
  scheduleSeveredDrop();
  cancelArmGrafts();   // 体を捨てるので、吸着途中の腕は破棄する
  state = S.HEAD;
  headH = EYE + CONFIG.spineLength * risingBlend;
  headVy = CONFIG.headDetachPop;
  headGrounded = false;
  // 頭は満タンの100から出血で減る（headBleedDuration 秒で死ぬ）。
  // 体を捨てた時点でそれまでの体のダメージは切り離されている、という扱い
  player.hp = CONFIG.playerMaxHp;
  headBleedT = 0; headDead = false; bleedDist = 0; bleedTicks = 0;
  lastBleedPos.set(playerPos.x, 0, playerPos.z);
  risingBlend = 1;               // 脊柱はしっぽとして伸びたまま
  selectedTarget = null;
  hideTargets();
  slowTimer = 0;                 // 頭モードは等速で動かす
  legSwing = null;
  addShake(0.35);
  doFlash(0.30, '#9ce8ff');
  showFeedback('HEAD DETACHED', '#9ce8ff', 32);
}

function updateHeadMode(dt) {
  // 上がりは高く、落ちは速く。ふわっとさせないために重力を分けている
  const g = (headVy > 0) ? CONFIG.headGravity : CONFIG.headFallGravity;
  headVy -= g * dt;
  headH += headVy * dt;
  const wasAirborne = !headGrounded;
  if (headH <= CONFIG.headRestHeight) {
    headH = CONFIG.headRestHeight;
    headVy = 0;
    // 着地の飛沫。跳んで降りたところにも跡が残る
    if (wasAirborne && !headDead) spawnBloodDecal(playerPos.x, playerPos.z, 0.30, 0.55);
    headGrounded = true;
  } else headGrounded = false;

  if (!headDead) updateHeadBleed(dt);
}

/* 頭モードの出血。
   時間制限ではなくHPで死ぬ。100を headBleedDuration(10s) で使い切るよう
   headBleedTick(0.25s) ごとに 2.5 ずつ減り、敵の攻撃はそこに上乗せされる。
   → 何も食らわなければちょうど10秒、殴られればそのぶん早い。          */
function updateHeadBleed(dt) {
  if (player.hp <= 0) { killPlayerHead(); return; }   // 敵の攻撃や爆発で0になった場合

  const perTick = CONFIG.playerMaxHp / (CONFIG.headBleedDuration / CONFIG.headBleedTick);
  headBleedT += dt;
  while (headBleedT >= CONFIG.headBleedTick) {
    headBleedT -= CONFIG.headBleedTick;
    player.hp = Math.max(0, player.hp - perTick);
    // 滴り。止まっているときは1秒に1滴だけ（同じ場所に重ねても情報が増えず、
    // bloodDecalMax を食って肝心の軌跡を押し出してしまう）
    bleedTicks++;
    const still = Math.hypot(playerPos.x - lastBleedPos.x, playerPos.z - lastBleedPos.z) < 0.01;
    if (!still || bleedTicks % 4 === 0) {
      spawnBloodDecal(playerPos.x, playerPos.z, 0.09 + Math.random() * 0.05, 0.45);
    }
    if (player.hp <= 0) { killPlayerHead(); return; }
  }

  // 移動した軌跡。HPが減るほど間隔が詰まり、跡が濃く大きくなる
  const k = 1 - player.hp / CONFIG.playerMaxHp;
  const step = CONFIG.bloodDecalStepFar +
               (CONFIG.bloodDecalStepNear - CONFIG.bloodDecalStepFar) * k;
  bleedDist += Math.hypot(playerPos.x - lastBleedPos.x, playerPos.z - lastBleedPos.z);
  lastBleedPos.set(playerPos.x, 0, playerPos.z);
  if (bleedDist >= step) {
    bleedDist = 0;
    spawnBloodDecal(playerPos.x, playerPos.z, 0.13 + k * 0.12, 0.40 + k * 0.35);
  }
}

// 頭モードでHPが0になった＝そこで終わり。乗っ取りも移動もできない
function killPlayerHead() {
  if (headDead) return;
  headDead = true;
  player.hp = 0;
  spawnHeadBurst(headPos, 1.2);
  spawnBloodDecal(playerPos.x, playerPos.z, 0.60, 0.85);
  addShake(0.6); addHitstop(0.08);
  doFlash(0.5, '#ff3b30');
  showFeedback('YOU DIED — [G] RESET', '#ff6b5e', 34);
}

/* =========================================================
   死体への乗っ取り（POSSESS）
   脊柱を首元に突き刺してから首が体に装着される。
   ========================================================= */
function startPossess(c) {
  if (!c) return;
  if (c === BOSS.hideBody) { bossFound(false); return; }   // 掘り当てた
  if (player.hp <= 0) return;                 // 潰れた頭は乗り移れない
  if (state !== S.HEAD && state !== S.RISE_IN && state !== S.RISING) return;
  c.fuse = null;                 // 乗っ取り開始で爆発は止まる
  setCorpseBlink(c, false, 0);
  possess = { corpse: c, t: 0, from: headPos.clone(), stabbed: false };
  possessHeadPos.copy(headPos);
  scheduleSeveredDrop();
  state = S.POSSESS;
  selectedTarget = null;
  hideTargets();
  spineGroup.visible = true;
  showFeedback('POSSESS', '#ffd75e', 30);
}

const _neckW = new THREE.Vector3();
function updatePossess(dt) {
  const p = possess, T = CONFIG.possessDuration;
  p.t += dt;
  const k = Math.min(1, p.t / T);
  p.corpse.neck.getWorldPosition(_neckW);
  const above = _neckW.clone(); above.y += 0.52;   // 突き刺す直前の位置
  const seated = _neckW.clone(); seated.y += 0.24; // 装着完了位置

  if (k < CONFIG.possessStabAt) {
    const u = k / CONFIG.possessStabAt;
    const e = u * u * (3 - 2 * u);                 // 首が飛んでいく
    possessHeadPos.lerpVectors(p.from, above, e);
  } else {
    if (!p.stabbed) {
      p.stabbed = true;
      addHitstop(0.10); addShake(0.40);
      doFlash(0.40, '#ffd0c0');
    }
    const u = (k - CONFIG.possessStabAt) / (1 - CONFIG.possessStabAt);
    possessHeadPos.lerpVectors(above, seated, u * u * (3 - 2 * u));
  }
  if (k >= 1) finishPossess();
}

function finishPossess() {
  const c = possess.corpse;
  playerPos.set(c.group.position.x, 0, c.group.position.z);
  removeCorpse(c);
  possess = null;
  state = S.HUMAN;
  risingBlend = 0;
  headH = 0; headVy = 0; legDeploy = 0;
  headBleedT = 0; headDead = false; bleedDist = 0;
  spineGroup.visible = false;
  spiderGroup.visible = false;
  // 敵の死体や無傷の体に乗り移れば全快。腕は死体が持っていたものをそのまま引き継ぐ
  // （敵の死体ならフルHPの敵腕、斬って奪った側は欠けている。自分の捨てた体なら元のまま）。
  // 自分が捨てた体だけは c.hp ＝ 捨てた時点のHPで復帰する。
  // 全快させると「捨てて拾い直す」だけで無限に回復できてしまい、
  // 頭モードに入るリスクが消えてライジングの選択が全部これに吸われる。
  // 捨てるのは生きている間だけなので c.hp は必ず1以上＝行き止まりにはならない。
  const ownBody = (c.hp !== null);
  player.hp = ownBody ? Math.max(1, Math.min(CONFIG.playerMaxHp, c.hp)) : CONFIG.playerMaxHp;
  for (const key of ['LEFT', 'RIGHT']) {
    const a = c.arms[key];
    player.arms[key] = a ? cloneArmState(a) : makeArmState(ARM.FIST, { lost: true });
  }
  // 体スキルも体と一緒に入れ替わる。阿修羅を使った自分の体なら腕も生え直す
  player.skill = Object.assign({}, c.skill);
  // リソースの数も体ごと。新しい体は満タン、自分が捨てた体は捨てた時点の残り
  player.resMax = c.resMax;
  player.resource = c.resource;
  player.resourceCharge = 0;
  clearAsuraArms();
  if (c.extraArms) spawnAsuraArms(c.extraArms);
  player.gunRecoil.LEFT = 0; player.gunRecoil.RIGHT = 0;
  player.attack = null; player.recoverT = 0;
  updateArmVisuals();
  if (ownBody) showFeedback('OLD BODY  HP ' + Math.round(player.hp), '#c8b98a', 30);
  else showFeedback('NEW BODY', '#7fc4a0', 30);
}

/* ---------- 蜘蛛脚の姿勢更新 ----------
   ・普段は legDeploy=0 で頭の中に格納されている
   ・ライジングでは「斬った瞬間」だけ飛び出して薙ぎ、振り終わると格納される
     （□を狙っている間は脊柱が伸びているだけ）
   ・頭モードでは常に展開し、頭を支える歩行ポーズをとる
   ・向きの軸補正は入れていない。常に yaw 基準で真下へ垂れ、
     ターゲットの方向や距離でポーズは変わらない（伸縮もしない）  */
const _legQ = new THREE.Quaternion();
const _legE = new THREE.Euler(0, 0, 0, 'YZX');

function updateSpiderLegs(dt) {
  const inRising = (state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT);
  const headMode = (state === S.HEAD || state === S.POSSESS);
  // 展開するのは「斬っている最中」と「頭モード」だけ。
  // □を狙っているだけでは出さない（頭に寄ったカメラだと、狙うたびに脚が出入りして
  // □とクロスヘアに被り、一番見たいものが隠れる）。
  // 狙えていることは□の selected 表示が伝えるので、脚の出番は斬撃だけでいい。
  const want = (headMode || legSwing !== null) ? 1 : 0;
  // 斬撃は 0.34s しかないので、出るときだけ一気に伸ばす。しまうのは通常の速さ
  const speed = (want === 1 && !headMode) ? CONFIG.legSlashDeploySpeed : CONFIG.legDeploySpeed;
  legDeploy += (want - legDeploy) * Math.min(1, dt * speed);
  if (legDeploy < 0.003) legDeploy = 0;

  spiderGroup.visible = (headMode || inRising) && legDeploy > 0.004 && !headDead;
  if (!spiderGroup.visible) return;

  let slashK = -1, slashSide = 0;
  if (legSwing) {
    slashK = Math.min(1, legSwing.t / CONFIG.spiderSwingTime);
    slashSide = (legSwing.side === 'LEFT') ? -1 : 1;
  }

  // 脚は頭の中から出る。向きは常に体の向き（yaw）基準で、真下へ垂れる。
  const rootPos = headPos.clone(); rootPos.y -= 0.06;
  const mid = (CONFIG.spiderLegsPerSide - 1) / 2;
  _legE.set(0, yaw, 0);
  _legQ.setFromEuler(_legE);

  const moving = headMode &&
    (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']);

  for (const leg of spiderLegs) {
    const s = leg.sign;
    leg.root.position.copy(rootPos);
    leg.root.quaternion.copy(_legQ);
    // ライジングは頭に寄ったカメラなので、脚が大きいと画面を埋めてしまう
    leg.root.scale.setScalar(legDeploy * (headMode ? 1 : CONFIG.spiderRiseScale));

    const sway = Math.sin(worldTime * 2.2 + leg.phase) * CONFIG.spiderIdleSway;
    let fan = (leg.index - mid) * CONFIG.spiderLegFan;
    let tilt = CONFIG.spiderLegTilt + sway;
    let bend = CONFIG.spiderLegBend - sway * 0.6;
    let claw = CONFIG.spiderLegClaw;

    if (moving) {
      // 頭モードの簡易歩行：脚が交互に動く
      const stepPhase = Math.sin(worldTime * 9 + leg.phase * 2.1);
      tilt += stepPhase * 0.11;
      bend -= stepPhase * 0.22;
      fan += stepPhase * 0.10;
    }

    if (slashK >= 0 && s === slashSide) {
      // 前半で後ろへ振りかぶり、後半で真正面を通して前へ薙ぐ
      const W = CONFIG.spiderSlashWindup;
      const sweep = (slashK < W)
        ? (slashK / W) * -CONFIG.spiderSlashBack
        : -CONFIG.spiderSlashBack + ((slashK - W) / (1 - W)) * CONFIG.spiderSlashSweep;
      fan = fan * 0.35 + s * sweep;
      const u = Math.max(0, Math.min(1, (slashK - 0.22) / 0.78));
      const ext = Math.pow(Math.sin(u * Math.PI), 0.6);
      tilt += CONFIG.spiderSlashTilt * ext;
      bend += CONFIG.spiderSlashBend * ext;
      claw += CONFIG.spiderSlashClaw * ext;
    } else if (slashK >= 0) {
      fan -= s * 0.25;
      bend += 0.15;
    }

    leg.joints[0].rotation.y = fan;
    leg.joints[0].rotation.z = -s * tilt;
    leg.joints[1].rotation.z = -s * bend;
    leg.joints[2].rotation.z = -s * claw;
  }
}

/* カメラに近すぎる脚の節を消す。
   ライジングのカメラは頭のすぐ後ろにあり、脚の付け根も頭なので、
   何もしないと必ず数本が画面（カメラと□の間）を横切る。
   カメラ位置が確定したあと＝animate()のカメラ処理の直後に呼ぶ。        */
const _segW = new THREE.Vector3();
function fadeSpiderLegs() {
  if (!spiderGroup.visible) return;
  // フェードするのはライジングだけ。頭モードのカメラは2.6m後ろにあって
  // 脚が視界を塞がないうえ、歩行中に脚が消えると何が起きたか分からなくなる
  const inRising = (state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT);
  if (!inRising) {
    for (const leg of spiderLegs) for (const seg of leg.segs) {
      if (seg.material.opacity !== 1) {
        seg.material.opacity = 1; seg.material.transparent = false; seg.material.depthWrite = true;
      }
      seg.visible = true;
    }
    return;
  }
  // 斬っている最中の側は消さない。見せ場そのものなので
  const slashSide = legSwing ? (legSwing.side === 'LEFT' ? -1 : 1) : 0;
  const near = CONFIG.legFadeNear, far = CONFIG.legFadeFar;
  const px = window.innerHeight / 720;                 // □の判定と同じく画面高さ基準
  const r0 = CONFIG.legFadeCenterPx * px, r1 = CONFIG.legFadeEdgePx * px;
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  for (const leg of spiderLegs) {
    const slashing = (slashSide !== 0 && leg.sign === slashSide);
    for (const seg of leg.segs) {
      seg.getWorldPosition(_segW);
      const d = _segW.distanceTo(camera.position);
      const distK = slashing ? 1 : Math.max(0, Math.min(1, (d - near) / (far - near)));
      let k = distK;
      if (distK < 1) {
        // 画面の端にいるぶんには邪魔にならないので残す
        const scr = projectToScreen(_segW);
        if (!scr.front) k = 1;
        else {
          const rad = Math.hypot(scr.x - cx, scr.y - cy);
          const edgeK = Math.max(0, Math.min(1, (rad - r0) / (r1 - r0)));
          k = Math.max(distK, edgeK);
        }
      }
      const m = seg.material;
      m.opacity = k;
      m.transparent = k < 0.999;
      m.depthWrite = k > 0.6;      // 半透明のときだけ深度を書かない
      seg.visible = k > 0.02;
    }
  }
}

/* ---------- 斬った腕を自分の体へ吸着させる ---------- */
const _shoulder = new THREE.Vector3();
function shoulderWorld(key) {
  // playerGroup の腕はローカル (±0.45, 1.18, 0)。yaw で回してワールドへ
  const sx = (key === 'LEFT') ? -0.45 : 0.45;
  return _shoulder.set(
    playerPos.x + Math.cos(yaw) * sx,
    playerPos.y + 1.18,
    playerPos.z - Math.sin(yaw) * sx);
}

function startArmGraft(obj, key, from, armState) {
  // タメで一度引く先を先に決めておく（体から遠ざかる方向＋少し上）
  const back = from.clone().sub(shoulderWorld(key));
  if (back.lengthSq() < 0.001) back.set(0, 1, 0);
  back.normalize().multiplyScalar(CONFIG.armGraftBack);
  back.y += 0.28;
  graftArms.push({
    obj, key, t: 0, from: from.clone(), kind: obj.userData.kind || ARM.FIST,
    armState: armState || null,      // 指定があればその状態で付く（死体の腕）
    pull: from.clone().add(back), landed: false,
  });
}

// 外れた古い腕を弾き飛ばす。
// 落ちた腕は armDropLife 秒だけ床に残り、その間は消耗したHPを保ったまま拾い直せる。
// 「銃腕に持ち替えたが弾切れ前に元の拳へ戻したい」を成立させるための猶予で、
// 時間切れになれば肉片になって消えるので、戦場が腕だらけにはならない。
function ejectOldArm(key) {
  const st = player.arms[key];
  if (st.lost) return;                 // 無い腕は飛ばない
  const pos = shoulderWorld(key).clone();
  const color = armColor(st);
  const isGun = st.kind === ARM.GUN;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.72, 0.13),
    new THREE.MeshLambertMaterial({ color }));
  m.position.copy(pos);
  m.userData.kind = st.kind;
  if (isGun) {
    // 銃腕は銃身も付けて、床に落ちていても種類が分かるようにする
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.30, 8),
      new THREE.MeshLambertMaterial({ color: COLOR_GUN_BARREL }));
    barrel.position.y = -0.48;
    m.add(barrel);
  }
  scene.add(m);
  // 真横に飛ばすと視界（水平FOV約114°）の外へ落ちて、拾える猶予があっても気づけない。
  // 前方成分を混ぜて、目の前の床に転がるようにする
  const sx = (key === 'LEFT') ? -1 : 1;
  const dir = new THREE.Vector3(
    Math.cos(yaw) * sx - Math.sin(yaw) * CONFIG.armEjectForward,
    0.85,
    -Math.sin(yaw) * sx - Math.cos(yaw) * CONFIG.armEjectForward).normalize();
  // 敵の腕・死体の腕と同じ□を出す。取り方を「□に合わせてクリック」に統一する
  const el = document.createElement('div');
  el.className = 'shoulder-target hidden';
  document.body.appendChild(el);
  severedParts.push({
    obj: m, key, el, phase: 'eject',
    armState: cloneArmState(st),       // HPも銃/拳も消耗したまま持ち越す
    vel: dir.multiplyScalar(CONFIG.armEjectSpeed),
    spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12,
                            (Math.random() - 0.5) * 12),
    dropAt: 0,          // 頭用の一斉落下スケジュールの対象外にする
    expireAt: null,     // 着地してから測りはじめる
    baseColor: color, blinkPhase: 0,
  });
}

function finishArmGraft(g) {
  scene.remove(g.obj);
  ejectOldArm(g.key);              // 交換なので古い方は外れて飛ぶ
  // 奪った腕は必ずフルHP。種類（拳／銃）も敵のものを引き継ぐ
  player.arms[g.key] = g.armState ? g.armState : makeArmState(g.kind, { swapped: true });
  player.gunRecoil[g.key] = 0;
  updateArmVisuals();
  addHitstop(CONFIG.armGraftHitstop);
  addShake(CONFIG.armGraftShake);
  doFlash(0.45, '#ffb0a0');
  showFeedback('GRAFT ' + g.key[0], '#ff9c8c', 42);
}

function updateArmGrafts(dt) {
  if (!graftArms.length) return;
  const W = CONFIG.armGraftWindup;
  for (const g of graftArms) {
    g.t += dt;
    const k = Math.min(1, g.t / CONFIG.armGraftTime);
    const target = shoulderWorld(g.key);
    if (k < W) {
      // タメ：体と反対へ一度引く
      const u = k / W;
      g.obj.position.lerpVectors(g.from, g.pull, Math.sin(u * Math.PI * 0.5));
    } else {
      // 一気に吸着（加速）
      const u = (k - W) / (1 - W);
      g.obj.position.lerpVectors(g.pull, target, u * u);
    }
    g.obj.rotation.x += CONFIG.armGraftSpin * dt;
    g.obj.rotation.z += CONFIG.armGraftSpin * 0.6 * dt;
    const s = 1 + Math.sin(k * Math.PI) * CONFIG.armGraftSwell;
    g.obj.scale.setScalar(s);
    if (k >= 1 && !g.landed) { g.landed = true; finishArmGraft(g); }
  }
  graftArms = graftArms.filter((g) => !g.landed);
}

function cancelArmGrafts() {
  for (const g of graftArms) scene.remove(g.obj);
  graftArms = [];
}

function cutPart(entry, side) {
  const pivot = entry.pivot;
  if (!pivot || !pivot.parent) return;
  const en = entry.enemy;

  pivot.updateWorldMatrix(true, false);
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
  pivot.getWorldPosition(wp);
  pivot.getWorldQuaternion(wq);
  pivot.parent.remove(pivot);
  scene.add(pivot);
  pivot.position.copy(wp);
  pivot.quaternion.copy(wq);

  selectedTarget = null;

  if (entry.key === 'HEAD') {
    // 頭だけは従来どおり、体からゆっくり離れながら滞空する
    const away = wp.clone().sub(en.group.position); away.y = 0;
    if (away.lengthSq() < 0.001) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    away.normalize().multiplyScalar(CONFIG.partDriftSpeed);
    away.y = CONFIG.partDriftUp;
    severedParts.push({
      obj: pivot, key: entry.key, vel: away, phase: 'drift', dropAt: null,
      spin: new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8,
                              (Math.random() - 0.5) * 0.8),
    });
    en.headless = true;
    en.glow.material.opacity = 0;
    applyDamage(en, 999);
    addHitstop(CONFIG.headCutHitstop);
    addShake(CONFIG.headCutShake);
    doFlash(0.85, '#ffd8c8');
    showFeedback('HEAD SEVERED', '#ff8f7a', 48);
    // ライジングは解除しない。
    // スタン中の敵が複数いると、1体斬るたびに抜けされてストレスになるため。
    // 抜けるのはQを離したときだけ。
  } else {
    // 腕の切断ではHPを削らない（risingCutDamage:0）。
    // ライジングは「腕を奪う手段」に寄せてあり、倒すのは人間モードの仕事。
    if (CONFIG.risingCutDamage > 0) applyDamage(en, CONFIG.risingCutDamage);
    // 切断でスタン時間を仕切り直し、連続で切る猟予を作る
    if (en.state === E.STUNNED) en.t = 0;
    // 浮かせずにそのまま自分の体へ。拾う手間と滞空の混雑をなくす。
    startArmGraft(pivot, side || entry.key, wp);
    addHitstop(0.10);
    addShake(0.20);
    doFlash(0.20, '#ffd0b0');
    showFeedback('SEVER ' + (side || entry.key)[0], '#ffd75e', 30);
  }
}

// ライジング中に死体の腕を斬る。表現はスタン中の敵の腕と同じ（吸着して交換）。
// 死体側はその腕を失う（乗っ取っても欠けたまま）
function cutCorpseArm(t, side) {
  const c = t.corpse, key = t.key, pivot = t.pivot;
  if (!pivot || !pivot.parent || !c.arms[key]) return;
  pivot.updateWorldMatrix(true, false);
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
  pivot.getWorldPosition(wp);
  pivot.getWorldQuaternion(wq);
  dropCorpseBlinkMats(c, pivot);   // 外したので、この死体の点滅には巻き込まれない
  pivot.parent.remove(pivot);
  scene.add(pivot);
  pivot.position.copy(wp);
  pivot.quaternion.copy(wq);
  selectedTarget = null;

  const armState = cloneArmState(c.arms[key]);   // 敵の死体なら既にフルHP。自分の捨てた体なら消耗したまま
  c.arms[key] = null;
  c.armPivots[key] = null;
  if (c.armEls[key]) { c.armEls[key].remove(); c.armEls[key] = null; }
  startArmGraft(pivot, side || key, wp, armState);
  addHitstop(0.10);
  addShake(0.20);
  doFlash(0.20, '#ffd0b0');
  showFeedback('SEVER ' + (side || key)[0], '#ffd75e', 30);
}

/* ---------- 部位の取得（腕のみ） ---------- */
// 床に落ちている腕を取る。敵の腕・死体の腕と同じで、□に合わせてクリック。
// 取り方・アニメーション・付く側の決まり方（押したボタンの側）を全部共通にしてある
function takeGroundArm(t, side) {
  const p = t.part;
  if (severedParts.indexOf(p) < 0) return;   // 寿命切れと同フレームの取りこぼし防止
  const wp = p.obj.position.clone();
  removeSeveredPart(p, false);               // 配列と□だけ外す。メッシュはグラフトが使う
  p.obj.rotation.set(0, 0, 0);
  selectedTarget = null;
  // 自分が捨てた腕は消耗したHPのまま戻る。拾い直しで全快できると
  // 腕の耐久が「捨てて拾えばリセット」になってしまう
  startArmGraft(p.obj, side || p.key, wp, p.armState ? cloneArmState(p.armState) : null);
  addHitstop(0.10);
  addShake(0.20);
  doFlash(0.20, '#ffd0b0');
  showFeedback('TAKE ' + (side || p.key)[0] +
               (p.armState ? '  HP ' + Math.round(p.armState.hp) : ''), '#ffd75e', 30);
}

// 部位を管理下から外す。dropObj=true ならメッシュも消す（寿命切れ・リセット）
function removeSeveredPart(p, dropObj) {
  if (p.el) { p.el.remove(); p.el = null; }
  if (dropObj) scene.remove(p.obj);
  severedParts = severedParts.filter((x) => x !== p);
}

function armColor(st) {
  if (st.kind === ARM.GUN) return COLOR_GUN_ARM;
  if (st.kind === ARM.TENTACLE) return COLOR_TENTACLE;   // 前腕も肉っぽい色にする
  return st.swapped ? COLOR_ENEMY_ARM : COLOR_PLAYER_ARM;
}

// 一人称の手（makeFpHand）の見た目を腕の状態に合わせる。
// 本体の左右の手と、阿修羅の追加の腕で共用
function applyHandLook(hand, st) {
  const color = armColor(st);
  const isGun = st.kind === ARM.GUN;
  const isTent = st.kind === ARM.TENTACLE;
  hand.userData.fore.material.color.setHex(color);
  hand.userData.fist.material.color.setHex(color);
  hand.userData.fist.visible = !st.purged && !isGun && !isTent;
  hand.userData.barrel.visible = isGun;
  // 触手の節は updateTentacleArms() が毎フレーム出し入れする（腕の中の節は隠す）。
  // ここでは種類が変わったときに全部消す／出すだけ
  hand.userData.cuff.visible = isTent;
  for (const tn of hand.userData.tentacles) {
    tn.init = false;                 // 前の形から補間しないよう遅延追従を初期化
    for (const s of tn.segs) s.visible = isTent;
  }
  hand.userData.lost = st.lost;      // 描画側で非表示にする
}

function updateArmVisuals() {
  for (const side of ['LEFT', 'RIGHT']) {
    const st = player.arms[side];
    const color = armColor(st);
    const isTent = st.kind === ARM.TENTACLE;
    applyHandLook(fpHands[side], st);
    if (!isTent && tentHold && tentHold.side === side) detachTentacle();
    const bodyArm = side === 'LEFT' ? playerArmL : playerArmR;
    bodyArm.material.color.setHex(color);
    bodyArm.scale.y = st.purged ? 0.65 : 1;
    bodyArm.visible = !st.lost;
  }
}

/* =========================================================
   触手腕（TENTACLE）
   既存の腕（拳／銃）と同じ ARM.kind として足しただけの腕。
   player.attack も mouseHold もパンチ／パージと同じ仕組みに乗せているので、
   キャンセル・先行入力・腕HPの消費はそのまま効く。

   見た目:
     手首から先が3本の触手。節（球）の座標を毎フレーム直接打ち込むだけで、
     ボーンもスキニングも使っていない。手首より奥に入った節は非表示にして、
     「根元は腕の中に引っ込んでいて、先端だけが外に出ている」状態を作る。

   短押し（薙ぎ払い・2コンボ）:
     type:'punch' の tent フラグ付き。1段目は片側、2段目は反対側へ振る。
     当たり判定は横に広い扇で、範囲内の敵をまとめて薙ぐ（単体のパンチとの差）。
     射程はパンチより長く、威力は半分以下。硬直も短いのでテンポよく2回振れる。

   長押し（刺突 → 拘束 → 振り回し → 投げ）:
     extend : クロスヘア方向へ伸びる。最大 tentMaxRange まで伸びて外れれば終了
     stuck  : 当たった敵に刺さる。敵は E.TETHER になり、AIも押しのけも止まる。
              敵はクロスヘアの先（目標位置）へバネで引かれる。減衰を弱くして
              わざと遅れて付いてこさせ、さらに目標位置の移動速度を敵の速度に
              上乗せすることで「視点を大きく振ると振り回される」挙動にしている。
     離す   : そのときの速度が tentThrowMin 以上なら E.THROWN。残った速度で
              放物線を描いて飛び、着地／壁で速度に応じたダメージ＋スタン。
              遅ければただ外れる。
     本物の物理は入れていない（疑似物理）。重要なのは
     「刺さる」「振り回せる」「投げられる」が操作で伝わること。
   ========================================================= */
let tentHold = null;       // 長押しの触手 { side, phase:'extend'|'stuck'|'retract', len, enemy, dist, held, anchor }
let tentComboStep = 0;     // 薙ぎ払いの段（0=1段目 / 1=2段目）
let tentComboAt = -99;     // 最後に薙いだワールド時刻。離れたら1段目に戻す
let tentFovKick = 0;       // 刺さった瞬間の画角寄せ(1→0)。カメラ側が毎フレーム減らす

// 伸ばした触手の見た目。3本が撚り合って1本の槍になる。
// 一人称の手元（fpHands）とは別に、ワールド座標で置く節を用意しておく
const tentBeam = new THREE.Group();
const tentBeamStrands = [];
{
  for (let s = 0; s < 3; s++) {
    const segs = [];
    for (let k = 0; k < CONFIG.tentBeamSegs; k++) {
      const t = k / (CONFIG.tentBeamSegs - 1);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.055 * (1 - t * 0.45), 7, 5),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(COLOR_TENTACLE).lerp(new THREE.Color(COLOR_TENTACLE_TIP), t) }));
      tentBeam.add(m);
      segs.push(m);
    }
    tentBeamStrands.push(segs);
  }
}
tentBeam.visible = false;
scene.add(tentBeam);

const _tOrigin = new THREE.Vector3();
const _tDir = new THREE.Vector3();
const _tEnd = new THREE.Vector3();
const _tUp = new THREE.Vector3();
const _tRight = new THREE.Vector3();
const _tChest = new THREE.Vector3();
const _tAnchor = new THREE.Vector3();
const _tAnchorVel = new THREE.Vector3();

/* --- 腕の付け替え（検証用。1/2/3キー）---
   既存の腕状態をそのまま差し替えるだけ。奪った腕と同じ makeArmState を使う  */
function equipArms(kind) {
  detachTentacle();
  // 検証用キーなので演出の途中でも通る。
  // フィニッシャー中に差し替えると掴まれている敵が取り残されるので先に放す
  if (inFinisher() && player.attack.enemy && player.attack.enemy.state === E.GRABBED) {
    const en = player.attack.enemy;
    en.grabK = 0; en.tentGrab = false; en.cooldown = 0.6;
    if (en.parts.HEAD.parent === en.pivotRoot) en.parts.HEAD.position.set(0, 2.12, 0);
    setEnemyState(en, E.IDLE);
  }
  for (const side of ['LEFT', 'RIGHT']) {
    player.arms[side] = makeArmState(kind);
    mouseHold[side] = null;
    gunHold[side] = false;
    gunCool[side] = 0;
    player.gunRecoil[side] = 0;
  }
  punchBuffer = null;
  player.attack = null;
  updateArmVisuals();
  showFeedback(kind === ARM.TENTACLE ? 'TENTACLE ARMS'
             : kind === ARM.GUN ? 'GUN ARMS' : 'FIST ARMS', '#d08fa0', 28);
}

// クロスヘア方向（= 触手が伸びる向き）
function tentAimDir(out) {
  return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch),
                 -Math.cos(yaw) * Math.cos(pitch));
}
// 物理（判定・引っ張り）用の始点。
// カメラにはヒットシェイクのブレが乗っているので、そこから触手の目標位置を作ると
// ブレが「視点を振った量」として検出されて敵が勝手に飛ぶ。
// 物理はこちら、見た目は tentHandOrigin() を使う
function tentAimOrigin(side, out) {
  out.set(playerPos.x, playerPos.y + EYE - 0.22, playerPos.z);
  const k = (side === 'LEFT' ? -0.26 : 0.26);
  out.x += Math.cos(yaw) * k;
  out.z += -Math.sin(yaw) * k;
  return out;
}
// 見た目用の始点。一人称の手の付け根（カメラからのローカル位置）に合わせる
function tentHandOrigin(side, out) {
  out.set((side === 'LEFT' ? -1 : 1) * 0.28, -0.28, -0.52)
     .applyQuaternion(camera.quaternion).add(camera.position);
  return out;
}

/* --- 刺突の当たり判定 ---
   敵を「足元から頭まで」の縦カプセルとして見て、始点から len までの線分に
   いちばん近い敵を拾う。貫通はしない（最初に当たった敵に刺さる）。
   当たった点(point)も返す。これを敵のローカル座標で覚えておくことで、
   刺さった位置と角度が保たれる                                        */
const TENT_BODY_Y = [0.95, 1.45, 1.95];   // 判定に使う体の高さ(m)

function tentFindHit(origin, dir, len) {
  let best = null, bestT = Infinity, bestY = 1.45;
  for (const en of enemies) {
    if (en.state === E.DEAD || en.state === E.FLEE || en.state === E.DODGE ||
        en.state === E.TETHER || en.state === E.THROWN) continue;
    for (const by of TENT_BODY_Y) {
      _tChest.copy(en.group.position); _tChest.y += by;
      _tChest.sub(origin);
      const t = _tChest.dot(dir);
      if (t < 0.4 || t > len) continue;
      const perp = Math.sqrt(Math.max(0, _tChest.lengthSq() - t * t));
      if (perp > CONFIG.tentHitRadius) continue;
      if (t < bestT) { bestT = t; best = en; bestY = by; }
    }
  }
  if (!best) return null;
  // 線分上のいちばん近い点を、少しだけ体の中へめり込ませる＝刺さった点
  const point = origin.clone().addScaledVector(dir, bestT);
  const body = best.group.position.clone(); body.y += bestY;
  point.lerp(body, 0.45);
  return { enemy: best, dist: bestT, point };
}

// 刺さっている点のワールド座標。敵の pivotRoot のローカルで覚えてあるので、
// 敵が前のめりになったり暴れたりすると触手の先もそれに追従する
function tentStabWorld(h, out) {
  const e = h.enemy;
  if (!e) return out.set(0, 0, 0);
  if (h.stabLocal) { out.copy(h.stabLocal); e.pivotRoot.localToWorld(out); }
  else { out.copy(e.group.position); out.y += 1.45; }
  return out;
}

function startTentacleHold(side) {
  // 戻りかけの触手は上書きして出し直せる（押し直しが死なないように）
  if (tentHold) { if (tentHold.phase !== 'retract') return false; tentHold = null; }
  if (!canCancelNow()) return false;
  const arm = player.arms[side];
  if (arm.lost || arm.kind !== ARM.TENTACLE) return false;
  cancelCurrentAction();
  tentHold = { side, phase: 'extend', len: 0.35, enemy: null,
               dist: 0, held: 0, anchor: null, stabLocal: null };
  showFeedback('REACH', '#d08fa0', 24);
  return true;
}

/* --- 吹き飛びの上限 ---
   ソフトキャップから上だけを圧縮して、上限へ漸近させる。
   soft 以下は素通しなので、普通の投げの手応えはそのまま。
   大振りだけが「伸びなくなる」ので、気持ちよさを残したまま画面外へ消えない  */
function softCap(v, soft, max) {
  if (v <= soft) return v;
  const room = Math.max(0.01, max - soft);
  return soft + room * (1 - Math.exp(-(v - soft) / room));
}

// 敵に乗る吹き飛び速度を抑える（投げ・ぶつけ・叩きつけの共通の出口）。
// 水平は「飛距離」、上方向は「画面の外へ打ち上がる」で効き方が違うので別に見る
function clampKnockVel(v) {
  const hv = Math.hypot(v.x, v.z);
  if (hv > CONFIG.knockSoftSpeed) {
    const s = softCap(hv, CONFIG.knockSoftSpeed, CONFIG.knockMaxSpeed) / hv;
    v.x *= s; v.z *= s;
  }
  if (v.y > CONFIG.knockSoftUp) v.y = softCap(v.y, CONFIG.knockSoftUp, CONFIG.knockMaxUp);
  else if (v.y < -CONFIG.knockMaxSpeed) v.y = -CONFIG.knockMaxSpeed;
  return v;
}

/* --- 振り回した敵を他の敵へぶつける ---
   拘束中の敵が一定速度以上で別の敵に重なったら、両方にダメージ。
   ぶつけられた側は投げられたのと同じ E.THROWN になって吹っ飛ぶ。
   1フレームに1体まで、同じ相手には tentSmashCd 秒あけて当たる      */
function tentSmashInto(e, vel, speed) {
  for (const o of enemies) {
    if (o === e || o.smashCd > 0) continue;
    if (o.state === E.DEAD || o.state === E.FLEE || o.state === E.TETHER ||
        o.state === E.THROWN || o.state === E.HIDDEN) continue;
    const dx = o.group.position.x - e.group.position.x;
    const dz = o.group.position.z - e.group.position.z;
    if (Math.abs(o.group.position.y - e.group.position.y) > 1.8) continue;
    if (dx * dx + dz * dz > CONFIG.tentSmashRadius * CONFIG.tentSmashRadius) continue;

    o.smashCd = CONFIG.tentSmashCd;
    e.smashCd = Math.max(e.smashCd, CONFIG.tentSmashCd * 0.5);
    const dmg = Math.min(CONFIG.tentSmashDamageMax, speed * CONFIG.tentSmashDamage);
    applyDamage(o, dmg);
    applyDamage(e, dmg * CONFIG.tentSmashSelf);   // ぶつけた側も無傷ではない
    if (o.state !== E.DEAD) {
      o.throwVel = vel.clone().multiplyScalar(CONFIG.tentSmashKnock);
      o.throwVel.y = Math.max(o.throwVel.y, 2.4);
      clampKnockVel(o.throwVel);
      o.throwSpin = 5 + speed * 0.4;
      o.stun = CONFIG.enemyStunThreshold;         // 着地で必ずスタンする
      o.consecutiveHits = 0;
      o.activeHitDone = false;
      setEnemyState(o, E.THROWN);
    }
    vel.multiplyScalar(1 - CONFIG.tentSmashLoss); // ぶつけた分だけ勢いが落ちる
    addHitstop(0.1);
    addShake(0.55);
    doFlash(0.35, '#ffc2cf');
    showFeedback('SMASH!  -' + Math.round(dmg), '#ff9bb0', 38);
    return;
  }
}

/* --- 拘束中の疑似物理。実時間(rdt)で動かす ---
   引き寄せはしない。刺した距離をそのまま拘束半径にして、
   クロスヘアの先（その半径上の点）へバネで引く＋ロープで外側を止める。 */
const _tStab = new THREE.Vector3();

function updateTentacle(rdt) {
  const h = tentHold;
  if (!h) return;

  // 人間モードから出た／腕が無くなった／敵が消えたら強制解除
  const arm = player.arms[h.side];
  if (state !== S.HUMAN || player.hp <= 0 || arm.lost || arm.kind !== ARM.TENTACLE) {
    detachTentacle(); return;
  }
  if (h.enemy && (h.enemy.state === E.DEAD || h.enemy.state === E.FLEE ||
                  enemies.indexOf(h.enemy) < 0)) {
    detachTentacle(); return;
  }

  tentAimOrigin(h.side, _tOrigin);
  tentAimDir(_tDir);

  if (h.phase === 'extend') {
    if (hitstop > 0) return;        // ヒットストップ中は伸びも止める
    h.len = Math.min(CONFIG.tentMaxRange, h.len + CONFIG.tentExtendSpeed * rdt);
    const hit = tentFindHit(_tOrigin, _tDir, h.len);
    if (hit) {
      const e = hit.enemy;
      h.enemy = e;
      h.phase = 'stuck';
      h.held = 0;
      h.anchor = null;
      // 刺した距離がそのまま拘束半径になる（手元へは引き寄せない）。
      // 食い込んだぶんだけ一度詰めて、刺さった手応えを作る
      h.dist = Math.max(CONFIG.tentHoldMinDist,
                        Math.min(CONFIG.tentMaxRange, hit.dist) - CONFIG.tentStabYankDist);
      // 刺さった点を敵のローカルで覚える＝敵が傾けば触手の先も一緒に動く
      e.group.updateMatrixWorld(true);
      h.stabLocal = e.pivotRoot.worldToLocal(hit.point.clone());
      // 刺さった瞬間だけ手前へ「ぐっ」と食い込む初速（引き寄せ続けはしない）
      e.tetherVel.copy(_tDir).multiplyScalar(-CONFIG.tentStabYank);
      e.shoveLeft = 0;
      e.smashCd = 0;
      setEnemyState(e, E.TETHER);
      applyDamage(e, CONFIG.tentStabDamage);
      e.stun = Math.min(CONFIG.enemyStunThreshold - 1, e.stun + CONFIG.tentStabStun);
      damageArm(h.side, CONFIG.tentStabCost);
      addHitstop(CONFIG.tentStabHitstop);
      addShake(CONFIG.tentStabShake);
      tentFovKick = 1;
      doFlash(0.35, '#ff9bb0');
      showFeedback('STAB!  ' + h.dist.toFixed(1) + 'm', '#ff9bb0', 38);
      return;
    }
    // 敵に当たらなければ最大距離まで伸びて終わり
    if (h.len >= CONFIG.tentMaxRange) {
      h.phase = 'retract';
      showFeedback('WHIFF', '#6e7268', 22);
    }
    return;
  }

  if (h.phase === 'stuck') {
    const e = h.enemy;
    if (!e) { h.phase = 'retract'; return; }

    h.held += rdt;
    damageArm(h.side, CONFIG.tentHoldDrain * rdt);
    if (player.arms[h.side].lost) { releaseTentacle(); return; }

    // 刺さっている点を取り直す（敵の傾き・暴れに追従している）
    e.group.updateMatrixWorld(true);
    tentStabWorld(h, _tStab);
    const pos = e.group.position;
    // 原点(足元)と刺さり点のズレ。目標はこのズレぶんだけ平行移動させる
    const offX = pos.x - _tStab.x, offY = pos.y - _tStab.y, offZ = pos.z - _tStab.z;

    // 目標＝クロスヘアの先、距離は刺したときの半径のまま
    _tAnchor.copy(_tOrigin).addScaledVector(_tDir, h.dist);
    if (hitstop > 0) {
      // 止めている間も目標位置は追従させる。ここで記録を飛ばすと、
      // 解除フレームで「止まっていた分のマウス移動」が全部速度になる
      if (!h.anchor) h.anchor = new THREE.Vector3();
      h.anchor.copy(_tAnchor);
      return;
    }

    const vel = e.tetherVel;
    const tx = _tAnchor.x + offX;
    const ty = Math.max(0, _tAnchor.y + offY);
    const tz = _tAnchor.z + offZ;
    const K = CONFIG.tentPullSpring, D = CONFIG.tentPullDamp;
    vel.x += ((tx - pos.x) * K - vel.x * D) * rdt;
    vel.y += ((ty - pos.y) * K - vel.y * D) * rdt;
    vel.z += ((tz - pos.z) * K - vel.z * D) * rdt;

    // 視点移動量そのものを速度に上乗せする。
    // バネだけだと「付いてくる」だけなので、大きく振ったときに伸びない。
    // 目標位置の移動速度（＝視点をどれだけ速く振ったか）を測って足し、
    // 大振りほど倍率が上がるようにしてご褒美を付けている
    if (h.anchor) {
      _tAnchorVel.copy(_tAnchor).sub(h.anchor).divideScalar(Math.max(rdt, 1 / 240));
      const boost = 1 + Math.min(1, _tAnchorVel.length() / CONFIG.tentSwingBoost);
      vel.addScaledVector(_tAnchorVel, CONFIG.tentSwingGain * boost * Math.min(1, rdt * 8));
    } else h.anchor = new THREE.Vector3();
    h.anchor.copy(_tAnchor);

    let sp = vel.length();
    if (sp > CONFIG.tentMaxSpeed) { vel.multiplyScalar(CONFIG.tentMaxSpeed / sp); sp = CONFIG.tentMaxSpeed; }

    const px = pos.x, pz = pos.z;
    pos.addScaledVector(vel, rdt);

    // 壁に叩きつけた
    if (!DEMO.active && !walkableAt(pos.x, pos.z, false)) {
      pos.x = px; pos.z = pz;
      const hv = Math.hypot(vel.x, vel.z);
      if (hv >= CONFIG.tentSmashMin && e.smashCd <= 0) {
        e.smashCd = CONFIG.tentSmashCd;
        const dmg = Math.min(CONFIG.tentThrowWallDamage, hv * CONFIG.tentSmashDamage);
        applyDamage(e, dmg);
        addHitstop(0.09); addShake(0.5); doFlash(0.3, '#ffb45e');
        showFeedback('WALL SMASH!  -' + Math.round(dmg), '#ffb45e', 36);
      }
      vel.x *= -0.25; vel.z *= -0.25;
    }

    // ロープ拘束：刺した半径より外へは出さない（内側は自由）。
    // これがあると敵が決まった半径で周回するので「振り回している」と読める
    let sx = pos.x - offX, sy = pos.y - offY, sz = pos.z - offZ;
    let dx = sx - _tOrigin.x, dy = sy - _tOrigin.y, dz = sz - _tOrigin.z;
    const dlen = Math.hypot(dx, dy, dz);
    if (dlen > h.dist && dlen > 0.001) {
      const pull = dlen - h.dist;
      dx /= dlen; dy /= dlen; dz /= dlen;
      pos.x -= dx * pull; pos.y -= dy * pull; pos.z -= dz * pull;
      // ロープが張った方向の速度だけ殺す（接線方向＝回る速度は残す）
      const radial = vel.x * dx + vel.y * dy + vel.z * dz;
      if (radial > 0) { vel.x -= dx * radial; vel.y -= dy * radial; vel.z -= dz * radial; }
    }
    // --- 地面への叩きつけ ---
    // 上に振ってから振り下ろすと、離さないまま投げの着地と同じ手応えが出る。
    // 見るのは落下速度だけなので、ただ降ろしただけ（tentGroundMin 未満）では鳴らない
    if (pos.y < 0) {
      const fall = -vel.y;
      pos.y = 0;
      if (fall >= CONFIG.tentGroundMin && e.smashCd <= 0 && e.state === E.TETHER) {
        e.smashCd = CONFIG.tentSmashCd;
        const dmg = Math.min(CONFIG.tentGroundDamageMax, fall * CONFIG.tentGroundDamage);
        applyDamage(e, dmg);
        // 拘束中はスタンで状態を奪えない（位置を触手側が持っている）ので上限の手前で止める
        e.stun = Math.min(CONFIG.enemyStunThreshold - 1, e.stun + CONFIG.tentGroundStun);
        // 叩きつけた勢いで少し跳ねる。横の勢いは殺さないので、そのまま次の振りへ繋がる。
        // 跳ね上がりだけ上限を見る（拘束中の横の速さは元から tentMaxSpeed で止まっている）
        vel.y = Math.min(CONFIG.knockMaxUp, fall * CONFIG.tentGroundBounce);
        addHitstop(0.11);
        addShake(0.55);
        doFlash(0.3, '#ffd0c0');
        spawnBloodDecal(pos.x, pos.z, 0.10 + Math.min(0.08, fall * 0.004), 0.4);
        showFeedback('GROUND SLAM!  -' + Math.round(dmg), '#ff8f7a', 38);
      } else if (vel.y < 0) vel.y = 0;
    }

    // 他の敵へぶつける
    if (sp >= CONFIG.tentSmashMin && e.state === E.TETHER) tentSmashInto(e, vel, sp);

    // 解除した瞬間に触手の長さが飛ばないよう、実距離を覚えておく
    h.len = Math.min(CONFIG.tentMaxRange + 1.5, Math.min(dlen, h.dist));

    if (h.held >= CONFIG.tentHoldMaxTime) { releaseTentacle(); return; }
    return;
  }

  // retract：根元へ戻る
  h.len -= CONFIG.tentRetractSpeed * rdt;
  if (h.len <= 0.25) { tentHold = null; tentBeam.visible = false; }
}

/* --- クリックを離した（＝投げの判定）--- */
function releaseTentacle() {
  const h = tentHold;
  if (!h) return;
  const e = h.enemy;
  if (e && e.state === E.TETHER) {
    const speed = e.tetherVel.length();
    if (speed >= CONFIG.tentThrowMin) {
      // 勢いが乗った状態で離した＝その方向へ投げる。
      // 速度はそのまま残して上方向だけ混ぜ、放物線にして「投げた」感を出す
      e.throwVel = e.tetherVel.clone().multiplyScalar(CONFIG.tentThrowMul);
      // 上方向は勢いに応じて増やす。弱い投げがいきなり打ち上がらないようにする
      e.throwVel.y += CONFIG.tentThrowUp *
                      (0.5 + Math.min(1, speed / CONFIG.tentSwingBoost));
      // 吹き飛びの上限。大振りほど圧縮されるので、画面の外までは飛ばない
      clampKnockVel(e.throwVel);
      e.throwSpin = 5 + speed * 0.5;
      setEnemyState(e, E.THROWN);
      addHitstop(0.1);
      addShake(0.45);
      doFlash(0.35, '#ffc2cf');
      showFeedback('THROW!  ' + e.throwVel.length().toFixed(1) + ' m/s', '#ff9bb0', 42);
    } else {
      // 低速で解除＝ただ外れる。
      // ただし拘束中にもう片方の腕で削ってスタンを溜め切っていたら、
      // 落とした瞬間にその場で崩れる＝そのまま掴みフィニッシャーに行ける
      e.group.position.y = 0;
      e.tetherVel.set(0, 0, 0);
      e.cooldown = 0.6;
      if (e.stun >= CONFIG.enemyStunThreshold - 1 && e.state !== E.DEAD) {
        e.stun = CONFIG.enemyStunThreshold;
        e.consecutiveHits = 0;
        e.activeHitDone = false;
        enterStun(e);                      // STUN! を出したあとに上書きする
        showFeedback('BREAK!', '#ffe98a', 36);
      } else {
        setEnemyState(e, E.IDLE);
        showFeedback('RELEASE', '#8b8f88', 22);
      }
    }
  }
  h.enemy = null;
  h.stabLocal = null;
  h.phase = 'retract';
}

/* --- 強制解除（モード遷移・腕の付け替え・リセット）。投げは発生しない --- */
function detachTentacle() {
  const h = tentHold;
  if (!h) return;
  const e = h.enemy;
  if (e && e.state === E.TETHER) {
    e.group.position.y = 0;
    e.tetherVel.set(0, 0, 0);
    e.cooldown = 0.6;
    setEnemyState(e, E.IDLE);
  }
  tentHold = null;
  tentBeam.visible = false;
}

/* --- 投げられて飛んでいる敵。着地と壁当てでダメージ＋スタン --- */
function updateThrownEnemy(en, rdt) {
  if (hitstop > 0) return;          // 着地と壁当ての手応えを殺さない
  const v = en.throwVel;
  if (!v) { en.group.position.y = 0; en.cooldown = 0.6; setEnemyState(en, E.IDLE); return; }
  v.y -= CONFIG.tentThrowGravity * rdt;
  const damp = Math.max(0, 1 - CONFIG.tentThrowDrag * rdt);
  v.x *= damp; v.z *= damp;

  const pos = en.group.position;
  // 速度の上限だけだと、低く速い投げが霧の中まで転がっていく。
  // 自分から knockMaxDist より遠い敵は空中で減速させて、視界の中に落とす
  const far = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z) - CONFIG.knockMaxDist;
  if (far > 0) {
    const brake = Math.max(0, 1 - CONFIG.knockFarDrag * Math.min(1, far / 4) * rdt);
    v.x *= brake; v.z *= brake;
  }
  const px = pos.x, pz = pos.z;
  pos.addScaledVector(v, rdt);

  // 壁に叩きつけた
  if (!DEMO.active && !walkableAt(pos.x, pos.z, false)) {
    pos.x = px; pos.z = pz;
    const hv = Math.hypot(v.x, v.z);
    if (hv > 6) {
      applyDamage(en, Math.min(CONFIG.tentThrowWallDamage, hv));
      addShake(0.3); addHitstop(0.06);
      showFeedback('WALL!', '#ffb45e', 32);
    }
    v.x *= -0.25; v.z *= -0.25;
  }

  if (pos.y <= 0) {
    pos.y = 0;
    const speed = v.length();
    const dmg = Math.min(CONFIG.tentThrowDamageMax, speed * CONFIG.tentThrowDamage);
    en.throwVel = null;
    // 着地したら必ずスタン。投げの見返りを「そのあと殴れる」側に寄せる
    en.stun = CONFIG.enemyStunThreshold;
    applyDamage(en, dmg);
    if (en.state === E.THROWN) {     // まだ生きている
      en.consecutiveHits = 0;
      en.activeHitDone = false;
      enterStun(en);
    }
    addHitstop(0.12);
    addShake(0.5);
    doFlash(0.3, '#ffd0c0');
    showFeedback('SLAM  -' + Math.round(dmg), '#ff8f7a', 34);
  }
}

/* =========================================================
   触手のフィニッシャー（薙ぎ払いの延長・自動発動）

   tentSweepHit() から入る。条件は拳の掴み（resolvePunch）と同じで、
   スタン中の敵を薙いだ瞬間に差し替わる。
   3本の触手を頭に刺し、引っ張って首から頭を引き抜く。
   拳が「引き寄せて潰す」なら、こちらは「腕の長さのまま引き抜く」。

     [0, stab)              触手が頭へ伸びていく（まだ敵は動かない）
     stab                   刺さる。ヒットストップ＋画角の寄り
     [stab, stab+pull)      刺したまま引っ張る。首が伸びて踵が浮く
     stab+pull              引き抜く → 頭が飛ぶ → killEnemy()（首なし死体）
     (..., +rip)            硬直。腕が引き戻る

   player.attack は拳と同じ type:'finisher'（tent:true）にしてあるので、
   キャンセル不可・移動不可・無敵の扱いは全部そのまま効く。
   ========================================================= */
const _tfNeck = new THREE.Vector3();
const _tfHeadW = new THREE.Vector3();
const _tfHeadQ = new THREE.Quaternion();
const _tfToMe = new THREE.Vector3();

function tentFinTotal() {
  return CONFIG.tentFinStab + CONFIG.tentFinPull + CONFIG.tentFinRip;
}

function startTentFinisher(en, side) {
  detachTentacle();          // 伸ばした触手は1本だけなので、拘束中なら落とす
  setEnemyState(en, E.GRABBED);
  en.grabK = 0;
  en.tentGrab = true;
  en.consecutiveHits = 0;
  en.activeHitDone = false;
  en.parts.HEAD.getWorldPosition(_tfHeadW);
  player.attack = {
    side, type: 'finisher', tent: true, t: 0, enemy: en,
    crushed: false, pierced: false, armOut: 0,
    lastHead: _tfHeadW.clone(),   // 頭が外れたあとも触手と腕の目標として使う
  };
  player.invuln = Math.max(player.invuln, tentFinTotal());
  slowTimer = CONFIG.tentFinStab + CONFIG.tentFinPull;
  slowScaleOverride = CONFIG.tentFinSlowScale;
  addHitstop(0.05);
  addShake(0.15);
  showFeedback('REACH', '#d08fa0', 28);
  return true;
}

// dt: 実時間（ヒットストップ中は0）
function updateTentFinisher(atk, dt) {
  const en = atk.enemy;
  const stab = CONFIG.tentFinStab, pull = CONFIG.tentFinPull;

  // 別の要因で敵が GRABBED でなくなった（リセットなど）ら引き抜く工程を飛ばして戻る
  if (!atk.crushed && en.state !== E.GRABBED) {
    atk.crushed = true;
    atk.t = Math.max(atk.t, stab + pull);
    en.tentGrab = false;
    if (en.parts.HEAD.parent === en.pivotRoot) en.parts.HEAD.position.set(0, 2.12, 0);
  }

  if (atk.t < stab) {
    // 伸びているだけ。刺さるまでは敵に触らない
    en.grabK = 0;
    en.parts.HEAD.getWorldPosition(atk.lastHead);
  } else if (atk.t < stab + pull) {
    if (!atk.pierced) tentFinPierce(atk);
    const k = (atk.t - stab) / pull;
    en.grabK = Math.min(1, k * 1.6);
    // 体を腕の長さの距離まで寄せる／押し戻す（実時間で動かすのでスローに引きずられない）。
    // 顔も正面に向かせて、引き抜く瞬間が正面から見えるようにする
    _tfToMe.copy(playerPos).sub(en.group.position); _tfToMe.y = 0;
    const d = _tfToMe.length();
    if (d > 0.001) {
      _tfToMe.divideScalar(d);
      const diff = d - CONFIG.tentFinPullDist;
      if (Math.abs(diff) > 0.01) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), CONFIG.tentFinPullSpeed * dt);
        en.group.position.addScaledVector(_tfToMe, step);
      }
      const targetYaw = Math.atan2(_tfToMe.x, _tfToMe.z);
      let dy = targetYaw - en.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      en.group.rotation.y += dy * Math.min(1, dt * 14);
    }
    // 頭をプレイヤー側（敵ローカル+Z）と上へ引っ張る＝首が伸びる。
    // 後半ほど伸びて、抜ける直前ほど速く震える
    const e2 = k * k;
    const jitter = Math.sin(clock.elapsedTime * 44) * 0.035 * k;
    en.parts.HEAD.position.set(jitter,
                               2.12 + CONFIG.tentFinNeck * 0.45 * e2,
                               CONFIG.tentFinNeck * e2);
    en.parts.HEAD.getWorldPosition(atk.lastHead);
  } else if (!atk.crushed) {
    tentFinRip(atk);
  }

  // 引き抜いた頭は触手が連れて戻る。頭は severedParts として自分で飛ぶので、
  // 触手の先はその位置を追いかけるだけでいい
  if (atk.ripHead) atk.lastHead.copy(atk.ripHead.position);

  if (atk.t >= tentFinTotal()) player.attack = null;
}

// 刺さった瞬間。ダメージは入れない（引き抜きで倒すので、
// ここでHPを削ると稀に「刺した時点で死んで頭が残る」になる）
function tentFinPierce(atk) {
  atk.pierced = true;
  addHitstop(CONFIG.tentStabHitstop);
  addShake(CONFIG.tentStabShake);
  tentFovKick = 1;
  doFlash(0.35, '#ff9bb0');
  showFeedback('PIERCE', '#ff9bb0', 38);
  atk.enemy.parts.HEAD.getWorldPosition(_tfHeadW);
  spawnFleshBurst(_tfHeadW, 4, 2.0, null, 1.2);
}

// 引き抜く。頭は破裂させず、体から外して床に転がす
function tentFinRip(atk) {
  atk.crushed = true;
  const en = atk.enemy;
  if (en.state !== E.GRABBED) return;

  const head = en.parts.HEAD;
  head.updateWorldMatrix(true, false);
  head.getWorldPosition(_tfHeadW);
  head.getWorldQuaternion(_tfHeadQ);
  atk.lastHead.copy(_tfHeadW);

  // 体から切り離して、触手に引かれるまま自分の方へ飛ばす。
  // 落下と床での扱いは、ライジングで斬り落とした頭と同じ severedParts に乗せる
  if (head.parent) head.parent.remove(head);
  scene.add(head);
  head.position.copy(_tfHeadW);
  head.quaternion.copy(_tfHeadQ);
  en.glow.material.opacity = 0;      // glow は頭の中にいるので、外す前に消しておく

  // 行き先は自分の少し手前の床上。飛ぶ距離をそのまま速度にするので、
  // どの間合いで決めても目の前に転がってくる（通り過ぎて背後に落ちない）
  _tfToMe.set(playerPos.x - Math.sin(yaw) * 1.2, EYE - 0.35, playerPos.z - Math.cos(yaw) * 1.2)
         .sub(_tfHeadW);
  const flyDist = _tfToMe.length();
  if (flyDist < 0.001) _tfToMe.set(0, 1, 0); else _tfToMe.divideScalar(flyDist);
  const flySpeed = Math.min(CONFIG.tentFinHeadSpeed,
                            Math.max(2.5, flyDist / CONFIG.tentFinHeadHang));
  atk.ripHead = head;              // 触手の先が連れて戻る対象
  severedParts.push({
    obj: head, key: 'HEAD', phase: 'drift',
    dropAt: worldTime + CONFIG.tentFinHeadHang,
    vel: _tfToMe.clone().multiplyScalar(flySpeed),
    spin: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9,
                            (Math.random() - 0.5) * 9),
  });

  // 首からの肉片と血。破裂ではないので頭の破片（spawnHeadBurst）は出さない。
  // 飛沫は自分から離れる向きへ（頭の破裂と同じで、顔に飛んでくると視界が汚れる）
  _tfNeck.set(0, 2.0, 0);
  en.pivotRoot.localToWorld(_tfNeck);
  spawnFleshBurst(_tfNeck, CONFIG.tentFinGibs, CONFIG.tentFinGibSpeed,
                  _tfToMe.clone().negate(), 2.2);
  spawnBloodDecal(en.group.position.x, en.group.position.z, 0.16, 0.5);

  // 頭は外し済みとして倒す（killEnemy は headless なら破裂を重ねない）
  en.headless = true;
  en.grabK = 0;
  en.tentGrab = false;
  applyDamage(en, 999);

  addHitstop(CONFIG.tentFinHitstop);
  addShake(CONFIG.tentFinShake);
  doFlash(0.85, '#ffd8c8');
  showFeedback('HEAD RIPPED', '#ff8f7a', 50);   // killEnemy() の DOWN を上書き
}

/* --- フィニッシャー中の一人称の腕 ---
   頭の方へ向けて突き出し、引っ張るぶん手前へ引き戻すだけ。
   伸びて刺すのはワールド側の触手(tentBeam)の仕事。
   armOut を書き戻しておくと触手の根元も同じだけ動くので、腕と繋がって見える */
const _tfAimDir = new THREE.Vector3();
const _tfAimQ = new THREE.Quaternion();
const _tfFwd = new THREE.Vector3(0, 0, -1);

function poseTentFinisherHand(hand, a) {
  const stab = CONFIG.tentFinStab, pull = CONFIG.tentFinPull, rip = CONFIG.tentFinRip;
  _tfAimDir.copy(a.lastHead).sub(camera.position);
  if (_tfAimDir.lengthSq() < 1e-6) _tfAimDir.set(0, 0, -1);
  _tfAimDir.normalize();
  let out;
  if (a.t < stab) {                                  // 突き出す
    const u = a.t / stab;
    out = 0.34 * (1 - (1 - u) * (1 - u));
  } else if (a.t < stab + pull) {                    // 引っ張る（手は手前へ）
    const u = (a.t - stab) / pull;
    out = 0.34 - 0.64 * u * u;
  } else {                                           // 抜けた反動から戻る
    const u = Math.min(1, (a.t - stab - pull) / rip);
    out = -0.30 * (1 - u) * (1 - u);
  }
  a.armOut = out;
  hand.position.addScaledVector(_tfAimDir, out);
  _tfAimQ.setFromUnitVectors(_tfFwd, _tfAimDir);
  hand.quaternion.slerp(_tfAimQ, 0.55);
}

/* =========================================================
   薙ぎ払い（短押し・左右2コンボ）

   ポーズはここ1か所で計算して、見た目（updateTentacleArms）と
   当たり判定（updateTentacleSweep）の両方が同じ値を見る。
     arcK : -0.45（振りかぶり・反対側） → 1.0（振り抜き） → 0（戻り）
     outK : 触手が前へ伸びる量(0-1)
   判定は「前方の扇をいっぺんに」ではなく、刃の角度を毎フレーム進めて
   前フレームから今フレームまでに通った角度の帯だけを薙ぐ。
   → 振っている最中に入ってきた敵も巻き込めるし、
      1段目(dir=+1)は右へ、2段目(dir=-1)は左へと判定が分かれる
   ========================================================= */
function tentSweepPose(atk, t) {
  const S0 = atk.startup, A1 = CONFIG.tentSweepActive, R = CONFIG.tentSweepRecover;
  if (t < S0) {                                   // 振りかぶり（判定なし）
    const u = t / S0;
    return { arcK: -0.45 * (u * (2 - u)), outK: 0.30 * u };
  }
  if (t < S0 + A1) {                              // 薙ぎ抜き（判定あり）
    const u = (t - S0) / A1;
    return { arcK: -0.45 + 1.45 * (u * (2 - u)),
             outK: 0.30 + 0.70 * (1 - Math.pow(1 - Math.min(1, u * 1.6), 2)) };
  }
  const u = Math.min(1, (t - S0 - A1) / R);       // 戻り
  return { arcK: (1 - u) * (1 - u), outK: (1 - u) * 0.75 };
}

// 刃が今向いている角度(rad)。正＝右、負＝左。
// 判定側だけ振りかぶりを浅くクランプする（見た目は大きく引いたままにしたいので分けてある）
function tentBladeAngle(atk, t) {
  const k = Math.max(-CONFIG.tentSweepHitWindup, tentSweepPose(atk, t).arcK);
  return atk.dir * k * (CONFIG.tentSweepSpan * Math.PI / 180);
}

// onHit: 当たった敵ごとに呼ぶ。省略時は本体の腕の tentSweepHit。
// 阿修羅の追加の腕も同じ帯の判定を使い、当たったときの処理だけ差し替える
function updateTentacleSweep(atk, onHit) {
  onHit = onHit || tentSweepHit;
  const S0 = atk.startup, A1 = CONFIG.tentSweepActive;
  const cur = tentBladeAngle(atk, atk.t);
  if (atk.t < S0 || atk.t > S0 + A1) { atk.prevAng = cur; return; }
  const prev = (atk.prevAng === undefined) ? cur : atk.prevAng;
  atk.prevAng = cur;

  // 前フレームから今フレームまでに刃が通った角度 ＋ 刃の太さ
  const band = CONFIG.tentSweepBand * Math.PI / 180;
  const lo = Math.min(prev, cur) - band, hi = Math.max(prev, cur) + band;
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
  const rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw);

  for (const en of enemies.slice()) {
    if (atk.hitSet.has(en)) continue;             // 1回の振りで同じ敵は1度だけ
    // 拘束中(E.TETHER)は除外しない。片方の腕で掴んだ敵を
    // もう片方の触手で薙ぐのが腕の組み合わせの本線なので、ここで弾くと成立しない
    if (en.state === E.DEAD || en.state === E.FLEE || en.state === E.DODGE ||
        en.state === E.THROWN) continue;
    const dx = en.group.position.x - playerPos.x;
    const dz = en.group.position.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d > CONFIG.tentSweepRange || d < 0.001) continue;
    // 敵の体の太さぶん帯を広げる。遠いほど角度としては細くなるので距離で割る
    const pad = Math.atan2(0.55, Math.max(0.6, d));
    const ang = Math.atan2(dx * rgtX + dz * rgtZ, dx * fwdX + dz * fwdZ);
    if (ang < lo - pad || ang > hi + pad) continue;
    atk.hitSet.add(en);
    onHit(en, atk);
    // フィニッシャーに差し替わったら、この薙ぎはもう進まない（追加の腕は player.attack を持たない）
    if (!atk.extra && player.attack !== atk) return;
  }
}

function tentSweepHit(en, atk) {
  // 死体のフリをしている男を薙いだ＝かくれんぼの先制攻撃
  if (en.boss && en.state === E.HIDDEN) {
    damageArm(atk.side, CONFIG.tentSweepHitCost);
    bossFound(true);
    return;
  }

  // --- 触手のフィニッシャーへの分岐 ---
  // 条件は拳の掴み（resolvePunch）とまったく同じ。スタンの見返りなので、
  // ただHPを削り切っただけでは出さない（finisherOnKill:false）。
  // ボスは掴めない（即死になって3倍HPが意味を失う）。
  // 薙ぎ払いは削り役なので腕HPも減らない＝スタンを取れたときのご褒美に寄せる
  // 拘束中の敵には出さない。伸ばせる触手は1本だけなので、
  // 掴んでいる腕とフィニッシャーの腕がぶつかる
  if (!en.boss && en.state !== E.DEAD && en.state !== E.TETHER &&
      ((CONFIG.finisherOnStun && en.state === E.STUNNED) ||
       (CONFIG.finisherOnKill && en.hp - CONFIG.tentSweepDamage <= 0))) {
    startTentFinisher(en, atk.side);
    return;
  }

  const attacking = (en.state === E.WINDUP || en.state === E.ACTIVE);
  applyDamage(en, CONFIG.tentSweepDamage);
  applyStun(en, CONFIG.tentSweepStun);
  // のけぞりは小さめ。止めるより削る攻撃なので、相手の行動をほぼ奪わない
  if (!attacking && en.state !== E.DEAD && en.state !== E.STUNNED) enterHitReact(en, 0.6);
  damageArm(atk.side, CONFIG.tentSweepHitCost);
  atk.hits++;
  if (attacking) {
    addHitstop(CONFIG.hitstopTrade);
    addShake(CONFIG.shakeNormal * 1.6);
    showFeedback('TRADE!', '#ffb45e', 30);
    return;
  }
  if (en.state === E.TETHER) {
    // もう片方の腕で拘束している敵を薙いだ
    addHitstop(0.04);
    addShake(CONFIG.shakeNormal * 0.9);
    doFlash(0.14, '#ffc2cf');
    showFeedback('PINNED SWEEP  -' + CONFIG.tentSweepDamage, '#ff9bb0', 30);
    return;
  }

  addHitstop(0.04);                               // パンチ(0.07)より軽い＝テンポを殺さない
  addShake(CONFIG.shakeNormal * 0.8);
  if (atk.hits > 1) showFeedback('SWEEP x' + atk.hits, '#ff9bb0', 34);
  else showFeedback('SWEEP', '#e8c0c8', 26);
}

/* --- 触手の見た目 ---
   毎フレーム、節の座標を打ち込み直すだけ。ボーンもスキニングも使っていない。
     1. 理想位置（うねり・薙ぎ・呼吸を乗せた形）を節ごとに作る
     2. 根元は即・先端ほど遅れてその位置へ寄せる
        → 根元から先端へ波が伝わって鞭のように見える
     3. 隣の節との距離を理想どおりに直す（遅れで伸び縮みして切れないように）
   手首より奥（z > -0.50）に来た節は非表示にして、腕の中に引っ込んで見せる  */
const _tIdeal = new THREE.Vector3();

// 手元の触手3本を1フレーム進める（うねり・薙ぎ・遅延追従）。
// 本体の左右の手と、阿修羅の追加の腕で共用
function animateHandTentacles(hand, sideBias, breath, out, arc, step, et) {
  const zWrist = -0.50;
  const root = zWrist + (CONFIG.tentLength - out);   // 根元は腕の中

  for (let i = 0; i < hand.userData.tentacles.length; i++) {
    const tn = hand.userData.tentacles[i];
    const segs = tn.segs, cur = tn.cur, ideal = tn.ideal, n = segs.length;
    const ph = tn.phase + sideBias;
    // たまに1本だけ大きくうねる。鋭いピークにして「不規則だが周期的」にする
    const accent = Math.pow(Math.max(0, Math.sin(et * 0.53 + ph * 1.7)), 6);

    // --- 1. 理想位置 ---
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const z = root - t * CONFIG.tentLength;
      const sOut = zWrist - z;                       // 手首から出ている長さ
      const grow = Math.max(0, Math.min(1, sOut / Math.max(0.05, out)));
      const amp = CONFIG.tentIdleWave * grow * grow *
                  (1 + breath * 0.25) * (1 + accent * CONFIG.tentIdleAccent);
      // 周波数の違うサイン波を重ねる。完全ランダムにしないことで
      // 「生き物がうねっている」読みやすい動きになる
      const w1 = Math.sin(et * CONFIG.tentIdleSpeed + ph + sOut * 7.0);
      const w2 = Math.sin(et * CONFIG.tentIdleSpeed * 1.7 + ph * 1.3 + sOut * 4.0);
      const w3 = Math.cos(et * CONFIG.tentIdleSpeed * 0.9 + ph * 2.0 + sOut * 6.0);
      ideal[k].set(
        tn.lane * CONFIG.tentSpread * (0.4 + grow * 0.6)
          + (w1 * 0.7 + w2 * 0.3) * amp
          + arc * 0.6 * grow,
        w3 * amp * 0.8 + (i === 1 ? 0.03 : -0.02),
        z);
    }

    // --- 2. 遅延追従（根元は即、先端ほど遅れる）---
    if (!tn.init) {
      for (let k = 0; k < n; k++) cur[k].copy(ideal[k]);
      tn.init = true;
    } else {
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const rate = CONFIG.tentFollowRoot +
                     (CONFIG.tentFollowTip - CONFIG.tentFollowRoot) * t;
        cur[k].lerp(ideal[k], 1 - Math.exp(-rate * step));
      }
    }

    // --- 3. 長さ拘束（理想の節間距離に戻す）---
    for (let it = 0; it < 2; it++) {
      for (let k = 1; k < n; k++) {
        const want = ideal[k].distanceTo(ideal[k - 1]);
        _tIdeal.copy(cur[k]).sub(cur[k - 1]);
        const L = _tIdeal.length();
        if (L > 1e-5) cur[k].copy(cur[k - 1]).addScaledVector(_tIdeal.divideScalar(L), want);
      }
    }

    for (let k = 0; k < n; k++) {
      const seg = segs[k];
      if (cur[k].z > zWrist) { seg.visible = false; continue; }   // 腕の中
      seg.visible = true;
      seg.position.copy(cur[k]);
    }
  }
}

function updateTentacleArms(rdt) {
  const et = clock.elapsedTime;
  // 触手のフィニッシャー中は、手元の3本を引っ込めて
  // ワールド側の1本（tentBeam）だけを敵の頭まで伸ばす
  const tentFin = (player.attack && player.attack.type === 'finisher' && player.attack.tent)
                ? player.attack : null;
  // フレーム落ちで遅延追従が飛ばないよう刻みに上限を切る
  const step = Math.max(1 / 240, Math.min(rdt, 1 / 20));

  for (const side of ['LEFT', 'RIGHT']) {
    const st = player.arms[side];
    const hand = fpHands[side];
    if (st.kind !== ARM.TENTACLE || !hand.visible) continue;

    // 左右で位相をずらす。同じ動きだと一対の作り物に見える
    const sideBias = (side === 'LEFT') ? 0 : 1.9;
    // 呼吸。ゆっくり伸び縮みして、止まっていても生きて見える
    const breath = Math.sin(et * CONFIG.tentIdleBreath + sideBias * 0.6);

    let out = CONFIG.tentIdleOut * (1 + breath * 0.09);
    let arc = 0;
    const atk = player.attack;
    if (atk && atk.tent && atk.type === 'punch' && atk.side === side) {
      const p = tentSweepPose(atk, atk.t);
      arc = atk.dir * CONFIG.tentSweepArc * p.arcK;
      out = CONFIG.tentIdleOut + CONFIG.tentSweepOut * p.outK;
      hand.rotateY(-arc * 0.35);         // 腕ごと振る（残りは節の横オフセットで出す）
    }
    // 刺突中は手元の3本を引っ込める（本体はワールド側の tentBeam）
    const holding = !!(tentHold && tentHold.side === side) ||
                    !!(tentFin && tentFin.side === side);
    if (holding) out = CONFIG.tentIdleOut * 0.45;
    // ガード中も引っ込める。腕を横に倒すと触手が画面を横切って前が見えない
    out *= 1 - 0.55 * guardBlend;
    animateHandTentacles(hand, sideBias, breath, out, arc, step, et);
  }

  /* --- 伸ばした触手（ワールド座標）---
     長押しの拘束と、フィニッシャーの引き抜きが同じ1本を使う          */
  if (!tentHold && !tentFin) { tentBeam.visible = false; return; }
  let stuck;
  if (tentFin) {
    // 手元から敵の頭（刺さっている点）まで。刺さるまでは途中で止めて
    // 「伸びていく」ところを見せる
    tentHandOrigin(tentFin.side, _tOrigin);
    _tDir.copy(tentFin.lastHead).sub(_tOrigin);
    if (_tDir.lengthSq() < 1e-6) _tDir.set(0, 0, -1);
    _tDir.normalize();
    // 腕が前後に動いたぶん根元もずらす（突き出し／引き戻しに触手が付いてくる）
    _tOrigin.addScaledVector(_tDir, tentFin.armOut || 0);
    const u = Math.min(1, tentFin.t / CONFIG.tentFinStab);
    let k = 1 - (1 - u) * (1 - u);
    // 引き抜いたあとも頭には刺さったまま（先端は飛んでいく頭を追う）。
    // 離すのは硬直の終わりぎわだけ。早く縮めると「千切れて落ちた」に見える
    const after = tentFin.t - (CONFIG.tentFinStab + CONFIG.tentFinPull);
    const letGo = CONFIG.tentFinRip * 0.55;
    if (after > letGo) k *= Math.max(0, 1 - (after - letGo) / (CONFIG.tentFinRip - letGo));
    _tEnd.copy(_tOrigin).lerp(tentFin.lastHead, k);
    stuck = (u >= 1);
  } else {
    const h = tentHold;
    tentHandOrigin(h.side, _tOrigin);
    if (h.phase === 'stuck' && h.enemy) {
      tentStabWorld(h, _tEnd);        // 刺さっている点そのもの（敵の傾きに追従する）
    } else {
      tentAimDir(_tDir);
      _tEnd.copy(_tOrigin).addScaledVector(_tDir, h.len);
    }
    stuck = (h.phase === 'stuck');
  }
  tentBeam.visible = true;
  _tDir.copy(_tEnd).sub(_tOrigin);
  const length = Math.max(0.001, _tDir.length());
  _tDir.divideScalar(length);
  // 撚りの基準になる直交ベクトル（真上を向いたときだけ基準を替える）
  _tUp.set(0, 1, 0);
  if (Math.abs(_tDir.y) > 0.95) _tUp.set(1, 0, 0);
  _tRight.copy(_tUp).cross(_tDir).normalize();
  _tUp.copy(_tDir).cross(_tRight).normalize();

  const nSeg = tentBeamStrands[0].length;
  // 長く伸ばすほど節の間隔が開くので、粒が切れないよう太さで埋める。
  // ただし手元(t<0.28)は太らせない。カメラのすぐ前なので、ここを太くすると
  // 画面の1/3を触手が塞いで狙えなくなる
  const thick = Math.max(0.9, Math.min(2.2, (length / nSeg) / 0.06));
  const sag = Math.min(0.45, length * 0.035);     // 長いほど少し垂れる
  const twist = et * 3.2;
  for (let s = 0; s < tentBeamStrands.length; s++) {
    const segs = tentBeamStrands[s];
    const base = s * Math.PI * 2 / 3;
    for (let k = 0; k < nSeg; k++) {
      const t = (k + 0.5) / nSeg;
      const th = 1 + (thick - 1) * Math.min(1, t / 0.28);
      // 3本の撚りの太さ。束の幅は手首ぶんに保ちたいので、伸ばしてもあまり広げない
      const r = (0.075 * Math.sin(t * Math.PI * 0.92) * (1 - t * 0.35) + 0.012) *
                (1 + (th - 1) * 0.4);
      const a = base + twist + t * 5.4;
      segs[k].position.copy(_tOrigin)
        .addScaledVector(_tDir, t * length)
        .addScaledVector(_tRight, Math.cos(a) * r)
        .addScaledVector(_tUp, Math.sin(a) * r);
      segs[k].position.y -= Math.sin(t * Math.PI) * sag;
      segs[k].scale.setScalar((0.9 + Math.sin(t * Math.PI) * 0.5) * (stuck ? 1.15 : 1) * th);
    }
  }
}

/* =========================================================
   体スキル（BODY SKILL）
   体ごとに1回だけZで使えるスキル。使うとその体の player.skill.used が立ち、
   中央の体アイコンの縁の光が消える（以後その体では使えない）。

   阿修羅（ASURA）:
     3時・2時（右）／9時・10時（左）の位置に腕が生えて6本腕になる。
     追加の腕は一人称の手（makeFpHand）をそのまま流用し、置き場所だけ変えて
     手先が画面中央を指すように向きを補正している。動き（パンチの振り抜き・
     銃の反動・触手のうねりと薙ぎ）は本体の腕と同じ関数を使う。
     本体の腕が攻撃すると（startPunch / tryShoot から asuraTrigger）、
     同じ側の追加の腕が asuraFollowDelay ずつ遅れて「自分の腕の種類の攻撃」を出す。
     追加の腕は player.attack を持たない（本体の腕のキャンセルや先行入力を邪魔しない）。
     耐久は腕ごとに減って 0 で肉片になる。HUDには出さない。
     生えたときに本体の腕の種類をコピーし、ライジングで本体の腕を
     交換しても変わらない（本体の腕が無ければ拳が生える）。

   回復（HEAL）:
     緑の光の粒が立ちのぼり、画面の縁が緑に光って、体のHPを全回復する。
   ========================================================= */
// 一人称の追加の腕の置き場所（右側。左は x を反転）。カメラ基準のローカル座標。
// 根元は画面の外に置き、手首から先だけが画面の端から中央へ向かって伸びる
const ASURA_SLOTS = [
  { pos: [0.55, -0.05, -0.40], bodyAng: 1.62 },   // 3時（左は9時）
  { pos: [0.45, 0.26, -0.40], bodyAng: 2.25 },    // 2時（左は10時）
];
let asuraArms = [];        // { side, slot, st, hand, pivot, bodyMesh, grow, sprouted, queue, act, dirToggle }
let asuraCombo = 0;        // 追加の腕のヒット数（表示用）
let asuraComboT = 0;

/* --- 検証用：今の体のスキルを差し替える（4/5キー）。未使用に戻る --- */
function setBodySkill(kind) {
  if (state !== S.HUMAN) return;
  clearAsuraArms();
  player.skill = makeBodySkill(kind);
  showFeedback('BODY SKILL: ' + SKILL_LABEL[kind], '#ffd75e', 26);
}

function useBodySkill() {
  // 体があるとき（人間モード）だけ。掴み演出の途中には割り込ませない
  if (state !== S.HUMAN || player.hp <= 0 || inFinisher()) return;
  const sk = player.skill;
  if (!sk) return;
  if (sk.used) { showFeedback('SKILL USED', '#8b8f88', 22); return; }
  sk.used = true;
  hudSkillFire = 0.7;      // HUDの縁が弾けて消える演出
  if (sk.kind === SKILL.HEAL) castHeal(); else castAsura();
}

/* ---------- 阿修羅 ---------- */
function castAsura() {
  const states = [];
  // 3時と9時から先に、少し遅れて2時と10時が生える
  for (let slot = 0; slot < ASURA_SLOTS.length; slot++) {
    for (const side of ['RIGHT', 'LEFT']) {
      const base = player.arms[side];
      const st = base.lost ? makeArmState(ARM.FIST)
                           : makeArmState(base.kind, { swapped: base.swapped });
      states.push({ side, slot, st });
    }
  }
  spawnAsuraArms(states);
  addHitstop(0.08);
  addShake(0.45);
  doFlash(0.30, '#ffcf7a');
  showFeedback('ASURA!', '#ffd75e', 44);
}

function spawnAsuraArms(states) {
  clearAsuraArms();
  states.forEach((d, i) => {
    const sign = d.side === 'LEFT' ? -1 : 1;
    const st = cloneArmState(d.st);
    const hand = makeFpHand(sign);
    applyHandLook(hand, st);
    hand.visible = false;
    // ライジング中に見える三人称の体にも生やす（肩から外へ。少し前へ倒す）
    const pivot = new THREE.Group();
    pivot.rotation.order = 'ZXY';
    pivot.position.set(sign * 0.36, 1.44, -0.02);
    pivot.rotation.set(0.35, 0, sign * ASURA_SLOTS[d.slot].bodyAng);
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.11),
      new THREE.MeshLambertMaterial({ color: armColor(st) }));
    bodyMesh.position.y = -0.31;
    pivot.add(bodyMesh);
    pivot.scale.y = 0.01;
    playerGroup.add(pivot);
    asuraArms.push({
      side: d.side, slot: d.slot, st, hand, pivot, bodyMesh,
      grow: -i * CONFIG.asuraGrowStagger,   // 負の間はまだ生えていない
      sprouted: false, queue: [], act: null, dirToggle: 1,
    });
  });
}

// 体を捨てるとき用。腕の状態だけ取り出して見た目は消す
function stashAsuraArms() {
  if (!asuraArms.length) return null;
  const out = asuraArms.map((xa) => ({ side: xa.side, slot: xa.slot, st: cloneArmState(xa.st) }));
  clearAsuraArms();
  return out;
}

function clearAsuraArms() {
  for (const xa of asuraArms) {
    scene.remove(xa.hand);
    playerGroup.remove(xa.pivot);
  }
  asuraArms = [];
}

// 生え具合(0-1)。少し行き過ぎてから戻る（にょきっと出る）
function asuraGrowK(xa) {
  const g = Math.max(0, Math.min(1, xa.grow / CONFIG.asuraGrowTime));
  if (g <= 0) return 0;
  const c = 1.9, u = g - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

// 本体の腕が攻撃した。同じ側の追加の腕に、遅れて続く攻撃を積む。
// 返り値: 続く腕が1本でもあったか（本体の腕が無いときのクリックで使う）
function asuraTrigger(side) {
  const main = player.attack;
  let n = 0;
  for (const xa of asuraArms) {
    if (xa.side !== side || xa.st.lost) continue;
    if (xa.grow < CONFIG.asuraGrowTime * 0.6) continue;   // 生えきる前は殴らない
    if (xa.queue.length >= 2) continue;
    // 触手の薙ぎは本体の腕と同じ向きに振る（本体が触手でなければ左右交互）
    const dir = (main && main.tent && main.type === 'punch' && main.side === side)
      ? main.dir : (xa.dirToggle = -xa.dirToggle);
    xa.queue.push({ t: CONFIG.asuraFollowDelay * (xa.slot + 1), dir });
    n++;
  }
  return n > 0;
}

// 追加の腕がまだ前の攻撃を振り抜いていないか（本体の腕のキャンセル可能点と同じ考え方）
function asuraBusy(xa) {
  const a = xa.act;
  if (!a) return false;
  if (a.type === 'punch') return a.t < a.startup + CONFIG.punchActive;
  if (a.type === 'sweep') return a.t < a.startup + CONFIG.tentSweepCancel;
  return a.t < CONFIG.gunInterval * 0.5;
}

function asuraStartAct(xa, q) {
  if (asuraBusy(xa)) return;
  const kind = xa.st.kind;
  if (kind === ARM.GUN) {
    xa.act = { type: 'shot', t: 0 };
    asuraShoot(xa);
  } else if (kind === ARM.TENTACLE) {
    xa.act = { type: 'sweep', tent: true, extra: xa, side: xa.side, dir: q.dir, t: 0,
               startup: CONFIG.tentSweepStartup, hitSet: new Set(), hits: 0, prevAng: undefined };
  } else {
    xa.act = { type: 'punch', t: 0, startup: CONFIG.punchStartup, resolved: false };
  }
}

const _xaPos = new THREE.Vector3();
const _xaDir = new THREE.Vector3();
const _xaOut = new THREE.Vector3();
const _xaQ = new THREE.Quaternion();
const _xaFwd = new THREE.Vector3(0, 0, -1);

// 銃の追加の腕。銃口からクロスヘアの先へ撃つ（遠くで中央に集まる）
function asuraShoot(xa) {
  const eye = new THREE.Vector3(playerPos.x, playerPos.y + EYE, playerPos.z);
  const fwd = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const aim = eye.clone().addScaledVector(fwd, 14);
  xa.hand.userData.barrel.getWorldPosition(_xaPos);
  const dir = aim.sub(_xaPos).normalize();
  spawnBullet(_xaPos.clone().addScaledVector(dir, 0.2), dir, xa.side, true);
  damageAsuraArm(xa, CONFIG.gunShotCost);
}

function asuraPunchHit(xa) {
  const en = findTargetEnemy(CONFIG.punchRange, CONFIG.punchAngle);
  if (!en) return;
  asuraHit(en, xa, CONFIG.attackDamage, CONFIG.attackStun, CONFIG.armHitCost);
}

function asuraSweepHit(en, xa, atk) {
  if (en.state === E.GRABBED) return;
  atk.hits++;
  asuraHit(en, xa, CONFIG.tentSweepDamage, CONFIG.tentSweepStun, CONFIG.tentSweepHitCost);
}

// 追加の腕のヒット。掴み（フィニッシャー）は出さない＝それは本体の腕の仕事。
// 回避の判定（checkEnemyEscape）にも数えない。数えると1クリックで3ヒットするので
// 毎回すぐ避けられて「ぼこぼこにする」が成立しない
function asuraHit(en, xa, dmg, stun, cost) {
  if (en.boss && en.state === E.HIDDEN) {
    damageAsuraArm(xa, cost);
    bossFound(true);
    return;
  }
  if (en.state === E.DEAD || en.state === E.FLEE || en.state === E.GRABBED ||
      en.state === E.DODGE) return;
  const mul = CONFIG.asuraDamageMul;
  const attacking = (en.state === E.WINDUP || en.state === E.ACTIVE);
  applyDamage(en, dmg * mul);
  applyStun(en, stun * mul);
  // のけぞりは延長するだけで押し出さない。本体の腕のぶんと重ねて押すと
  // 2時（10時）の腕が届く前に間合い(punchRange)の外へ逃げてしまう
  if (!attacking) {
    if (en.state === E.HIT) en.t = 0;
    else enterHitReact(en, 0.35);
  }
  addHitstop(CONFIG.asuraHitstop);
  addShake(CONFIG.shakeNormal);
  asuraCombo++;
  asuraComboT = 0.7;
  showFeedback('ASURA x' + asuraCombo, '#ffd75e', Math.min(44, 26 + asuraCombo * 2));
  damageAsuraArm(xa, cost);
}

function damageAsuraArm(xa, amount) {
  if (xa.st.lost) return;
  xa.st.hp = Math.max(0, xa.st.hp - amount);
  if (xa.st.hp > 0) return;
  xa.st.lost = true;
  xa.queue.length = 0;
  xa.act = null;
  xa.hand.userData.fore.getWorldPosition(_xaPos);
  spawnFleshBurst(_xaPos, CONFIG.armLostPieces, 3.0, null, CONFIG.armGibLife);
  xa.hand.visible = false;
  xa.pivot.visible = false;
  addShake(0.25);
}

// 毎フレーム：積んだ攻撃を出す → 攻撃を進める → 見た目を置く。
// カメラが決まったあとに呼ぶ（手はカメラ基準で置く）
function updateAsuraArms(dt, rdt) {
  if (asuraComboT > 0) { asuraComboT -= rdt; if (asuraComboT <= 0) asuraCombo = 0; }
  if (!asuraArms.length) return;
  const human = (state === S.HUMAN && player.hp > 0);
  const et = clock.elapsedTime;
  const step = Math.max(1 / 240, Math.min(rdt, 1 / 20));

  for (const xa of asuraArms) {
    xa.grow += rdt;
    if (xa.st.lost) { xa.hand.visible = false; xa.pivot.visible = false; continue; }
    const gk = asuraGrowK(xa);
    xa.pivot.visible = gk > 0;
    xa.pivot.scale.y = Math.max(0.01, gk);

    // --- 積んだ攻撃 ---
    if (!human) xa.queue.length = 0;
    for (let i = 0; i < xa.queue.length; i++) {
      const q = xa.queue[i];
      q.t -= dt;
      if (q.t > 0) continue;
      xa.queue.splice(i--, 1);
      asuraStartAct(xa, q);
      if (xa.st.lost) break;
    }
    if (xa.st.lost) continue;

    // --- 攻撃の進行 ---
    const a = xa.act;
    if (a) {
      a.t += dt;
      if (a.type === 'punch') {
        if (!a.resolved && a.t >= a.startup) { a.resolved = true; if (human) asuraPunchHit(xa); }
        if (a.t >= a.startup + CONFIG.punchRecover) xa.act = null;
      } else if (a.type === 'sweep') {
        if (human) updateTentacleSweep(a, (en, atk) => asuraSweepHit(en, xa, atk));
        if (a.t >= a.startup + CONFIG.tentSweepActive + CONFIG.tentSweepRecover) xa.act = null;
      } else if (a.t >= CONFIG.gunInterval) xa.act = null;
      if (xa.st.lost) continue;
    }

    // --- 一人称の見た目 ---
    const vis = (state === S.HUMAN) && gk > 0;
    xa.hand.visible = vis;
    if (!vis) continue;
    const act = xa.act;
    const sign = xa.side === 'LEFT' ? -1 : 1;
    const P = ASURA_SLOTS[xa.slot].pos;
    const g01 = Math.max(0, Math.min(1, xa.grow / CONFIG.asuraGrowTime));
    _xaPos.set(sign * P[0], P[1], P[2]);
    // 手先が画面中央（前方 asuraAimDist の点）を指す向き
    _xaDir.set(0, 0, -CONFIG.asuraAimDist).sub(_xaPos).normalize();
    // 生えはじめは画面の外側に寄せておき、伸びながら定位置へ入ってくる
    _xaOut.set(sign * P[0], P[1], 0).normalize();
    _xaPos.addScaledVector(_xaOut, 0.30 * (1 - g01));
    let punchOut = 0, recoil = 0;
    if (act && act.type === 'punch') {
      punchOut = swingCurve(act.t, act.startup + CONFIG.punchActive,
                            act.startup + CONFIG.punchRecover) * 0.6;
    } else if (act && act.type === 'shot') {
      recoil = Math.max(0, 1 - act.t / (CONFIG.gunInterval * 0.6));
    }
    _xaPos.addScaledVector(_xaDir, punchOut - recoil * CONFIG.gunRecoil);
    xa.hand.position.copy(_xaPos).applyQuaternion(camera.quaternion).add(camera.position);
    _xaQ.setFromUnitVectors(_xaFwd, _xaDir);
    xa.hand.quaternion.copy(camera.quaternion).multiply(_xaQ);
    // 長さ方向に伸びて出てくる。伸びている間は少しよじれる
    const sc = CONFIG.asuraArmScale;
    const wid = sc * (0.55 + 0.45 * Math.min(1, g01 * 1.4));
    xa.hand.scale.set(wid, wid, sc * Math.max(0.02, gk));
    if (g01 < 1) xa.hand.rotateZ(Math.sin(g01 * Math.PI * 3) * 0.5 * (1 - g01));
    xa.hand.rotateX(punchOut * 0.2 + recoil * 0.35);

    if (xa.st.kind === ARM.TENTACLE) {
      const sideBias = (xa.side === 'LEFT' ? 0 : 1.9) + 0.8 + xa.slot * 1.3;
      const breath = Math.sin(et * CONFIG.tentIdleBreath + sideBias * 0.6);
      let out = CONFIG.tentIdleOut * (1 + breath * 0.09), arc = 0;
      if (act && act.type === 'sweep') {
        const p = tentSweepPose(act, act.t);
        arc = act.dir * CONFIG.tentSweepArc * p.arcK;
        out = CONFIG.tentIdleOut + CONFIG.tentSweepOut * p.outK;
        xa.hand.rotateY(-arc * 0.35);
      }
      animateHandTentacles(xa.hand, sideBias, breath, out, arc, step, et);
    }

    // 生えた瞬間に肩口から肉が少し散る
    if (!xa.sprouted) {
      xa.sprouted = true;
      xa.hand.updateMatrixWorld(true);
      xa.hand.userData.fore.getWorldPosition(_xaPos);
      spawnFleshBurst(_xaPos, 3, 1.4, null, 0.6);
    }
  }
}

/* ---------- 回復 ---------- */
let healFx = [];           // 立ちのぼる緑の粒 { obj, vel, life, max, base }
const healOverlay = document.getElementById('healOverlay');
let healOverlayT = 0;
const healGeo = new THREE.SphereGeometry(1, 8, 6);

function castHeal() {
  const before = player.hp;
  player.hp = CONFIG.playerMaxHp;
  spawnHealFx();
  healOverlayT = CONFIG.healFxTime;
  doFlash(0.30, '#7dffb0');
  addShake(0.12);
  showFeedback('HEAL  +' + Math.round(CONFIG.playerMaxHp - before), '#7fe0a6', 36);
}

function spawnHealFx() {
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(healGeo, new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? 0xc8ffd8 : 0x5cff9a, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    // 体のまわりの輪から立ちのぼる。一人称でも見えるよう、半分は視界の前寄りに置く。
    // カメラに近すぎる粒は画面いっぱいの塊になるので、輪は目から0.8m以上離す
    const a = Math.random() * Math.PI * 2;
    const r = 0.8 + Math.random() * 0.5;
    const front = (i % 2 === 0) ? 1.3 + Math.random() * 0.9 : 0;
    m.position.set(playerPos.x + Math.cos(a) * r + fwdX * front,
                   0.1 + Math.random() * 1.0,
                   playerPos.z + Math.sin(a) * r + fwdZ * front);
    const base = 0.02 + Math.random() * 0.028;
    m.scale.setScalar(base);
    scene.add(m);
    const max = CONFIG.healFxTime * (0.6 + Math.random() * 0.4);
    healFx.push({ obj: m, vel: new THREE.Vector3((Math.random() - 0.5) * 0.3,
                  0.9 + Math.random() * 1.4, (Math.random() - 0.5) * 0.3),
                  life: max, max, base, delay: Math.random() * 0.25 });
  }
}

function updateHealFx(rdt) {
  if (healOverlayT > 0) healOverlayT = Math.max(0, healOverlayT - rdt);
  // 画面の縁の緑。出だしで一気に光って、ゆっくり引く
  const k = healOverlayT / CONFIG.healFxTime;
  healOverlay.style.opacity = String(k > 0.85 ? (1 - k) / 0.15 : k / 0.85);
  if (!healFx.length) return;
  for (const p of healFx) {
    if (p.delay > 0) { p.delay -= rdt; p.obj.visible = false; continue; }
    p.obj.visible = true;
    p.life -= rdt;
    p.obj.position.addScaledVector(p.vel, rdt);
    const u = Math.max(0, p.life / p.max);
    p.obj.material.opacity = 0.9 * Math.min(1, u * 2.5);
    p.obj.scale.setScalar(p.base * (0.6 + 0.4 * u));
  }
  const dead = healFx.filter((p) => p.life <= 0);
  if (!dead.length) return;
  for (const p of dead) { scene.remove(p.obj); p.obj.material.dispose(); }
  healFx = healFx.filter((p) => p.life > 0);
}

function clearHealFx() {
  for (const p of healFx) { scene.remove(p.obj); p.obj.material.dispose(); }
  healFx = [];
  healOverlayT = 0;
}

/* ---------- 画面投影 ---------- */
const _proj = new THREE.Vector3();
function projectToScreen(worldPos) {
  _proj.copy(worldPos).project(camera);
  return {
    x: (_proj.x * 0.5 + 0.5) * window.innerWidth,
    y: (-_proj.y * 0.5 + 0.5) * window.innerHeight,
    front: _proj.z < 1,
  };
}

/* ---------- 切断ターゲットUI ---------- */
// 判定半径は画面高さに比例させる（絶対pxだと高解像度で□を拾えなくなる）
function targetRadius() {
  return CONFIG.targetRadiusPx * window.innerHeight / 720;
}
function hideTargets() { for (const t of targetEntries) t.el.classList.add('hidden'); }

function updateTargets() {
  const active = (state === S.RISE_IN || state === S.RISING);
  if (!active) {
    hideTargets();
    for (const c of corpses) {
      c.el.classList.add('hidden');
      for (const key of ['LEFT', 'RIGHT']) if (c.armEls[key]) c.armEls[key].classList.add('hidden');
    }
    for (const p of severedParts) if (p.el) p.el.classList.add('hidden');
    for (const sl of RACK.slots) sl.el.classList.add('hidden');
    selectedTarget = null;
    return;
  }
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  let best = null, bestDist = Infinity;
  const wp = new THREE.Vector3();

  // --- スタン中の敵の四肢（左腕 / 右腕 / 頭）---
  for (const t of targetEntries) {
    const en = t.enemy;
    const attached = t.pivot.parent === en.pivotRoot;
    if (en.state !== E.STUNNED || !attached ||
        playerPos.distanceTo(en.group.position) > CONFIG.risingInteractRange) {
      t.el.classList.add('hidden'); continue;
    }
    t.pivot.getWorldPosition(wp);
    const scr = projectToScreen(wp);
    if (!scr.front) { t.el.classList.add('hidden'); continue; }
    t.el.classList.remove('hidden');
    t.el.style.left = scr.x + 'px';
    t.el.style.top = scr.y + 'px';
    const d = Math.hypot(scr.x - cx, scr.y - cy);
    if (d < targetRadius() && d < bestDist) {
      best = { kind: 'part', entry: t, el: t.el, world: wp.clone() };
      bestDist = d;
    }
  }

  // --- 死体の首元と腕 ---
  for (const c of corpses) {
    if (playerPos.distanceTo(c.group.position) > CONFIG.risingInteractRange) {
      c.el.classList.add('hidden');
      for (const key of ['LEFT', 'RIGHT']) if (c.armEls[key]) c.armEls[key].classList.add('hidden');
      continue;
    }
    for (const key of ['LEFT', 'RIGHT']) {
      const ae = c.armEls[key], pv = c.armPivots[key];
      if (!ae || !pv) continue;
      pv.getWorldPosition(wp);
      const scrA = projectToScreen(wp);
      if (!scrA.front) { ae.classList.add('hidden'); continue; }
      ae.classList.remove('hidden');
      ae.style.left = scrA.x + 'px';
      ae.style.top = scrA.y + 'px';
      const dA = Math.hypot(scrA.x - cx, scrA.y - cy);
      if (dA < targetRadius() && dA < bestDist) {
        best = { kind: 'corpseArm', corpse: c, key, pivot: pv, el: ae, world: wp.clone() };
        bestDist = dA;
      }
    }
    c.neck.getWorldPosition(wp);
    const scr = projectToScreen(wp);
    if (!scr.front) { c.el.classList.add('hidden'); continue; }
    c.el.classList.remove('hidden');
    c.el.style.left = scr.x + 'px';
    c.el.style.top = scr.y + 'px';
    const d = Math.hypot(scr.x - cx, scr.y - cy);
    if (d < targetRadius() && d < bestDist) {
      best = { kind: 'corpse', corpse: c, el: c.el, world: wp.clone() };
      bestDist = d;
    }
  }

  // --- 床に落ちている腕（自分が交換で外した腕）---
  for (const p of severedParts) {
    if (!p.el) continue;
    if (playerPos.distanceTo(p.obj.position) > CONFIG.risingInteractRange) {
      p.el.classList.add('hidden'); continue;
    }
    const scr = projectToScreen(p.obj.position);
    if (!scr.front) { p.el.classList.add('hidden'); continue; }
    p.el.classList.remove('hidden');
    p.el.style.left = scr.x + 'px';
    p.el.style.top = scr.y + 'px';
    const d = Math.hypot(scr.x - cx, scr.y - cy);
    if (d < targetRadius() && d < bestDist) {
      best = { kind: 'groundArm', part: p, el: p.el, world: p.obj.position.clone() };
      bestDist = d;
    }
  }

  // --- 腕の棚（何度でも取れる見本）---
  for (const sl of RACK.slots) {
    if (playerPos.distanceTo(sl.world) > RACK.range) { sl.el.classList.add('hidden'); continue; }
    const scr = projectToScreen(sl.world);
    if (!scr.front) { sl.el.classList.add('hidden'); continue; }
    sl.el.classList.remove('hidden');
    sl.el.style.left = scr.x + 'px';
    sl.el.style.top = scr.y + 'px';
    const d = Math.hypot(scr.x - cx, scr.y - cy);
    if (d < targetRadius() && d < bestDist) {
      best = { kind: 'rackArm', slot: sl, el: sl.el, world: sl.world.clone() };
      bestDist = d;
    }
  }

  selectedTarget = best;
  for (const sl of RACK.slots) {
    sl.el.classList.toggle('selected', best !== null && sl.el === best.el);
  }
  for (const p of severedParts) {
    if (p.el) p.el.classList.toggle('selected', best !== null && p.el === best.el);
  }
  for (const t of targetEntries) t.el.classList.toggle('selected', best !== null && t.el === best.el);
  for (const c of corpses) {
    c.el.classList.toggle('selected', best !== null && c.el === best.el);
    for (const key of ['LEFT', 'RIGHT']) {
      if (c.armEls[key]) c.armEls[key].classList.toggle('selected', best !== null && c.armEls[key] === best.el);
    }
  }
}

/* ---------- 死体の[F]プロンプト ---------- */
const _cPos = new THREE.Vector3();
function updateCorpseUi() {
  // 頭モード：一番近い死体だけに出す / ライジング：□で選択中のものに出す
  const nearby = findCorpseNearby();
  const picked = (selectedTarget && selectedTarget.kind === 'corpse') ? selectedTarget.corpse : null;
  for (const c of corpses) {
    const show = (c === nearby) || (c === picked);
    if (!show) { c.prompt.classList.add('hidden'); continue; }
    c.neck.getWorldPosition(_cPos);
    _cPos.y += 0.30;
    const scr = projectToScreen(_cPos);
    if (!scr.front) { c.prompt.classList.add('hidden'); continue; }
    if (!c.promptIcon) {
      c.promptIcon = true;
      c.prompt.querySelector('.skill-ico').innerHTML =
        '<svg viewBox="0 0 48 48">' + HUD_ICON[c.skill.kind] + '</svg>';
    }
    c.prompt.classList.remove('hidden');
    c.prompt.style.left = scr.x + 'px';
    c.prompt.style.top = scr.y + 'px';
  }
}

/* ---------- 敵UI ---------- */
const _uiPos = new THREE.Vector3();
function updateEnemyUi() {
  for (const en of enemies) {
    // 死体のフリをしている間はバーも出さない。出したら隠れる意味がない
    if (en.state === E.DEAD || en.state === E.HIDDEN || en.state === E.FLEE) {
      en.ui.root.classList.add('hidden');
      continue;
    }
    // 霧の向こうの敵はバーだけが宙に浮いて見えるので距離で切る
    if (playerPos.distanceTo(en.group.position) > 24) { en.ui.root.classList.add('hidden'); continue; }
    en.group.getWorldPosition(_uiPos);
    _uiPos.y += 2.75;
    const scr = projectToScreen(_uiPos);
    if (scr.front) {
      en.ui.root.classList.remove('hidden');
      en.ui.root.style.left = scr.x + 'px';
      en.ui.root.style.top = scr.y + 'px';
      en.ui.hp.style.width = (en.hp / en.maxHp * 100) + '%';
      en.ui.stun.style.width = (en.stun / CONFIG.enemyStunThreshold * 100) + '%';
      // 状態は文字ではなく色の印で出す。予備動作＝橙、ジャストの瞬間＝白く光る、
      // 攻撃中＝赤、スタン＝黄。それ以外は印を消す
      const just = (en.state === E.WINDUP && isJustTiming(en));
      en.ui.state.className = 'state' +
        (just ? ' just' : en.state === E.WINDUP ? ' windup' : en.state === E.ACTIVE ? ' active' :
         en.state === E.STUNNED ? ' stunned' : '');
    } else en.ui.root.classList.add('hidden');
  }
}


/* =========================================================
   ボス：ダクトの男（DUCT MAN）

   3つの部屋が「ダクト」でだけ繋がったアリーナ。部屋同士の通路は塞がれていて、
   人間の体では隣の部屋へ行けない。頭モードだけがダクトを通れる。
   ——だから彼は「ダクトの男」と呼ばれている。

   ラウンド構成:
     R1  部屋Aで正面から戦う。通常の敵の動きに加えて
           ・プレイヤーのパンチをキックで潰してくる（BOSS_KICK）
           ・ライジングで腕を刈りに来る（BOSS_RISE）
         倒すと首が伸びて頭モードになり、ダクトへ逃げる。体は死体として残る。
     追う プレイヤーもライジング→頭モードでダクトを抜ける
     R2  暗い部屋。大量の死体のどこかに頭を挿して隠れている。
         10秒以内に見つけて殴れば先制ダメージ入りで開幕。
         見つけられなければジャンプスケアから開幕。
         開幕と同時に部屋の死体をほとんど爆散させる（腕と体の補給を絞る）
     R3  レイアウトを変えて同じ流れ。ここで倒すと完全に逃走してボス戦終了。

   隠れている男を見分ける手掛かりは「頭が付いていること」。
   この世界の死体は全部首なしなので、暗がりの中で頭のある1体を探すことになる。
   ========================================================= */

/* ---------- アリーナの寸法 ---------- */
const ARENA = {
  z0: -49, z1: -31,            // 3部屋共通の奥行き
  wallH: 4.2, wallT: 0.6,
  ductH: 2.0,
  rooms: [
    { name: 'DUCT ROOM A', x0: -30, x1: -12 },
    { name: 'DUCT ROOM B', x0: -9, x1: 9 },
    { name: 'DUCT ROOM C', x0: 12, x1: 30 },
  ],
  // 頭モードだけが通れる横穴。部屋 a と b をつなぐ
  ducts: [
    { a: 0, b: 1, x0: -12, x1: -9, z: -35.5, half: 0.85 },
    { a: 1, b: 2, x0: 9, x1: 12, z: -44.5, half: 0.85 },
  ],
  gate: { x0: -22.6, x1: -19.4 },   // 部屋Aの南側にある唯一の入口
};

// 敵の部屋判定（playerInRoom）にそのまま渡せる形
const ARENA_ROOMS = ARENA.rooms.map((r) => ({
  name: r.name, x0: r.x0, x1: r.x1, z0: ARENA.z0, z1: ARENA.z1,
}));

/* ---------- 歩ける範囲 ----------
   壁の当たり判定は持たず、「歩ける矩形の集合」の中にいるかどうかだけ見る。
   ダクトの矩形は頭モードのときだけ有効。矩形同士は少し重ねてあるので、
   部屋→ダクト→部屋が切れ目なく繋がる。                                */
const INSET = 0.5;
const WALK = {
  outside: { x0: -32, x1: 32, z0: -30, z1: 25 },
  gate: { x0: ARENA.gate.x0 + 0.4, x1: ARENA.gate.x1 - 0.4, z0: ARENA.z1 - 0.8, z1: -29.4 },
  rooms: ARENA.rooms.map((r) => ({
    x0: r.x0 + INSET, x1: r.x1 - INSET, z0: ARENA.z0 + INSET, z1: ARENA.z1 - INSET })),
  ducts: ARENA.ducts.map((d) => ({
    x0: d.x0 - 0.7, x1: d.x1 + 0.7, z0: d.z - d.half + 0.2, z1: d.z + d.half - 0.2 })),
};

function inRect(r, x, z) { return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1; }

function walkableAt(x, z, headMode) {
  if (inRect(WALK.outside, x, z) || inRect(WALK.gate, x, z)) return true;
  for (const r of WALK.rooms) if (inRect(r, x, z)) return true;
  if (headMode) for (const d of WALK.ducts) if (inRect(d, x, z)) return true;
  return false;
}

// 壁ずり付き。斜めに壁へ入ったときは通れる軸だけ残す
function confinePlayer(prevX, prevZ) {
  // デモステージは自分の矩形と門だけで閉じている（ハブの矩形とは繋がっていない）
  if (DEMO.active) { demoConfine(); return; }
  const hm = (state === S.HEAD);
  if (walkableAt(playerPos.x, playerPos.z, hm)) return;
  if (walkableAt(playerPos.x, prevZ, hm)) { playerPos.z = prevZ; return; }
  if (walkableAt(prevX, playerPos.z, hm)) { playerPos.x = prevX; return; }
  if (walkableAt(prevX, prevZ, hm)) { playerPos.x = prevX; playerPos.z = prevZ; return; }
  // 直前の位置も無効（ダクトの中で頭モードを抜けた等）。一番近い部屋へ押し出す
  let best = WALK.outside, bd = Infinity;
  for (const r of [WALK.outside].concat(WALK.rooms)) {
    const dx = Math.max(r.x0 - playerPos.x, 0, playerPos.x - r.x1);
    const dz = Math.max(r.z0 - playerPos.z, 0, playerPos.z - r.z1);
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = r; }
  }
  playerPos.x = Math.max(best.x0, Math.min(best.x1, playerPos.x));
  playerPos.z = Math.max(best.z0, Math.min(best.z1, playerPos.z));
}

// プレイヤーが今いるアリーナの部屋index（外にいれば -1）
function arenaRoomIndex() {
  for (let i = 0; i < WALK.rooms.length; i++) {
    const r = WALK.rooms[i];
    if (playerPos.x >= r.x0 - 1 && playerPos.x <= r.x1 + 1 &&
        playerPos.z >= r.z0 - 1 && playerPos.z <= r.z1 + 1) return i;
  }
  return -1;
}

/* ---------- アリーナの建物 ---------- */
const arenaGroup = new THREE.Group();
scene.add(arenaGroup);
const arenaLights = [];
{
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x2b3038 });
  const ductMat = new THREE.MeshLambertMaterial({ color: 0x1d2228 });
  const addBox = (x0, x1, z0, z1, y0, y1, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat || wallMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    arenaGroup.add(m);
    return m;
  };
  const T = ARENA.wallT, H = ARENA.wallH;
  // gaps は [開始, 終了] の配列。壁をその区間だけ抜く
  const wallAlongX = (x0, x1, z, gaps) => {
    const cuts = [x0];
    for (const g of (gaps || [])) cuts.push(g[0], g[1]);
    cuts.push(x1);
    for (let i = 0; i < cuts.length; i += 2)
      if (cuts[i + 1] - cuts[i] > 0.05) addBox(cuts[i], cuts[i + 1], z - T / 2, z + T / 2, 0, H);
  };
  const wallAlongZ = (z0, z1, x, gaps) => {
    const cuts = [z0];
    for (const g of (gaps || [])) cuts.push(g[0], g[1]);
    cuts.push(z1);
    for (let i = 0; i < cuts.length; i += 2)
      if (cuts[i + 1] - cuts[i] > 0.05) addBox(x - T / 2, x + T / 2, cuts[i], cuts[i + 1], 0, H);
  };

  for (let i = 0; i < ARENA.rooms.length; i++) {
    const r = ARENA.rooms[i];
    // 床のタイル。部屋ごとに少し色を変えて区別できるようにする
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(r.x1 - r.x0, ARENA.z1 - ARENA.z0),
      new THREE.MeshLambertMaterial({ color: [0x241d20, 0x1c2026, 0x231f28][i] }));
    tile.rotation.x = -Math.PI / 2;
    tile.position.set((r.x0 + r.x1) / 2, 0.012, (ARENA.z0 + ARENA.z1) / 2);
    arenaGroup.add(tile);

    // 奥の壁
    wallAlongX(r.x0, r.x1, ARENA.z0, null);
    // 手前の壁（部屋Aだけ入口を抜く）
    wallAlongX(r.x0, r.x1, ARENA.z1, i === 0 ? [[ARENA.gate.x0, ARENA.gate.x1]] : null);
    // 左右の壁。ダクトが刺さるところを抜く
    for (const [x, isWest] of [[r.x0, true], [r.x1, false]]) {
      const gaps = [];
      for (const d of ARENA.ducts) {
        const touches = (isWest && Math.abs(d.x1 - x) < 0.01) || (!isWest && Math.abs(d.x0 - x) < 0.01);
        if (touches) gaps.push([d.z - d.half, d.z + d.half]);
      }
      wallAlongZ(ARENA.z0, ARENA.z1, x, gaps);
    }

    const lamp = new THREE.PointLight(0xffc9a0, 0.85, 30);
    lamp.position.set((r.x0 + r.x1) / 2, 3.4, (ARENA.z0 + ARENA.z1) / 2);
    arenaGroup.add(lamp);
    arenaLights.push(lamp);
  }

  // ダクト本体（頭がくぐる横穴）
  for (const d of ARENA.ducts) {
    const dh = ARENA.ductH;
    addBox(d.x0, d.x1, d.z - d.half - T, d.z - d.half, 0, dh, ductMat);
    addBox(d.x0, d.x1, d.z + d.half, d.z + d.half + T, 0, dh, ductMat);
    addBox(d.x0, d.x1, d.z - d.half - T, d.z + d.half + T, dh, dh + 0.3, ductMat);
    // 口。暗い部屋でも見つけられるように薄く光らせておく
    for (const x of [d.x0, d.x1]) {
      const f = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, dh, d.half * 2 + T * 2),
        new THREE.MeshBasicMaterial({ color: 0x49b0c8, transparent: true, opacity: 0.42 }));
      f.position.set(x, dh / 2, d.z);
      arenaGroup.add(f);
    }
  }

  // 入口の目印
  const gateMark = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA.gate.x1 - ARENA.gate.x0, 0.14, 0.9),
    new THREE.MeshBasicMaterial({ color: 0xc8503c, transparent: true, opacity: 0.55 }));
  gateMark.position.set((ARENA.gate.x0 + ARENA.gate.x1) / 2, 0.07, ARENA.z1 + 0.5);
  arenaGroup.add(gateMark);
}

/* ---------- ボス状態 ---------- */
const BOSS = {
  phase: 'IDLE',   // IDLE / FIGHT / FLEE / WAIT / HIDE / SCARE / CLEAR
  round: 0,
  room: 0,         // 今戦っている部屋index
  next: 0,         // 逃げた先の部屋index
  timer: 0,
  hideBody: null,  // 男が頭を挿している死体
  props: [],       // 遮蔽物
  spawned: [],     // このアリーナで作った死体
  burst: [],       // 爆散待ちの死体
  burstT: 0,
  scareT: 0,
  camLock: false,
  preempt: false,
};
let bossMan = null;
let stolenArms = [];     // 奪われて飛んでいく腕の演出

// 同じ seed なら同じ配置になる簡易乱数（ラウンドごとにレイアウトを変える）
function bossRng(seed) {
  let x = (seed * 2654435761) >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

/* ---------- カウントダウン ---------- */
const bossUi = {
  hud: document.getElementById('bossHud'),
  bar: document.getElementById('bossBarFill'),
  count: document.getElementById('bossCount'),
  scare: document.getElementById('scareVignette'),
};

/* ---------- ダクトの男の生成 ---------- */
function createBossMan() {
  const en = createEnemy(0, 0, ARM.FIST, ARM.FIST);
  en.boss = true;
  en.maxHp = CONFIG.enemyMaxHp * CONFIG.bossHpMul;
  en.hp = en.maxHp;
  en.torsoColor = 0x2e3944;
  en.headColor = 0x93a6b2;
  en.torso.material.color.setHex(en.torsoColor);
  en.headMat.color.setHex(en.headColor);
  en.group.scale.setScalar(1.12);
  en.room = null;                 // 部屋判定はボス側の phase で持つ
  en.home = new THREE.Vector3();
  en.kickCd = 0; en.riseCd = 0; en.bonusDamage = 0; en.stolen = 0;
  en.armMesh = { LEFT: en.parts.LEFT.children[0], RIGHT: en.parts.RIGHT.children[0] };
  en.armBaseColor = COLOR_ENEMY_ARM;

  // 目印のバイザー。暗い部屋でも「敵の頭」だと分かるように光らせる
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.07, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x59e0ff }));
  visor.position.set(0, 0.04, 0.26);
  en.parts.HEAD.add(visor);
  en.visor = visor;

  // --- ライジング用のリグ（伸びる首と、腕を刈る2本の刃）---
  const neckSegs = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.10),
      new THREE.MeshLambertMaterial({ color: 0xd9d2c4 }));
    m.visible = false;
    en.pivotRoot.add(m);
    neckSegs.push(m);
  }
  const blades = [];
  for (const sgn of [-1, 1]) {
    const root = new THREE.Group();
    root.position.set(sgn * 0.24, 2.02, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 1.30),
      new THREE.MeshLambertMaterial({ color: 0x272d34 }));
    arm.position.z = 0.65;
    root.add(arm);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.46),
      new THREE.MeshLambertMaterial({ color: 0xd9d2c4 }));
    claw.position.z = 1.45;
    root.add(claw);
    root.visible = false;
    en.pivotRoot.add(root);
    blades.push({ root, sgn });
  }
  en.rig = { neckSegs, blades, riseK: 0 };

  buildEnemyUi(en);
  en.group.visible = false;
  setEnemyState(en, E.IDLE);
  bossMan = en;
  return en;
}

// 伸びる首と刃の見た目。riseK は BOSS_RISE / FLEE の進行に合わせて動く
function updateBossRig(en, dt) {
  const rig = en.rig;
  const rising = (en.state === E.BOSS_RISE || en.state === E.FLEE);
  if (!rising) rig.riseK += (0 - rig.riseK) * Math.min(1, dt * 9);
  const k = rig.riseK;
  const lift = 0.95 * k;
  en.parts.HEAD.position.y = 2.12 + lift;

  const show = k > 0.02;
  for (let i = 0; i < rig.neckSegs.length; i++) {
    const seg = rig.neckSegs[i];
    seg.visible = show;
    if (!show) continue;
    const u = (i + 0.5) / rig.neckSegs.length;
    seg.position.set(0, 1.95 + (2.12 + lift - 1.95) * u, 0);
  }
  // 刃はプレイヤーの方を向いて伸びる。振り抜きで内側へ薙ぐ
  const toP = playerPos.clone().sub(en.group.position); toP.y = 0;
  const localYaw = (toP.lengthSq() > 0.001)
    ? Math.atan2(toP.x, toP.z) - en.group.rotation.y : 0;
  const sweep = (en.state === E.BOSS_RISE)
    ? Math.max(0, (en.t - CONFIG.bossRiseWindup) / 0.22) : 0;
  for (const b of rig.blades) {
    b.root.visible = show && en.state === E.BOSS_RISE;
    if (!b.root.visible) continue;
    b.root.scale.setScalar(0.25 + 0.75 * k);
    b.root.rotation.y = localYaw + b.sgn * (0.55 - 0.5 * k) - b.sgn * Math.min(1, sweep) * 0.8;
    b.root.rotation.x = -0.15 + 0.30 * k;
    b.root.position.y = 2.02 + lift * 0.85;
  }
}

/* ---------- レイアウト生成 ---------- */
function clearArenaProps() {
  for (const m of BOSS.props) scene.remove(m);
  BOSS.props = [];
}
function clearArenaCorpses() {
  for (const c of BOSS.spawned.slice()) if (corpses.indexOf(c) >= 0) removeCorpse(c);
  BOSS.spawned = [];
  BOSS.hideBody = null;
}

// 部屋の中に死体と遮蔽物をばらまく。seed が同じなら同じ配置
function buildRoomLayout(idx, seed, corpseCount, coverCount) {
  const r = ARENA.rooms[idx];
  const rng = bossRng(seed);
  const cx = (r.x0 + r.x1) / 2, cz = (ARENA.z0 + ARENA.z1) / 2;
  const propMat = new THREE.MeshLambertMaterial({ color: 0x39404a });

  for (let i = 0; i < coverCount; i++) {
    const w = 1.0 + rng() * 1.4, h = 1.2 + rng() * 1.3, d = 1.0 + rng() * 1.2;
    const x = r.x0 + 2.2 + rng() * (r.x1 - r.x0 - 4.4);
    const z = ARENA.z0 + 2.2 + rng() * (ARENA.z1 - ARENA.z0 - 4.4);
    if (Math.hypot(x - cx, z - cz) < 3.0) continue;   // 中央は開けておく
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), propMat);
    m.position.set(x, h / 2, z);
    m.rotation.y = rng() * 0.8;
    scene.add(m);
    BOSS.props.push(m);
  }

  for (let i = 0; i < corpseCount; i++) {
    const x = r.x0 + 1.6 + rng() * (r.x1 - r.x0 - 3.2);
    const z = ARENA.z0 + 1.6 + rng() * (ARENA.z1 - ARENA.z0 - 3.2);
    if (Math.hypot(x - cx, z - cz) < 2.2) continue;
    const c = createCorpse(x, z, rng() * Math.PI * 2, {
      enemyStyle: rng() < 0.6,
      arms: (rng() < 0.35) ? { LEFT: null } : undefined,   // 腕が欠けた死体も混ぜる
      fuse: null,
    });
    BOSS.spawned.push(c);
  }
}

/* ---------- ラウンド進行 ---------- */
function resetBoss() {
  BOSS.phase = 'IDLE'; BOSS.round = 0; BOSS.room = 0; BOSS.next = 0;
  BOSS.timer = 0; BOSS.burst = []; BOSS.burstT = 0; BOSS.scareT = 0;
  BOSS.camLock = false; BOSS.preempt = false;
  BOSS.scarePosed = false; BOSS.scareHit = false;
  clearArenaProps();
  BOSS.spawned = []; BOSS.hideBody = null;
  for (const a of stolenArms) scene.remove(a.obj);
  stolenArms = [];
  bossUi.hud.classList.add('hidden');
  bossUi.count.classList.add('hidden');
  hideSubtitle();
  bossUi.scare.style.opacity = '0';
  if (bossMan) {
    const en = bossMan;
    en.hp = en.maxHp; en.stun = 0; en.shoveLeft = 0; en.consecutiveHits = 0;
    en.kickCd = 0; en.riseCd = 0; en.bonusDamage = 0; en.stolen = 0;
    en.headless = false; en.grabK = 0; en.activeHitDone = false;
    en.rig.riseK = 0;
    en.group.visible = false;
    en.group.position.set(0, 0, ARENA.z0 - 20);   // 画面外へ退避
    en.pivotRoot.rotation.set(0, 0, 0);
    en.pivotRoot.position.set(0, 0, 0);
    for (const key of ['LEFT', 'RIGHT']) {
      const part = en.parts[key];
      if (part.parent !== en.pivotRoot) { if (part.parent) part.parent.remove(part); en.pivotRoot.add(part); }
      part.position.set(key === 'RIGHT' ? -0.68 : 0.68, 1.82, 0);
      part.rotation.set(0, 0, 0); part.quaternion.set(0, 0, 0, 1); part.visible = true;
      en.armMesh[key].material.color.setHex(en.armBaseColor);
    }
    en.parts.HEAD.visible = true;
    en.parts.HEAD.position.set(0, 2.12, 0);
    setEnemyState(en, E.IDLE);
    updateBossRig(en, 1);
  }
}

// 部屋Aに入った or [B] で開始
function startBossFight() {
  resetBoss();
  clearArenaCorpses();
  BOSS.round = 1; BOSS.room = 0;
  buildRoomLayout(0, 101, CONFIG.bossRoundCorpses, 4);
  beginRound(0, false);
  say('ダクトの男：また来たのか', 3.0);
}

// 部屋 idx でラウンド開始。preempt = 先制攻撃が成立していたか
function beginRound(idx, preempt, burst) {
  const en = bossMan;
  const r = ARENA.rooms[idx];
  BOSS.room = idx;
  BOSS.phase = 'FIGHT';
  BOSS.timer = 0;
  bossUi.count.classList.add('hidden');
  en.group.visible = true;
  en.group.position.set((r.x0 + r.x1) / 2, 0, (ARENA.z0 + ARENA.z1) / 2);
  en.hp = en.maxHp * (preempt ? (1 - CONFIG.bossPreemptiveDamage) : 1);
  en.stun = 0; en.shoveLeft = 0; en.consecutiveHits = 0; en.activeHitDone = false;
  en.cooldown = 1.2; en.kickCd = 1.5; en.riseCd = 4.0;
  en.rig.riseK = 0;
  setEnemyState(en, E.IDLE);
  bossUi.hud.classList.remove('hidden');

  // かくれんぼ明けは開幕に部屋の死体をほとんど爆散させる。
  // 派手さと、腕・体の補給を絞る目的。第1ラウンドは死体だらけのまま戦わせる
  if (burst) queueCorpseBurst();
}

// 残す数だけ残して、順番に爆散させるキューを作る
function queueCorpseBurst() {
  const live = BOSS.spawned.filter((c) => corpses.indexOf(c) >= 0 && c !== BOSS.hideBody);
  // プレイヤーから遠い順に爆散させる（近くのものが残ると補給が楽すぎる）
  live.sort((a, b) => playerPos.distanceTo(b.group.position) - playerPos.distanceTo(a.group.position));
  BOSS.burst = live.slice(0, Math.max(0, live.length - CONFIG.bossBurstKeep));
  BOSS.burstT = 0;
}

// ダメージなしの爆散。開幕で20体ぶんのダメージを受けたら即死するので演出専用
function burstCorpseSpectacle(c) {
  const at = new THREE.Vector3();
  c.neck.getWorldPosition(at); at.y -= 0.5;
  spawnFleshBurst(at, 10, CONFIG.corpseBurstSpeed);
  if (selectedTarget && (selectedTarget.kind === 'corpse' || selectedTarget.kind === 'corpseArm') &&
      selectedTarget.corpse === c) selectedTarget = null;
  removeCorpse(c);
  const i = BOSS.spawned.indexOf(c);
  if (i >= 0) BOSS.spawned.splice(i, 1);
  addShake(0.12);
}

/* ---------- 倒された ---------- */
function bossDefeated(en) {
  en.hp = 0;
  en.stun = 0;
  if (BOSS.round >= 3) {
    // 3ラウンド目。完全に逃走してボス戦終了
    BOSS.phase = 'CLEAR';
    setEnemyState(en, E.FLEE);
    en.fleeT = 0; en.fleeStage = 'rise';
    say('ダクトの男：……次は殺す', 4.0);
    showFeedback('BOSS CLEAR', '#ffd75e', 46);
    doFlash(0.5, '#ffe9a0'); addShake(0.7);
  } else {
    BOSS.phase = 'FLEE';
    setEnemyState(en, E.FLEE);
    en.fleeT = 0; en.fleeStage = 'rise';
    showFeedback('DOWN', '#ff8f7a', 36);
    addHitstop(0.2); addShake(0.5); doFlash(0.4, '#ffd0c0');
  }
}

// 首が伸びて頭だけになり、ダクトへ飛び込む
function updateBossFlee(en, wdt) {
  en.fleeT += wdt;
  if (en.fleeStage === 'rise') {
    en.rig.riseK = Math.min(1, en.fleeT / CONFIG.bossFleeRise);
    if (en.fleeT >= CONFIG.bossFleeRise) {
      // 体は死体として残る（プレイヤーが乗っ取れる。ここが唯一まともな補給）
      const c = createCorpse(en.group.position.x, en.group.position.z, en.group.rotation.y,
        { enemyStyle: true, arms: armsFromEnemy(en), fuse: null });
      BOSS.spawned.push(c);
      const at = new THREE.Vector3();
      en.parts.HEAD.getWorldPosition(at);
      en.group.visible = false;
      fleeHead.visible = true;
      fleeHead.position.copy(at);
      en.fleeStage = 'travel';
      en.fleeT = 0;
      en.fleeFrom = at.clone();
      // 逃げ込むダクト。CLEAR のときは隣室が無いこともあるので index を丸める
      const di = Math.min(ARENA.ducts.length - 1, BOSS.room);
      const d = ARENA.ducts[di];
      const goRight = (d.a === BOSS.room);
      en.fleeMid = new THREE.Vector3(goRight ? d.x0 : d.x1, 1.05, d.z);
      en.fleeTo = new THREE.Vector3(goRight ? d.x1 : d.x0, 1.05, d.z);
      BOSS.next = goRight ? d.b : d.a;
      addShake(0.4);
      doFlash(0.25, '#9ce8ff');
      say('ダクトの男：ついてこい', 2.6);
    }
  } else if (en.fleeStage === 'travel') {
    const k = Math.min(1, en.fleeT / CONFIG.bossFleeTravel);
    const e = k * k * (3 - 2 * k);
    if (e < 0.6) fleeHead.position.lerpVectors(en.fleeFrom, en.fleeMid, e / 0.6);
    else fleeHead.position.lerpVectors(en.fleeMid, en.fleeTo, (e - 0.6) / 0.4);
    fleeHead.rotation.y += wdt * 6;
    if (k >= 1) {
      fleeHead.visible = false;
      en.fleeStage = 'gone';
      if (BOSS.phase === 'CLEAR') {
        bossUi.hud.classList.add('hidden');
      } else {
        BOSS.phase = 'WAIT';
      }
    }
  }
}

// 逃げる頭（本体とは別オブジェクト）
const fleeHead = new THREE.Group();
{
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10),
    new THREE.MeshLambertMaterial({ color: 0x93a6b2 }));
  fleeHead.add(s);
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x59e0ff }));
  v.position.set(0, 0.04, 0.25);
  fleeHead.add(v);
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xd9d2c4 }));
    t.position.set(0, -0.05 - i * 0.03, -0.24 - i * 0.13);
    fleeHead.add(t);
  }
  fleeHead.visible = false;
  scene.add(fleeHead);
}

/* ---------- かくれんぼ ---------- */
// 隣の部屋に着いた瞬間に呼ばれる
function startHidePhase(idx) {
  const en = bossMan;
  BOSS.round++;
  BOSS.room = idx;
  BOSS.phase = 'HIDE';
  BOSS.timer = CONFIG.bossHideTime;
  BOSS.preempt = false;
  clearArenaProps();
  clearArenaCorpses();
  // ラウンドごとに seed を変える＝レイアウトが変わる
  buildRoomLayout(idx, 700 + BOSS.round * 37, CONFIG.bossHideCorpses, 6);

  // どれか1体に頭を挿して隠れる。首なしだらけの中で「頭がある」のが手掛かり
  const pool = BOSS.spawned.filter((c) => corpses.indexOf(c) >= 0);
  const c = pool[Math.floor(bossRng(BOSS.round * 91 + 3)() * pool.length)] || pool[0];
  BOSS.hideBody = c;
  attachBossHead(c);

  // 当たり判定は本体（見えない敵）が持つ。位置だけ死体に合わせる
  en.group.visible = false;
  en.group.position.set(c.group.position.x, 0, c.group.position.z);
  en.hp = en.maxHp;
  en.stun = 0; en.rig.riseK = 0;
  setEnemyState(en, E.HIDDEN);

  bossUi.hud.classList.add('hidden');
  bossUi.count.classList.remove('hidden');
  say('ダクトの男：見つけてみろ', 3.2);
}

// 隠れている死体に頭を生やす（唯一の手掛かり）
function attachBossHead(c) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10),
    new THREE.MeshLambertMaterial({ color: 0x93a6b2 }));
  head.position.y = 0.26;
  g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.055, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x2b6470 }));   // 暗いので光らせすぎない
  visor.position.set(0, 0.30, 0.25);
  g.add(visor);
  c.neck.add(g);
  c.bossHead = g;
}

// 見つけた（殴った or 乗っ取ろうとした）
function bossFound(byAttack) {
  if (BOSS.phase !== 'HIDE') return;
  BOSS.preempt = true;
  bossUi.count.classList.add('hidden');
  showFeedback('先制攻撃！', '#ffd75e', 46);
  doFlash(0.5, '#ffe9a0');
  addShake(0.6); addHitstop(0.22);
  say('ダクトの男：見つけたか', 2.4);
  revealAndStart(true);
}

// 隠れていた死体から出てきて戦闘開始
function revealAndStart(preempt) {
  const en = bossMan;
  const c = BOSS.hideBody;
  if (c && corpses.indexOf(c) >= 0) {
    const at = new THREE.Vector3();
    c.neck.getWorldPosition(at);
    spawnFleshBurst(at, 8, 4.0);
    removeCorpse(c);
    const i = BOSS.spawned.indexOf(c);
    if (i >= 0) BOSS.spawned.splice(i, 1);
  }
  BOSS.hideBody = null;
  // 立ち上がる位置はプレイヤーから少し離す（開幕即殴りにならないように）
  const r = ARENA.rooms[BOSS.room];
  const away = new THREE.Vector3(en.group.position.x - playerPos.x, 0, en.group.position.z - playerPos.z);
  if (away.lengthSq() < 0.01) away.set(0, 0, 1);
  away.normalize();
  const px = Math.max(r.x0 + 1.5, Math.min(r.x1 - 1.5, playerPos.x + away.x * 3.2));
  const pz = Math.max(ARENA.z0 + 1.5, Math.min(ARENA.z1 - 1.5, playerPos.z + away.z * 3.2));
  en.group.position.set(px, 0, pz);
  beginRound(BOSS.room, preempt, true);
}

/* ---------- ジャンプスケア ---------- */
function startJumpscare() {
  BOSS.phase = 'SCARE';
  BOSS.scareT = 0;
  bossUi.count.classList.add('hidden');
  hideSubtitle();
}

function updateJumpscare(dt) {
  const en = bossMan;
  BOSS.scareT += dt;
  const D = CONFIG.bossJumpscareDelay, TU = CONFIG.bossJumpscareTurn, HO = CONFIG.bossJumpscareHold;

  if (BOSS.scareT < D) {
    // 「間」。カウントが0になっても何も起きない時間を作る
    if (BOSS.hideBody) { /* まだ死体のフリ */ }
    return;
  }
  if (!BOSS.scarePosed) {
    BOSS.scarePosed = true;
    // 真後ろに立たせて、頭をカメラの高さへ持ってくる。
    // 頭モードのままカウントが尽きることもあるので playerPos ではなくカメラ基準
    const bx = camera.position.x + Math.sin(yaw) * 1.15;
    const bz = camera.position.z + Math.cos(yaw) * 1.15;
    en.group.visible = true;
    en.group.position.set(bx, 0, bz);
    en.group.rotation.y = yaw + Math.PI;
    // 頭の世界Y = (2.12 + pivot.y) * 1.12。カメラの高さに合わせる
    en.pivotRoot.position.y = camera.position.y / 1.12 - 2.12;
    en.pivotRoot.rotation.x = 0.25;
    setEnemyState(en, E.HIDDEN);          // まだ動かさない
    BOSS.scareYaw0 = yaw;
    BOSS.camLock = true;
    player.stagger = Math.max(player.stagger, TU + HO);
    // 隠れていた死体はもう不要
    if (BOSS.hideBody && corpses.indexOf(BOSS.hideBody) >= 0) {
      removeCorpse(BOSS.hideBody);
      const i = BOSS.spawned.indexOf(BOSS.hideBody);
      if (i >= 0) BOSS.spawned.splice(i, 1);
    }
    BOSS.hideBody = null;
  }

  const t = BOSS.scareT - D;
  if (t < TU) {
    // 一気に振り向く
    const u = Math.min(1, t / TU);
    const e = 1 - Math.pow(1 - u, 3);
    yaw = BOSS.scareYaw0 + Math.PI * e;
    pitch += (0 - pitch) * Math.min(1, dt * 14);
    if (!BOSS.scareHit && u >= 0.85) {
      BOSS.scareHit = true;
      addShake(1.2); addHitstop(0.12);
      doFlash(0.65, '#ff4436');
      showFeedback('！！', '#ff6b5e', 72);
      say('ダクトの男：うしろだ', 2.2);
    }
    bossUi.scare.style.opacity = String(0.25 + 0.5 * u);
  } else if (t < TU + HO) {
    // 顔アップで固定。頭だけ細かく震わせる
    const u = (t - TU) / HO;
    en.pivotRoot.rotation.z = Math.sin(clock.elapsedTime * 42) * 0.05 * (1 - u);
    // 振り向き終わっているので、こちらの正面（-sin, -cos）に貼り付ける
    // 前のめりの分だけ頭が寄るので、体は少し引いた位置に置く（頭が画面に収まる距離）
    en.group.position.x += (camera.position.x - Math.sin(yaw) * 1.62 - en.group.position.x) * 0.4;
    en.group.position.z += (camera.position.z - Math.cos(yaw) * 1.62 - en.group.position.z) * 0.4;
    en.group.rotation.y = yaw;                 // こちらを向く
    en.pivotRoot.position.y = camera.position.y / 1.12 - 2.12;
    bossUi.scare.style.opacity = String(0.75 * (1 - u * 0.6));
  } else {
    // そのまま第2/第3ラウンド開始
    bossUi.scare.style.opacity = '0';
    BOSS.camLock = false;
    BOSS.scarePosed = false; BOSS.scareHit = false;
    en.pivotRoot.position.y = 0;
    en.pivotRoot.rotation.set(0, 0, 0);
    revealAndStart(false);
  }
}

/* ---------- ボスAI（通常の敵の状態機械への追加分）----------
   updateEnemy() の switch の前に呼ばれ、true を返すとボス専用の処理で
   そのフレームを打ち切る。false ならいつもの敵として動く。            */
function updateBossState(en, wdt) {
  if (en.kickCd > 0) en.kickCd -= wdt;
  if (en.riseCd > 0) en.riseCd -= wdt;

  // ボス戦が始まっていない（リセット直後・ハブ・デモ中）あいだは何もしない。
  // ダクトの男は enemies に入ったまま、見えない状態でアリーナの奥に退避している。
  // ここで止めないと通常の敵AIに落ち、部屋判定(room)も無いのでプレイヤーを
  // どこまでも追ってきて、見えないまま殴ってくる（リセットから約40秒後に届く）
  if (BOSS.phase === 'IDLE') return true;
  if (en.state === E.HIDDEN) return true;              // 死体のフリ。何もしない
  if (en.state === E.FLEE) { updateBossFlee(en, wdt); return true; }

  if (en.state === E.BOSS_KICK) {
    if (en.t >= CONFIG.bossKickStartup && !en.kickDone) {
      en.kickDone = true;
      bossKickHit(en);
    }
    if (en.t >= CONFIG.bossKickStartup + 0.34) {
      en.kickDone = false; en.cooldown = 0.7;
      bossEndMove(en);
    }
    return true;
  }

  if (en.state === E.BOSS_RISE) {
    const W = CONFIG.bossRiseWindup;
    en.rig.riseK = Math.min(1, en.t / (W * 0.65));
    if (en.t >= W && !en.riseDone) { en.riseDone = true; bossArmCut(en); }
    if (en.t >= W + CONFIG.bossRiseRecover) {
      en.riseDone = false; en.riseCd = CONFIG.bossRiseCooldown;
      en.cooldown = 1.0;
      bossEndMove(en);
    }
    return true;
  }

  // --- ここから新しくボス行動へ入るか ---
  if (BOSS.phase !== 'FIGHT') return false;
  if (en.state !== E.IDLE && en.state !== E.MOVE) return false;
  const dist = playerPos.distanceTo(en.group.position);
  if (en.riseCd <= 0 && dist <= CONFIG.bossRiseRange && state === S.HUMAN && player.hp > 0) {
    en.riseDone = false;
    setEnemyState(en, E.BOSS_RISE);
    showFeedback('腕を狙っている！', '#ff9c6a', 34);
    say('ダクトの男：その腕をよこせ', 1.6);
    addShake(0.18);
    return true;
  }
  return false;
}

// アーマー中に溜め切ったスタンは、技を出し切ったところで効く。
// 「止められないが、殴った分はちゃんと残る」ようにするため
function bossEndMove(en) {
  if (en.stun >= CONFIG.enemyStunThreshold) enterStun(en);
  else setEnemyState(en, E.IDLE);
}

// プレイヤーがパンチを出した瞬間に呼ばれる。たまに割り込んで潰しに来る
function bossTryCounterKick() {
  const en = bossMan;
  if (!en || BOSS.phase !== 'FIGHT' || en.kickCd > 0) return;
  if (en.state !== E.IDLE && en.state !== E.MOVE &&
      en.state !== E.WINDUP && en.state !== E.RECOVERY) return;
  if (playerPos.distanceTo(en.group.position) > CONFIG.kickRange + 0.5) return;
  if (Math.random() > CONFIG.bossKickChance) return;
  en.kickCd = CONFIG.bossKickCooldown;
  en.kickDone = false;
  setEnemyState(en, E.BOSS_KICK);
  showFeedback('COUNTER', '#ffb45e', 30);
}

function bossKickHit(en) {
  const dist = playerPos.distanceTo(en.group.position);
  if (dist > CONFIG.kickRange + 0.6) { showFeedback('MISS', '#6e7268', 22); return; }
  if (player.invuln > 0) { showFeedback('DODGE', '#9ce8ff', 26); return; }
  // 出しかけの攻撃ごと潰される。stagger の間は先行入力も含めて何も出せない
  player.attack = null;
  punchBuffer = null;
  player.stagger = CONFIG.bossKickStagger;
  damagePlayer(CONFIG.bossKickDamage);
  const away = new THREE.Vector3(playerPos.x - en.group.position.x, 0, playerPos.z - en.group.position.z);
  if (away.lengthSq() > 0.001) playerPos.addScaledVector(away.normalize(), 1.1);
  addHitstop(0.14); addShake(0.55);
  doFlash(0.42, '#ff6a4a');
  showFeedback('CANCELLED!', '#ff8f5e', 38);
  if (player.hp <= 0) showFeedback('YOU DOWN — [G] RESET', '#ff6b5e', 30);
}

// ライジングの振り抜き。ドッジ・射程外なら空振り、当たれば腕を1本持っていかれる
function bossArmCut(en) {
  const dist = playerPos.distanceTo(en.group.position);
  addShake(0.4);
  if (dist > CONFIG.bossRiseRange) { showFeedback('MISSED', '#7fc4a0', 30); return; }
  if (player.invuln > 0) { showFeedback('JUST DODGE!', '#9ce8ff', 36); doFlash(0.2, '#9ce8ff'); return; }
  if (state !== S.HUMAN) { showFeedback('MISSED', '#7fc4a0', 30); return; }

  const sides = ['LEFT', 'RIGHT'].filter((s) => !player.arms[s].lost);
  if (!sides.length) {
    // 腕が無いなら普通の一撃として入る
    damagePlayer(CONFIG.enemyDamageToPlayer);
    doFlash(0.4, '#ff3b30'); addShake(0.4);
    showFeedback('SLASHED', '#ff6b5e', 32);
    return;
  }
  const side = sides[Math.floor(Math.random() * sides.length)];
  const st = player.arms[side];
  const from = new THREE.Vector3();
  fpHands[side].userData.fist.getWorldPosition(from);

  // 奪った腕は同じ側に付ける（右手を取られたら男の右手になる）
  const bossSide = side;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18),
    new THREE.MeshLambertMaterial({ color: st.kind === ARM.GUN ? COLOR_GUN_ARM : COLOR_PLAYER_ARM }));
  mesh.position.copy(from);
  scene.add(mesh);
  stolenArms.push({ obj: mesh, from: from.clone(), en, key: bossSide, t: 0 });

  st.lost = true; st.hp = 0; st.purged = false;
  gunHold[side] = false;
  if (player.attack && player.attack.side === side) player.attack = null;
  updateArmVisuals();
  en.stolen++;
  en.bonusDamage = en.stolen * CONFIG.bossStolenArmDamage;
  addHitstop(0.24); addShake(0.8);
  doFlash(0.55, '#ff5a48');
  showFeedback(side[0] + ' ARM TAKEN', '#ff6b5e', 42);
  say('ダクトの男：もらっておく', 2.2);
}

// 奪われた腕が男の肩へ飛んでいく
function updateStolenArms(dt) {
  for (let i = stolenArms.length - 1; i >= 0; i--) {
    const a = stolenArms[i];
    a.t += dt;
    const k = Math.min(1, a.t / 0.45);
    const to = new THREE.Vector3();
    a.en.parts[a.key].getWorldPosition(to);
    a.obj.position.lerpVectors(a.from, to, k * k * (3 - 2 * k));
    a.obj.rotation.x += dt * 14; a.obj.rotation.z += dt * 9;
    if (k >= 1) {
      scene.remove(a.obj);
      // 奪った腕をそのまま使う。色が変わって「持っていかれた」ことが残る
      a.en.armMesh[a.key].material.color.setHex(a.obj.material.color.getHex());
      stolenArms.splice(i, 1);
    }
  }
}

/* ---------- 毎フレームの進行 ---------- */
function updateBoss(dt, rdt) {
  const en = bossMan;
  updateStolenArms(rdt);

  // 部屋Aに踏み込んだら自動でボス戦開始
  const idx = arenaRoomIndex();
  if (BOSS.phase === 'IDLE' && idx === 0) startBossFight();

  // 逃げた先の部屋に着いたらかくれんぼ開始
  if (BOSS.phase === 'WAIT' && idx === BOSS.next) startHidePhase(idx);

  if (BOSS.phase === 'HIDE') {
    BOSS.timer -= rdt;
    const left = Math.max(0, BOSS.timer);
    bossUi.count.textContent = left.toFixed(1);
    bossUi.count.classList.toggle('urgent', left <= 3);
    if (BOSS.timer <= 0) startJumpscare();
  } else if (BOSS.phase === 'SCARE') {
    updateJumpscare(rdt);
  }

  // 開幕の死体の連鎖爆散
  if (BOSS.burst.length) {
    BOSS.burstT -= rdt;
    while (BOSS.burst.length && BOSS.burstT <= 0) {
      BOSS.burstT += CONFIG.bossBurstInterval;
      const c = BOSS.burst.shift();
      if (corpses.indexOf(c) >= 0) burstCorpseSpectacle(c);
      if (!BOSS.burst.length) { doFlash(0.3, '#ff8f7a'); addShake(0.5); }
    }
  }

  // ボスHUD
  if (en && !bossUi.hud.classList.contains('hidden')) {
    bossUi.bar.style.width = (Math.max(0, en.hp) / en.maxHp * 100) + '%';
  }

  // 照明。かくれんぼとジャンプスケアだけ大きく落とす
  const dark = (BOSS.phase === 'HIDE' || BOSS.phase === 'SCARE');
  const inArena = (BOSS.phase !== 'IDLE' && BOSS.phase !== 'CLEAR') || idx >= 0;
  const tHemi = dark ? 0.13 : (inArena ? 0.55 : LIGHT_BASE.hemi);
  const tDir = dark ? 0.08 : (inArena ? 0.42 : LIGHT_BASE.dir);
  const tLamp = dark ? 0.22 : 0.85;
  const tFogFar = dark ? 20 : (inArena ? 40 : LIGHT_BASE.fogFar);
  const s = Math.min(1, rdt * 3);
  hemiLight.intensity += (tHemi - hemiLight.intensity) * s;
  dirLight.intensity += (tDir - dirLight.intensity) * s;
  for (const l of arenaLights) l.intensity += (tLamp - l.intensity) * s;
  scene.fog.far += (tFogFar - scene.fog.far) * s;

  // ボスを部屋の中に閉じ込める（プレイヤーと同じ部屋から出さない）
  if (en && en.group.visible && BOSS.phase === 'FIGHT') {
    const r = WALK.rooms[BOSS.room];
    en.group.position.x = Math.max(r.x0 + 0.6, Math.min(r.x1 - 0.6, en.group.position.x));
    en.group.position.z = Math.max(r.z0 + 0.6, Math.min(r.z1 - 0.6, en.group.position.z));
  }
}

// [B]：アリーナ入口へ飛んでボス戦をやり直す
function warpToBoss() {
  demoStop();
  resetBoss();
  clearArenaCorpses();
  state = S.HUMAN;
  risingBlend = 0; headH = 0; headVy = 0; legDeploy = 0; possess = null;
  headDead = false; player.stagger = 0;
  spineGroup.visible = false; spiderGroup.visible = false;
  player.attack = null; player.recoverT = 0; player.dodgeT = 0; punchBuffer = null;
  player.hp = CONFIG.playerMaxHp;
  player.arms.LEFT = makeArmState(ARM.FIST);
  player.arms.RIGHT = makeArmState(ARM.FIST);
  player.skill = makeBodySkill();
  clearAsuraArms();
  updateArmVisuals();
  playerPos.set((ARENA.gate.x0 + ARENA.gate.x1) / 2, 0, ARENA.z1 + 3.0);
  yaw = Math.PI; pitch = 0;
  showFeedback('DUCT MAN', '#59e0ff', 40);
}

createBossMan();
resetBoss();

/* =========================================================
   デモステージ（DEMO・一本道のウェーブ戦）
   ハブから離れた x=60 の位置に置いた、閉じた廊下。V で入る。
   前へ進むと部屋ごとにウェーブが湧き、全滅させるまで奥の門が開かない。
   狙いは「殴る→スタン→掴み／ライジングで腕を奪う→死体を乗っ取って回復」
   の一巡を、休みなく回させること。腕は削れるので敵の腕が補給になる。
   ハブとボスアリーナには触っていないので、オミットするときは
   このブロックと、呼び出し4箇所（keydownのV / confinePlayer /
   animateのupdateDemo / resetAllのdemoStop）を消せばいい。
   ========================================================= */
const DEMO = {
  cx: 60,            // 廊下の中心x（ハブとは霧で完全に切れている）
  half: 4.6,         // 廊下の半幅(m)。ドッジ1回ぶんしか横に逃げ場がない
  zStart: 12,        // 入口のz。ここから -Z へ進む
  segLen: 17,        // 1ウェーブぶんの部屋の長さ(m)
  active: false,
  phase: 'IDLE',     // IDLE / OPEN（次の部屋へ歩く）/ FIGHT / CLEAR
  next: 0,           // 次に湧かせるウェーブindex
  wave: -1,          // 今戦っているウェーブindex
  pending: [],       // 時間差で湧く敵 { t, x, z, left, right }
  live: [],          // このウェーブで湧かせた敵
  spawned: [],       // この潜入で湧かせた敵ぜんぶ（掃除用）
  lockZ: null,       // 門で止まるz（null なら開放）
  gates: [],
};

// ウェーブ表。1体 = [xオフセット, 左腕, 右腕, 湧くまでの秒数, 背後から湧くか]
// 前のウェーブで奪った腕が削れきる頃に銃腕が出てくる並びにしてある。
// 数を減らす／増やすときはこの配列だけ触ればいい（門も部屋数も追従する）
const DEMO_WAVES = [
  [[-2.2, ARM.FIST, ARM.FIST, 0.0, false],
   [ 2.2, ARM.FIST, ARM.FIST, 0.8, false]],

  [[-3.0, ARM.FIST, ARM.FIST, 0.0, false],
   [ 0.0, ARM.FIST, ARM.GUN,  0.6, false],
   [ 3.0, ARM.FIST, ARM.FIST, 1.3, false]],

  [[-3.2, ARM.FIST, ARM.FIST, 0.0, false],
   [ 3.2, ARM.GUN,  ARM.FIST, 0.5, false],
   [ 0.0, ARM.FIST, ARM.FIST, 1.2, false],
   [ 2.0, ARM.FIST, ARM.FIST, 2.4, true]],

  [[-3.4, ARM.FIST, ARM.GUN,  0.0, false],
   [ 0.0, ARM.FIST, ARM.FIST, 0.4, false],
   [ 3.4, ARM.GUN,  ARM.FIST, 0.9, false],
   [-2.2, ARM.FIST, ARM.FIST, 2.2, true]],

  [[-3.4, ARM.FIST, ARM.FIST, 0.0, false],
   [ 0.0, ARM.GUN,  ARM.GUN,  0.5, false],
   [ 3.4, ARM.FIST, ARM.FIST, 1.0, false],
   [-2.4, ARM.FIST, ARM.GUN,  2.4, true],
   [ 2.4, ARM.GUN,  ARM.FIST, 3.2, true]],
];

function demoSegZ(i) { return DEMO.zStart - DEMO.segLen * i; }        // 部屋iの入口
function demoGateZ(i) { return DEMO.zStart - DEMO.segLen * (i + 1); } // 部屋iの奥の門
function demoEndZ() { return demoGateZ(DEMO_WAVES.length - 1) - 9; }  // 突き当り

/* ---------- 廊下を建てる（起動時に1回だけ）---------- */
(function buildDemoStage() {
  const zBack = DEMO.zStart + 3, zEnd = demoEndZ();
  const len = zBack - zEnd, w = DEMO.half * 2;
  const mid = (zBack + zEnd) / 2;

  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, len),
    new THREE.MeshLambertMaterial({ color: 0x14171b }));
  fl.rotation.x = -Math.PI / 2;
  fl.position.set(DEMO.cx, 0.004, mid);
  scene.add(fl);

  // 部屋ごとに床の色を変える。どこまで進んだかが足元で分かる
  for (let i = 0; i < DEMO_WAVES.length; i++) {
    const t = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.3, DEMO.segLen - 0.4),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0x1c2028 : 0x191d23 }));
    t.rotation.x = -Math.PI / 2;
    t.position.set(DEMO.cx, 0.012, (demoSegZ(i) + demoGateZ(i)) / 2);
    scene.add(t);
  }

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x2b323b });
  const walls = [
    [0.5, len, DEMO.cx - DEMO.half, mid],
    [0.5, len, DEMO.cx + DEMO.half, mid],
    [w + 1, 0.5, DEMO.cx, zBack],
    [w + 1, 0.5, DEMO.cx, zEnd],
  ];
  for (const [sx, sz, x, z] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 3.4, sz), wallMat);
    m.position.set(x, 1.7, z);
    scene.add(m);
  }

  // 門。ウェーブ中だけ出て、倒しきると消える
  for (let i = 0; i < DEMO_WAVES.length; i++) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.2, 2.9, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.20 }));
    panel.position.y = 1.45;
    g.add(panel);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.2, 0.10, 0.30),
      new THREE.MeshBasicMaterial({ color: 0xff6b5e }));
    rail.position.y = 2.9;
    g.add(rail);
    g.position.set(DEMO.cx, 0, demoGateZ(i));
    g.visible = false;
    scene.add(g);
    DEMO.gates.push(g);
  }
})();

/* ---------- 敵の出し入れ ---------- */
function demoSpawnEnemy(x, z, left, right) {
  const en = createEnemy(x, z, left, right);
  buildEnemyUi(en);
  en.demo = true;
  en.room = null;                       // デモでは部屋判定なし。常に追ってくる
  en.home = new THREE.Vector3(x, 0, z);
  en.cooldown = 0.6 + Math.random() * 0.6;
  DEMO.live.push(en);
  DEMO.spawned.push(en);
  doFlash(0.18, '#ff8f7a');
  return en;
}

// 敵を丸ごと消す。enemies の並びが ENEMY_SPOTS と1対1でないと
// resetAll() が壊れるので、ハブへ戻る前に必ず全部これで消す
function demoRemoveEnemy(en) {
  scene.remove(en.group);
  const i = enemies.indexOf(en);
  if (i >= 0) enemies.splice(i, 1);
  for (let k = targetEntries.length - 1; k >= 0; k--) {
    if (targetEntries[k].enemy === en) {
      targetEntries[k].el.remove();
      targetEntries.splice(k, 1);
    }
  }
  if (en.ui) en.ui.root.remove();
}

function demoLiveCount() {
  return DEMO.pending.length + DEMO.live.filter((en) => en.state !== E.DEAD).length;
}

/* ---------- ウェーブ ---------- */
function demoStartWave(i) {
  DEMO.wave = i;
  DEMO.next = i + 1;
  DEMO.phase = 'FIGHT';
  DEMO.lockZ = demoGateZ(i) + 0.9;      // 奥の門で止める
  DEMO.gates[i].visible = true;
  DEMO.live = [];
  DEMO.pending = DEMO_WAVES[i].map((s) => ({
    t: s[3], x: DEMO.cx + s[0], left: s[1], right: s[2],
    z: s[4] ? demoSegZ(i) - 1.5 : demoGateZ(i) + 3.5,   // 背後 or 奥から
  }));
  showFeedback('WAVE ' + (i + 1) + ' / ' + DEMO_WAVES.length, '#ffd75e', 40);
  addShake(0.45);
}

function demoClearWave() {
  DEMO.gates[DEMO.wave].visible = false;
  DEMO.lockZ = null;
  DEMO.phase = (DEMO.next >= DEMO_WAVES.length) ? 'CLEAR' : 'OPEN';
  if (DEMO.phase === 'CLEAR') {
    showFeedback('ALL CLEAR', '#9ce8ff', 46);
  } else {
    showFeedback('GATE OPEN', '#9ce8ff', 34);
  }
  doFlash(0.3, '#9ce8ff');
}

/* ---------- 出入り ---------- */
function startDemo() {
  // ハブ側の敵・死体・腕の状態はまとめて resetAll() に戻してもらう。
  // （demoStop() もその中で呼ばれるので、前回のデモの敵はここで消える）
  resetAll();
  playerPos.set(DEMO.cx, 0, DEMO.zStart);
  yaw = 0; pitch = 0;                   // yaw 0 = -Z。廊下の奥を向く
  DEMO.active = true;
  DEMO.phase = 'OPEN';
  DEMO.next = 0; DEMO.wave = -1; DEMO.lockZ = null;
  showFeedback('DEMO STAGE', '#ffd75e', 42);
}

function demoStop() {
  for (const en of DEMO.spawned.slice()) demoRemoveEnemy(en);
  DEMO.spawned = []; DEMO.live = []; DEMO.pending = [];
  DEMO.active = false; DEMO.phase = 'IDLE';
  DEMO.next = 0; DEMO.wave = -1; DEMO.lockZ = null;
  for (const g of DEMO.gates) g.visible = false;
}

// デモは自分の矩形だけで閉じている。ハブの歩ける矩形とは繋がっていない
function demoConfine() {
  const m = 0.45;
  playerPos.x = Math.max(DEMO.cx - DEMO.half + m, Math.min(DEMO.cx + DEMO.half - m, playerPos.x));
  const front = (DEMO.lockZ !== null) ? DEMO.lockZ : demoEndZ() + m;
  playerPos.z = Math.max(front, Math.min(DEMO.zStart + 2.4, playerPos.z));
}

/* ---------- 毎フレーム ---------- */
// ウェーブ数などの文字表示は出さない（指示のない文字は出さない方針）

function updateDemo(wdt) {
  if (!DEMO.active) return;

  // 部屋の入口を数m越えたところで湧く（門の手前で立ち止まっていても始まらない）
  if (DEMO.phase === 'OPEN' &&
      DEMO.next < DEMO_WAVES.length &&
      playerPos.z < demoSegZ(DEMO.next) - 2.5) {
    demoStartWave(DEMO.next);
  }

  // 倒れ切った敵は消して回る。□とバーのDOMが溜まり続けるのと、
  // enemies の並びが ENEMY_SPOTS からずれたまま resetAll() に入るのを防ぐ
  for (const en of DEMO.spawned.slice()) {
    if (en.state !== E.DEAD || en.fallT < 1) continue;
    if (player.attack && player.attack.enemy === en) continue;   // 掴みの演出中
    demoRemoveEnemy(en);
    DEMO.spawned.splice(DEMO.spawned.indexOf(en), 1);
  }

  if (DEMO.phase === 'FIGHT') {
    for (const s of DEMO.pending.slice()) {
      s.t -= wdt;
      if (s.t > 0) continue;
      demoSpawnEnemy(s.x, s.z, s.left, s.right);
      DEMO.pending.splice(DEMO.pending.indexOf(s), 1);
    }
    if (demoLiveCount() === 0) demoClearWave();
  }
}

/* ---------- リセット ---------- */
function resetAll() {
  demoStop();          // デモの敵を消してから。enemies の並びを ENEMY_SPOTS に戻す
  player.hp = CONFIG.playerMaxHp;
  player.resMax = CONFIG.resourceStart;
  player.resource = player.resMax;
  player.resourceCharge = 0;
  player.arms.LEFT = makeArmState(ARM.FIST);
  player.arms.RIGHT = makeArmState(ARM.FIST);
  player.skill = makeBodySkill();
  clearAsuraArms();
  clearHealFx();
  player.gunRecoil.LEFT = 0; player.gunRecoil.RIGHT = 0;
  gunHold.LEFT = false; gunHold.RIGHT = false; gunCool.LEFT = 0; gunCool.RIGHT = 0;
  mouseHold.LEFT = null; mouseHold.RIGHT = null;
  player.attack = null; player.recoverT = 0; player.dodgeT = 0; player.invuln = 0;
  player.stagger = 0;
  punchBuffer = null;
  detachTentacle();                                  // 伸ばしかけ／拘束中の触手を落とす
  tentComboStep = 0; tentComboAt = -99; tentFovKick = 0;
  playerPos.set(0, 0, 6);
  state = S.HUMAN;
  risingBlend = 0; risingSlashSide = 'RIGHT'; legSwing = null;
  legDeploy = 0; headH = 0; headVy = 0; headGrounded = false; possess = null;
  headBleedT = 0; headDead = false; bleedDist = 0; bleedTicks = 0; lastBleedPos.set(0, 0, 0);
  spineGroup.visible = false; spiderGroup.visible = false;
  resetCorpses();
  clearDebris();
  clearBloodDecals();
  // 演出系の残りも落とす（ジャストドッジのスロー中にGを押すと残っていた）
  slowTimer = 0; slowScaleOverride = 1; hitstop = 0; shake = 0;
  for (const p of projectiles) scene.remove(p.obj);
  projectiles = [];
  for (const p of severedParts) { scene.remove(p.obj); if (p.el) p.el.remove(); }
  severedParts = [];
  cancelArmGrafts();

  const spots = ENEMY_SPOTS;
  enemies.forEach((en, i) => {
    if (en.boss) return;                 // ダクトの男は resetBoss() が面倒を見る
    en.room = ROOMS[spots[i][4]]; en.home.set(spots[i][0], 0, spots[i][1]);
    en.hp = CONFIG.enemyMaxHp; en.stun = 0; en.shoveLeft = 0;
    en.consecutiveHits = 0; en.cooldown = 1.0 + Math.random();
    en.activeHitDone = false; en.headless = false; en.grabK = 0; en.tentGrab = false;
    en.tetherVel.set(0, 0, 0); en.throwVel = null; en.throwSpin = 0; en.smashCd = 0;
    en.group.visible = true;
    setEnemyState(en, E.IDLE);
    en.group.position.set(spots[i][0], 0, spots[i][1]);
    en.pivotRoot.rotation.set(0, 0, 0);
    en.pivotRoot.position.set(0, 0, 0);
    const home = { RIGHT: [-0.68, 1.82, 0], LEFT: [0.68, 1.82, 0], HEAD: [0, 2.12, 0] };
    for (const key of ['LEFT', 'RIGHT', 'HEAD']) {
      const part = en.parts[key];
      if (part.parent !== en.pivotRoot) {
        if (part.parent) part.parent.remove(part);
        en.pivotRoot.add(part);
      }
      part.position.set(home[key][0], home[key][1], home[key][2]);
      part.rotation.set(0, 0, 0);
      part.quaternion.set(0, 0, 0, 1);
      part.visible = true;
    }
  });
  resetBoss();
  updateArmVisuals();
  showFeedback('RESET', '#8b8f88', 24);
}

/* =========================================================
   操作説明（MANUAL）

   棚の横の看板をFでインタラクトすると開く。1ページ＝1動作。
   F で閉じる / A で前ページ / D で次ページ。
   開いている間は移動も攻撃も視点も止まる（入力を全部マニュアルが食う）。

   図は外部画像を使わず、その場で組み立てたSVGで描いている。
   zip配布をやめてURL配信にしたので、画像ファイルを足さずに済ませたい。
   色はゲーム本編のマテリアルと同じ値を使って、図と実物を結び付けている。
   ========================================================= */

const ART = { W: 360, H: 200 };
const C_ARM = '#e8e4da', C_ENEMY_ARM = '#b5493f', C_GUN = '#6b6f7a', C_BARREL = '#2a2c31';
const C_TENT = '#9c4a52', C_TENT_TIP = '#c2707a', C_TORSO = '#5c5464', C_HEAD = '#827a8c';
const C_LEG = '#3a3542', C_FLESH = '#8d3a33', C_HI = '#ffd75e', C_COOL = '#9ce8ff';

const n1 = (v) => Math.round(v * 10) / 10;

function aRect(x, y, w, h, fill, extra) {
  return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) +
         '" fill="' + fill + '"' + (extra || '') + '/>';
}
function aLine(x1, y1, x2, y2, col, w, extra) {
  return '<path d="M' + n1(x1) + ' ' + n1(y1) + ' L' + n1(x2) + ' ' + n1(y2) +
         '" stroke="' + col + '" stroke-width="' + (w || 2) + '" stroke-linecap="round"' +
         (extra || '') + '/>';
}
function aText(x, y, t, o) {
  o = o || {};
  return '<text x="' + n1(x) + '" y="' + n1(y) + '" fill="' + (o.col || 'rgba(205,210,200,0.8)') +
         '" font-size="' + (o.size || 12) + '" font-family="ui-monospace,monospace"' +
         ' text-anchor="' + (o.anchor || 'middle') + '">' + t + '</text>';
}
// 矢印。操作の向き（移動・振り・飛ぶ方向）は全部これで描く
function aArrow(x1, y1, x2, y2, col, w) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = (w || 3) * 2.6;
  const p = (ang) => n1(x2 - Math.cos(a + ang) * h) + ' ' + n1(y2 - Math.sin(a + ang) * h);
  return aLine(x1, y1, x2, y2, col, w) +
         '<polygon points="' + n1(x2) + ' ' + n1(y2) + ' ' + p(0.42) + ' ' + p(-0.42) +
         '" fill="' + col + '"/>';
}
function aCross(x, y, col) {
  const c = col || '#e6ebe1';
  return aLine(x - 9, y, x + 9, y, c, 2) + aLine(x, y - 9, x, y + 9, c, 2);
}
// ライジングで出る□。本編の .shoulder-target と同じ意味で使う
function aSquare(x, y, s, col) {
  return '<rect x="' + n1(x - s / 2) + '" y="' + n1(y - s / 2) + '" width="' + n1(s) +
         '" height="' + n1(s) + '" fill="none" stroke="' + (col || C_HI) + '" stroke-width="2.5"/>';
}
function aBurst(x, y, k, col) {
  let s = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.22;
    s += aLine(x + Math.cos(a) * 7 * k, y + Math.sin(a) * 7 * k,
               x + Math.cos(a) * 21 * k, y + Math.sin(a) * 21 * k, col || C_HI, 3 * k);
  }
  return s;
}
function aArc(cx, cy, r, a0, a1, col, w) {
  const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
  return '<path d="M' + n1(x0) + ' ' + n1(y0) + ' A ' + n1(r) + ' ' + n1(r) + ' 0 0 ' +
         (a1 > a0 ? 1 : 0) + ' ' + n1(x1) + ' ' + n1(y1) +
         '" fill="none" stroke="' + col + '" stroke-width="' + (w || 3) +
         '" stroke-linecap="round"/>';
}

/* ---------- 背景（部屋の床） ---------- */
function aStage(inner) {
  let s = aRect(0, 0, 360, 200, '#0f1215') + aRect(0, 0, 360, 126, '#0b0e11');
  for (let i = 1; i <= 5; i++) {
    const y = 126 + Math.pow(i / 5, 1.9) * 74;
    s += aLine(0, y, 360, y, '#222a32', 1);
  }
  for (let i = -4; i <= 4; i++) s += aLine(180, 126, 180 + i * 92, 200, '#222a32', 1);
  return s + inner;
}

/* ---------- 敵（正面・箱人間。本編のマテリアルと同じ色） ---------- */
function aEnemy(cx, k, o) {
  o = o || {};
  const feet = (o.feet === undefined) ? 172 : o.feet;
  const ac = o.armColor || C_ENEMY_ARM;
  let s = '<g opacity="' + (o.op === undefined ? 1 : o.op) + '">';
  s += aRect(cx - 11 * k, feet - 30 * k, 22 * k, 30 * k, C_LEG);
  s += aRect(cx - 28 * k, feet - 76 * k, 9 * k, 42 * k, ac);
  s += aRect(cx + 19 * k, feet - 76 * k, 9 * k, 42 * k, ac);
  s += aRect(cx - 18 * k, feet - 78 * k, 36 * k, 50 * k, C_TORSO);
  if (o.headless) s += aRect(cx - 9 * k, feet - 86 * k, 18 * k, 9 * k, C_FLESH);
  else s += aRect(cx - 11 * k, feet - 100 * k, 22 * k, 21 * k, o.headColor || C_HEAD);
  if (o.stun) s += aText(cx, feet - 108 * k, 'STUNNED', { size: 11, col: '#ffe98a' });
  s += '</g>';
  return s;
}
// 首から上がない死体（座っている）
function aCorpse(cx, k) {
  let s = aRect(cx - 17 * k, 172 - 36 * k, 34 * k, 36 * k, C_TORSO);
  s += aRect(cx - 26 * k, 172 - 32 * k, 8 * k, 30 * k, C_ENEMY_ARM);
  s += aRect(cx + 18 * k, 172 - 32 * k, 8 * k, 30 * k, C_ENEMY_ARM);
  s += aRect(cx - 8 * k, 172 - 42 * k, 16 * k, 8 * k, C_FLESH);
  return s;
}

/* ---------- 一人称の腕 ----------
   画面下の隅から手首が出て、クロスヘア（180, 78）の方を向く。
   ext=0 で構え、ext=1 で振り抜き。腕の種類で手先だけ差し替える        */
function aArm(side, kind, ext, o) {
  o = o || {};
  ext = ext || 0;
  const sg = (side === 'L') ? -1 : 1;
  const bx = 180 + sg * 130, by = 238;
  const hx = (o.hx === undefined) ? 180 + sg * (88 - 50 * ext) : o.hx;
  const hy = (o.hy === undefined) ? 164 - 50 * ext : o.hy;
  const dx = hx - bx, dy = hy - by, L = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / L, ny = dx / L;
  const wB = 17, wH = 10 + 4 * ext;
  const col = (kind === 'gun') ? C_GUN : (kind === 'tentacle') ? C_TENT : C_ARM;
  let s = '<polygon points="' +
    [[bx + nx * wB, by + ny * wB], [bx - nx * wB, by - ny * wB],
     [hx - nx * wH, hy - ny * wH], [hx + nx * wH, hy + ny * wH]]
      .map((p) => n1(p[0]) + ' ' + n1(p[1])).join(' ') +
    '" fill="' + col + '" stroke="#0b0d10" stroke-width="2"/>';

  // 手先の向き（クロスヘアの方）
  const ax = (o.aimX === undefined ? 180 : o.aimX) - hx;
  const ay = (o.aimY === undefined ? 78 : o.aimY) - hy;
  const aL = Math.max(1, Math.hypot(ax, ay));
  const ux = ax / aL, uy = ay / aL;

  if (kind === 'gun') {
    s += aRect(hx - 11, hy - 11, 22, 22, C_GUN, ' stroke="#0b0d10" stroke-width="2"');
    s += aLine(hx, hy, hx + ux * 30, hy + uy * 30, C_BARREL, 9);
  } else if (kind === 'tentacle') {
    const len = o.tentLen === undefined ? 34 : o.tentLen;
    for (let i = -1; i <= 1; i++) {
      const sp = i * 0.34;
      const vx = ux * Math.cos(sp) - uy * Math.sin(sp);
      const vy = ux * Math.sin(sp) + uy * Math.cos(sp);
      s += '<path d="M' + n1(hx) + ' ' + n1(hy) + ' Q ' + n1(hx + vx * len * 0.6 - vy * 6) +
           ' ' + n1(hy + vy * len * 0.6 + vx * 6) + ' ' + n1(hx + vx * len) + ' ' +
           n1(hy + vy * len) + '" fill="none" stroke="' + C_TENT + '" stroke-width="7"' +
           ' stroke-linecap="round"/>';
    }
    s += '<circle cx="' + n1(hx + ux * len) + '" cy="' + n1(hy + uy * len) + '" r="4" fill="' +
         C_TENT_TIP + '"/>';
  } else {
    s += aRect(hx - 13, hy - 12, 26, 24, C_ARM, ' rx="4" stroke="#0b0d10" stroke-width="2"');
  }
  return s;
}

/* ---------- マウス／キーの図（図の中で使うぶん） ---------- */
function aMouse(x, y, k, hl) {
  let s = '<rect x="' + n1(x - 15 * k) + '" y="' + n1(y - 22 * k) + '" width="' + n1(30 * k) +
          '" height="' + n1(44 * k) + '" rx="' + n1(14 * k) +
          '" fill="#1b2026" stroke="#5a636d" stroke-width="2"/>';
  s += '<path d="M' + n1(x) + ' ' + n1(y - 22 * k) + ' V' + n1(y - 2 * k) +
       '" stroke="#5a636d" stroke-width="2"/>';
  if (hl === 'L') s += '<path d="M' + n1(x - 15 * k) + ' ' + n1(y - 8 * k) + ' V' + n1(y - 14 * k) +
    ' a' + n1(14 * k) + ' ' + n1(14 * k) + ' 0 0 1 ' + n1(14 * k) + ' -' + n1(14 * k) +
    ' V' + n1(y - 2 * k) + ' Z" fill="' + C_HI + '" opacity="0.85"/>';
  if (hl === 'R') s += '<path d="M' + n1(x + 15 * k) + ' ' + n1(y - 8 * k) + ' V' + n1(y - 14 * k) +
    ' a' + n1(14 * k) + ' ' + n1(14 * k) + ' 0 0 0 -' + n1(14 * k) + ' -' + n1(14 * k) +
    ' V' + n1(y - 2 * k) + ' Z" fill="' + C_HI + '" opacity="0.85"/>';
  return s;
}
function aKey(x, y, label, hl) {
  const w = Math.max(26, 13 * label.length + 14);
  return '<rect x="' + n1(x - w / 2) + '" y="' + n1(y - 13) + '" width="' + n1(w) +
         '" height="26" rx="4" fill="' + (hl ? 'rgba(255,215,94,0.18)' : '#161a1f') +
         '" stroke="' + (hl ? C_HI : '#5a636d') + '" stroke-width="2"/>' +
         aText(x, y + 5, label, { size: 13, col: hl ? C_HI : 'rgba(215,220,210,0.9)' });
}

/* ---------- 頭モードの姿（丸い頭＋蜘蛛脚＋脊柱のしっぽ） ---------- */
function aHeadForm(cx, cy, k) {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const sg = i < 2 ? -1 : 1, t = (i % 2) * 0.5;
    s += '<path d="M' + n1(cx) + ' ' + n1(cy + 4 * k) + ' q ' + n1(sg * (16 + t * 8) * k) + ' ' +
         n1(10 * k) + ' ' + n1(sg * (22 + t * 12) * k) + ' ' + n1(26 * k) +
         '" fill="none" stroke="#b9b3a6" stroke-width="' + n1(3 * k) + '" stroke-linecap="round"/>';
  }
  s += '<path d="M' + n1(cx) + ' ' + n1(cy + 8 * k) + ' q ' + n1(-18 * k) + ' ' + n1(20 * k) +
       ' ' + n1(-36 * k) + ' ' + n1(14 * k) + '" fill="none" stroke="#c9c3b4" stroke-width="' +
       n1(4 * k) + '" stroke-linecap="round"/>';
  s += '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(13 * k) + '" fill="#d9d4c8"/>';
  return s;
}

/* =========================================================
   ページ定義（1ページ＝1動作）
   ========================================================= */
const MANUAL_PAGES = [
  /* --- 基本 --- */
  {
    cat: '基本', title: '移動',
    keys: [['W A S D', '']],
    desc: '前後左右に歩く。ライジング中とフィニッシャー中はその場に固定されて動けない。',
    art: () => aStage(
      aKey(180, 54, 'W', true) + aKey(146, 86, 'A', true) + aKey(180, 86, 'S', true) +
      aKey(214, 86, 'D', true) +
      aArrow(180, 150, 180, 120, C_HI, 3) + aArrow(180, 150, 180, 180, C_HI, 3) +
      aArrow(180, 150, 134, 150, C_HI, 3) + aArrow(180, 150, 226, 150, C_HI, 3) +
      '<circle cx="180" cy="150" r="9" fill="' + C_ARM + '"/>'),
  },
  {
    cat: '基本', title: '視点',
    keys: [['マウス', '']],
    desc: 'マウスを動かすと視点が回る。画面中央のクロスヘアが、攻撃も触手も□選択も全部の基準になる。',
    art: () => aStage(
      aEnemy(255, 0.9, { op: 0.5 }) + aEnemy(95, 0.9, { op: 0.5 }) +
      aCross(180, 96) +
      aMouse(180, 162, 0.9) +
      aArrow(205, 150, 243, 150, C_HI, 3) + aArrow(155, 150, 117, 150, C_HI, 3)),
  },
  {
    cat: '基本', title: '目的とコンパス',
    keys: [['Tab', '開く / 閉じる']],
    desc: '画面上のコンパスの赤い丸がゴールの方角。中央の目盛りが正面、両端が真横。' +
          'Tab で今の目的が左上に出る。もう一度押すと消える。',
    art: () => aStage(
      aRect(60, 30, 240, 34, 'rgba(0,0,0,0.55)') +
      aRect(73, 35, 3, 24, '#f2f2f2') + aRect(284, 35, 3, 24, '#f2f2f2') +
      aRect(179, 40, 2, 14, 'rgba(255,255,255,0.55)') +
      '<circle cx="232" cy="47" r="13" fill="#ff6b6b" stroke="#000" stroke-width="1"/>' +
      '<text x="232" y="52" fill="#fff" font-size="14" font-weight="bold" text-anchor="middle">G</text>' +
      aArrow(196, 47, 214, 47, C_HI, 2) +
      aKey(70, 150, 'Tab', true) +
      aRect(110, 128, 150, 44, 'rgba(0,0,0,0.6)') + aRect(110, 128, 3, 44, '#ff6b6b') +
      '<text x="122" y="155" fill="#eef1ea" font-size="13">ゴールを目指す</text>'),
  },

  /* --- 人間モード（拳） --- */
  {
    cat: '人間モード（拳）', title: '通常攻撃（パンチ）',
    keys: [['左クリック', '短押し'], ['右クリック', '短押し']],
    desc: '押した側の手で殴る。左クリック＝左手 / 右クリック＝右手。左右交互に押すと先行入力で繋がる。当てるたびに腕のHPが減る。',
    art: () => aStage(
      aEnemy(180, 1.05, {}) + aBurst(180, 96, 1.1) +
      aArm('L', 'fist', 0.1) + aArm('R', 'fist', 1) +
      aMouse(300, 52, 0.7, 'R')),
  },
  {
    cat: '人間モード（拳）', title: '掴みフィニッシャー',
    keys: [['左クリック', '短押し'], ['右クリック', '短押し']],
    desc: '専用の入力はない。スタン中（STUNNED）の敵にパンチが当たると、殴った側の腕が自動で頭を掴んで握り潰す。この攻撃では腕のHPは減らない。',
    art: () => aStage(
      aEnemy(180, 1.05, { stun: true, headColor: '#9b8f7a' }) +
      aArm('L', 'fist', 0.1) + aArm('R', 'fist', 1, { hx: 196, hy: 92 }) +
      aArc(180, 96, 26, -2.4, 0.5, '#ff9c8c', 4)),
  },
  {
    cat: '人間モード（拳）', title: 'パージ（手首射出）',
    keys: [['左クリック', '長押し'], ['右クリック', '長押し']],
    desc: '手首から先を弾として撃ち出す。各腕1回だけ。撃ったあとその腕は殴れなくなるので、棚か敵から腕を取り直す。',
    art: () => aStage(
      aEnemy(180, 0.95, { feet: 166 }) +
      aArm('L', 'fist', 0.1) +
      aArm('R', 'fist', 0.35, { hx: 232, hy: 150 }) +
      aRect(196, 86, 20, 20, C_ARM, ' rx="4" stroke="#0b0d10" stroke-width="2"') +
      aArrow(228, 136, 200, 100, C_COOL, 3) +
      aText(258, 176, 'HOLD', { size: 12, col: C_HI })),
  },
  {
    cat: '人間モード（拳）', title: 'キック',
    keys: [['Space', '']],
    desc: 'リソースを1消費する蹴り。敵の攻撃予備動作で、頭上の印が白く光った瞬間に出すとジャストキックになる。腕を使わないので、両腕を失っても出せる。',
    art: () => aStage(
      aEnemy(180, 1.0, {}) + aBurst(180, 120, 0.9) +
      '<polygon points="200 216 240 206 212 128 186 136" fill="' + C_LEG +
      '" stroke="#0b0d10" stroke-width="2"/>' +
      aKey(300, 48, 'Space', true)),
  },
  {
    cat: '人間モード（拳）', title: 'ドッジ',
    keys: [['Shift', '']],
    desc: 'リソースを1消費して入力方向へ回避する。移動キーを押していなければ後ろへ下がる。回避中は無敵。',
    art: () => aStage(
      aEnemy(180, 0.95, { feet: 164 }) +
      '<circle cx="120" cy="160" r="10" fill="' + C_ARM + '" opacity="0.35"/>' +
      '<circle cx="150" cy="158" r="10" fill="' + C_ARM + '" opacity="0.6"/>' +
      '<circle cx="182" cy="156" r="10" fill="' + C_ARM + '"/>' +
      aArrow(172, 182, 112, 182, C_COOL, 3) +
      aKey(300, 48, 'Shift', true)),
  },
  {
    cat: '人間モード（拳）', title: 'ジャストドッジ',
    keys: [['Shift', '白い印に合わせて']],
    desc: '敵の頭上の印が白く光った瞬間にドッジすると成立。リソースを消費せず逆に1回復し、短いスローがかかる。',
    art: () => aStage(
      aEnemy(180, 0.95, { feet: 164 }) +
      '<rect x="174" y="40" width="12" height="12" fill="#fff" transform="rotate(45 180 46)"/>' +
      '<rect x="0" y="0" width="360" height="200" fill="' + C_COOL + '" opacity="0.07"/>' +
      '<circle cx="182" cy="156" r="10" fill="' + C_ARM + '"/>' +
      aArrow(172, 182, 112, 182, C_COOL, 3) +
      aText(180, 192, 'JUST DODGE!', { size: 15, col: C_COOL })),
  },

  {
    cat: '人間モード（拳）', title: 'ガード',
    keys: [['Ctrl', '長押し']],
    desc: '両腕を斜めに構えて受ける。受けるダメージは半分になり、体ではなく残っている腕それぞれに入る（両腕あれば両方に）。両腕とも無いと体に入る。構えている間は攻撃とキックは出せず、歩きも遅くなる。ドッジは出せる。',
    art: () => aStage(
      aEnemy(180, 1.0, {}) +
      '<polygon points="64 214 92 196 236 112 222 98" fill="' + C_ARM + '" stroke="#0b0d10" stroke-width="2"/>' +
      '<polygon points="296 214 268 196 124 112 138 98" fill="' + C_ARM + '" stroke="#0b0d10" stroke-width="2"/>' +
      aText(180, 60, '-6 / -6', { size: 13, col: '#b8d4ee' }) + aKey(56, 44, 'Ctrl', true)),
  },

  /* --- 銃腕 --- */
  {
    cat: '銃腕', title: '射撃',
    keys: [['左クリック', '押した瞬間'], ['右クリック', '押した瞬間']],
    desc: '押した側の銃腕から1発。パージはできない。1発撃つごとに腕のHPが減るので、撃ち続けると腕が落ちる。',
    art: () => aStage(
      aEnemy(180, 1.0, {}) + aBurst(180, 92, 0.8, '#ffd1a0') +
      aArm('L', 'fist', 0.1) + aArm('R', 'gun', 0.5) +
      aLine(178, 118, 180, 96, '#ffe9a0', 3) +
      aMouse(300, 52, 0.7, 'R')),
  },
  {
    cat: '銃腕', title: '連射',
    keys: [['左クリック', '長押し'], ['右クリック', '長押し']],
    desc: '押しているあいだ一定間隔で撃ち続ける。もう片方が拳なら、撃ちながら殴れる（銃腕は player.attack を占有しない）。',
    art: () => aStage(
      aEnemy(180, 1.0, {}) +
      aArm('L', 'fist', 0.1) + aArm('R', 'gun', 0.5) +
      aLine(178, 126, 180, 112, '#ffe9a0', 3) +
      aLine(179, 104, 180, 90, '#ffe9a0', 3) +
      aLine(180, 82, 180, 70, '#ffe9a0', 3) +
      aText(300, 176, 'HOLD', { size: 12, col: C_HI }) +
      aMouse(300, 52, 0.7, 'R')),
  },

  /* --- 触手腕 --- */
  {
    cat: '触手腕', title: '薙ぎ払い',
    keys: [['左クリック', '短押し'], ['右クリック', '短押し']],
    desc: '横に広い扇で範囲内の敵をまとめて薙ぐ。1段目と2段目で振る向きが反転する2コンボ。パンチより射程が長く、威力は半分以下。',
    art: () => aStage(
      aEnemy(118, 0.85, { feet: 168 }) + aEnemy(242, 0.85, { feet: 168 }) +
      aArc(180, 170, 96, -2.75, -0.39, C_TENT_TIP, 5) +
      aArrow(86, 92, 128, 74, C_TENT_TIP, 3) +
      aArm('R', 'tentacle', 0.9, { hx: 206, hy: 128, aimX: 110, aimY: 110, tentLen: 48 })),
  },
  {
    cat: '触手腕', title: '触手のフィニッシャー',
    keys: [['左クリック', '短押し'], ['右クリック', '短押し']],
    desc: '専用の入力はない。スタン中の敵に薙ぎ払いが当たると、頭に触手を刺して首から引き抜く。拳の掴みと違って敵を引き寄せないので、死体が離れた位置に落ちる。',
    art: () => aStage(
      aEnemy(210, 1.0, { headless: true, stun: true }) +
      '<circle cx="128" cy="76" r="13" fill="' + C_HEAD + '"/>' +
      '<path d="M206 96 Q 170 78 134 76" fill="none" stroke="' + C_TENT +
      '" stroke-width="7" stroke-linecap="round"/>' +
      aArrow(150, 60, 112, 52, C_TENT_TIP, 3) +
      aArm('R', 'tentacle', 0.6, { hx: 232, hy: 134, aimX: 206, aimY: 100, tentLen: 26 })),
  },
  {
    cat: '触手腕', title: '刺突（伸ばす）',
    keys: [['左クリック', '長押し'], ['右クリック', '長押し']],
    desc: 'クロスヘアの方向へ触手を伸ばす。当たった敵には刺さって拘束状態になり、敵のAIも押しのけも止まる。最大距離まで伸びて外れれば空振り。',
    art: () => aStage(
      aEnemy(180, 1.0, {}) +
      '<path d="M258 196 Q 220 150 182 100" fill="none" stroke="' + C_TENT +
      '" stroke-width="9" stroke-linecap="round"/>' +
      '<circle cx="182" cy="100" r="6" fill="' + C_TENT_TIP + '"/>' +
      aCross(180, 96) +
      aText(300, 176, 'HOLD', { size: 12, col: C_HI })),
  },
  {
    cat: '触手腕', title: '振り回す',
    keys: [['マウス', '刺したまま大きく振る']],
    desc: '刺さったまま視点を大きく振ると、敵が遅れて付いてきて振り回される。壁や床にぶつければダメージ。押しっぱなしのあいだ続く。',
    art: () => aStage(
      aArc(250, 176, 120, -2.9, -1.1, 'rgba(156,74,82,0.35)', 6) +
      aEnemy(132, 0.8, { feet: 112 }) +
      '<path d="M268 196 Q 210 150 146 90" fill="none" stroke="' + C_TENT +
      '" stroke-width="8" stroke-linecap="round"/>' +
      aArrow(228, 54, 150, 44, C_TENT_TIP, 3) +
      aMouse(312, 150, 0.6) + aArrow(336, 128, 300, 112, C_HI, 3)),
  },
  {
    cat: '触手腕', title: '投げる',
    keys: [['左クリック', '離す'], ['右クリック', '離す']],
    desc: '振り回している速度が十分なら、離した方向へ飛んでいく。着地や壁で速度に応じたダメージとスタン。速度が足りなければただ外れる。',
    art: () => aStage(
      aEnemy(272, 0.78, { feet: 96 }) +
      '<path d="M120 150 Q 200 72 268 84" fill="none" stroke="rgba(255,215,94,0.35)"' +
      ' stroke-width="3" stroke-dasharray="6 6"/>' +
      aArrow(238, 72, 276, 70, C_HI, 3) +
      '<path d="M96 196 Q 104 176 118 154" fill="none" stroke="' + C_TENT +
      '" stroke-width="8" stroke-linecap="round"/>' +
      aText(96, 142, 'RELEASE', { size: 12, col: C_HI })),
  },
  {
    cat: '触手腕', title: '拘束したまま追撃（PINNED）',
    keys: [['もう片方の腕', '']],
    desc: '触手で刺して拘束している敵には、もう片方の腕の攻撃が全部通る。銃ならダメージ増（PINNED SHOT）、拳なら通常どおり（PINNED HIT）、触手の薙ぎ払いも通る（PINNED SWEEP）。',
    art: () => aStage(
      aEnemy(180, 1.0, {}) +
      '<path d="M268 196 Q 226 150 186 102" fill="none" stroke="' + C_TENT +
      '" stroke-width="8" stroke-linecap="round"/>' +
      aArm('L', 'gun', 0.5, { hx: 96, hy: 136, aimX: 176, aimY: 100 }) +
      aLine(140, 118, 172, 102, '#ffe9a0', 3) +
      aBurst(180, 96, 0.8, '#ffd1a0') +
      aText(180, 48, 'PINNED SHOT', { size: 13, col: C_HI })),
  },
  {
    cat: '触手腕', title: 'BREAK（拘束のまま崩す）',
    keys: [['左クリック', '静かに離す'], ['右クリック', '静かに離す']],
    desc: '拘束中はのけぞらないがスタンだけ溜まり続ける。溜め切ってから振り回さずに静かに離すと、その場で崩れて（BREAK!）掴みフィニッシャーに繋がる。',
    art: () => aStage(
      aEnemy(180, 1.0, { stun: true }) +
      '<path d="M268 196 Q 226 150 186 102" fill="none" stroke="' + C_TENT +
      '" stroke-width="8" stroke-linecap="round" opacity="0.45"/>' +
      aRect(120, 36, 120, 10, '#1b2026', ' stroke="#5a636d" stroke-width="1"') +
      aRect(121, 37, 118, 8, '#ffd75e') +
      aText(180, 190, 'BREAK!', { size: 16, col: C_HI })),
  },

  /* --- 腕の管理 --- */
  {
    cat: '腕の管理', title: '腕の耐久',
    keys: [['—', '']],
    desc: '腕ごとにHPがある。近接を当てるたび／銃を1発撃つたびに減り、0になると肉片になって消えてその側は何もできなくなる。奪った腕・棚の腕は必ずフルHP。',
    art: () => aStage(
      aText(96, 44, 'LEFT', { size: 13 }) + aText(264, 44, 'RIGHT', { size: 13 }) +
      '<circle cx="96" cy="100" r="34" fill="none" stroke="#5a636d" stroke-width="6"/>' +
      '<path d="M96 66 A 34 34 0 1 1 62 100" fill="none" stroke="#7fd08a" stroke-width="6"/>' +
      aText(96, 106, '100', { size: 16, col: '#d8dcd4' }) +
      '<circle cx="264" cy="100" r="34" fill="none" stroke="#5a636d" stroke-width="6"/>' +
      '<path d="M264 66 A 34 34 0 0 1 294 84" fill="none" stroke="#cf4a44" stroke-width="6"/>' +
      aText(264, 106, '18', { size: 16, col: '#cf4a44' }) +
      aText(180, 178, '0 になった腕は落ちる', { size: 12 })),
  },
  {
    cat: '腕の管理', title: '腕の切り替え（デバッグ）',
    keys: [['1', '拳'], ['2', '銃'], ['3', '触手']],
    desc: '検証用のショートカット。両腕をその場でまとめて差し替える（フルHP）。片腕だけ変えたいときは棚か敵から取る。',
    art: () => aStage(
      aKey(96, 60, '1', true) + aKey(180, 60, '2', true) + aKey(264, 60, '3', true) +
      aRect(88, 100, 16, 56, C_ARM) + aRect(84, 92, 24, 14, C_ARM, ' rx="3"') +
      aRect(172, 100, 16, 56, C_GUN) + aLine(180, 100, 180, 82, C_BARREL, 8) +
      '<path d="M264 156 V112" stroke="' + C_TENT + '" stroke-width="16" stroke-linecap="round"/>' +
      '<path d="M264 112 q -10 -14 -16 -24 M264 112 q 2 -18 0 -28 M264 112 q 12 -12 18 -22"' +
      ' fill="none" stroke="' + C_TENT_TIP + '" stroke-width="5" stroke-linecap="round"/>' +
      aText(96, 182, 'FIST', { size: 12 }) + aText(180, 182, 'GUN', { size: 12 }) +
      aText(264, 182, 'TENTACLE', { size: 12 })),
  },
  {
    cat: '腕の管理', title: '腕の棚（ARM RACK）',
    keys: [['Q', '長押し'], ['左/右クリック', '□に合わせて']],
    desc: 'リスポーン地点の正面にある棚。ライジング中に□へクロスヘアを合わせてクリックすると、その腕がフルHPで付く。何度取っても棚から減らない。',
    art: () => aStage(
      aRect(60, 128, 240, 10, '#3b4149') + aRect(70, 60, 220, 68, '#272c33') +
      aText(180, 50, 'ARM RACK', { size: 14, col: C_HI }) +
      aRect(112, 86, 12, 42, C_ARM) + aRect(108, 78, 20, 12, C_ARM, ' rx="3"') +
      aRect(174, 86, 12, 42, C_GUN) + aLine(180, 86, 180, 70, C_BARREL, 7) +
      '<path d="M242 128 V96" stroke="' + C_TENT + '" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M242 96 q -10 -14 -17 -22 M242 96 q 2 -16 0 -26 M242 96 q 12 -12 18 -20"' +
      ' fill="none" stroke="' + C_TENT_TIP + '" stroke-width="5" stroke-linecap="round"/>' +
      aSquare(118, 98, 34, 'rgba(150,230,170,0.95)') + aCross(118, 98) +
      aText(180, 182, '取っても消えない', { size: 12, col: C_HI })),
  },

  /* --- ライジング --- */
  {
    cat: 'ライジング', title: 'ライジング',
    keys: [['Q', '長押し']],
    desc: '押しているあいだだけ脊柱が伸びてワールドがスローになる。いつでも出せるが、その場から動けない。離すとゴムのように縮んで人間モードへ戻る。',
    art: () => aStage(
      '<rect width="360" height="200" fill="#2c5a68" opacity="0.14"/>' +
      aRect(169, 166, 22, 30, C_LEG) +
      aRect(160, 130, 40, 38, '#4e5560') +
      aRect(147, 132, 10, 32, C_ARM) + aRect(203, 132, 10, 32, C_ARM) +
      '<path d="M180 130 V92" stroke="#c9c3b4" stroke-width="7"/>' +
      aHeadForm(180, 80, 1.0) +
      aText(300, 44, 'SLOW', { size: 14, col: C_COOL }) +
      aKey(60, 44, 'Q', true) + aText(60, 72, 'HOLD', { size: 11, col: C_HI })),
  },
  {
    cat: 'ライジング', title: '腕を奪う',
    keys: [['左クリック', '→ 左手に付く'], ['右クリック', '→ 右手に付く']],
    desc: 'スタン中の敵の腕・死体の腕・床に落ちた腕・棚の腕、すべて□にクロスヘアを合わせてクリック。押したボタンの側に付く（敵と対面すると左右が鏡になるため）。この斬撃で敵のHPは減らない。',
    art: () => aStage(
      aEnemy(180, 1.05, { stun: true }) +
      aSquare(146, 108, 32) + aSquare(214, 108, 32) +
      aCross(214, 108) +
      aLine(196, 72, 236, 140, '#fff0b0', 4) +
      aMouse(312, 150, 0.6, 'R')),
  },
  {
    cat: 'ライジング', title: '死体を乗っ取る',
    keys: [['F', '□が死体の首元のとき']],
    desc: '死体の首元に出る青い□に合わせてFを押すと、首が飛んで脊柱を突き刺し、その体で人間モードになる。死体の腕はそのまま自分の腕になる。',
    art: () => aStage(
      aCorpse(180, 1.1) +
      aSquare(180, 128, 32, '#b8e8ff') +
      '<path d="M90 60 Q 140 60 176 118" fill="none" stroke="rgba(184,232,255,0.5)"' +
      ' stroke-width="3" stroke-dasharray="6 6"/>' +
      aHeadForm(90, 60, 0.85) +
      aKey(300, 48, 'F', true)),
  },
  {
    cat: 'ライジング', title: '頭モードへ',
    keys: [['Space', '']],
    desc: 'ライジング中にSpaceで脊柱から下を切り離す。残した体はその場に死体として残るので、あとから自分で乗っ取り直せる。',
    art: () => aStage(
      aCorpse(120, 1.0) +
      aHeadForm(252, 86, 1.0) +
      aArrow(166, 96, 220, 86, C_HI, 3) +
      aKey(60, 44, 'Space', true)),
  },

  /* --- 頭モード --- */
  {
    cat: '頭モード', title: '移動とジャンプ',
    keys: [['W A S D', '移動'], ['Space', 'ジャンプ']],
    desc: '三人称。丸い頭に蜘蛛脚と脊柱のしっぽが付いた状態で歩き回る。攻撃はできない。',
    art: () => aStage(
      '<path d="M70 168 Q 150 92 240 150" fill="none" stroke="rgba(255,215,94,0.3)"' +
      ' stroke-width="3" stroke-dasharray="6 6"/>' +
      aHeadForm(150, 102, 1.0) +
      aKey(296, 48, 'Space', true) + aKey(296, 86, 'WASD', true)),
  },
  {
    cat: '頭モード', title: '死体に乗り移る',
    keys: [['F', '死体に近づいて']],
    desc: '近くの死体にFで乗り移ると、その体で人間モードに戻る。死体が持っている腕がそのまま自分の腕になる。',
    art: () => aStage(
      aCorpse(220, 1.1) +
      aHeadForm(120, 140, 0.9) +
      aArrow(148, 128, 198, 112, C_HI, 3) +
      aText(220, 56, '[F] TAKE BODY', { size: 13, col: C_HI })),
  },

  /* --- 体スキル --- */
  {
    cat: '体スキル', title: '体スキル',
    keys: [['Z', '体ごとに1回']],
    desc: '体ごとに1回だけ使えるスキル。使えるときは中央の体アイコンの縁が光り、絵がスキルの種類を表す。使うと光が消え、その体ではもう使えない。死体を乗っ取ると、その体のスキルが手に入る。',
    art: () => aStage(
      '<circle cx="180" cy="96" r="44" fill="none" stroke="' + C_HI + '" stroke-width="5" opacity="0.9"/>' +
      '<circle cx="180" cy="96" r="52" fill="none" stroke="' + C_HI + '" stroke-width="2" opacity="0.35"/>' +
      '<circle cx="180" cy="96" r="38" fill="#7fc4a0"/>' +
      '<g transform="translate(152 68) scale(1.17)" fill="none" stroke="#f4f7f0" stroke-width="3"' +
      ' stroke-linecap="round" stroke-linejoin="round">' + HUD_ICON.asura.replace(/class="f"/g, 'fill="#f4f7f0"') +
      '</g>' + aKey(258, 70, 'Z', true) +
      aText(180, 172, '[F] TAKE BODY  ASURA', { size: 12, col: C_HI })),
  },
  {
    cat: '体スキル', title: '阿修羅（ASURA）',
    keys: [['Z', '発動'], ['左右クリック', '追加の腕も続く']],
    desc: '3時・2時／9時・10時の位置に腕が生えて6本腕になる。クリックした側の追加の腕も少し遅れて同じように攻撃する。追加の腕は生えたときの腕の種類のままで、ライジングで腕を交換しても変わらない。',
    art: () => {
      // 画面の左右の縁から、手先をクロスヘアへ向けて伸びる追加の腕
      const extra = (x0, y0, x1, y1) =>
        aLine(x0, y0, x1, y1, C_ARM, 16) +
        aRect(x1 - 11, y1 - 11, 22, 22, C_ARM, ' rx="4" stroke="#0b0d10" stroke-width="2"');
      return aStage(
        aEnemy(180, 1.0, {}) + aBurst(180, 96, 0.9) +
        extra(372, 92, 268, 88) + extra(360, 12, 262, 50) +
        extra(-12, 92, 92, 88) + extra(0, 12, 98, 50) +
        aArm('L', 'fist', 0.1) + aArm('R', 'fist', 1) +
        aText(312, 120, '3', { size: 13, col: C_HI }) + aText(300, 30, '2', { size: 13, col: C_HI }) +
        aText(48, 120, '9', { size: 13, col: C_HI }) + aText(60, 30, '10', { size: 13, col: C_HI }));
    },
  },
  {
    cat: '体スキル', title: '回復（HEAL）',
    keys: [['Z', '発動']],
    desc: '緑の光が立ちのぼり、体のHPを全回復する。',
    art: () => {
      let dots = '';
      for (let i = 0; i < 16; i++) {
        // 体のまわりに散らす（規則的に並ばないよう、ずらした正弦で置く）
        const x = 180 + Math.sin(i * 2.4) * (40 + (i % 4) * 14), y = 150 - ((i * 47) % 100);
        dots += '<circle cx="' + x + '" cy="' + y + '" r="' + (2 + (i % 3)) + '" fill="#7dffb0" opacity="0.8"/>';
      }
      return aStage(
        '<rect width="360" height="200" fill="url(#hg)"/>' +
        '<defs><radialGradient id="hg"><stop offset="55%" stop-color="#50ff96" stop-opacity="0"/>' +
        '<stop offset="100%" stop-color="#3ce682" stop-opacity="0.45"/></radialGradient></defs>' +
        dots + aArrow(180, 150, 180, 70, '#7dffb0', 4) +
        aText(180, 182, 'HP 100', { size: 15, col: '#7fe0a6' }) + aKey(56, 44, 'Z', true));
    },
  },

  /* --- デバッグ --- */
  {
    cat: 'デバッグ', title: 'ボス戦へワープ',
    keys: [['B', '']],
    desc: 'ダクトの男（DUCT MAN）のアリーナへ飛ぶ。3ラウンドのかくれんぼ。',
    art: () => aStage(
      '<rect width="360" height="200" fill="#120a0a" opacity="0.6"/>' +
      aEnemy(180, 1.25, { armColor: '#7a2f2a', headColor: '#6a5f70', op: 0.85 }) +
      aText(180, 44, 'DUCT MAN', { size: 15, col: '#ff8f7a' }) +
      aKey(56, 44, 'B', true)),
  },
  {
    cat: 'デバッグ', title: 'デモステージへ',
    keys: [['V', '']],
    desc: '一本道の廊下で5ウェーブ戦う。全滅させないと奥の門（赤い壁）が開かない。Gでリセットするとハブへ戻る。',
    art: () => aStage(
      aLine(104, 60, 104, 200, '#3b4149', 4) + aLine(256, 60, 256, 200, '#3b4149', 4) +
      aRect(104, 56, 152, 12, '#8e2f2a') +
      aEnemy(146, 0.62, { feet: 136 }) + aEnemy(212, 0.62, { feet: 136 }) +
      aText(180, 188, 'WAVE 1 / 5', { size: 13, col: C_HI }) +
      aKey(56, 44, 'V', true)),
  },
  {
    cat: 'デバッグ', title: '体スキルの切り替え',
    keys: [['4', '阿修羅'], ['5', '回復']],
    desc: '今の体の体スキルを差し替えて未使用に戻す（検証用）。阿修羅で生えていた腕は消える。',
    art: () => aStage(
      aKey(130, 80, '4', true) + aText(130, 124, 'ASURA', { size: 13, col: C_HI }) +
      aKey(230, 80, '5', true) + aText(230, 124, 'HEAL', { size: 13, col: '#7fe0a6' })),
  },
  {
    cat: 'デバッグ', title: 'リセット',
    keys: [['G', '']],
    desc: 'プレイヤー・敵・死体・落ちた腕を初期状態に戻し、リスポーン地点へ帰る。デモ中なら抜けてハブへ戻る。',
    art: () => aStage(
      '<path d="M180 70 A 42 42 0 1 1 143.6 91" fill="none" stroke="' + C_HI +
      '" stroke-width="5" stroke-linecap="round"/>' +
      '<polygon points="198 70 174 60 174 80" fill="' + C_HI + '"/>' +
      aText(180, 182, 'RESET', { size: 15, col: C_HI }) +
      aKey(56, 44, 'G', true)),
  },
];

/* =========================================================
   マニュアルの開閉とページ送り
   ========================================================= */
let manualOpen = false;
let manualIdx = 0;

const mu = {
  root: document.getElementById('manual'),
  cat: document.getElementById('manualCat'),
  count: document.getElementById('manualCount'),
  art: document.getElementById('manualArt'),
  title: document.getElementById('manualTitle'),
  keys: document.getElementById('manualKeys'),
  desc: document.getElementById('manualDesc'),
  dots: document.getElementById('manualDots'),
};

function renderManual() {
  const p = MANUAL_PAGES[manualIdx];
  mu.cat.textContent = p.cat;
  mu.count.textContent = (manualIdx + 1) + ' / ' + MANUAL_PAGES.length;
  mu.art.innerHTML = '<svg viewBox="0 0 ' + ART.W + ' ' + ART.H + '" preserveAspectRatio="xMidYMid meet">' +
                     p.art() + '</svg>';
  mu.title.textContent = p.title;
  mu.keys.innerHTML = p.keys.map(
    (k) => '<span class="mk">' + k[0] + '</span>' + (k[1] ? '<span class="mm">' + k[1] + '</span>' : '')
  ).join('<span class="msep">/</span>');
  mu.desc.textContent = p.desc;
  // ページ位置。カテゴリの切れ目で間を空けて「章」が見えるようにする
  let dots = '';
  for (let i = 0; i < MANUAL_PAGES.length; i++) {
    const gap = i > 0 && MANUAL_PAGES[i].cat !== MANUAL_PAGES[i - 1].cat;
    dots += '<i class="' + (i === manualIdx ? 'on' : '') + (gap ? ' gap' : '') + '"></i>';
  }
  mu.dots.innerHTML = dots;
}

function openManual() {
  manualOpen = true;
  // 開く前に握っていたキーを落とす。閉じた瞬間に歩き出さないように
  for (const k of Object.keys(keys)) keys[k] = false;
  mouseHold.LEFT = null; mouseHold.RIGHT = null;
  gunHold.LEFT = false; gunHold.RIGHT = false;
  signPrompt.classList.add('hidden');
  document.body.classList.add('manual-on');   // クロスヘアと腕HUDを引っ込める
  renderManual();
  mu.root.classList.remove('hidden');
}

function closeManual() {
  manualOpen = false;
  document.body.classList.remove('manual-on');
  mu.root.classList.add('hidden');
}

function manualTurn(d) {
  manualIdx = (manualIdx + d + MANUAL_PAGES.length) % MANUAL_PAGES.length;
  renderManual();
}

/* =========================================================
   腕の棚（ARM RACK）と操作説明の看板

   リスポーン地点 (0, 6) の正面、ROOM1 と ROOM2 のあいだの通路に置いてある。
   棚に並んだ腕はライジングの□＋クリックで何度でも取れる（取っても棚から減らない）。
   敵を倒して腕を奪わなくても、腕ごとの手触りをその場で比べられるようにするための
   デバッグ用の設備。

   看板はFでインタラクトすると操作説明（1ページ1動作）が開く。
   ========================================================= */

const RACK = {
  x: 0, z: 1.2,            // 棚の中心。プレイヤーは (0, 6) に -Z を向いて出るので正面に見える
  slotGap: 1.30,           // 腕と腕の間隔(m)
  boardY: 1.15,            // 腕を載せる棚板の高さ(m)
  range: 9.0,              // □が出る距離(m)。risingInteractRange(7.0)より少し広くとってある
  signX: 3.6,              // 看板は棚の右どなり
  signRange: 3.8,          // 看板に[F]が出る距離(m)
  slots: [],               // { kind, group, world, el, pulse }
  signWorld: new THREE.Vector3(),
};

const ARM_LABEL = { fist: 'FIST  [1]', gun: 'GUN  [2]', tentacle: 'TENTACLE  [3]' };

/* ---------- 文字を貼った板（部屋名と同じ CanvasTexture 方式）---------- */
function makeTextPlane(lines, w, h, opts) {
  const o = opts || {};
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.max(32, Math.round(512 * h / w));
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  if (ctx) {
    if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      ctx.font = (L.size || 54) + 'px sans-serif';
      ctx.fillStyle = L.color || 'rgba(205,210,200,0.85)';
      ctx.fillText(L.text, cv.width / 2, cv.height * ((i + 0.5) / lines.length));
    }
    tex.needsUpdate = true;
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
}

/* ---------- 棚に飾る腕 ----------
   手首が上を向いた状態で立てて置く。床に落ちている腕（ejectOldArm）と
   同じ色・同じ太さにしてあるので、棚の腕と拾う腕が同じものだと分かる      */
function buildRackArm(kind) {
  const g = new THREE.Group();
  const col = (kind === ARM.GUN) ? COLOR_GUN_ARM
            : (kind === ARM.TENTACLE) ? COLOR_TENTACLE : COLOR_PLAYER_ARM;
  const fore = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.74, 0.15),
    new THREE.MeshLambertMaterial({ color: col }));
  fore.position.y = 0.37;
  g.add(fore);

  if (kind === ARM.GUN) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.32, 8),
      new THREE.MeshLambertMaterial({ color: COLOR_GUN_BARREL }));
    barrel.position.y = 0.88;
    g.add(barrel);
  } else if (kind === ARM.TENTACLE) {
    // 手首から先の3本。棚の上では軽く開いて垂れている
    for (let s = 0; s < 3; s++) {
      const a = s * Math.PI * 2 / 3;
      for (let k = 0; k < 6; k++) {
        const t = (k + 1) / 6;
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 * (1 - t * 0.5), 7, 5),
          new THREE.MeshLambertMaterial({
            color: new THREE.Color(COLOR_TENTACLE).lerp(new THREE.Color(COLOR_TENTACLE_TIP), t) }));
        m.position.set(Math.cos(a) * t * 0.17,
                       0.76 + t * 0.26 - t * t * 0.20,
                       Math.sin(a) * t * 0.17);
        g.add(m);
      }
    }
  } else {
    const fist = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.19, 0.21),
      new THREE.MeshLambertMaterial({ color: COLOR_PLAYER_ARM }));
    fist.position.y = 0.83;
    g.add(fist);
  }
  g.userData.kind = kind;
  return g;
}

/* ---------- 棚と看板を建てる ---------- */
const rackGroup = new THREE.Group();
scene.add(rackGroup);

{
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x3b4149 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x272c33 });
  const kinds = [ARM.FIST, ARM.GUN, ARM.TENTACLE];
  const W = RACK.slotGap * kinds.length + 0.5;

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, 2.70, 0.10), darkMat);
  back.position.set(RACK.x, 1.35, RACK.z - 0.32);
  rackGroup.add(back);

  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.10, 0.60), woodMat);
  board.position.set(RACK.x, RACK.boardY, RACK.z);
  rackGroup.add(board);

  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, RACK.boardY, 0.12), woodMat);
    leg.position.set(RACK.x + sx * (W / 2 - 0.12), RACK.boardY / 2, RACK.z);
    rackGroup.add(leg);
  }

  const title = makeTextPlane([{ text: 'ARM RACK', size: 62, color: 'rgba(255,215,94,0.85)' }],
                              2.4, 0.45);
  title.position.set(RACK.x, 2.42, RACK.z - 0.26);
  rackGroup.add(title);

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const x = RACK.x + (i - (kinds.length - 1) / 2) * RACK.slotGap;

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.07, 0.40), darkMat);
    pad.position.set(x, RACK.boardY + 0.08, RACK.z);
    rackGroup.add(pad);

    const arm = buildRackArm(kind);
    arm.position.set(x, RACK.boardY + 0.11, RACK.z);
    rackGroup.add(arm);

    const label = makeTextPlane([{ text: ARM_LABEL[kind], size: 46 }], 1.15, 0.26);
    label.position.set(x, RACK.boardY - 0.16, RACK.z + 0.32);
    rackGroup.add(label);

    const el = document.createElement('div');
    el.className = 'shoulder-target rack hidden';
    document.body.appendChild(el);

    RACK.slots.push({
      kind, group: arm, el, pulse: 0,
      world: new THREE.Vector3(x, RACK.boardY + 0.55, RACK.z),
    });
  }

  // --- 操作説明の看板（棚の右どなり）---
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 0.12), woodMat);
  post.position.set(RACK.signX, 0.72, RACK.z);
  rackGroup.add(post);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.70, 1.00, 0.08), darkMat);
  panel.position.set(RACK.signX, 1.88, RACK.z);
  rackGroup.add(panel);

  const face = makeTextPlane([
    { text: '操作説明', size: 86, color: 'rgba(255,233,138,0.95)' },
    { text: 'MANUAL   [ F ]', size: 42, color: 'rgba(200,205,195,0.7)' },
  ], 1.60, 0.92);
  face.position.set(RACK.signX, 1.88, RACK.z + 0.05);
  rackGroup.add(face);

  RACK.signWorld.set(RACK.signX, 2.18, RACK.z + 0.05);
}

// 看板の[F]プロンプト（死体の胸元と同じ見た目）
const signPrompt = document.createElement('div');
signPrompt.className = 'chest-prompt hidden';
signPrompt.innerHTML = '<span class="key">F</span>';
document.body.appendChild(signPrompt);

function signInRange() {
  if (DEMO.active) return false;
  // 看板は頭より高い位置にあるので、3D距離だと真下に立っても遠く出る。水平距離で見る
  return Math.hypot(playerPos.x - RACK.signWorld.x, playerPos.z - RACK.signWorld.z) <= RACK.signRange;
}

/* ---------- 棚から腕を取る ----------
   見本は棚に残したまま、グラフト演出用の使い捨てメッシュだけを飛ばす。
   付き方も付く側（押したボタンの側）も、敵の腕・床の腕とまったく同じ扱い   */
function takeRackArm(t, side) {
  const sl = t.slot;
  const ghost = buildRackArm(sl.kind);
  ghost.position.copy(sl.world);
  scene.add(ghost);
  selectedTarget = null;
  startArmGraft(ghost, side, sl.world.clone(), makeArmState(sl.kind));
  sl.pulse = 1;                     // 見本が一度膨らむ。「まだ在庫がある」ことの合図
  addHitstop(0.10);
  addShake(0.20);
  doFlash(0.20, '#ffd0b0');
  showFeedback('RACK ' + side[0] + '  ' + sl.kind.toUpperCase(), '#ffd75e', 30);
}

/* ---------- 毎フレーム ---------- */
function updateRack(rdt) {
  for (const sl of RACK.slots) {
    sl.group.rotation.y += rdt * 0.6;          // ゆっくり回して形が見えるようにする
    if (sl.pulse > 0) {
      sl.pulse = Math.max(0, sl.pulse - rdt * 2.6);
      sl.group.scale.setScalar(1 + Math.sin(sl.pulse * Math.PI) * 0.22);
    } else sl.group.scale.setScalar(1);
  }

  // 看板の[F]。人間モードと頭モードのときだけ出す
  const show = !manualOpen && signInRange() && (state === S.HUMAN || state === S.HEAD);
  if (!show) { signPrompt.classList.add('hidden'); return; }
  const scr = projectToScreen(RACK.signWorld);
  if (!scr.front) { signPrompt.classList.add('hidden'); return; }
  signPrompt.classList.remove('hidden');
  signPrompt.style.left = scr.x + 'px';
  signPrompt.style.top = scr.y + 'px';
}

/* =========================================================
   目的とコンパス
   ・今の目的（文章）とゴールの位置は、状況（ハブ／ボス戦／デモ）から毎フレーム決める
   ・目的は普段は隠れていて、Tabで左上に開閉する
   ・コンパスは上中央。丸いアイコン(G)がゴールの方角を指す。
     中央＝正面、両端の目盛り＝真横(±90°)。それより後ろは端に張り付いて薄くなる
   ========================================================= */
const objUi = {
  panel: document.getElementById('objective'),
  text: document.getElementById('objectiveText'),
  goal: document.getElementById('compassGoal'),
};
let objectiveOpen = false;
const _objGoal = new THREE.Vector3();
const _objDir = new THREE.Vector3();

function toggleObjective() {
  objectiveOpen = !objectiveOpen;
  objUi.panel.classList.toggle('hidden', !objectiveOpen);
}

// 今の目的。goal は _objGoal を書き換えて返す（ゴールがない場面は null）
function currentObjective() {
  const at = (x, z) => _objGoal.set(x, 0, z);
  if (DEMO.active) {
    if (DEMO.phase === 'FIGHT') {
      return { text: '敵を全滅させて奥の門を開ける', goal: at(DEMO.cx, demoGateZ(DEMO.wave)) };
    }
    if (DEMO.phase === 'CLEAR') return { text: '突き当りまで進む', goal: at(DEMO.cx, demoEndZ()) };
    return { text: '廊下を前へ進む', goal: at(DEMO.cx, demoSegZ(DEMO.next) - 2.5) };
  }
  const room = ARENA.rooms[BOSS.room];
  const roomCenter = () => at((room.x0 + room.x1) / 2, (ARENA.z0 + ARENA.z1) / 2);
  switch (BOSS.phase) {
    case 'FIGHT':
      return { text: 'ダクトの男を倒す', goal: _objGoal.copy(bossMan.group.position) };
    case 'FLEE':
      return { text: '逃げるダクトの男を追う',
        goal: fleeHead.visible ? _objGoal.copy(fleeHead.position) : roomCenter() };
    case 'WAIT': {
      // 今いる部屋側のダクトの入口
      const d = ARENA.ducts[Math.min(ARENA.ducts.length - 1, BOSS.room)];
      return { text: '頭モード（Q長押し → Space）でダクトを抜け、ダクトの男を追う',
        goal: at(d.a === BOSS.room ? d.x0 : d.x1, d.z) };
    }
    case 'HIDE':
    case 'SCARE':
      return { text: '頭の付いた死体を探し出す', goal: roomCenter() };
    case 'CLEAR':
      return { text: 'ボス戦は終わった（[B] でもう一度 / [G] でハブへ）', goal: null };
    default:
      // ハブ：ボスアリーナの入口（赤いライン）
      return { text: 'ダクトの男の部屋へ向かう',
        goal: at((ARENA.gate.x0 + ARENA.gate.x1) / 2, ARENA.z1 + 0.5) };
  }
}

function updateObjectiveHud() {
  const obj = currentObjective();
  if (objUi.text.textContent !== obj.text) objUi.text.textContent = obj.text;

  objUi.goal.classList.toggle('hidden', !obj.goal);
  if (!obj.goal) return;
  // 見ている方向（カメラ）を水平にしたものを正面として、ゴールが左右どちらに何度あるか
  camera.getWorldDirection(_objDir);
  const fx = _objDir.x, fz = _objDir.z;
  const len = Math.hypot(fx, fz) || 1;
  const from = (state === S.HEAD || state === S.POSSESS) ? headPos : playerPos;
  const dx = obj.goal.x - from.x, dz = obj.goal.z - from.z;
  // 右 = (-fz, fx)。右にあれば正
  const ang = Math.atan2((dx * -fz + dz * fx) / len, (dx * fx + dz * fz) / len);
  const k = Math.max(-1, Math.min(1, ang / (Math.PI / 2)));
  objUi.goal.style.left = (50 + k * 44) + '%';     // 両端の目盛りは 6% / 94%
  objUi.goal.classList.toggle('edge', Math.abs(ang) > Math.PI / 2);
}

/* =========================================================
   メインループ
   ========================================================= */
updateArmVisuals();

/* ---------- ライジングのカメラ（首越し）----------
   首が飛び出すところを見せてから、首越しの寄りカメラに落ち着く。
   前後左右はすぐ首越しの位置へ寄せ、高さだけ頭から遅れて追う。
   頭が先に画面上へ抜け、カメラが首を這い上がって追いつく。
   t はライジング開始からの実時間(s)。戻り（RISE_OUT）は一人称へ寄せる   */
const _ncFwd = new THREE.Vector3(), _ncFlat = new THREE.Vector3(), _ncRight = new THREE.Vector3();
const _ncFps = new THREE.Vector3(), _ncAim = new THREE.Vector3();
const _ncPos = new THREE.Vector3(), _ncLook = new THREE.Vector3();
const smooth01 = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const easeOut01 = (x) => { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };

function updateNeckCamera(t) {
  _ncFwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  _ncFlat.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  _ncRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
  _ncFps.set(playerPos.x, playerPos.y + EYE, playerPos.z);
  _ncAim.copy(_ncFps).addScaledVector(_ncFwd, 5.0);

  // 首越しの最終位置と注視点
  _ncPos.copy(headPos)
    .addScaledVector(_ncFlat, -CONFIG.neckCamBack)
    .addScaledVector(_ncRight, CONFIG.neckCamSide);
  _ncLook.copy(headPos).addScaledVector(_ncFwd, 6.0);

  const slide = easeOut01(t / CONFIG.neckCamSlideTime);
  const climb = smooth01((t - CONFIG.neckCamClimbStart) /
    (CONFIG.neckCamClimbEnd - CONFIG.neckCamClimbStart));
  _ncPos.lerpVectors(_ncFps, _ncPos, slide);
  _ncPos.addScaledVector(_ncFlat,
    -CONFIG.neckCamBulge * Math.sin(Math.PI * smooth01(t / CONFIG.neckCamClimbEnd)));
  _ncPos.y = playerPos.y + EYE + CONFIG.spineLength * climb + CONFIG.neckCamHeight * slide;
  _ncPos.y = Math.max(_ncPos.y, 0.4);
  _ncLook.lerpVectors(_ncAim, _ncLook, slide);

  // 戻り（RISE_OUT）は脊柱の縮みに合わせて一人称へ寄せる
  const w = state === S.RISE_OUT ? smooth01(risingBlend) : 1;
  camera.position.lerpVectors(_ncFps, _ncPos, w);
  camera.lookAt(_ncAim.lerp(_ncLook, w));
  // 頭の中・すぐ外を通るあいだは頭を消す（内側から突き抜けて見えるのを防ぐ）
  if (camera.position.distanceTo(headPos) < 0.5) headMesh.visible = false;
}

function animate() {
  requestAnimationFrame(animate);
  const rdt = Math.min(clock.getDelta(), 0.05);

  let dt = rdt;
  if (hitstop > 0) { hitstop -= rdt; dt = 0; }

  /* --- ライジングのブレンド（脊柱の伸び＋カメラ） --- */
  if (state === S.RISE_IN) {
    risingBlend = Math.min(1, risingBlend + rdt / CONFIG.severEnterTime);
    if (risingBlend >= 1) state = S.RISING;
  } else if (state === S.RISE_OUT) {
    risingBlend = Math.max(0, risingBlend - rdt / CONFIG.severExitTime);
    if (risingBlend <= 0) finishRising();
  }
  // タイムスケール。risingBlend に合わせてスローに入り、戻るときに解ける。
  // 頭モードと乗っ取り中は等速
  let timeScale = 1;
  if (state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT) {
    timeScale = 1 + (CONFIG.slowMotionScale - 1) * risingBlend;
  }
  if (slowTimer > 0) { slowTimer -= rdt; timeScale = Math.min(timeScale, slowScaleOverride); }
  const wdt = dt * timeScale;
  worldTime += wdt;

  /* --- 入力（人間モード） --- */
  updateGuard(rdt);
  for (const side of ['LEFT', 'RIGHT']) {
    if (gunCool[side] > 0) gunCool[side] -= rdt;
    if (player.gunRecoil[side] > 0) player.gunRecoil[side] = Math.max(0, player.gunRecoil[side] - rdt * 7);
  }
  if (state === S.HUMAN && locked() && player.hp > 0) {
    for (const side of ['LEFT', 'RIGHT']) {
      const h = mouseHold[side];
      if (h && !h.purged) {
        h.t += rdt;
        // 出せなければ消化しない。キャンセルできる状態になった時点で出るし、
        // 出せない腕（既にパージ済み／銃腕）なら離したときにパンチが出る
        if (h.tent) {
          // 触手腕の長押しはパージではなく前方への刺突
          if (h.t >= CONFIG.tentHoldTime && startTentacleHold(side)) h.purged = true;
        } else if (h.t >= CONFIG.purgeHoldTime && doPurge(side)) h.purged = true;
      }
      if (gunHold[side]) tryShoot(side);   // 長押しで連射（間隔は gunCool が見る）
    }
  }

  // 壁判定用に、動かす前の座標を控えておく
  const prevX = playerPos.x, prevZ = playerPos.z;
  if (player.dodgeT > 0) {
    player.dodgeT -= dt;
    playerPos.addScaledVector(player.dodgeDir, CONFIG.dodgeDistance * dt / CONFIG.dodgeDuration);
    if (player.dodgeT <= 0) player.recoverT = CONFIG.dodgeRecover;
  } else if (canMove() && locked() && player.hp > 0) {
    const f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    const r = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    if (f !== 0 || r !== 0) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const len = Math.hypot(f, r);
      const spd = moveSpeedNow();
      playerPos.x += (fx * f + rx * r) / len * spd * dt;
      playerPos.z += (fz * f + rz * r) / len * spd * dt;
    }
  }
  confinePlayer(prevX, prevZ);

  if (player.invuln > 0) player.invuln -= dt;
  if (player.recoverT > 0) player.recoverT -= dt;
  if (player.stagger > 0) player.stagger -= dt;

  // 触手の伸び／刺し／振り回し。プレイヤーの座標と視点が確定したあとに見る。
  // 実時間(rdt)で動かすので、スローがかかっても振り回しの手応えは変わらない
  updateTentacle(rdt);

  // 頭モードの上下動（ジャンプと重力）
  if (state === S.HEAD) updateHeadMode(dt);
  // 乗っ取り演出
  if (state === S.POSSESS && possess) updatePossess(rdt);
  if (legSwing) { legSwing.t += rdt; if (legSwing.t >= CONFIG.spiderSwingTime) legSwing = null; }

  if (player.resource < player.resMax) {
    player.resourceCharge += dt;
    if (player.resourceCharge >= CONFIG.resourceRegenTime) { player.resourceCharge = 0; player.resource++; }
  } else player.resourceCharge = 0;

  if (player.attack) {
    const atk = player.attack;
    atk.t += dt;
    if (atk.type === 'finisher') {
      if (atk.tent) updateTentFinisher(atk, dt); else updateFinisher(atk, dt);
    } else {
      if (!atk.resolved && atk.t >= atk.startup) { atk.resolved = true; resolveAttack(atk); }
      // 触手の薙ぎ払いだけは、刃の角度を進めながら通った帯を毎フレーム判定する
      if (atk.tent && player.attack === atk) updateTentacleSweep(atk);
      // resolvePunch() がフィニッシャーに差し替えた場合は、このパンチの硬直は見ない
      if (player.attack === atk) {
        const recover = atk.type === 'kick' ? CONFIG.kickRecover
                      : atk.tent ? CONFIG.tentSweepActive + CONFIG.tentSweepRecover
                                 : CONFIG.punchRecover;
        if (atk.t >= atk.startup + recover) player.attack = null;
      }
    }
  }

  // 先行入力。攻撃の進行を進めたあとに見るので、
  // 振り抜きに達したフレームでそのまま次のパンチへ繋がる
  updatePunchBuffer(dt);

  /* --- 弾とパージ手首 ---
     判定は「今フレームで通った線分」と「敵の体の縦線分」の最短距離で見る。
     高さを 1.5m 固定の1点で見ていたときは、触手で持ち上げた敵／投げて
     飛んでいる敵は足元が浮いているぶん判定の高さがずれて、当たらなかった  */
  for (const p of projectiles) {
    if (p.dead) continue;
    const step = p.vel.clone().multiplyScalar(dt);
    const from = p.obj.position.clone();            // 通った線分の始点
    p.obj.position.add(step);
    if (p.kind !== 'bullet') p.obj.rotation.x += 12 * dt;   // 手首だけ回転する
    p.travelled += step.length();

    // いちばん手前で線分に触れた敵を拾う（奥の敵に先に当たらないように）
    let hitEn = null, hitT = Infinity;
    for (const en of enemies) {
      if (en.state === E.DEAD || en.state === E.DODGE || en.state === E.GRABBED) continue;
      // 拘束中／飛んでいる敵は足が浮いているので、高さは必ず足元基準で見る
      const flying = (en.state === E.TETHER || en.state === E.THROWN);
      const r = (p.kind === 'bullet')
        ? (flying ? CONFIG.gunHitRadiusHeld : CONFIG.gunHitRadius)
        : CONFIG.purgeHitRadius;
      const bp = en.group.position;
      const s = segSegDistSq(from.x, from.y, from.z,
                             p.obj.position.x, p.obj.position.y, p.obj.position.z,
                             bp.x, bp.y + PROJ_BODY_LO, bp.z,
                             bp.x, bp.y + PROJ_BODY_HI, bp.z);
      if (s.d2 > r * r || s.t >= hitT) continue;
      hitT = s.t; hitEn = en;
    }
    if (hitEn) {
      p.dead = true;
      // 当たった点まで戻す。血と肉片が出る位置を当たった場所に合わせる
      p.obj.position.copy(from).addScaledVector(step, hitT);
      if (p.kind === 'bullet') resolveBullet(p, hitEn);
      else {
        const en = hitEn;
        const attacking = (en.state === E.WINDUP || en.state === E.ACTIVE);
        applyDamage(en, CONFIG.attackDamage);
        applyStun(en, CONFIG.attackStun);
        if (attacking) { showFeedback('TRADE!', '#ffb45e', 30); addHitstop(CONFIG.hitstopTrade); }
        else {
          if (en.state !== E.STUNNED && en.state !== E.DEAD) enterHitReact(en);
          showFeedback(en.state === E.TETHER ? 'PINNED PURGE' : 'PURGE HIT', '#a8d8ff', 30);
          addHitstop(CONFIG.hitstopNormal);
        }
        addShake(CONFIG.shakeNormal * 1.4);
        checkEnemyEscape(en);
      }
    }
    const range = p.kind === 'bullet' ? CONFIG.gunRange : CONFIG.purgeRange;
    if (p.obj.position.y < 0.1 || p.travelled > range) p.dead = true;
  }
  for (const p of projectiles) {
    if (!p.dead) continue;
    // パージした手は、当たった地点／力尽きた地点で肉片になって消える。
    // 手首だけが音もなく消えると「当たったのか外れたのか」が分からない
    if (p.kind !== 'bullet') {
      spawnFleshBurst(p.obj.position, CONFIG.purgeGibs, CONFIG.armEjectGibSpeed,
                      null, CONFIG.armGibLife);
    }
    scene.remove(p.obj);
  }
  projectiles = projectiles.filter((p) => !p.dead);

  /* --- 敵更新 --- */
  for (const en of enemies) updateEnemy(en, wdt, rdt);

  /* --- 倒した敵の死体の爆発 --- */
  updateCorpseFuses(wdt);

  /* --- ボス戦（ダクトの男）--- */
  updateBoss(dt, rdt);

  /* --- デモステージのウェーブ --- */
  updateDemo(wdt);

  /* --- プレイヤー見た目 --- */
  const inRising = (state === S.RISE_IN || state === S.RISING || state === S.RISE_OUT);
  const headMode = (state === S.HEAD || state === S.POSSESS);
  playerGroup.position.copy(playerPos);
  playerGroup.rotation.y = yaw;
  playerGroup.visible = inRising;   // 頭モードでは体は死体側に移っている

  /* --- 頭の位置 --- */
  // 戻るときは一度縮みすぎてから戻る（ゴム感）
  let visualBlend = risingBlend;
  if (state === S.RISE_OUT) {
    // 終盤で一度平常より縮んでから戻るので、ゴムを放したように見える
    const u = Math.pow(1 - risingBlend, 2.2);
    visualBlend = risingBlend - CONFIG.risingSnapBack * Math.sin(Math.PI * u);
    visualBlend = Math.max(-0.09, visualBlend);
  }
  if (headMode) {
    headPos.set(playerPos.x, playerPos.y + headH, playerPos.z);
    if (state === S.POSSESS) headPos.copy(possessHeadPos);
  } else if (inRising) {
    headPos.set(playerPos.x, playerPos.y + EYE + CONFIG.spineLength * visualBlend, playerPos.z);
  } else {
    headPos.set(playerPos.x, playerPos.y + EYE, playerPos.z);
  }
  headMesh.position.copy(headPos);
  headMesh.visible = (inRising || headMode) && !headDead;

  /* --- 脊柱 --- */
  spineGroup.visible = (inRising || headMode) && !headDead;
  if (spineGroup.visible) {
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    let sag = 0;
    if (state === S.POSSESS) {
      // 首元へ突き刺さる：頭の下から死体の首元へ一直線
      possess.corpse.neck.getWorldPosition(to);
      from.copy(headPos); from.y -= 0.18;
    } else if (headMode) {
      // しっぽ：頭の後ろ下へ垂れる
      const bx = Math.sin(yaw), bz = Math.cos(yaw);
      from.set(headPos.x + bx * 0.14, headPos.y - 0.10, headPos.z + bz * 0.14);
      const tail = CONFIG.spineLength * CONFIG.headTailLength;
      to.set(headPos.x + bx * tail, Math.max(0.10, headPos.y - 0.62), headPos.z + bz * tail);
      sag = 0.14;
    } else {
      // 伸びた首：首の付け根から頭の下まで
      from.set(playerPos.x, playerPos.y + NECK_BASE, playerPos.z);
      to.set(headPos.x, headPos.y - 0.2, headPos.z);
    }
    for (let i = 0; i < spineSegs.length; i++) {
      const k = (i + 0.5) / spineSegs.length;
      spineSegs[i].position.lerpVectors(from, to, k);
      if (sag > 0) {
        spineSegs[i].position.y -= Math.sin(k * Math.PI) * sag;
        spineSegs[i].position.y += Math.sin(worldTime * 5 - k * 3) * 0.03 * k;
      }
      spineSegs[i].rotation.y = yaw;
      const sc = 1 - Math.abs(k - 0.5) * 0.4;
      spineSegs[i].scale.set(sc, 1, sc);
    }
  }

  /* --- 蜘蛛脚 --- */
  updateSpiderLegs(rdt);

  /* --- 切断された部位 --- */
  let partsExpired = false;
  for (const p of severedParts) {
    const o = p.obj;
    if (p.dropAt !== null && worldTime >= p.dropAt && p.phase === 'drift') {
      p.phase = 'dropping'; p.vel.set(0, 0, 0);
    }
    if (p.phase === 'drift') {
      o.position.addScaledVector(p.vel, wdt);
      p.vel.multiplyScalar(Math.max(0, 1 - CONFIG.partDriftDamp * wdt));
      o.rotation.x += p.spin.x * wdt;
      o.rotation.y += p.spin.y * wdt;
      o.rotation.z += p.spin.z * wdt;
    } else if (p.phase === 'eject') {
      // 交換で外れた腕。放物線で飛んで、着いたところから寿命を測りはじめる
      p.vel.y -= CONFIG.headBurstGravity * wdt;
      o.position.addScaledVector(p.vel, wdt);
      o.rotation.x += p.spin.x * wdt;
      o.rotation.y += p.spin.y * wdt;
      o.rotation.z += p.spin.z * wdt;
      if (o.position.y <= 0.12) {
        o.position.y = 0.12;
        o.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2);
        p.phase = 'grounded';
        p.expireAt = worldTime + CONFIG.armDropLife;
      }
    } else if (p.phase === 'dropping') {
      p.vel.y += CONFIG.partDropGravity * wdt;
      o.position.y -= p.vel.y * wdt;
      o.rotation.z += 2.5 * wdt;
      if (o.position.y <= 0.12) {
        o.position.y = 0.12;
        o.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2);
        p.phase = 'grounded';
      }
    }
    // 寿命付きの部位（床の腕）。死体の導火線と同じで、最後だけ点滅してから肉片になる
    // expireAt を持つのは床の腕だけ。頭は undefined なので緩い比較で弾く
    if (p.phase === 'grounded' && p.expireAt != null) {
      const left = p.expireAt - worldTime;
      if (left <= 0) { p.expired = true; partsExpired = true; }
      else if (left <= CONFIG.armDropBlinkLead) {
        const urgency = 1 - left / CONFIG.armDropBlinkLead;
        p.blinkPhase += wdt * (5 + urgency * 20);
        o.material.color.setHex(Math.sin(p.blinkPhase) > 0 ? 0xff9a80 : p.baseColor);
      }
    }
  }
  if (partsExpired) {
    for (const p of severedParts.slice()) {
      if (!p.expired) continue;
      const at = p.obj.position.clone();
      removeSeveredPart(p, true);
      spawnFleshBurst(at, CONFIG.armEjectGibs, CONFIG.armEjectGibSpeed, null, CONFIG.armGibLife);
      // 頭モードの出血（0.09〜0.25）より小さくして、血痕の意味を混ぜない
      spawnBloodDecal(at.x, at.z, 0.07 + Math.random() * 0.04, 0.35);
    }
  }

  /* --- 斬った腕の吸着 --- */
  updateArmGrafts(rdt);

  /* --- 血痕 --- */
  updateBloodDecals(rdt);

  /* --- 頭の破片 --- */
  let debrisGone = false;
  for (const d of debris) {
    if (d.life !== null && d.life !== undefined) {
      d.life -= wdt;
      if (d.life <= 0) { d.gone = true; debrisGone = true; continue; }
      // 最後の1/3だけ薄くなる（血痕デカールと同じ消え方）
      d.obj.material.opacity = Math.min(1, d.life / (CONFIG.armGibLife / 3));
    }
    if (d.rest) continue;
    d.vel.y -= CONFIG.headBurstGravity * wdt;
    d.obj.position.addScaledVector(d.vel, wdt);
    d.obj.rotation.x += d.spin.x * wdt;
    d.obj.rotation.y += d.spin.y * wdt;
    d.obj.rotation.z += d.spin.z * wdt;
    if (d.obj.position.y <= 0.05) {
      d.obj.position.y = 0.05;
      d.rest = true;
    }
  }
  if (debrisGone) {
    for (const d of debris) {
      if (!d.gone) continue;
      scene.remove(d.obj);
      d.obj.geometry.dispose(); d.obj.material.dispose();
    }
    debris = debris.filter((d) => !d.gone);
  }

  /* --- カメラ --- */
  if (inRising && state !== S.RISE_OUT) riseCamT += rdt;   // 戻り中は演出を止める
  let targetFov = inRising
    // 入りは首越しへ寄るのに合わせて、戻りは脊柱の縮みに合わせて画角を変える
    ? CONFIG.fovNormal + (CONFIG.fovNeck - CONFIG.fovNormal) *
      (state === S.RISE_OUT ? smooth01(risingBlend) : easeOut01(riseCamT / CONFIG.neckCamSlideTime))
    : (headMode ? CONFIG.fovNormal + 8 : CONFIG.fovNormal);
  // 触手が刺さった瞬間だけ画角を詰める。ヒットストップと合わせて「刺さった」を出す
  if (tentFovKick > 0) {
    tentFovKick = Math.max(0, tentFovKick - rdt / CONFIG.tentFovTime);
    targetFov -= CONFIG.tentFovPunch * tentFovKick * tentFovKick;
  }
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    // 寄っている間は追従を速くする（ゆっくり寄ると「演出」に見えず鈍る）
    camera.fov += (targetFov - camera.fov) * Math.min(1, rdt * (tentFovKick > 0 ? 24 : 10));
    camera.updateProjectionMatrix();
  }

  if (state === S.POSSESS && possess) {
    // 乗っ取りは首元を見ている三人称
    const look = new THREE.Vector3();
    possess.corpse.neck.getWorldPosition(look);
    const ang = yaw + 0.85;
    camera.position.set(
      look.x + Math.sin(ang) * 2.5, look.y + 1.15, look.z + Math.cos(ang) * 2.5);
    camera.lookAt(look.clone().lerp(headPos, 0.4));
  } else if (headMode) {
    // 頭モードは三人称
    const fwd = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    // 切り離した直後の自分の体にカメラがめり込まないよう、後ろの死体分だけ寄せる
    let camDist = CONFIG.headCamDistance;
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const to = new THREE.Vector3();
    for (const c of corpses) {
      to.copy(c.group.position).sub(headPos); to.y = 0;
      const d = to.length();
      if (d > camDist + 0.9) continue;
      if (d > 0.001 && to.divideScalar(d).dot(back) > 0.55) {
        camDist = Math.min(camDist, Math.max(0.9, d - 0.9));
      }
    }
    const cam = headPos.clone().addScaledVector(fwd, -camDist);
    cam.y += CONFIG.headCamHeight;
    cam.y = Math.max(cam.y, 0.35);
    camera.position.copy(cam);
    camera.lookAt(headPos.clone().addScaledVector(fwd, 4.0));
  } else if (!inRising) {
    camera.position.set(playerPos.x, playerPos.y + EYE, playerPos.z);
    camera.rotation.set(pitch, yaw, 0);
  } else {
    updateNeckCamera(riseCamT);
  }

  // カメラが決まってから、視界を塞ぐ脚を消す
  fadeSpiderLegs();

  if (shake > 0) {
    shake = Math.max(0, shake - rdt * 2.5);
    camera.position.x += (Math.random() - 0.5) * shake * 0.3;
    camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    camera.position.z += (Math.random() - 0.5) * shake * 0.3;
  }

  /* --- 一人称の手足 --- */
  const showHands = (state === S.HUMAN);
  for (const side of ['LEFT', 'RIGHT']) {
    const hand = fpHands[side];
    hand.visible = showHands && !hand.userData.lost;
    if (!hand.visible) continue;
    const sign = side === 'LEFT' ? -1 : 1;
    let punchOut = 0;
    // 銃の反動：手前へ引いて少し上を向く
    const recoil = player.gunRecoil[side];
    if (player.attack && player.attack.type === 'punch' && player.attack.side === side) {
      const a = player.attack;
      // 振り抜き（= キャンセル可能になる瞬間）でちょうど拳が伸びきる。
      // 「攻撃終わりからキャンセルできる」ことを見た目だけで読めるようにしている
      punchOut = swingCurve(a.t, a.startup + CONFIG.punchActive,
                            a.startup + CONFIG.punchRecover) * 0.75;
    }
    const local = new THREE.Vector3(sign * 0.28, -0.28, -0.35 - punchOut + recoil * CONFIG.gunRecoil);
    hand.position.copy(local.applyQuaternion(camera.quaternion)).add(camera.position);
    hand.quaternion.copy(camera.quaternion);
    hand.rotateX(-0.12 + punchOut * 0.2 + recoil * 0.35);
    hand.userData.fist.scale.setScalar(1);
    applyGuardPose(hand, side);

    // --- フィニッシャー ---
    // 拳は敵の頭へ伸びて掴み、握り潰して戻る。
    // 触手は手を突き出して引き戻すだけで、伸びて刺して引き抜くのは
    // ワールド側の1本（tentBeam）が受け持つ
    const fin = (player.attack && player.attack.type === 'finisher' &&
                 player.attack.side === side) ? player.attack : null;
    if (fin && fin.tent) poseTentFinisherHand(hand, fin);
    else if (fin) {
      const a = fin;
      const reach = CONFIG.finisherReach, hold = CONFIG.finisherHold, rec = CONFIG.finisherRecover;
      const headW = a.lastHead;
      const dir = headW.clone().sub(camera.position);
      if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1); else dir.normalize();
      // 拳（ローカル z=-0.55）が頭に重なる位置・向き
      const grabQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      const grabPos = headW.clone().addScaledVector(dir, -0.55);
      let k;
      if (a.t < reach) { const u = a.t / reach; k = 1 - (1 - u) * (1 - u); }
      else if (a.t < reach + hold) k = 1;
      else { const u = Math.min(1, (a.t - reach - hold) / rec); k = 1 - u * u; }
      hand.position.lerp(grabPos, k);
      hand.quaternion.slerp(grabQ, k);
      if (a.t >= reach && a.t < reach + hold) {
        // 握り込み。潰す直前ほど速く震える
        const u = (a.t - reach) / hold;
        hand.userData.fist.scale.setScalar(1.15 + Math.sin(clock.elapsedTime * (26 + 30 * u)) * 0.09 * (0.4 + u));
      } else if (a.t >= reach + hold) {
        // 潰した反動で一瞬手前に引く
        const u = Math.min(1, (a.t - reach - hold) / rec);
        hand.position.addScaledVector(dir, -0.28 * Math.sin(u * Math.PI));
      }
    }
  }
  /* --- 触手腕の見た目（アイドルのうねり／薙ぎ払い／伸ばした触手）--- */
  updateTentacleArms(rdt);
  /* --- 体スキル（阿修羅の追加の腕／回復の粒）--- */
  updateAsuraArms(dt, rdt);
  updateHealFx(rdt);
  if (hudSkillFire > 0) hudSkillFire -= rdt;

  if (player.attack && player.attack.type === 'kick' && state === S.HUMAN) {
    const a = player.attack;
    const out = swingCurve(a.t, a.startup + CONFIG.kickActive,
                           a.startup + CONFIG.kickRecover) * 1.1;
    fpFoot.visible = true;
    const local = new THREE.Vector3(0.12, -0.6, -0.4 - out);
    fpFoot.position.copy(local.applyQuaternion(camera.quaternion)).add(camera.position);
    fpFoot.quaternion.copy(camera.quaternion);
  } else fpFoot.visible = false;

  /* --- UI --- */
  updateTargets();
  updateEnemyUi();
  updateCorpseUi();
  updateRack(rdt);

  const risingActive = inRising && risingBlend > 0.25;
  ui.slowOverlay.classList.toggle('hidden', !(risingActive || slowTimer > 0));
  // SLOW / RISING / HEAD / DEAD などのモード名は出さない（スローは画面の縁の色で伝える）


  if (flashTimer > 0) {
    flashTimer -= rdt;
    ui.flash.style.opacity = String(Math.max(0, flashTimer / 0.18) * flashPower);
  } else ui.flash.style.opacity = '0';


  updatePlayerHud();
  updateSubtitle(rdt);
  updateObjectiveHud();

  // デバッグHUD：キャンセル受付中かどうかも出す（タイミングの確認用）
  ui.state.textContent = state + (player.guard ? '  [GUARD]' : '') +
    (state === S.HUMAN && player.attack
      ? (inCancelWindow() ? '  [CANCEL OK]' : '  [' + player.attack.type.toUpperCase() + ']')
      : '') +
    (punchBuffer ? '  [BUF ' + punchBuffer.side[0] + ']' : '') +
    (tentHold ? '  [TENT ' + tentHold.phase.toUpperCase() +
                (tentHold.phase === 'stuck'
                  ? ' ' + tentHold.enemy.tetherVel.length().toFixed(1) + 'm/s' : '') + ']' : '');
  ui.target.textContent = selectedTarget
    ? (selectedTarget.kind === 'corpse' ? 'CORPSE'
       : selectedTarget.kind === 'corpseArm' ? 'CORPSE ' + selectedTarget.key
       : selectedTarget.kind === 'groundArm' ? 'GROUND ARM ' + selectedTarget.part.key
       : selectedTarget.kind === 'rackArm' ? 'RACK ' + selectedTarget.slot.kind.toUpperCase()
       : selectedTarget.entry.key) : 'NONE';
  const room = currentRoom();
  ui.room.textContent = DEMO.active
    ? 'DEMO ' + (DEMO.phase === 'CLEAR' ? 'CLEAR' : 'W' + (Math.max(0, DEMO.wave) + 1))
    : (room ? room.name : 'HUB');
  const airborne = severedParts.filter((p) => p.phase === 'drift' || p.phase === 'eject').length;
  const grounded = severedParts.filter((p) => p.phase === 'grounded').length;
  ui.arms.textContent = airborne + ' air / ' + grounded + ' ground / ' +
                        graftArms.length + ' graft / ' + corpses.length + ' corpse';
  const near = findTargetEnemy(8, 90) || enemies[0];
  ui.enemy.textContent = near
    ? near.state + '  HP ' + Math.round(near.hp) + '  STUN ' + Math.round(near.stun) : '-';

  renderer.render(scene, camera);
}

animate();
