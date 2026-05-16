# Event Log Bug Fix - Before & After

## The Problem

```
BEFORE FIX:
┌──────────────────────────────────┐
│ EVENT LOG                        │
├──────────────────────────────────┤
│                                  │
│         No events yet            │
│                                  │
│                                  │
│  (even while replay is playing)  │
│                                  │
└──────────────────────────────────┘

Map: Shows markers ✕ ● ◆ ◇ (events exist!)
```

## Root Cause

```javascript
// ❌ WRONG TIME COMPARISON
const visibleEvents = events.filter(e => e.tsMs <= currentTime)

// Example values:
e.tsMs = 1705338731207     (absolute timestamp from January 2024)
currentTime = 2450         (relative time: 2 seconds 450ms into replay)

1705338731207 <= 2450      // FALSE → event hidden!
```

## The Solution

```javascript
// ✅ CORRECT TIME COMPARISON
const visibleEvents = events.filter(e => {
  if (e.event === 'Position' || e.event === 'BotPosition') return false
  return e.tsRel <= currentTime  // Compare relative times!
})

// Example values:
e.tsRel = 2450             (relative time from match start)
currentTime = 2450         (relative time: 2 seconds 450ms)

2450 <= 2450               // TRUE → event shown! ✓
```

## After Fix

```
AFTER FIX:
┌──────────────────────────────────┐
│ EVENT LOG                    [42]│
├──────────────────────────────────┤
│ 0:00 ✕ PlayerA found a kill    │
│ 0:02 ● PlayerB was eliminated  │
│ 0:05 ◇ PlayerC looted an item  │
│ 0:08 ◆ PlayerD died to storm   │
│ 0:11 ✕ PlayerE found a kill    │
│ 0:15 ◇ PlayerF looted an item  │
│ 0:17 ● PlayerA was eliminated  │
│ ...                            │
│                                  │
│  (updates in real-time!)         │
└──────────────────────────────────┘

Map: Shows markers matching log entries
```

## Code Changes Summary

### File: `src/components/EventLog.tsx`

#### Change #1: Event Filtering (Line 88)
```diff
- const visibleEvents = events.filter(e => e.tsMs <= currentTime)
+ const visibleEvents = events.filter(e => {
+   if (e.event === 'Position' || e.event === 'BotPosition') return false
+   return e.tsRel <= currentTime
+ })
```

#### Change #2: Time Display (Line 152)
```diff
- <span className="event-time">{formatTime(event.tsMs)}</span>
+ <span className="event-time">{formatTime(event.tsRel)}</span>
```

#### Change #3: Debug Logging (Line 93)
```diff
+ useEffect(() => {
+   const nonPosCount = events.filter(e => e.event !== 'Position' && e.event !== 'BotPosition').length
+   if (nonPosCount > 0 || visibleEvents.length > 0 || currentTime > 0) {
+     console.debug('[EventLog]', {
+       totalEvents: events.length,
+       nonPosEventCount: nonPosCount,
+       visibleEventCount: visibleEvents.length,
+       currentTime,
+       sampleEvent: events.find(e => e.event !== 'Position' && e.event !== 'BotPosition') || null,
+     })
+   }
+ }, [events, currentTime, visibleEvents.length])
```

### File: `src/App.tsx`

#### Change #4: State Debug Logging (Line 20)
```diff
+ useEffect(() => {
+   if (state.activeMatchId) {
+     const nonPosCount = state.allEvents.filter(e => e.event !== 'Position' && e.event !== 'BotPosition').length
+     console.debug('[App]', {
+       activeMatch: state.activeMatchId,
+       totalEvents: state.allEvents.length,
+       nonPosEventCount: nonPosCount,
+       timelineCurrent: state.timelineCurrent,
+       durationMs: state.durationMs,
+       playersCount: state.players.length,
+     })
+   }
+ }, [state.activeMatchId, state.allEvents.length, state.timelineCurrent])
```

## Testing Flow

```
1. LOAD REPLAY
   ↓
2. CHECK CONSOLE [App]
   totalEvents: 457 ✓
   nonPosEventCount: 42 ✓
   timelineCurrent: 0
   durationMs: 180000
   ↓
3. CLICK PLAY
   ↓
4. WATCH EVENT LOG POPULATE
   [EventLog] visibleEventCount: 0
   [EventLog] visibleEventCount: 1 (0:00)
   [EventLog] visibleEventCount: 2 (0:02)
   [EventLog] visibleEventCount: 3 (0:05)
   ... (continues as replay plays)
   ↓
5. VERIFY UI UPDATES
   Panel shows: 0:00 ✕ PlayerA found a kill
   Panel shows: 0:02 ● PlayerB was eliminated
   Panel shows: 0:05 ◇ PlayerC looted an item
   etc.
```

## Key Insight

```
The issue was comparing:
├─ tsMs (absolute timestamp)      1705338731207 ms since epoch
└─ currentTime (relative time)    2450 ms from match start

These are measured from different reference points!
They will NEVER align correctly.

The fix compares:
├─ tsRel (relative timestamp)     2450 ms from match start
└─ currentTime (relative time)    2450 ms from match start

Same reference point → Correct comparison → Events show!
```

## Event Type Filter

```typescript
// Position events don't appear in event log (too noisy)
✗ Position       (player position tracking)
✗ BotPosition    (bot position tracking)

// Important events DO appear
✓ Kill           (red border, ✕ icon)
✓ Killed         (light red border, ● icon)
✓ KilledByStorm  (purple border, ◆ icon)
✓ Loot           (gold border, ◇ icon)
✓ BotKill        (same as Kill)
✓ BotKilled      (same as Killed)
```

## Performance Impact

```
BEFORE:  Event log always empty = no rendering needed (but broken!)
AFTER:   Event log shows events = slightly more rendering

Total impact: Negligible
- Same filtering algorithm (just using different field)
- Same event rendering (no new DOM elements)
- Debug logs only trigger if data exists
- Auto-scroll already existed

Result: No perceptible performance change
```

## Rollback Plan

If needed, these changes can be easily reverted:
1. Change `e.tsRel` back to `e.tsMs` in filter (breaks it again)
2. Remove debug logging blocks
3. Change `event.tsRel` back to `event.tsMs` in time display

But the fix is correct - no need to rollback!
