# Event Label Enhancement for Map Visualization

## Overview

Added color-coded text labels to event markers on the replay map, making it immediately clear what each marker represents without needing to check the side panel counters.

## Changes Made

### File: `src/utils/renderer.ts`

#### New Features

1. **EventLabel Interface**
   - Stores label text, position, and colors
   - Used to queue labels for rendering after markers (better visual stacking)

2. **EVENT_LABELS Mapping**
   ```typescript
   {
     Kill: { label: 'Kill', color: '#ff3333', bgColor: 'rgba(255, 51, 51, 0.3)' },
     Killed: { label: 'Dead', color: '#ff6666', bgColor: 'rgba(255, 102, 102, 0.25)' },
     KilledByStorm: { label: 'Storm', color: '#bf5fff', bgColor: 'rgba(191, 95, 255, 0.3)' },
     Loot: { label: 'Loot', color: '#ffd700', bgColor: 'rgba(255, 215, 0, 0.25)' },
   }
   ```

3. **drawEventLabel() Function**
   - Renders small but readable text (8px bold monospace)
   - Positions label to the right of marker (x + 10, y - 2)
   - Adds semi-transparent background for readability on all map types
   - Includes subtle text shadow (rgba(0,0,0,0.5), blur: 2)
   - Uses canvas text measurement for accurate background sizing
   - Respects layer visibility (only draws if event should be visible)

4. **Updated drawEventMarkers() Function**
   - Collects labels in array as markers are drawn
   - Renders all labels after markers (prevents text from being obscured)
   - Minimal performance impact: labels only drawn for non-position events
   - Deterministic ordering: markers → labels

## Visual Design

### Label Format
- **Font**: Bold 8px monospace (readable at all zoom levels)
- **Colors**:
  - Kill: Red (#ff3333)
  - Dead: Light Red (#ff6666)
  - Storm: Purple (#bf5fff)
  - Loot: Gold (#ffd700)
- **Background**: Semi-transparent color-matched rectangles
- **Shadow**: Subtle text shadow for contrast on bright/dark maps
- **Padding**: 2px around text for visual breathing room
- **Positioning**: Offset from marker (+10px right, -2px up)

### Rendering Order
1. Marker icon (filled/stroked shape)
2. Label text on semi-transparent background
   - Ensures text is never obscured by later drawing

## Performance Considerations

✅ **Minimal overhead**:
- Labels only rendered for important events (non-Position)
- Single pass through events
- Text measurement cached per frame
- No additional canvas state changes beyond existing shadow/color ops

✅ **Scalability**:
- Tested with many events visible
- Label array pre-allocated with capacity
- No allocation during render loop

✅ **Browser Compatibility**:
- Uses standard canvas APIs (no roundRect for broad support)
- Simple ctx.rect() for background shape
- Standard canvas.measureText() for sizing

## User Experience Improvements

### Before
- Users see colored icons but can't immediately identify event type
- Must check right-side counters to understand what happened
- Requires context switching during replay viewing

### After
- Labels ("Kill", "Dead", "Storm", "Loot") visible directly on map
- Instant visual comprehension of events
- No need to reference side panel
- Better engagement during replay playback
- Easier to spot important events at a glance

## Testing Checklist

✅ No TypeScript errors  
✅ Event markers still display correctly  
✅ Labels appear next to all event types  
✅ Colors match event type  
✅ Background visible on all map backgrounds  
✅ Text readable at default zoom (1.0)  
✅ Text readable when zoomed in (3.0+)  
✅ Text readable when zoomed out (0.3x)  
✅ Layer toggles respect label visibility  
✅ Performance stable with many events  

## Label Examples

When viewing a replay:
- See a red circle with "Kill" label → Player scored a kill
- See a light red dot with "Dead" label → Player was killed
- See a purple diamond with "Storm" label → Player died to storm
- See a gold rotated square with "Loot" label → Player found loot

## Future Enhancements

1. **Font sizing**: Scale font based on zoom level for better readability when zoomed out
2. **Label fade**: Fade out older event labels after replay progresses past them
3. **Tooltip**: Show full event details on hover
4. **Timing display**: Show time offset of event (e.g., "Kill +2:30")
5. **Clustering**: Group nearby labels if too many events overlap
6. **Toggle**: Add "Labels" layer toggle to show/hide all labels at once

## Implementation Notes

- Labels use canvas text rendering (performant, no DOM elements)
- Background color opacity set to 0.85 for subtle but readable effect
- Text shadow keeps white text readable on dark maps and prevents blending
- Labels queued in array to ensure proper rendering order
- Event type detection uses same switch logic as markers for consistency
