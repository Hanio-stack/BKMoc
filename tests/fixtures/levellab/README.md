# BK LevelLab v7 fixtures

- `pressure-restoration.v7.json`: Original exported LevelLab project supplied by the owner; title: 供給圧力復旧区画, `version: 7`, one floor, 96 floor items.
- This JSON is a **test fixture** for a reusable LevelLab importer, **not** a hand-converted BKMoc stage.
- Understand `floors[].items[].mock` and the root-level `mock`, `progression`, `graph`, etc. from the actual data. Never hardcode conversion for this one map.
- Keep the original fixture unchanged. Add additional LevelLab exports as separate fixtures when available.
- Validate exported data, duplicate stage IDs, updating versions, unknown elements, stage selection, playable objectives, and safe-room return.
- LevelLab editor source code has not been committed here. Consult its separate source repository when available.
