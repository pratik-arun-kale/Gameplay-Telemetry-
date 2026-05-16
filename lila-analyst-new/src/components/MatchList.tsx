import React from 'react'
import type { MatchGroup, FilterMap, FilterDate } from '../types'

interface Props {
  matches: MatchGroup[]
  activeMatchId: string | null
  filterMap:    FilterMap
  filterDate:   FilterDate
  onSelectMatch: (id: string) => void
  onFilterMap:   (v: FilterMap) => void
  onFilterDate:  (v: FilterDate) => void
  totalCount: number
}

const MAP_SHORT: Record<string, string> = {
  AmbroseValley: 'AMBROSE',
  GrandRift:     'GRAND RIFT',
  Lockdown:      'LOCKDOWN',
}
const MAP_CLASS: Record<string, string> = {
  AmbroseValley: 'badge-ambrose',
  GrandRift:     'badge-grand',
  Lockdown:      'badge-lock',
}

export function MatchList({
  matches, activeMatchId,
  filterMap, filterDate,
  onSelectMatch, onFilterMap, onFilterDate,
  totalCount,
}: Props) {
  return (
    <div className="match-list-panel">
      {/* Filters */}
      <div className="panel-section">
        <div className="panel-title">// Filters</div>
        <div className="filter-group">
          <label className="filter-label">Map</label>
          <select value={filterMap} onChange={e => onFilterMap(e.target.value as FilterMap)}>
            <option value="all">All Maps</option>
            <option value="AmbroseValley">Ambrose Valley</option>
            <option value="GrandRift">Grand Rift</option>
            <option value="Lockdown">Lockdown</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Date</label>
          <select value={filterDate} onChange={e => onFilterDate(e.target.value as FilterDate)}>
            <option value="all">All Dates</option>
            <option value="February_10">Feb 10</option>
            <option value="February_11">Feb 11</option>
            <option value="February_12">Feb 12</option>
            <option value="February_13">Feb 13</option>
            <option value="February_14">Feb 14</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="panel-title match-list-header">
        // Match Select <span className="dim">({matches.length}/{totalCount})</span>
      </div>
      <div className="match-scroll">
        {matches.length === 0 ? (
          <div className="no-data">No matches — load matches.json</div>
        ) : (
          matches.map(g => (
            <div
              key={g.realMatchId}
              className={`match-item ${g.realMatchId === activeMatchId ? 'active' : ''}`}
              onClick={() => onSelectMatch(g.realMatchId)}
            >
              <div className="match-id">{g.realMatchId.substring(0, 8)}…</div>
              <div className="match-meta">
                <span className={`badge ${MAP_CLASS[g.mapId] || 'badge-ambrose'}`}>
                  {MAP_SHORT[g.mapId] || g.mapId}
                </span>
                <span className="match-counts">
                  👤{g.humanCount} 🤖{g.botCount}
                </span>
                <span className="match-folder dim">{g.folder.replace('February_', 'F')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
