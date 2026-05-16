import React from 'react'
import { useAppState } from './hooks/useAppState'
import { useFileLoader } from './hooks/useFileLoader'
import { usePlayback } from './hooks/usePlayback'

import { Header }       from './components/Header'
import { UploadZone }   from './components/UploadZone'
import { LayerToggles } from './components/LayerToggles'
import { MatchList }    from './components/MatchList'
import { MapCanvas }    from './components/MapCanvas'
import { Timeline }     from './components/Timeline'
import { StatsPanel, PlayerList } from './components/StatsPanel'
import { EventLog }     from './components/EventLog'

import type { FilterMap, FilterDate, Layers, MapId } from './types'

const MAP_DISPLAY: Record<MapId, string> = {
  AmbroseValley: 'AMBROSE',
  GrandRift:     'GRAND RIFT',
  Lockdown:      'LOCKDOWN',
}

export default function App() {
  const { state, dispatch, filteredMatches } = useAppState()
  const { loadFiles, loadMatch }             = useFileLoader(state, dispatch)

  const { play, pause, rewind, seek } = usePlayback(
    state.isPlaying,
    state.timelineCurrent,
    state.durationMs,
    state.playSpeed,
    dispatch
  )

  // Debug: Log state changes for event log
  React.useEffect(() => {
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

  const filtered = filteredMatches()

  // Unique human player count across loaded files
  const humanSet = new Set(
    state.allEvents.filter(e => !e.isBot).map(e => e.userId)
  )

  return (
    <div className="app">
      <Header
        matchCount={state.matchGroups.size}
        playerCount={humanSet.size}
        eventCount={state.allEvents.length}
        activeMap={state.activeMatchId && state.mapId ? MAP_DISPLAY[state.mapId] || state.mapId : '—'}
        status={state.status}
      />

      <div className="app-body">
        {/* ── LEFT PANEL ── */}
        <aside className="left-panel">
          <div className="panel-section">
            <div className="panel-title">// Data Input</div>
            <UploadZone onFiles={(f: File[]) => loadFiles(f)} />
          </div>

          <LayerToggles
            layers={state.layers}
            onToggle={(layer: keyof Layers) => dispatch({ type: 'TOGGLE_LAYER', layer })}
          />

          <MatchList
            matches={filtered}
            activeMatchId={state.activeMatchId}
            filterMap={state.filterMap}
            filterDate={state.filterDate}
            onSelectMatch={loadMatch}
            onFilterMap={(v: FilterMap) => dispatch({ type: 'SET_FILTER_MAP', value: v })}
            onFilterDate={(v: FilterDate) => dispatch({ type: 'SET_FILTER_DATE', value: v })}
            totalCount={state.matchGroups.size}
          />
        </aside>

        {/* ── CENTER MAP ── */}
        <MapCanvas
          mapId={state.mapId}
          players={state.players}
          allEvents={state.allEvents}
          selectedPlayers={state.selectedPlayers}
          cutoffRel={state.timelineCurrent}
          layers={state.layers}
          hasMatch={!!state.activeMatchId}
          isLoading={state.isLoadingMatch}
        />

        {/* ── RIGHT PANEL ── */}
        <aside className="right-panel">
          <div className="right-panel-timeline">
            <Timeline
              current={state.timelineCurrent}
              duration={state.durationMs}
              isPlaying={state.isPlaying}
              playSpeed={state.playSpeed}
              onSeek={seek}
              onPlay={play}
              onPause={pause}
              onRewind={rewind}
              onSpeedChange={(v: number) => dispatch({ type: 'SET_PLAY_SPEED', value: v })}
            />
          </div>

          <div className="right-panel-main">
            <EventLog
              events={state.allEvents}
              currentTime={state.timelineCurrent}
              isPlaying={state.isPlaying}
              players={state.players}
            />
          </div>

          <div className="right-panel-stats">
            <StatsPanel
              players={state.players}
              allEvents={state.allEvents}
              cutoffRel={state.timelineCurrent}
            />

            <PlayerList
              players={state.players}
              selectedPlayers={state.selectedPlayers}
              onToggle={(uid: string) => dispatch({ type: 'TOGGLE_PLAYER', userId: uid })}
              onSelectAll={() => dispatch({ type: 'SELECT_ALL_PLAYERS' })}
              onDeselectAll={() => dispatch({ type: 'DESELECT_ALL_PLAYERS' })}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
