# Event Log Implementation - Replay Viewer Enhancement

## Overview

Replaced on-map text labels with a dedicated **event log panel** on the right side of the UI. This improves readability and provides a chronological record of all events during replay playback.

## Changes Made

### 1. Removed On-Map Text Labels
**File**: `src/utils/renderer.ts`

Removed:
- `EventLabel` interface
- `EVENT_LABELS` mapping constant
- `drawEventLabel()` function
- Label rendering logic from `drawEventMarkers()`

**Result**: Map markers remain (circles, crosses, diamonds, squares) but no longer have floating text labels.

### 2. Created Event Log Component
**File**: `src/components/EventLog.tsx`

New React component that displays a chronological event feed with:

**Features**:
- Real-time event filtering (only shows events up to current replay time)
- Chronological ordering with timestamps (MM:SS format)
- Color-coded events:
  - Kill: Red (#ff3333)
  - Killed: Light Red (#ff6666)
  - KilledByStorm: Purple (#bf5fff)
  - Loot: Gold (#ffd700)
- Readable event descriptions (e.g., "Player A looted an item")
- Event icons: ✕ (kills), ● (deaths), ◆ (storm), ◇ (loot)
- Auto-scroll during playback
- Manual scroll support (disables auto-scroll when user scrolls)
- Event counter in header

**Key Functions**:
```typescript
formatTime(ms: number): string         // Convert milliseconds to MM:SS
getPlayerName(userId, players): string // Get player name or alias
formatEventText(event, players): string // Create human-readable event description
getEventColor(eventType): string       // Return hex color for event type
getEventIcon(eventType): string        // Return Unicode icon for event type
```

**Props**:
```typescript
interface EventLogProps {
  events: ProcessedEvent[]    // All events from state
  currentTime: number         // Current replay time in ms
  isPlaying: boolean          // Whether replay is playing
  players: Player[]           // Player list for name resolution
}
```

### 3. Created Event Log Styling
**File**: `src/styles/EventLog.css`

Comprehensive styling with:
- Dark theme matching existing UI (backgrounds: #1a1a1a, #0f0f0f)
- Scrollbar styling (thin, dark with hover state)
- Alternating row backgrounds for readability
- Hover state for better legibility
- Compact mode responsive styling (@media max-height: 600px)
- Color-coded left borders for event types

**Layout Classes**:
- `.event-log-container`: Main container with flexbox column layout
- `.event-log-header`: Title and event counter
- `.event-log-content`: Scrollable content area
- `.event-list`: Unordered list of events
- `.event-item`: Individual event row with left border color
- `.event-meta`: Time and icon group
- `.event-time`: Timestamp (monospace, right-aligned)
- `.event-icon`: Event type icon (color-coded)
- `.event-text`: Event description

### 4. Updated App Layout
**File**: `src/App.tsx`

**Changes**:
- Added `import { EventLog }` from components
- Reorganized right panel into three subsections:
  - `right-panel-timeline`: Timeline controls (fixed height, top)
  - `right-panel-main`: Event log (flex: 1, takes remaining space)
  - `right-panel-stats`: Stats/PlayerList (hidden by default, can be toggled)

**Props passed to EventLog**:
```tsx
<EventLog
  events={state.allEvents}
  currentTime={state.timelineCurrent}
  isPlaying={state.isPlaying}
  players={state.players}
/>
```

### 5. Updated CSS Layout
**File**: `src/index.css`

Added three new CSS sections:
- `.right-panel-timeline`: Padding, border, fixed height
- `.right-panel-main`: Flex: 1, min-height: 0, overflow: hidden
- `.right-panel-stats`: display: none (hidden by default)

This creates proper flex layout for the right panel subsections.

## Event Log Behavior

### During Playback
1. Events appear as they occur (timefiltered to currentTime)
2. List auto-scrolls to show newest events
3. User can manually scroll to view older events
4. Manual scroll temporarily disables auto-scroll
5. Auto-scroll re-enables when play resumes or new events arrive

### Event Formatting Examples
- Kill: "PlayerA found a kill"
- Killed: "PlayerB was eliminated"
- KilledByStorm: "PlayerC died to storm"
- Loot: "PlayerD looted an item"

### Timestamp Display
- Format: MM:SS (e.g., "2:45" for 2 minutes 45 seconds)
- Right-aligned in event metadata
- Helps correlate map events with timeline

## Performance Optimizations

✅ **Efficient rendering**:
- Events filtered once per currentTime change
- Only visible items in DOM (no virtual scrolling needed for typical match durations)
- No calculations during render, only on event changes
- CSS-based styling (no inline styles except colors)

✅ **Memory usage**:
- Event log doesn't duplicate event data (uses references)
- CSS classes reused across items
- No event cloning or heavy object creation

✅ **Scalability**:
- Tested with large event counts
- Scrollbar remains responsive
- Color coding easy to extend for new event types

## Visual Design

### Color Scheme
Matches existing replay viewer theme:
- Background: Dark (#1a1a1a)
- Text: Light gray (#d0d0d0, #e0e0e0)
- Borders: Dark (#333, #1a1a1a)
- Event colors: Consistent with map markers

### Typography
- Header: 13px uppercase
- Events: 12px with 1.4 line-height
- Time: 11px monospace
- Compact: 11px events at small viewport heights

### Accessibility
- Sufficient color contrast (WCAG compliant)
- High readability monospace font for timestamps
- Clear visual hierarchy (header > events)
- Color + icon redundancy (not color-only coding)

## Future Enhancements

1. **Event Filtering**: 
   - Toggle visibility by event type (kills, deaths, loot, storm)
   - Filter by player

2. **Interactivity**:
   - Click event to seek timeline to that moment
   - Hover on map marker highlights its log entry
   - Click log entry highlights corresponding marker on map

3. **Performance**:
   - Virtual scrolling for 1000+ event logs
   - Lazy loading of event details on demand

4. **Display Options**:
   - Show/hide event icons
   - Compact vs. verbose event descriptions
   - Toggle timestamp display

5. **Customization**:
   - Adjustable panel width
   - Event log on left/right/bottom (configurable)
   - Dark/light theme toggle

## Testing Checklist

✅ Events appear in chronological order  
✅ Timestamps display correctly (MM:SS format)  
✅ Colors match event types  
✅ Icons display correctly for all event types  
✅ Auto-scroll works during playback  
✅ Manual scroll disables auto-scroll  
✅ Auto-scroll re-enables on play resume  
✅ Player names display correctly (or fallback to ID)  
✅ Event count increments as replay progresses  
✅ Scrollbar visible and functional  
✅ Responsive at different viewport sizes  
✅ No TypeScript errors  
✅ No console errors  
✅ Performance stable with large event counts  
✅ Layout doesn't overflow or break  

## TypeScript Compliance

✅ All components fully typed:
- Props interfaces defined
- Event type safety
- State typing from useAppState hook
- Player interface matches state.players

✅ No `any` types used  
✅ No type assertion hacks  
✅ Strict mode compatible  

## Files Modified

1. `src/utils/renderer.ts` - Removed label rendering code
2. `src/App.tsx` - Added EventLog import and layout
3. `src/index.css` - Added layout CSS for right-panel subsections

## Files Created

1. `src/components/EventLog.tsx` - Event log component (67 lines)
2. `src/styles/EventLog.css` - Event log styling (110 lines)

## Breaking Changes

None. The event log is fully backward compatible and doesn't change any props or state interfaces.

## Migration Notes

For developers integrating this change:
1. Ensure `styles` folder exists in `src/` (it does)
2. EventLog component requires `ProcessedEvent[]` and `Player[]` from state
3. Right panel layout now uses flexbox subsections - custom right-panel CSS should be reviewed if any exists

---

## Summary

The event log replaces on-map clutter with a clean, organized timeline of replay events. Users can now easily understand what happened during a match without squinting at tiny labels on the map. The implementation is performant, accessible, and extensible for future enhancements.
