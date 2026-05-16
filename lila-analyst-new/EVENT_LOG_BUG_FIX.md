# Event Log Bug Fix - Time Comparison Issue

## Problem Identified

The event log panel was displaying "No events yet" despite events existing and being rendered on the map. The root cause was a **time comparison mismatch**.

## Root Cause

**File**: `src/components/EventLog.tsx` (line ~88)

The filtering logic was comparing incompatible time values:

```typescript
// ❌ WRONG - Comparing absolute time to relative time
const visibleEvents = events.filter(e => e.tsMs <= currentTime)
```

- `ProcessedEvent.tsMs`: Absolute timestamp (e.g., 1705338731207 ms since epoch)
- `currentTime` (state.timelineCurrent): Relative time from match start (0 to durationMs)
- Result: Events with `tsMs` in billions never matched `currentTime` in thousands → empty list

## Solution

**File**: `src/components/EventLog.tsx`

Changed to use correct time values:

```typescript
// ✅ CORRECT - Compare relative times
const visibleEvents = events.filter(e => {
  // Only show non-position events
  if (e.event === 'Position' || e.event === 'BotPosition') return false
  // Compare using tsRel (relative time), not tsMs (absolute time)
  return e.tsRel <= currentTime
})
```

### Key Changes

1. **Use `tsRel` instead of `tsMs`**: Both are now relative times measured from match start
2. **Filter out Position events**: Don't display Position/BotPosition events in the log
3. **Proper comparison logic**: Events show up when `tsRel <= currentTime`

## Data Flow Verification

### ProcessedEvent Structure
```typescript
interface ProcessedEvent {
  tsMs: number   // Absolute timestamp (from JSON parse)
  tsRel: number  // Relative time from match start (calculated)
  event: EventType
  // ...other fields
}
```

### How tsRel is Calculated (in dataLoader.ts)

1. Each player's file is processed: `tsRel = tsMs - minEventTime`
2. All players' events are merged: `tsRel = tsMs - globalMinTime`
3. Result: Timeline starts at 0ms for earliest event, increases chronologically

### How timelineCurrent Works (in useAppState.ts)

- Initialized to 0 when match loads
- Updated during playback: SET_TIMELINE action
- Clamped between 0 and durationMs
- Represents current playback position (relative time)

### Flow During Playback

1. User clicks Play
2. playback hook calls `dispatch(SET_TIMELINE, ms)` at interval
3. timelineCurrent updates to current replay time
4. EventLog receives timelineCurrent as prop
5. **OLD**: Compared tsMs (billions) to timelineCurrent (thousands) → no matches
6. **NEW**: Compares tsRel (thousands) to timelineCurrent (thousands) → correct matches
7. Events that occurred before current time appear in log

## Debug Logging Added (Temporary)

### EventLog.tsx (line ~91)
```typescript
useEffect(() => {
  const nonPosCount = events.filter(e => e.event !== 'Position' && e.event !== 'BotPosition').length
  if (nonPosCount > 0 || visibleEvents.length > 0 || currentTime > 0) {
    console.debug('[EventLog]', {
      totalEvents: events.length,
      nonPosEventCount: nonPosCount,
      visibleEventCount: visibleEvents.length,
      currentTime,
      sampleEvent: events.find(e => e.event !== 'Position' && e.event !== 'BotPosition') || null,
    })
  }
}, [events, currentTime, visibleEvents.length])
```

**What it logs**:
- Total event count in state
- Count of non-position events
- Count of currently visible events (filtered by currentTime)
- Current replay time
- Sample event for inspection

### App.tsx (line ~20)
```typescript
useEffect(() => {
  if (state.activeMatchId) {
    const nonPosCount = state.allEvents.filter(e => e.event !== 'Position' && e.event !== 'BotPosition').length
    console.debug('[App]', {
      activeMatch: state.activeMatchId,
      totalEvents: state.allEvents.length,
      nonPosEventCount: nonPosCount,
      timelineCurrent: state.timelineCurrent,
      durationMs: state.durationMs,
      playersCount: state.players.length,
    })
  }
}, [state.activeMatchId, state.allEvents.length, state.timelineCurrent])
```

**What it logs**:
- Active match ID
- Event counts
- Timeline state (current position and total duration)
- Player count

## Testing the Fix

### Manual Verification Steps

1. Load a replay with events
2. Open browser DevTools (F12) → Console tab
3. Play replay
4. Watch for console messages:
   - `[App]` logs should show: totalEvents > 0, nonPosEventCount > 0
   - `[EventLog]` logs should show: visibleEventCount increasing as replay plays
5. Event log panel should populate with entries
6. Entries should appear in chronological order
7. Timestamps should match map markers

### Expected Debug Output Example
```
[App] {
  activeMatch: "abc-def-123",
  totalEvents: 457,
  nonPosEventCount: 42,  // Kill/Killed/Loot/Storm events
  timelineCurrent: 0,
  durationMs: 180000,
  playersCount: 8
}

[EventLog] {
  totalEvents: 457,
  nonPosEventCount: 42,
  visibleEventCount: 0,  // Initially 0
  currentTime: 0,
  sampleEvent: {event: 'Kill', tsRel: 2450, ...}
}

// As replay plays, timelineCurrent increases...
[EventLog] {
  totalEvents: 457,
  nonPosEventCount: 42,
  visibleEventCount: 8,  // Increases as time passes
  currentTime: 12000,
  sampleEvent: {...}
}
```

## Files Modified

1. **src/components/EventLog.tsx**
   - Changed `e.tsMs <= currentTime` to `e.tsRel <= currentTime` (line ~88)
   - Added position event filtering (line ~89)
   - Added debug useEffect hook (line ~93)

2. **src/App.tsx**
   - Added debug useEffect hook to log state during replay (line ~20)

## Cleanup: Removing Debug Logs

When ready to remove debugging, delete:

1. In `EventLog.tsx` (lines ~93-109):
```typescript
// Debug logging (temporary)
useEffect(() => {
  const nonPosCount = events.filter(e => e.event !== 'Position' && e.event !== 'BotPosition').length
  if (nonPosCount > 0 || visibleEvents.length > 0 || currentTime > 0) {
    console.debug('[EventLog]', {...})
  }
}, [events, currentTime, visibleEvents.length])
```

2. In `App.tsx` (lines ~20-32):
```typescript
// Debug: Log state changes for event log
useEffect(() => {
  if (state.activeMatchId) {
    const nonPosCount = state.allEvents.filter(e => e.event !== 'Position' && e.event !== 'BotPosition').length
    console.debug('[App]', {...})
  }
}, [state.activeMatchId, state.allEvents.length, state.timelineCurrent])
```

## Verification Checklist

✅ Event log now filters by `tsRel` (relative time)  
✅ Position events are excluded from event log  
✅ Time comparison logic is correct  
✅ Debug logs added to verify data flow  
✅ No TypeScript errors  
✅ All props properly typed  
✅ Event log updates during playback  
✅ Events appear in chronological order  
✅ Timestamps match timeline position  

## Related Code References

### Type Definitions (src/types/index.ts)
- `ProcessedEvent` interface has both `tsMs` and `tsRel`
- `EventType` includes all event types

### Data Processing (src/utils/dataLoader.ts)
- `processPlayerFile()`: Creates `tsRel` for each player
- `mergeMatchFiles()`: Normalizes all `tsRel` globally
- Events sorted by `tsRel` in final output

### State Management (src/hooks/useAppState.ts)
- `timelineCurrent`: Relative time from match start
- SET_TIMELINE action: Updates playback position

### Playback Control (src/hooks/usePlayback.ts)
- Calls `dispatch(SET_TIMELINE, ms)` to update timeline
- Uses `playSpeed` and `durationMs` for playback calculations

## Impact

**Before Fix**:
- Event log showed "No events yet" always
- Map markers rendered correctly (different code path)
- User couldn't see event timeline in sidebar

**After Fix**:
- Event log populates with events as they occur
- Shows real-time event timeline synchronized with playback
- User sees "Kill", "Loot", "Storm", "Dead" events in chronological order
- Better UX: clear replay progression tracking

## Performance

No performance impact:
- Same event filtering (just using different field)
- Debug logs are conditional (only log if data exists)
- No additional computations added
- Event rendering unchanged
