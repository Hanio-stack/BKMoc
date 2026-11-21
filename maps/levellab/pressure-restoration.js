// LevelLab の書き出し（供給圧力復旧区画）。中身は書き出した JSON のまま。tools/levellab-publish.js で作る
BK_publishLevelLab("levellab/pressure-restoration.js", {
  "version": 7,
  "title": "供給圧力復旧区画",
  "width": 190,
  "height": 115,
  "snap": true,
  "exportGrid": false,
  "exportLabels": true,
  "ghost": false,
  "floors": [
    {
      "id": "floor1",
      "name": "1F / 供給圧力復旧区画",
      "z": 0,
      "items": [
        {
          "id": "entry",
          "type": "rect",
          "x": 79.5,
          "y": 102,
          "w": 6,
          "h": 11,
          "color": "#89a7bc",
          "label": "搬入口",
          "mock": {
            "type": "space",
            "raw": {
              "id": "entry",
              "r": [
                -3,
                3,
                1,
                12
              ],
              "name": "搬入口",
              "tone": "cold",
              "type": "room",
              "h": 4.5
            }
          },
          "manualOpenings": []
        },
        {
          "id": "hub",
          "type": "rect",
          "x": 78,
          "y": 65,
          "w": 24,
          "h": 23,
          "color": "#89a7bc",
          "label": "中央ホール",
          "mock": {
            "type": "space",
            "raw": {
              "id": "hub",
              "r": [
                -12,
                12,
                -25,
                -2
              ],
              "name": "中央ホール",
              "tone": "cold",
              "type": "room",
              "h": 6
            },
            "encounter": {
              "id": "aFight",
              "type": "arena",
              "zone": [
                -12,
                12,
                -25,
                -2
              ],
              "trigger": [
                -11.5,
                11.5,
                -24.5,
                -2.5
              ],
              "doors": [
                "entrySeal"
              ],
              "startLine": "供給試験を開始。対象を排除してください。",
              "clearLine": "供給試験終了。中央ホールのA弁を開放してください。",
              "waves": [
                [
                  [
                    4,
                    -18,
                    "fist",
                    "fist",
                    0.3
                  ],
                  [
                    -5,
                    -7,
                    "fist",
                    "fist",
                    0.8
                  ]
                ]
              ]
            }
          },
          "manualOpenings": []
        },
        {
          "id": "bArena",
          "type": "rect",
          "x": 20,
          "y": 63,
          "w": 21,
          "h": 24,
          "color": "#89a7bc",
          "label": "ポンプ試験室　アリーナ",
          "mock": {
            "type": "space",
            "raw": {
              "id": "bArena",
              "r": [
                -70,
                -49,
                -27,
                -3
              ],
              "name": "B系統 ポンプ試験室",
              "tone": "warm",
              "type": "room",
              "h": 6
            },
            "encounter": {
              "id": "bFight",
              "type": "arena",
              "zone": [
                -70,
                -49,
                -27,
                -3
              ],
              "trigger": [
                -68,
                -52,
                -25,
                -5
              ],
              "doors": [
                "bIn",
                "bOut"
              ],
              "startLine": "",
              "clearLine": "",
              "waves": [
                [
                  [
                    -66,
                    -24,
                    "fist",
                    "fist",
                    0.3
                  ],
                  [
                    -55,
                    -6,
                    "fist",
                    "gun",
                    0.8
                  ]
                ],
                [
                  [
                    -66,
                    -6,
                    "fist",
                    "fist",
                    0.3,
                    {
                      "strong": true
                    }
                  ],
                  [
                    -53,
                    -23,
                    "gun",
                    "fist",
                    0.7
                  ]
                ]
              ]
            }
          },
          "manualOpenings": []
        },
        {
          "id": "bValve",
          "type": "rect",
          "x": 20,
          "y": 45,
          "w": 21,
          "h": 12,
          "color": "#89a7bc",
          "label": "B調圧室",
          "mock": {
            "type": "space",
            "raw": {
              "id": "bValve",
              "r": [
                -70,
                -49,
                -45,
                -33
              ],
              "name": "B調圧室",
              "tone": "amber",
              "type": "room",
              "h": 4.5
            }
          },
          "manualOpenings": []
        },
        {
          "id": "cHub",
          "type": "rect",
          "x": 125.5,
          "y": 74.5,
          "w": 19.5,
          "h": 9.5,
          "color": "#89a7bc",
          "label": "検体照合区画",
          "mock": {
            "type": "space",
            "raw": {
              "id": "cHub",
              "r": [
                27,
                43,
                -25,
                -2
              ],
              "name": "検体照合区画",
              "tone": "green",
              "type": "room",
              "h": 4.5
            }
          },
          "manualOpenings": []
        },
        {
          "id": "wrong",
          "type": "rect",
          "x": 158,
          "y": 80.5,
          "w": 13,
          "h": 14,
          "color": "#89a7bc",
          "label": "第一保管庫 / 記録・予備検体",
          "mock": {
            "type": "space",
            "raw": {
              "id": "wrong",
              "r": [
                68,
                81,
                -4,
                10
              ],
              "name": "第一保管庫 / 記録・予備検体",
              "tone": "amber",
              "type": "room",
              "h": 4.5
            },
            "encounter": {
              "id": "wrongFight",
              "zone": [
                68,
                81,
                -4,
                10
              ],
              "spawns": [
                [
                  77,
                  -1,
                  "fist",
                  "fist",
                  0.5
                ]
              ]
            }
          },
          "manualOpenings": []
        },
        {
          "id": "cValve",
          "type": "rect",
          "x": 127,
          "y": 54.5,
          "w": 16,
          "h": 13,
          "color": "#89a7bc",
          "label": "C調圧室",
          "mock": {
            "type": "space",
            "raw": {
              "id": "cValve",
              "r": [
                27,
                43,
                -45,
                -32
              ],
              "name": "C調圧室",
              "tone": "cold",
              "type": "room",
              "h": 4.5
            },
            "encounter": {
              "id": "fight_cValve",
              "type": "arena",
              "doors": [
                "Dyqvy"
              ],
              "startLine": "試験を開始します。",
              "clearLine": "試験終了。"
            },
            "requires": [
              "valve:C"
            ]
          },
          "manualOpenings": []
        },
        {
          "id": "final",
          "type": "rect",
          "x": 83,
          "y": 30,
          "w": 29,
          "h": 27,
          "color": "#89a7bc",
          "label": "最終試験場",
          "mock": {
            "type": "space",
            "raw": {
              "id": "final",
              "r": [
                -7,
                22,
                -60,
                -33
              ],
              "name": "最終試験場",
              "tone": "warm",
              "type": "room",
              "h": 7
            },
            "encounter": {
              "id": "finalFight",
              "type": "arena",
              "zone": [
                -7,
                22,
                -60,
                -33
              ],
              "trigger": [
                -5,
                20,
                -58,
                -36
              ],
              "cond": "done:valves",
              "doors": [
                "finalIn",
                "finalOut"
              ],
              "startLine": "全系統復旧を確認。最終運動試験を開始します。",
              "waves": [
                [
                  [
                    18,
                    -56,
                    "fist",
                    "gun",
                    0.4
                  ],
                  [
                    -4,
                    -56,
                    "fist",
                    "fist",
                    0.7
                  ]
                ],
                [
                  [
                    16,
                    -37,
                    "fist",
                    "fist",
                    0.3,
                    {
                      "strong": true
                    }
                  ],
                  [
                    -3,
                    -55,
                    "gun",
                    "fist",
                    0.7
                  ],
                  [
                    18,
                    -55,
                    "fist",
                    "fist",
                    1.2
                  ]
                ]
              ]
            },
            "requires": [
              "done:valves"
            ],
            "any": false
          },
          "manualOpenings": []
        },
        {
          "id": "exitHall",
          "type": "rect",
          "x": 96,
          "y": 24,
          "w": 4,
          "h": 7,
          "color": "#5a8194",
          "label": "搬出通路",
          "mock": {
            "type": "space",
            "raw": {
              "id": "exitHall",
              "r": [
                6,
                10,
                -66,
                -59
              ],
              "name": "搬出通路",
              "tone": "cold",
              "type": "corridor",
              "h": 4.5
            }
          },
          "manualOpenings": []
        },
        {
          "id": "exit",
          "type": "rect",
          "x": 93,
          "y": 15,
          "w": 10,
          "h": 10,
          "color": "#89a7bc",
          "label": "搬出室",
          "mock": {
            "type": "space",
            "raw": {
              "id": "exit",
              "r": [
                3,
                13,
                -75,
                -65
              ],
              "name": "搬出室",
              "tone": "cold",
              "type": "room",
              "h": 4.5
            }
          },
          "manualOpenings": []
        },
        {
          "id": "bqj0sttr",
          "type": "icon",
          "kind": "mock_door",
          "x": 90,
          "y": 88,
          "label": "entrySeal",
          "mock": {
            "type": "door",
            "raw": {
              "id": "entrySeal",
              "axis": "x",
              "at": -2,
              "from": -2,
              "to": 2,
              "h": 2.8,
              "style": "blast",
              "lamp": true,
              "open": true
            },
            "width": 4
          }
        },
        {
          "id": "gvyg31n4",
          "type": "icon",
          "kind": "mock_door",
          "x": 78,
          "y": 80,
          "label": "westGate",
          "mock": {
            "type": "door",
            "raw": {
              "id": "westGate",
              "axis": "z",
              "at": -12,
              "from": -12,
              "to": -8,
              "h": 2.8,
              "style": "blast",
              "lamp": true
            },
            "width": 4
          }
        },
        {
          "id": "1i8437ma",
          "type": "icon",
          "kind": "mock_door",
          "x": 102,
          "y": 80,
          "label": "eastGate",
          "mock": {
            "type": "door",
            "raw": {
              "id": "eastGate",
              "axis": "z",
              "at": 12,
              "from": -12,
              "to": -8,
              "h": 2.8,
              "style": "blast",
              "lamp": true
            },
            "width": 4
          }
        },
        {
          "id": "pv4vmd9y",
          "type": "icon",
          "kind": "mock_door",
          "x": 40,
          "y": 69,
          "label": "bIn",
          "mock": {
            "type": "door",
            "raw": {
              "id": "bIn",
              "axis": "z",
              "at": -50,
              "from": -23,
              "to": -19,
              "h": 2.8,
              "style": "blast",
              "lamp": true,
              "open": true
            },
            "width": 4
          }
        },
        {
          "id": "hbhhisbl",
          "type": "icon",
          "kind": "mock_door",
          "x": 29,
          "y": 63,
          "label": "bOut",
          "mock": {
            "type": "door",
            "raw": {
              "id": "bOut",
              "axis": "x",
              "at": -27,
              "from": -63,
              "to": -59,
              "h": 2.8,
              "style": "blast",
              "lamp": true
            },
            "width": 4
          }
        },
        {
          "id": "dhrpz8lx",
          "type": "icon",
          "kind": "mock_door",
          "x": 78,
          "y": 68,
          "label": "bShortcut",
          "mock": {
            "type": "door",
            "raw": {
              "id": "bShortcut",
              "axis": "z",
              "at": -25,
              "from": -12,
              "to": -8,
              "h": 2.8,
              "style": "blast",
              "lamp": true
            },
            "width": 4
          }
        },
        {
          "id": "46zvylgx",
          "type": "icon",
          "kind": "mock_door",
          "x": 135,
          "y": 74,
          "label": "cGate",
          "mock": {
            "type": "door",
            "raw": {
              "id": "cGate",
              "axis": "x",
              "at": -25,
              "from": 32,
              "to": 36,
              "h": 2.8,
              "style": "blast",
              "lamp": true
            },
            "width": 4
          }
        },
        {
          "id": "0nm6kpxp",
          "type": "icon",
          "kind": "mock_door",
          "x": 90,
          "y": 65,
          "label": "mainGate",
          "mock": {
            "type": "door",
            "raw": {
              "id": "mainGate",
              "axis": "x",
              "at": -25,
              "from": -2,
              "to": 2,
              "h": 2.8,
              "style": "blast",
              "lamp": true
            },
            "width": 4,
            "requires": [
              "valve:A",
              "valve:B",
              "valve:C"
            ]
          }
        },
        {
          "id": "ulh7euc9",
          "type": "icon",
          "kind": "mock_door",
          "x": 90,
          "y": 57,
          "label": "finalIn",
          "mock": {
            "type": "door",
            "raw": {
              "id": "finalIn",
              "axis": "x",
              "at": -33,
              "from": -2,
              "to": 2,
              "h": 2.8,
              "style": "blast",
              "lamp": true,
              "open": true
            },
            "width": 4
          }
        },
        {
          "id": "lc8673w6",
          "type": "icon",
          "kind": "mock_door",
          "x": 98,
          "y": 30,
          "label": "finalOut",
          "mock": {
            "type": "door",
            "raw": {
              "id": "finalOut",
              "axis": "x",
              "at": -60,
              "from": 6,
              "to": 10,
              "h": 2.8,
              "style": "blast",
              "lamp": true
            },
            "width": 4
          }
        },
        {
          "id": "rne8b0hl",
          "type": "icon",
          "kind": "mock_door",
          "x": 98,
          "y": 15,
          "label": "goal",
          "mock": {
            "type": "door",
            "raw": {
              "id": "goal",
              "axis": "x",
              "at": -75,
              "from": 6,
              "to": 10,
              "h": 2.8,
              "style": "blast",
              "lamp": true,
              "decor": true
            },
            "width": 4
          }
        },
        {
          "id": "p99oh9q1",
          "type": "icon",
          "kind": "mock_valve",
          "x": 78.4,
          "y": 76,
          "label": "バルブA",
          "mock": {
            "type": "valve",
            "raw": {
              "id": "A",
              "x": -11.6,
              "z": -14,
              "face": "e",
              "y": 1.35,
              "color": 13648175,
              "lamp": [
                -1,
                3.5,
                -24.8
              ],
              "flag": "valveA",
              "line": "A系統、供給開始。B・C区画を開放します。",
              "pipe": [
                [
                  -1,
                  3.5,
                  -24.8
                ],
                [
                  -11.6,
                  3.5,
                  -24.8
                ],
                [
                  -11.6,
                  3.5,
                  -14
                ],
                [
                  -11.6,
                  1.8,
                  -14
                ]
              ],
              "cond": "cleared:aFight",
              "opens": [
                "westGate",
                "eastGate"
              ]
            },
            "requires": [
              "cleared:aFight"
            ],
            "any": false
          }
        },
        {
          "id": "xqvv5gj5",
          "type": "icon",
          "kind": "mock_valve",
          "x": 20.400000000000006,
          "y": 51,
          "label": "バルブB",
          "mock": {
            "type": "valve",
            "raw": {
              "id": "B",
              "x": -69.6,
              "z": -39,
              "face": "e",
              "y": 1.35,
              "color": 14725152,
              "lamp": [
                0,
                3.5,
                -24.8
              ],
              "flag": "valveB",
              "line": "B系統、供給を開始しました。",
              "pipe": [
                [
                  0,
                  3.5,
                  -24.8
                ],
                [
                  0,
                  4,
                  -24.8
                ],
                [
                  -10,
                  4,
                  -24.8
                ],
                [
                  -10,
                  3.6,
                  -41
                ],
                [
                  -69.6,
                  3.6,
                  -41
                ],
                [
                  -69.6,
                  3.6,
                  -39
                ],
                [
                  -69.6,
                  1.8,
                  -39
                ]
              ],
              "cond": "cleared:bFight",
              "approach": {
                "x": -54,
                "z": -15
              },
              "opens": [
                "bShortcut"
              ]
            },
            "requires": [
              "cleared:bFight"
            ],
            "any": false
          }
        },
        {
          "id": "l0ei7nog",
          "type": "icon",
          "kind": "mock_valve",
          "x": 142.6,
          "y": 60.5,
          "label": "バルブC",
          "mock": {
            "type": "valve",
            "raw": {
              "id": "C",
              "x": 42.6,
              "z": -39,
              "face": "w",
              "y": 1.35,
              "color": 3897568,
              "lamp": [
                1,
                3.5,
                -24.8
              ],
              "flag": "valveC",
              "line": "C系統、供給を開始しました。",
              "pipe": [
                [
                  1,
                  3.5,
                  -24.8
                ],
                [
                  1,
                  4.2,
                  -24.8
                ],
                [
                  11.6,
                  4.2,
                  -24.8
                ],
                [
                  11.6,
                  3.6,
                  -10
                ],
                [
                  34,
                  3.6,
                  -10
                ],
                [
                  34,
                  3.6,
                  -39
                ],
                [
                  42.6,
                  3.6,
                  -39
                ],
                [
                  42.6,
                  1.8,
                  -39
                ]
              ],
              "cond": "done:armA",
              "approach": {
                "x": 38,
                "z": -24
              }
            },
            "requires": [
              "done:armA"
            ],
            "any": false
          }
        },
        {
          "id": "pviekgp9",
          "type": "icon",
          "kind": "mock_corpse",
          "x": 80,
          "y": 74.5,
          "label": "通常腕の死体",
          "mock": {
            "type": "corpse",
            "raw": {
              "x": -8,
              "z": -14,
              "arms": [
                "fist",
                "fist"
              ]
            }
          }
        },
        {
          "id": "cd9bqrpb",
          "type": "icon",
          "kind": "mock_corpse",
          "x": 22,
          "y": 49,
          "label": "通常腕の死体",
          "mock": {
            "type": "corpse",
            "raw": {
              "x": -66,
              "z": -39,
              "arms": [
                "fist",
                "fist"
              ]
            }
          }
        },
        {
          "id": "82v3qccq",
          "type": "icon",
          "kind": "mock_corpse",
          "x": 139.5,
          "y": 63.5,
          "label": "通常腕の死体",
          "mock": {
            "type": "corpse",
            "raw": {
              "x": 39,
              "z": -39,
              "arms": [
                "fist",
                "fist"
              ]
            }
          }
        },
        {
          "id": "fl77q0t9",
          "type": "icon",
          "kind": "mock_corpse",
          "x": 165,
          "y": 87.5,
          "label": "通常腕の死体",
          "mock": {
            "type": "corpse",
            "raw": {
              "x": 75,
              "z": 3,
              "arms": [
                "gun",
                "fist"
              ]
            }
          }
        },
        {
          "id": "h7le442m",
          "type": "icon",
          "kind": "mock_corpse",
          "x": 86,
          "y": 38,
          "label": "通常腕の死体",
          "mock": {
            "type": "corpse",
            "raw": {
              "x": -4,
              "z": -52,
              "arms": [
                "fist",
                "fist"
              ]
            }
          }
        },
        {
          "id": "fmlg242w",
          "type": "icon",
          "kind": "mock_arm",
          "x": 165,
          "y": 89.5,
          "label": "gun",
          "mock": {
            "type": "arm",
            "raw": {
              "x": 75,
              "z": 5,
              "kind": "gun"
            }
          }
        },
        {
          "id": "87jvgbxd",
          "type": "icon",
          "kind": "mock_arm",
          "x": 25,
          "y": 80,
          "label": "gun",
          "mock": {
            "type": "arm",
            "raw": {
              "x": -65,
              "z": -10,
              "kind": "gun"
            }
          }
        },
        {
          "id": "v0d4j274",
          "type": "icon",
          "kind": "mock_arm",
          "x": 117,
          "y": 75.5,
          "label": "B02",
          "mock": {
            "type": "arm",
            "raw": {
              "x": 82,
              "z": -33,
              "kind": "fist",
              "tag": "B02",
              "side": "RIGHT"
            }
          }
        },
        {
          "id": "77w423tb",
          "type": "icon",
          "kind": "mock_arm",
          "x": 108.5,
          "y": 72,
          "label": "適合腕A",
          "mock": {
            "type": "arm",
            "raw": {
              "kind": "fist",
              "tag": "A01",
              "side": "RIGHT",
              "y": 1.05
            },
            "replenish": true
          }
        },
        {
          "id": "mj3igsyg",
          "type": "icon",
          "kind": "mock_prop",
          "x": 94,
          "y": 65.2,
          "label": "sign",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "sign",
              "x": 0,
              "z": -24.8,
              "face": "s",
              "lines": [
                "最終扉 / 供給圧力",
                "A・B・Cの3系統を復旧"
              ],
              "w": 4,
              "h": 0.9,
              "y": 2.6,
              "style": "notice"
            }
          }
        },
        {
          "id": "gunzcycy",
          "type": "icon",
          "kind": "mock_prop",
          "x": 78.2,
          "y": 84,
          "label": "sign",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "sign",
              "x": -11.8,
              "z": -6,
              "face": "e",
              "lines": [
                "B系統 ← ポンプ試験室"
              ],
              "w": 3,
              "h": 0.9,
              "y": 2.6,
              "style": "notice"
            }
          }
        },
        {
          "id": "sru7jbx3",
          "type": "icon",
          "kind": "mock_prop",
          "x": 101.8,
          "y": 84,
          "label": "sign",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "sign",
              "x": 11.8,
              "z": -6,
              "face": "w",
              "lines": [
                "C系統 → 検体照合区画"
              ],
              "w": 3,
              "h": 0.9,
              "y": 2.6,
              "style": "notice"
            }
          }
        },
        {
          "id": "79r4ol55",
          "type": "icon",
          "kind": "mock_prop",
          "x": 170.8,
          "y": 87.5,
          "label": "sign",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "sign",
              "x": 80.8,
              "z": 3,
              "face": "w",
              "lines": [
                "移送記録",
                "適合腕Aは第二保管庫へ",
                "本室の検体は不適合"
              ],
              "w": 3,
              "h": 0.9,
              "y": 2.6,
              "style": "notice"
            }
          }
        },
        {
          "id": "x8kh7gi8",
          "type": "icon",
          "kind": "mock_prop",
          "x": 40.8,
          "y": 49,
          "label": "sign",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "sign",
              "x": -49.2,
              "z": -41,
              "face": "w",
              "lines": [
                "中央ホールへ →"
              ],
              "w": 3,
              "h": 0.9,
              "y": 2.6,
              "style": "notice"
            },
            "signText": "中央ホールへ →"
          }
        },
        {
          "id": "52x7bcnz",
          "type": "icon",
          "kind": "mock_prop",
          "x": 98,
          "y": 15.200000000000003,
          "label": "sign",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "sign",
              "x": 8,
              "z": -74.8,
              "face": "s",
              "lines": [
                "搬出口 / Fで帰還"
              ],
              "w": 3,
              "h": 0.9,
              "y": 2.6,
              "style": "notice"
            }
          }
        },
        {
          "id": "a7gvfug4",
          "type": "icon",
          "kind": "mock_prop",
          "x": 139,
          "y": 75,
          "label": "適合腕認証装置",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "inspector",
              "x": 38,
              "z": -22,
              "face": "s",
              "label": "適合腕認証装置"
            }
          }
        },
        {
          "id": "ah959tl1",
          "type": "icon",
          "kind": "mock_prop",
          "x": 113.5,
          "y": 76.5,
          "label": "pedestal",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "pedestal",
              "x": 85,
              "z": -40,
              "face": "n"
            }
          }
        },
        {
          "id": "edlt9zot",
          "type": "icon",
          "kind": "mock_prop",
          "x": 168,
          "y": 92.5,
          "label": "desk",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "desk",
              "x": 78,
              "z": 8,
              "face": "n",
              "w": 2.5,
              "d": 0.8,
              "crt": "検体移送記録",
              "papers": true
            }
          }
        },
        {
          "id": "veymckqf",
          "type": "icon",
          "kind": "mock_prop",
          "x": 161,
          "y": 91.5,
          "label": "armpile",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "armpile",
              "x": 71,
              "z": 7,
              "n": 18,
              "r": 1
            }
          }
        },
        {
          "id": "iq2c5and",
          "type": "icon",
          "kind": "mock_prop",
          "x": 29,
          "y": 75,
          "label": "復旧設備",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "machine",
              "x": -61,
              "z": -15,
              "w": 2.6,
              "d": 2,
              "h": 1.5,
              "style": "pump",
              "label": "復旧設備"
            }
          }
        },
        {
          "id": "do9sewyt",
          "type": "icon",
          "kind": "mock_prop",
          "x": 33,
          "y": 70,
          "label": "復旧設備",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "machine",
              "x": -57,
              "z": -20,
              "w": 2.6,
              "d": 2,
              "h": 1.5,
              "style": "pump",
              "label": "復旧設備"
            }
          }
        },
        {
          "id": "i4dx39oz",
          "type": "icon",
          "kind": "mock_prop",
          "x": 95,
          "y": 45,
          "label": "復旧設備",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "machine",
              "x": 5,
              "z": -45,
              "w": 2.6,
              "d": 2,
              "h": 1.5,
              "style": "pump",
              "label": "復旧設備"
            }
          }
        },
        {
          "id": "0zuve77b",
          "type": "icon",
          "kind": "mock_prop",
          "x": 105,
          "y": 41,
          "label": "復旧設備",
          "mock": {
            "type": "prop",
            "raw": {
              "type": "machine",
              "x": 15,
              "z": -49,
              "w": 2.6,
              "d": 2,
              "h": 1.5,
              "style": "pump",
              "label": "復旧設備"
            }
          }
        },
        {
          "id": "oby8fotz",
          "type": "gas",
          "x": 80.5,
          "y": 106.5,
          "w": 4,
          "h": 4,
          "label": "凝固ガス"
        },
        {
          "id": "dll3tzvs",
          "type": "gas",
          "x": 24,
          "y": 78,
          "w": 4,
          "h": 4,
          "label": "凝固ガス"
        },
        {
          "id": "bzn49anz",
          "type": "icon",
          "kind": "mock_supply",
          "x": 20,
          "y": 70,
          "label": "通常腕支給口",
          "mock": {
            "type": "supply",
            "raw": {
              "x": -70,
              "z": -20,
              "face": "e",
              "name": "ポンプ試験室"
            }
          }
        },
        {
          "id": "ry2xmapp",
          "type": "icon",
          "kind": "mock_supply",
          "x": 127,
          "y": 59.5,
          "label": "通常腕支給口",
          "mock": {
            "type": "supply",
            "raw": {
              "x": 27,
              "z": -40,
              "face": "e",
              "name": "C調圧室"
            }
          }
        },
        {
          "id": "d34m2hc8",
          "type": "icon",
          "kind": "mock_supply",
          "x": 83,
          "y": 38,
          "label": "通常腕支給口",
          "mock": {
            "type": "supply",
            "raw": {
              "x": -7,
              "z": -52,
              "face": "e",
              "name": "最終試験場"
            }
          }
        },
        {
          "id": "sxxy3s98",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 94,
          "y": 72,
          "label": "aFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "hub",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.3,
              "strong": false
            }
          }
        },
        {
          "id": "uegxh3xh",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 85,
          "y": 83,
          "label": "aFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "hub",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.8,
              "strong": false
            }
          }
        },
        {
          "id": "mg8qjez5",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 24,
          "y": 66,
          "label": "bFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "bArena",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.3,
              "strong": false
            }
          }
        },
        {
          "id": "qa5if08y",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 35,
          "y": 84,
          "label": "bFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "bArena",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "gun"
              ],
              "delay": 0.8,
              "strong": false
            }
          }
        },
        {
          "id": "kn07te1r",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 24,
          "y": 84,
          "label": "bFight / wave 2",
          "mock": {
            "type": "enemy",
            "roomId": "bArena",
            "wave": 2,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.3,
              "strong": true
            }
          }
        },
        {
          "id": "06o1dmwr",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 37,
          "y": 67,
          "label": "bFight / wave 2",
          "mock": {
            "type": "enemy",
            "roomId": "bArena",
            "wave": 2,
            "raw": {
              "arms": [
                "gun",
                "fist"
              ],
              "delay": 0.7,
              "strong": false
            }
          }
        },
        {
          "id": "7nwru256",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 167,
          "y": 83.5,
          "label": "wrongFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "wrong",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.5,
              "strong": false
            }
          }
        },
        {
          "id": "14edov3h",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 117.5,
          "y": 72.5,
          "label": "",
          "mock": {
            "type": "enemy",
            "roomId": "right",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.3,
              "strong": false
            }
          }
        },
        {
          "id": "2a9ra7xb",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 110.5,
          "y": 75,
          "label": "",
          "mock": {
            "type": "enemy",
            "roomId": "right",
            "wave": 0,
            "raw": {
              "arms": [
                "fist",
                "gun"
              ],
              "delay": 0.8,
              "strong": false
            }
          }
        },
        {
          "id": "9xj7haik",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 108,
          "y": 34,
          "label": "finalFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "final",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "gun"
              ],
              "delay": 0.4,
              "strong": false
            }
          }
        },
        {
          "id": "luk3p14b",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 86,
          "y": 34,
          "label": "finalFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "final",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.7,
              "strong": false
            }
          }
        },
        {
          "id": "to666s7p",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 106,
          "y": 53,
          "label": "finalFight / wave 2",
          "mock": {
            "type": "enemy",
            "roomId": "final",
            "wave": 2,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.3,
              "strong": true
            }
          }
        },
        {
          "id": "5x6z3xn1",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 92,
          "y": 38.5,
          "label": "finalFight / wave 2",
          "mock": {
            "type": "enemy",
            "roomId": "final",
            "wave": 2,
            "raw": {
              "arms": [
                "gun",
                "fist"
              ],
              "delay": 0.7,
              "strong": false
            }
          }
        },
        {
          "id": "xljdflrk",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 108,
          "y": 35,
          "label": "finalFight / wave 2",
          "mock": {
            "type": "enemy",
            "roomId": "final",
            "wave": 2,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 1.2,
              "strong": false
            }
          }
        },
        {
          "id": "pavs1c4j",
          "type": "icon",
          "kind": "mock_spawn",
          "x": 82.5,
          "y": 108,
          "label": "開始地点",
          "mock": {
            "type": "spawn",
            "raw": {
              "after": null,
              "x": 0,
              "z": 7,
              "yaw": 0,
              "arms": [
                "fist",
                "fist"
              ]
            }
          }
        },
        {
          "id": "m2zkko68",
          "type": "icon",
          "kind": "mock_goal",
          "x": 98,
          "y": 17,
          "label": "セーフルームへ帰還",
          "mock": {
            "type": "goal",
            "raw": {
              "door": "goal",
              "x": 8,
              "z": -73,
              "r": 2.6
            }
          }
        },
        {
          "id": "y31akcxy",
          "type": "icon",
          "kind": "mock_check",
          "x": 135,
          "y": 77,
          "label": "適合腕 認証装置",
          "mock": {
            "type": "check",
            "raw": {
              "parallel": true,
              "tag": "A01",
              "label": "適合腕A",
              "kind": "fist",
              "side": "RIGHT",
              "mode": "store",
              "device": "認証装置",
              "door": "cGate",
              "idleCrt": [
                "C系統 認証",
                "適合腕 A01"
              ],
              "okCrt": [
                "認証完了",
                "C調圧室 開放"
              ],
              "crusher": {
                "x": 38,
                "z": -22,
                "face": "s",
                "crt": [
                  40,
                  2.8,
                  -22
                ],
                "r": 2.5
              }
            }
          }
        },
        {
          "id": "xbhfxe0o",
          "type": "corridor",
          "x1": 90,
          "y1": 88,
          "x2": 90,
          "y2": 98.5,
          "width": 2,
          "label": ""
        },
        {
          "id": "uzhyfjb1",
          "type": "corridor",
          "x1": 82.5,
          "y1": 98,
          "x2": 91,
          "y2": 98,
          "width": 2,
          "label": ""
        },
        {
          "id": "9j2fki5v",
          "type": "corridor",
          "x1": 82.5,
          "y1": 97,
          "x2": 82.5,
          "y2": 102,
          "width": 2,
          "label": ""
        },
        {
          "id": "drzcai8v",
          "type": "route",
          "points": [
            {
              "x": 40.5,
              "y": 69
            },
            {
              "x": 51,
              "y": 69
            },
            {
              "x": 51,
              "y": 69.5
            },
            {
              "x": 51,
              "y": 80
            },
            {
              "x": 78.5,
              "y": 80
            }
          ],
          "width": 4,
          "label": ""
        },
        {
          "id": "wgjgqvpo",
          "type": "corridor",
          "x1": 29,
          "y1": 57,
          "x2": 29,
          "y2": 63.5,
          "width": 4,
          "label": ""
        },
        {
          "id": "f0a7h2yg",
          "type": "route",
          "points": [
            {
              "x": 41,
              "y": 55.5
            },
            {
              "x": 73.5,
              "y": 55.5
            },
            {
              "x": 73.5,
              "y": 57
            },
            {
              "x": 73.5,
              "y": 67.5
            }
          ],
          "width": 2,
          "label": ""
        },
        {
          "id": "85819wq6",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 59.5,
          "y": 55,
          "label": "敵",
          "mock": {
            "type": "enemy",
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0,
              "strong": false
            },
            "roomId": "",
            "wave": 1
          }
        },
        {
          "id": "fwrn2zpp",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 73.5,
          "y": 61.5,
          "label": "敵",
          "mock": {
            "type": "enemy",
            "raw": {
              "arms": [
                "tentacle",
                "fist"
              ],
              "delay": 0,
              "strong": false
            },
            "roomId": "",
            "wave": 1
          }
        },
        {
          "id": "uhb13pf2",
          "type": "corridor",
          "x1": 90,
          "y1": 57,
          "x2": 90,
          "y2": 65.5,
          "width": 4,
          "label": ""
        },
        {
          "id": "fishw6iu",
          "type": "route",
          "points": [
            {
              "x": 101.5,
              "y": 80
            },
            {
              "x": 107.5,
              "y": 80
            },
            {
              "x": 107.5,
              "y": 96.5
            },
            {
              "x": 135,
              "y": 96.5
            },
            {
              "x": 135,
              "y": 97
            },
            {
              "x": 135,
              "y": 84
            }
          ],
          "width": 4,
          "label": ""
        },
        {
          "id": "e7cw5eyj",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 110,
          "y": 96.5,
          "label": "敵",
          "mock": {
            "type": "enemy",
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0,
              "strong": false
            },
            "roomId": "",
            "wave": 1
          }
        },
        {
          "id": "gd2zqdux",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 125,
          "y": 97,
          "label": "敵",
          "mock": {
            "type": "enemy",
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0,
              "strong": false
            },
            "roomId": "",
            "wave": 1
          }
        },
        {
          "id": "dzruuqsc",
          "type": "corridor",
          "x1": 135,
          "y1": 74.5,
          "x2": 135,
          "y2": 67,
          "width": 4,
          "label": ""
        },
        {
          "id": "g2qxtqgy",
          "type": "route",
          "points": [
            {
              "x": 141.5,
              "y": 74.5
            },
            {
              "x": 142,
              "y": 74.5
            },
            {
              "x": 142,
              "y": 70
            },
            {
              "x": 150,
              "y": 70
            },
            {
              "x": 150,
              "y": 70.5
            },
            {
              "x": 150,
              "y": 82.5
            },
            {
              "x": 158.5,
              "y": 82.5
            }
          ],
          "width": 2,
          "label": ""
        },
        {
          "id": "0tmetpjx",
          "type": "corridor",
          "x1": 150.5,
          "y1": 73.5,
          "x2": 151,
          "y2": 73.5,
          "width": 2,
          "label": ""
        },
        {
          "id": "cb4z6aoz",
          "type": "corridor",
          "x1": 150.5,
          "y1": 73.5,
          "x2": 162.5,
          "y2": 73.5,
          "width": 2,
          "label": ""
        },
        {
          "id": "on0a78r6",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 160.5,
          "y": 89,
          "label": "wrongFight / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "wrong",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.5,
              "strong": false
            }
          }
        },
        {
          "id": "uck94wll",
          "type": "rect",
          "x": 161.5,
          "y": 72.5,
          "w": 12,
          "h": 5.5,
          "label": "",
          "color": "#89a7bc",
          "manualOpenings": [],
          "mock": {
            "type": "space",
            "raw": {
              "type": "duct",
              "h": 4.5,
              "tone": "cold"
            }
          }
        },
        {
          "id": "gr1fimd7",
          "type": "route",
          "points": [
            {
              "x": 129,
              "y": 75
            },
            {
              "x": 128.5,
              "y": 75
            },
            {
              "x": 128.5,
              "y": 70
            },
            {
              "x": 121.5,
              "y": 70
            },
            {
              "x": 121.5,
              "y": 69.5
            },
            {
              "x": 121.5,
              "y": 62
            }
          ],
          "width": 2,
          "label": ""
        },
        {
          "id": "120bzu3t",
          "type": "route",
          "points": [
            {
              "x": 121,
              "y": 66
            },
            {
              "x": 113,
              "y": 66
            },
            {
              "x": 113,
              "y": 66.5
            },
            {
              "x": 113,
              "y": 71.5
            }
          ],
          "width": 2,
          "label": ""
        },
        {
          "id": "j5ogm2u8",
          "type": "rect",
          "x": 106.5,
          "y": 70.5,
          "w": 12.5,
          "h": 6.5,
          "label": "",
          "color": "#89a7bc",
          "manualOpenings": [],
          "mock": {
            "type": "space",
            "raw": {
              "type": "room",
              "h": 4.5,
              "tone": "cold"
            }
          }
        },
        {
          "id": "birqlw50",
          "type": "corridor",
          "x1": 72.5,
          "y1": 68,
          "x2": 78.5,
          "y2": 68,
          "width": 2,
          "label": ""
        },
        {
          "id": "yqvy7gkt",
          "type": "icon",
          "kind": "mock_door",
          "x": 135,
          "y": 67.5,
          "label": "Cdoor",
          "mock": {
            "type": "door",
            "raw": {
              "id": "Dyqvy",
              "axis": "x",
              "h": 2.8,
              "style": "blast",
              "open": true
            },
            "width": 2,
            "requires": []
          }
        },
        {
          "id": "qomzv32c",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 132.5,
          "y": 58.5,
          "label": "敵",
          "mock": {
            "type": "enemy",
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0,
              "strong": false
            },
            "roomId": "cValve",
            "wave": 1
          }
        },
        {
          "id": "jj101zua",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 131.5,
          "y": 62.5,
          "label": "敵",
          "mock": {
            "type": "enemy",
            "raw": {
              "arms": [
                "gun",
                "tentacle"
              ],
              "delay": 0,
              "strong": false
            },
            "roomId": "cValve",
            "wave": 2
          }
        },
        {
          "id": "du5yr89j",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 138,
          "y": 59,
          "label": "敵",
          "mock": {
            "type": "enemy",
            "raw": {
              "arms": [
                "fist",
                "gun"
              ],
              "delay": 0,
              "strong": false
            },
            "roomId": "cValve",
            "wave": 1
          }
        },
        {
          "id": "nfgd4h7k",
          "type": "icon",
          "kind": "mock_enemy",
          "x": 145.5,
          "y": 70,
          "label": "armGuard / wave 1",
          "mock": {
            "type": "enemy",
            "roomId": "right",
            "wave": 1,
            "raw": {
              "arms": [
                "fist",
                "fist"
              ],
              "delay": 0.3,
              "strong": false
            }
          }
        }
      ]
    }
  ],
  "verticals": [],
  "switchLinks": [],
  "graph": {
    "nodes": [],
    "edges": []
  },
  "progression": {
    "version": 1,
    "rooms": [
      {
        "id": "entry",
        "title": "搬入口",
        "type": "start",
        "subtitle": "",
        "x": 0,
        "y": 0,
        "mapRoomId": "entry"
      },
      {
        "id": "hub",
        "title": "中央ホール",
        "type": "area",
        "subtitle": "",
        "x": 320,
        "y": 0,
        "mapRoomId": "hub"
      },
      {
        "id": "bArena",
        "title": "B系統 ポンプ試験室",
        "type": "area",
        "subtitle": "",
        "x": 640,
        "y": 0,
        "mapRoomId": "bArena"
      },
      {
        "id": "bValve",
        "title": "B調圧室",
        "type": "area",
        "subtitle": "",
        "x": 960,
        "y": 0,
        "mapRoomId": "bValve"
      },
      {
        "id": "cHub",
        "title": "検体照合区画",
        "type": "area",
        "subtitle": "",
        "x": 0,
        "y": 240,
        "mapRoomId": "cHub"
      },
      {
        "id": "wrong",
        "title": "第一保管庫 / 記録・予備検体",
        "type": "area",
        "subtitle": "",
        "x": 320,
        "y": 240,
        "mapRoomId": "wrong"
      },
      {
        "id": "right",
        "title": "第二保管庫 / 適合腕A",
        "type": "area",
        "subtitle": "",
        "x": 640,
        "y": 240,
        "mapRoomId": "right"
      },
      {
        "id": "cValve",
        "title": "C調圧室",
        "type": "area",
        "subtitle": "",
        "x": 960,
        "y": 240,
        "mapRoomId": "cValve"
      },
      {
        "id": "final",
        "title": "最終試験場",
        "type": "area",
        "subtitle": "",
        "x": 0,
        "y": 480,
        "mapRoomId": "final"
      },
      {
        "id": "exit",
        "title": "搬出室",
        "type": "end",
        "subtitle": "",
        "x": 320,
        "y": 480,
        "mapRoomId": "exit"
      }
    ],
    "flags": [
      {
        "id": "cleared:aFight",
        "title": "中央ホール 戦闘クリア",
        "roomId": "hub",
        "kind": "event",
        "description": ""
      },
      {
        "id": "cleared:bFight",
        "title": "B系統 ポンプ試験室 戦闘クリア",
        "roomId": "bArena",
        "kind": "event",
        "description": ""
      },
      {
        "id": "cleared:wrongFight",
        "title": "第一保管庫 / 記録・予備検体 戦闘クリア",
        "roomId": "wrong",
        "kind": "event",
        "description": ""
      },
      {
        "id": "cleared:armGuard",
        "title": "第二保管庫 / 適合腕A 戦闘クリア",
        "roomId": "right",
        "kind": "event",
        "description": ""
      },
      {
        "id": "cleared:finalFight",
        "title": "最終試験場 戦闘クリア",
        "roomId": "final",
        "kind": "event",
        "description": ""
      },
      {
        "id": "valve:A",
        "title": "バルブA",
        "roomId": "hub",
        "kind": "valve",
        "description": ""
      },
      {
        "id": "valve:B",
        "title": "バルブB",
        "roomId": "bValve",
        "kind": "valve",
        "description": ""
      },
      {
        "id": "valve:C",
        "title": "バルブC",
        "roomId": "cValve",
        "kind": "valve",
        "description": ""
      },
      {
        "id": "done:armA",
        "title": "適合腕A 認証完了",
        "roomId": "cHub",
        "kind": "key",
        "description": ""
      },
      {
        "id": "done:valves",
        "title": "全系統復旧",
        "roomId": "hub",
        "kind": "event",
        "description": ""
      }
    ],
    "links": [
      {
        "id": "link_entry_hub",
        "from": "entry",
        "to": "hub",
        "name": "entrySeal",
        "role": "shortcut",
        "bidirectional": true,
        "rules": [],
        "mapDoorId": "entrySeal"
      },
      {
        "id": "link_hub_bArena",
        "from": "hub",
        "to": "bArena",
        "name": "westGate",
        "role": "main",
        "bidirectional": true,
        "rules": [
          [
            "valve:A"
          ]
        ],
        "mapDoorId": "westGate"
      },
      {
        "id": "link_bArena_bValve",
        "from": "bArena",
        "to": "bValve",
        "name": "bOut",
        "role": "main",
        "bidirectional": true,
        "rules": [
          [
            "cleared:bFight"
          ]
        ],
        "mapDoorId": "bOut"
      },
      {
        "id": "link_bValve_hub",
        "from": "bValve",
        "to": "hub",
        "name": "bShortcut",
        "role": "shortcut",
        "bidirectional": true,
        "rules": [
          [
            "valve:B"
          ]
        ],
        "mapDoorId": "bShortcut"
      },
      {
        "id": "link_hub_cHub",
        "from": "hub",
        "to": "cHub",
        "name": "eastGate",
        "role": "main",
        "bidirectional": true,
        "rules": [
          [
            "valve:A"
          ]
        ],
        "mapDoorId": "eastGate"
      },
      {
        "id": "link_cHub_wrong",
        "from": "cHub",
        "to": "wrong",
        "name": "探索通路",
        "role": "main",
        "bidirectional": true,
        "rules": [],
        "mapDoorId": ""
      },
      {
        "id": "link_cHub_right",
        "from": "cHub",
        "to": "right",
        "name": "探索通路",
        "role": "main",
        "bidirectional": true,
        "rules": [],
        "mapDoorId": ""
      },
      {
        "id": "link_cHub_cValve",
        "from": "cHub",
        "to": "cValve",
        "name": "cGate",
        "role": "main",
        "bidirectional": true,
        "rules": [
          [
            "done:armA"
          ]
        ],
        "mapDoorId": "cGate"
      },
      {
        "id": "link_hub_final",
        "from": "hub",
        "to": "final",
        "name": "mainGate",
        "role": "main",
        "bidirectional": true,
        "rules": [
          [
            "valve:A",
            "valve:B",
            "valve:C"
          ]
        ],
        "mapDoorId": "mainGate"
      },
      {
        "id": "link_final_exit",
        "from": "final",
        "to": "exit",
        "name": "finalOut",
        "role": "main",
        "bidirectional": true,
        "rules": [
          [
            "cleared:finalFight"
          ]
        ],
        "mapDoorId": "finalOut"
      }
    ],
    "events": [
      {
        "id": "event_hub",
        "title": "戦闘",
        "roomId": "hub",
        "triggerFlagId": "",
        "returnRoomId": "",
        "note": "供給試験を開始。対象を排除してください。",
        "x": 320,
        "y": 150
      },
      {
        "id": "event_bArena",
        "title": "戦闘",
        "roomId": "bArena",
        "triggerFlagId": "",
        "returnRoomId": "",
        "note": "ポンプ区画の障害を排除してください。",
        "x": 640,
        "y": 150
      },
      {
        "id": "event_wrong",
        "title": "戦闘",
        "roomId": "wrong",
        "triggerFlagId": "",
        "returnRoomId": "",
        "note": "",
        "x": 320,
        "y": 390
      },
      {
        "id": "event_right",
        "title": "戦闘",
        "roomId": "right",
        "triggerFlagId": "",
        "returnRoomId": "",
        "note": "",
        "x": 640,
        "y": 390
      },
      {
        "id": "event_final",
        "title": "戦闘",
        "roomId": "final",
        "triggerFlagId": "done:valves",
        "returnRoomId": "",
        "note": "全系統復旧を確認。最終運動試験を開始します。",
        "x": 0,
        "y": 630
      }
    ]
  },
  "mock": {
    "origin2D": [
      90,
      90
    ],
    "source": {
      "id": "1-3",
      "label": "DEMO STAGE 1-3",
      "title": "供給圧力復旧区画",
      "kind": "stage",
      "selectable": true,
      "speaker": "研究員",
      "origin": [
        1100,
        0,
        0
      ],
      "fog": {
        "color": 1053978,
        "near": 4,
        "far": 42
      },
      "ambient": {
        "hemi": 0.58,
        "dir": 0.2
      },
      "spaces": [
        {
          "id": "entry",
          "r": [
            -3,
            3,
            1,
            12
          ],
          "name": "搬入口",
          "tone": "cold",
          "type": "room",
          "h": 4.5
        },
        {
          "id": "entryHall",
          "r": [
            -2,
            2,
            -3,
            2
          ],
          "name": "中央ホールへ",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "hub",
          "r": [
            -12,
            12,
            -25,
            -2
          ],
          "name": "中央ホール",
          "tone": "cold",
          "type": "room",
          "h": 6
        },
        {
          "id": "west",
          "r": [
            -37,
            -11,
            -12,
            -8
          ],
          "name": "B系統 配管通路",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "bArena",
          "r": [
            -70,
            -49,
            -27,
            -3
          ],
          "name": "B系統 ポンプ試験室",
          "tone": "warm",
          "type": "room",
          "h": 6
        },
        {
          "id": "bNeck",
          "r": [
            -63,
            -59,
            -34,
            -26
          ],
          "name": "調圧室へ",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "bValve",
          "r": [
            -70,
            -49,
            -45,
            -33
          ],
          "name": "B調圧室",
          "tone": "amber",
          "type": "room",
          "h": 4.5
        },
        {
          "id": "bReturn",
          "r": [
            -50,
            -8,
            -43,
            -39
          ],
          "name": "中央ホール帰還路",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "bReturn2",
          "r": [
            -12,
            -8,
            -40,
            -24
          ],
          "name": "帰還階廊",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "east",
          "r": [
            11,
            28,
            -12,
            -8
          ],
          "name": "C系統 検体通路",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "cHub",
          "r": [
            27,
            43,
            -25,
            -2
          ],
          "name": "検体照合区画",
          "tone": "green",
          "type": "room",
          "h": 4.5
        },
        {
          "id": "wrongHall",
          "r": [
            42,
            60,
            -8,
            -4
          ],
          "name": "第一保管庫へ",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "wrong",
          "r": [
            68,
            81,
            -4,
            10
          ],
          "name": "第一保管庫 / 記録・予備検体",
          "tone": "amber",
          "type": "room",
          "h": 4.5
        },
        {
          "id": "rightHall",
          "r": [
            42,
            60,
            -23,
            -19
          ],
          "name": "第二保管庫へ",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "right",
          "r": [
            74,
            89,
            -43,
            -29
          ],
          "name": "第二保管庫 / 適合腕A",
          "tone": "red",
          "type": "room",
          "h": 4.5
        },
        {
          "id": "cNeck",
          "r": [
            32,
            36,
            -33,
            -24
          ],
          "name": "C系統 検体認証扉",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "cValve",
          "r": [
            27,
            43,
            -45,
            -32
          ],
          "name": "C調圧室",
          "tone": "cold",
          "type": "room",
          "h": 4.5
        },
        {
          "id": "finalHall",
          "r": [
            -2,
            2,
            -34,
            -24
          ],
          "name": "最終試験区画へ",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "final",
          "r": [
            -7,
            22,
            -60,
            -33
          ],
          "name": "最終試験場",
          "tone": "warm",
          "type": "room",
          "h": 7
        },
        {
          "id": "exitHall",
          "r": [
            6,
            10,
            -66,
            -59
          ],
          "name": "搬出通路",
          "tone": "cold",
          "type": "corridor",
          "h": 4.5
        },
        {
          "id": "exit",
          "r": [
            3,
            13,
            -75,
            -65
          ],
          "name": "搬出室",
          "tone": "cold",
          "type": "room",
          "h": 4.5
        },
        {
          "id": "westBend",
          "type": "corridor",
          "r": [
            -38,
            -34,
            -23,
            -8
          ],
          "h": 4,
          "tone": "cold",
          "name": "B系統 配管点検路"
        },
        {
          "id": "westApproach",
          "type": "corridor",
          "r": [
            -50,
            -34,
            -23,
            -19
          ],
          "h": 4,
          "tone": "cold",
          "name": "ポンプ試験室へ"
        },
        {
          "id": "wrongBend",
          "type": "corridor",
          "r": [
            56,
            60,
            -5,
            5
          ],
          "h": 4,
          "tone": "cold",
          "name": "第一保管庫 点検路"
        },
        {
          "id": "wrongApproach",
          "type": "corridor",
          "r": [
            59,
            69,
            1,
            5
          ],
          "h": 4,
          "tone": "cold",
          "name": "第一保管庫へ"
        },
        {
          "id": "rightBend",
          "type": "corridor",
          "r": [
            56,
            60,
            -36,
            -19
          ],
          "h": 4,
          "tone": "cold",
          "name": "第二保管庫 搬入路"
        },
        {
          "id": "rightApproach",
          "type": "corridor",
          "r": [
            59,
            75,
            -36,
            -32
          ],
          "h": 4,
          "tone": "cold",
          "name": "第二保管庫へ"
        }
      ],
      "doors": [
        {
          "id": "entrySeal",
          "axis": "x",
          "at": -2,
          "from": -2,
          "to": 2,
          "h": 2.8,
          "style": "blast",
          "lamp": true,
          "open": true
        },
        {
          "id": "westGate",
          "axis": "z",
          "at": -12,
          "from": -12,
          "to": -8,
          "h": 2.8,
          "style": "blast",
          "lamp": true
        },
        {
          "id": "eastGate",
          "axis": "z",
          "at": 12,
          "from": -12,
          "to": -8,
          "h": 2.8,
          "style": "blast",
          "lamp": true
        },
        {
          "id": "bIn",
          "axis": "z",
          "at": -50,
          "from": -23,
          "to": -19,
          "h": 2.8,
          "style": "blast",
          "lamp": true,
          "open": true
        },
        {
          "id": "bOut",
          "axis": "x",
          "at": -27,
          "from": -63,
          "to": -59,
          "h": 2.8,
          "style": "blast",
          "lamp": true
        },
        {
          "id": "bShortcut",
          "axis": "x",
          "at": -25,
          "from": -12,
          "to": -8,
          "h": 2.8,
          "style": "blast",
          "lamp": true
        },
        {
          "id": "cGate",
          "axis": "x",
          "at": -25,
          "from": 32,
          "to": 36,
          "h": 2.8,
          "style": "blast",
          "lamp": true
        },
        {
          "id": "mainGate",
          "axis": "x",
          "at": -25,
          "from": -2,
          "to": 2,
          "h": 2.8,
          "style": "blast",
          "lamp": true
        },
        {
          "id": "finalIn",
          "axis": "x",
          "at": -33,
          "from": -2,
          "to": 2,
          "h": 2.8,
          "style": "blast",
          "lamp": true,
          "open": true
        },
        {
          "id": "finalOut",
          "axis": "x",
          "at": -60,
          "from": 6,
          "to": 10,
          "h": 2.8,
          "style": "blast",
          "lamp": true
        },
        {
          "id": "goal",
          "axis": "x",
          "at": -75,
          "from": 6,
          "to": 10,
          "h": 2.8,
          "style": "blast",
          "lamp": true,
          "decor": true
        }
      ],
      "gas": [
        [
          -2,
          2,
          3,
          7
        ],
        [
          29,
          32,
          -17,
          -14
        ],
        [
          -66,
          -62,
          -12,
          -8
        ],
        [
          -1,
          3,
          -55,
          -51
        ]
      ],
      "armSupply": [
        {
          "x": -12,
          "z": -19,
          "face": "e",
          "name": "中央ホール"
        },
        {
          "x": -70,
          "z": -20,
          "face": "e",
          "name": "ポンプ試験室"
        },
        {
          "x": 27,
          "z": -20,
          "face": "e",
          "name": "検体照合区画"
        },
        {
          "x": 27,
          "z": -40,
          "face": "e",
          "name": "C調圧室"
        },
        {
          "x": -7,
          "z": -52,
          "face": "e",
          "name": "最終試験場"
        }
      ],
      "corpses": [
        {
          "x": -8,
          "z": -14,
          "arms": [
            "fist",
            "fist"
          ]
        },
        {
          "x": -66,
          "z": -39,
          "arms": [
            "fist",
            "fist"
          ]
        },
        {
          "x": 39,
          "z": -39,
          "arms": [
            "fist",
            "fist"
          ]
        },
        {
          "x": 75,
          "z": 3,
          "arms": [
            "fist",
            "fist"
          ]
        },
        {
          "x": -4,
          "z": -52,
          "arms": [
            "fist",
            "fist"
          ]
        }
      ],
      "arms": [
        {
          "x": 75,
          "z": 5,
          "kind": "gun"
        },
        {
          "x": -65,
          "z": -10,
          "kind": "gun"
        },
        {
          "x": 82,
          "z": -33,
          "kind": "fist",
          "tag": "B02",
          "side": "RIGHT"
        }
      ],
      "taggedArms": [
        {
          "tag": "A01",
          "label": "適合腕A",
          "kind": "fist",
          "side": "RIGHT",
          "at": {
            "x": 85,
            "z": -40,
            "y": 1.05
          }
        }
      ],
      "props": [
        {
          "type": "sign",
          "x": 0,
          "z": -24.8,
          "face": "s",
          "lines": [
            "最終扉 / 供給圧力",
            "A・B・Cの3系統を復旧"
          ],
          "w": 4,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": -11.8,
          "z": -6,
          "face": "e",
          "lines": [
            "B系統 ← ポンプ試験室"
          ],
          "w": 3,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": 11.8,
          "z": -6,
          "face": "w",
          "lines": [
            "C系統 → 検体照合区画"
          ],
          "w": 3,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": 27.1,
          "z": -15,
          "face": "e",
          "lines": [
            "C扉：適合腕Aで認証",
            "保管庫を探索せよ"
          ],
          "w": 3,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": 42.8,
          "z": -6,
          "face": "w",
          "lines": [
            "第一保管庫 →",
            "検体記録・予備身体"
          ],
          "w": 2.7,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": 42.8,
          "z": -21,
          "face": "w",
          "lines": [
            "第二保管庫 →",
            "適合検体"
          ],
          "w": 2.7,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": 80.8,
          "z": 3,
          "face": "w",
          "lines": [
            "移送記録",
            "適合腕Aは第二保管庫へ",
            "本室の検体は不適合"
          ],
          "w": 3,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": 88.8,
          "z": -40,
          "face": "w",
          "lines": [
            "適合腕 A01",
            "損壊時は同じ台へ補充"
          ],
          "w": 2.7,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": -49.2,
          "z": -41,
          "face": "w",
          "lines": [
            "中央ホールへ →",
            "試験終了後に帰還扉開放"
          ],
          "w": 3,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "sign",
          "x": 8,
          "z": -74.8,
          "face": "s",
          "lines": [
            "搬出口 / Fで帰還"
          ],
          "w": 3,
          "h": 0.9,
          "y": 2.6,
          "style": "notice"
        },
        {
          "type": "inspector",
          "x": 38,
          "z": -22,
          "face": "n",
          "label": "適合腕認証装置"
        },
        {
          "type": "pedestal",
          "x": 85,
          "z": -40
        },
        {
          "type": "desk",
          "x": 78,
          "z": 8,
          "face": "n",
          "w": 2.5,
          "d": 0.8,
          "crt": "検体移送記録",
          "papers": true
        },
        {
          "type": "armpile",
          "x": 71,
          "z": 7,
          "n": 18,
          "r": 1
        },
        {
          "type": "machine",
          "x": -61,
          "z": -15,
          "w": 2.6,
          "d": 2,
          "h": 1.5,
          "style": "pump",
          "label": "復旧設備"
        },
        {
          "type": "machine",
          "x": -57,
          "z": -20,
          "w": 2.6,
          "d": 2,
          "h": 1.5,
          "style": "pump",
          "label": "復旧設備"
        },
        {
          "type": "machine",
          "x": 5,
          "z": -45,
          "w": 2.6,
          "d": 2,
          "h": 1.5,
          "style": "pump",
          "label": "復旧設備"
        },
        {
          "type": "machine",
          "x": 15,
          "z": -49,
          "w": 2.6,
          "d": 2,
          "h": 1.5,
          "style": "pump",
          "label": "復旧設備"
        }
      ],
      "valves": [
        {
          "id": "A",
          "x": -11.6,
          "z": -14,
          "face": "e",
          "y": 1.35,
          "color": 13648175,
          "lamp": [
            -1,
            3.5,
            -24.8
          ],
          "flag": "valveA",
          "line": "A系統、供給開始。B・C区画を開放します。",
          "pipe": [
            [
              -1,
              3.5,
              -24.8
            ],
            [
              -11.6,
              3.5,
              -24.8
            ],
            [
              -11.6,
              3.5,
              -14
            ],
            [
              -11.6,
              1.8,
              -14
            ]
          ],
          "cond": "cleared:aFight",
          "opens": [
            "westGate",
            "eastGate"
          ]
        },
        {
          "id": "B",
          "x": -69.6,
          "z": -39,
          "face": "e",
          "y": 1.35,
          "color": 14725152,
          "lamp": [
            0,
            3.5,
            -24.8
          ],
          "flag": "valveB",
          "line": "B系統、供給を開始しました。",
          "pipe": [
            [
              0,
              3.5,
              -24.8
            ],
            [
              0,
              4,
              -24.8
            ],
            [
              -10,
              4,
              -24.8
            ],
            [
              -10,
              3.6,
              -41
            ],
            [
              -69.6,
              3.6,
              -41
            ],
            [
              -69.6,
              3.6,
              -39
            ],
            [
              -69.6,
              1.8,
              -39
            ]
          ],
          "cond": "cleared:bFight",
          "approach": {
            "x": -54,
            "z": -15
          },
          "opens": [
            "bShortcut"
          ]
        },
        {
          "id": "C",
          "x": 42.6,
          "z": -39,
          "face": "w",
          "y": 1.35,
          "color": 3897568,
          "lamp": [
            1,
            3.5,
            -24.8
          ],
          "flag": "valveC",
          "line": "C系統、供給を開始しました。",
          "pipe": [
            [
              1,
              3.5,
              -24.8
            ],
            [
              1,
              4.2,
              -24.8
            ],
            [
              11.6,
              4.2,
              -24.8
            ],
            [
              11.6,
              3.6,
              -10
            ],
            [
              34,
              3.6,
              -10
            ],
            [
              34,
              3.6,
              -39
            ],
            [
              42.6,
              3.6,
              -39
            ],
            [
              42.6,
              1.8,
              -39
            ]
          ],
          "cond": "done:armA",
          "approach": {
            "x": 38,
            "z": -24
          }
        }
      ],
      "lockDoor": "mainGate",
      "lockName": "最終扉",
      "valveObjective": "A・B・Cを復旧する（C：適合腕Aを認証装置へ搬入）",
      "armCheck": {
        "parallel": true,
        "tag": "A01",
        "label": "適合腕A",
        "kind": "fist",
        "side": "RIGHT",
        "mode": "store",
        "device": "認証装置",
        "door": "cGate",
        "idleCrt": [
          "C系統 認証",
          "適合腕 A01"
        ],
        "okCrt": [
          "認証完了",
          "C調圧室 開放"
        ],
        "crusher": {
          "x": 38,
          "z": -22,
          "face": "n",
          "crt": [
            40,
            2.8,
            -22
          ],
          "r": 2.5
        }
      },
      "encounters": [
        {
          "id": "aFight",
          "type": "arena",
          "zone": [
            -12,
            12,
            -25,
            -2
          ],
          "trigger": [
            -11.5,
            11.5,
            -24.5,
            -2.5
          ],
          "doors": [
            "entrySeal"
          ],
          "startLine": "供給試験を開始。対象を排除してください。",
          "clearLine": "供給試験終了。中央ホールのA弁を開放してください。",
          "waves": [
            [
              [
                4,
                -18,
                "fist",
                "fist",
                0.3
              ],
              [
                -5,
                -7,
                "fist",
                "fist",
                0.8
              ]
            ]
          ]
        },
        {
          "id": "bFight",
          "type": "arena",
          "zone": [
            -70,
            -49,
            -27,
            -3
          ],
          "trigger": [
            -68,
            -52,
            -25,
            -5
          ],
          "doors": [
            "bIn",
            "bOut"
          ],
          "startLine": "ポンプ区画の障害を排除してください。",
          "clearLine": "障害排除を確認。奥のB弁を開放してください。",
          "waves": [
            [
              [
                -66,
                -24,
                "fist",
                "fist",
                0.3
              ],
              [
                -55,
                -6,
                "fist",
                "gun",
                0.8
              ]
            ],
            [
              [
                -66,
                -6,
                "fist",
                "fist",
                0.3,
                {
                  "strong": true
                }
              ],
              [
                -53,
                -23,
                "gun",
                "fist",
                0.7
              ]
            ]
          ]
        },
        {
          "id": "wrongFight",
          "zone": [
            68,
            81,
            -4,
            10
          ],
          "spawns": [
            [
              77,
              -1,
              "fist",
              "fist",
              0.5
            ]
          ]
        },
        {
          "id": "armGuard",
          "zone": [
            74,
            89,
            -43,
            -29
          ],
          "spawns": [
            [
              78,
              -40,
              "fist",
              "fist",
              0.3
            ],
            [
              86,
              -31,
              "fist",
              "gun",
              0.8
            ]
          ]
        },
        {
          "id": "finalFight",
          "type": "arena",
          "zone": [
            -7,
            22,
            -60,
            -33
          ],
          "trigger": [
            -5,
            20,
            -58,
            -36
          ],
          "cond": "done:valves",
          "doors": [
            "finalIn",
            "finalOut"
          ],
          "startLine": "全系統復旧を確認。最終運動試験を開始します。",
          "waves": [
            [
              [
                18,
                -56,
                "fist",
                "gun",
                0.4
              ],
              [
                -4,
                -56,
                "fist",
                "fist",
                0.7
              ]
            ],
            [
              [
                16,
                -37,
                "fist",
                "fist",
                0.3,
                {
                  "strong": true
                }
              ],
              [
                -3,
                -55,
                "gun",
                "fist",
                0.7
              ],
              [
                18,
                -55,
                "fist",
                "fist",
                1.2
              ]
            ]
          ]
        }
      ],
      "missions": [
        {
          "id": "valves",
          "type": "valves",
          "brief": "中央ホールの試験を突破し、A弁を開放してください。その後B・C系統を任意の順番で復旧してください。",
          "doneLine": "全系統の圧力を確認。中央の最終扉を開放します。"
        },
        {
          "id": "armA",
          "type": "armCheck",
          "doneLine": "適合腕Aを保管しました。C調圧室を開放します。"
        },
        {
          "id": "final",
          "type": "arena",
          "enc": "finalFight",
          "text": "中央の最終扉を通り、最終試験を突破する",
          "doneLine": "試験終了。搬出口より帰還してください。"
        }
      ],
      "checkpoints": [
        {
          "after": null,
          "x": 0,
          "z": 7,
          "yaw": 0,
          "arms": [
            "fist",
            "fist"
          ]
        },
        {
          "after": "valves",
          "x": 0,
          "z": -20,
          "yaw": 0,
          "arms": [
            "fist",
            "fist"
          ]
        },
        {
          "after": "final",
          "x": 8,
          "z": -69,
          "yaw": 0,
          "arms": [
            "fist",
            "fist"
          ]
        }
      ],
      "goal": {
        "door": "goal",
        "x": 8,
        "z": -73,
        "r": 2.6
      }
    },
    "runtimeUrl": ""
  }
});
