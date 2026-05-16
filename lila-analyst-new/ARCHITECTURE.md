# Architecture

## What I Built With and Why

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | React 18 + TypeScript | Strong typing catches coordinate bugs at compile time; React's component model maps cleanly to the panel-based UI |
| Build tool | Vite 5 | Fastest HMR, handles TS out of the box, trivial Vercel/Netlify deploy |
| Rendering | HTML5 Canvas 2D API | The only reasonable choice for drawing 89k event points interactively. SVG would thrash the DOM; WebGL is overkill for 2D. Canvas gives full control over heatmap blending and line rendering. |
| State management | `useReducer` (no Redux) | The state is a single tree with well-defined transitions. No async side effects in the reducer — file loading is in a separate hook. Avoids a library dependency for a contained app. |
| Styling | Plain CSS with custom properties | Zero runtime, full control, no build complexity. The tactical HUD aesthetic is better served by hand-crafted CSS than a utility framework. |
| Data format | Pre-processed JSON (offline Python pipeline) | Parsing 89k-row Parquet in the browser is not viable. The pipeline computes pixel coordinates once; the browser just loads and renders. |
| Hosting | Vercel | Git push → deploy. Handles the static JSON files as assets. |

---

## Data Flow

```
Player parquet files (1,243 files)
        │
        ▼ [Python pipeline — runs once offline]
        │  • Reads parquet via pyarrow
        │  • Decodes event bytes → string
        │  • Computes map_x / map_y (world → pixel)
        │  • Detects human vs bot (UUID vs numeric user_id)
        │  • Writes one JSON per player-file
        ▼
  matches.json           {player}_{match}.json files
  (1,243-entry index)    (one per player in one match)
        │                         │
        └──────────┬──────────────┘
                   ▼ [Browser — on file upload]
            useFileLoader.ts
            • Parses matches.json → MatchGroup index
            • Indexes player JSON files by multiple key variants
            • On match select: merges all player files for that match_id
                   │
                   ▼
            dataLoader.ts / mergeMatchFiles()
            • Sorts events by timestamp
            • Normalises timestamps: first event = t=0
            • Assigns per-player colour from palette
            • Splits into players[] and allEvents[] (merged)
                   │
                   ▼
            AppState (useReducer)
            • Holds players, allEvents, timeline position, layer flags
                   │
                   ▼ [Every frame / state change]
            renderer.ts / renderFrame()
            • Clears canvas
            • drawHeatmap() — 40×40 grid, box-blur pass, blue→red gradient
            • drawPaths()   — polylines per player, dot at current position
            • drawEventMarkers() — per-event geometry (✕, ◆, ■)
                   │
                   ▼
            <canvas> overlaid on minimap <img>
```

---

## Coordinate Mapping Approach

This was the most important detail to get right.

**The problem:** Game world uses a 3D coordinate system (x, y, z). Minimaps are 1024×1024 pixel images. `y` is elevation — irrelevant for a top-down view.

**The formula (from README):**
```
u = (world_x - origin_x) / scale
v = (world_z - origin_z) / scale

pixel_x = u * 1024
pixel_y = (1 - v) * 1024   ← Y-axis flip: image origin is top-left
```

Each map has its own `scale` and `(origin_x, origin_z)`:

| Map | Scale | Origin X | Origin Z |
|-----|-------|----------|----------|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

**Key subtlety — the Y flip:** In image space, Y increases downward (top-left origin). In the game's UV space, V increases upward. So `pixel_y = (1 - v) * 1024`, not `v * 1024`. Getting this wrong mirrors all Z-axis positions.

**Implementation:** The Python pipeline pre-computes `map_x` and `map_y` at 1024px resolution. The browser scales these by `canvasSize / 1024` when drawing on differently-sized canvases. Live recalculation from raw (x, z) is available as fallback.

---

## Assumptions

| Ambiguity | Assumption |
|-----------|-----------|
| `ts` column looks like `1970-01-21T11:52:11.207000` — a 1970 epoch offset, not a real wall-clock date | Parsed via `new Date(ts).getTime()`. Timestamps are then re-normalised so the first event in each match = t=0. This gives a clean "time since match start" for the timeline. |
| matches.json `match_id` field = `{user_id}_{real_match_id}` (the filename without extension) | I split on the last UUID to extract `real_match_id`, grouping all player files for the same match. Numeric prefixes (bots) are handled separately. |
| Some matches have only 1 player file loaded (single-player view) | Tool works fine with partial data — shows whatever files are loaded. Missing players simply don't appear. |
| Map image filenames | Detected from filename: `grand` → GrandRift, `lock` → Lockdown, else AmbroseValley. |
| February 14 is a partial day | No special handling needed — treated identically to other days. The filter lets users isolate it if desired. |

---

## Major Tradeoffs

| What I considered | What I decided | Why |
|-------------------|----------------|-----|
| Serve JSON files from `public/` (static) vs. a backend API | Static files in `public/data/` | No server needed, deploys anywhere, faster for the file sizes involved (~6KB/match) |
| Pre-compute all pixel coords in Python vs. compute in browser | Pre-compute in Python (`map_x`, `map_y`) | Removes coordinate logic from the hot path; browser just multiplies by a scale factor |
| WebGL for rendering | Canvas 2D | 89k events across all 796 matches is large, but any single match has <2,000 events. Canvas 2D is more than fast enough and far simpler to maintain. |
| Bundling all match data into one large JSON | One JSON file per player-file + an index | Lazy loading: the browser only fetches the ~6–100KB needed for the selected match, not the full dataset |
| Redux / Zustand | `useReducer` | Avoids a dependency for a self-contained state machine with no async in reducers |
