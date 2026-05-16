import { useReducer, useCallback } from 'react'
import type { MatchGroup, Player, ProcessedEvent, Layers, FilterMap, FilterDate, MapId } from '../types'
import type { FileIndex } from '../utils/fileIndexer'

export interface AppState {
  // Index
  matchGroups: Map<string, MatchGroup>   // realMatchId -> group
  loadedFiles: Map<string, unknown>      // json_file path -> parsed JSON (deprecated, use fileIndex)
  fileIndex: FileIndex                   // global file index for lazy loading
  parsedCache: Map<string, unknown>      // cache for lazy-loaded parsed files

  // Filters
  filterMap:  FilterMap
  filterDate: FilterDate

  // Active match
  activeMatchId: string | null
  mapId: MapId
  players: Player[]
  allEvents: ProcessedEvent[]
  durationMs: number
  selectedPlayers: Set<string>

  // Layers
  layers: Layers

  // Timeline
  timelineCurrent: number   // ms offset from match start
  isPlaying: boolean
  playSpeed: number

  // UI
  status: string
  uploadedFolders: Set<string>  // track uploaded folders for feedback
}

export type Action =
  | { type: 'SET_INDEX'; groups: Map<string, MatchGroup> }
  | { type: 'MERGE_FILES'; files: Map<string, unknown> }
  | { type: 'SET_FILE_INDEX'; index: FileIndex }
  | { type: 'ADD_PARSED_CACHE'; key: string; data: unknown }
  | { type: 'SET_UPLOADED_FOLDERS'; folders: Set<string> }
  | { type: 'UPDATE_MAP_ID'; realMatchId: string; mapId: MapId }
  | { type: 'SET_FILTER_MAP';  value: FilterMap }
  | { type: 'SET_FILTER_DATE'; value: FilterDate }
  | { type: 'LOAD_MATCH'; matchId: string; players: Player[]; allEvents: ProcessedEvent[]; durationMs: number; mapId: MapId }
  | { type: 'TOGGLE_PLAYER';   userId: string }
  | { type: 'SELECT_ALL_PLAYERS' }
  | { type: 'DESELECT_ALL_PLAYERS' }
  | { type: 'TOGGLE_LAYER';    layer: keyof Layers }
  | { type: 'SET_TIMELINE';    ms: number }
  | { type: 'SET_PLAYING';     value: boolean }
  | { type: 'SET_PLAY_SPEED';  value: number }
  | { type: 'SET_STATUS';      value: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_INDEX':
      return { ...state, matchGroups: action.groups }

    case 'MERGE_FILES': {
      const merged = new Map([...state.loadedFiles, ...action.files])
      return { ...state, loadedFiles: merged }
    }

    case 'SET_FILE_INDEX':
      return { ...state, fileIndex: action.index }

    case 'ADD_PARSED_CACHE': {
      const cache = new Map(state.parsedCache)
      cache.set(action.key, action.data)
      return { ...state, parsedCache: cache }
    }

    case 'SET_UPLOADED_FOLDERS':
      return { ...state, uploadedFolders: action.folders }

    case 'UPDATE_MAP_ID': {
      const groups = new Map(state.matchGroups)
      const g = groups.get(action.realMatchId)
      if (g) groups.set(action.realMatchId, { ...g, mapId: action.mapId })
      return { ...state, matchGroups: groups }
    }

    case 'SET_FILTER_MAP':
      return { ...state, filterMap: action.value }

    case 'SET_FILTER_DATE':
      return { ...state, filterDate: action.value }

    case 'LOAD_MATCH':
      return {
        ...state,
        activeMatchId: action.matchId,
        players: action.players,
        allEvents: action.allEvents,
        durationMs: action.durationMs,
        mapId: action.mapId,
        selectedPlayers: new Set(action.players.map(p => p.userId)),
        timelineCurrent: action.durationMs,
        isPlaying: false,
      }

    case 'TOGGLE_PLAYER': {
      const sel = new Set(state.selectedPlayers)
      if (sel.has(action.userId)) sel.delete(action.userId)
      else sel.add(action.userId)
      return { ...state, selectedPlayers: sel }
    }

    case 'SELECT_ALL_PLAYERS':
      return { ...state, selectedPlayers: new Set(state.players.map(p => p.userId)) }

    case 'DESELECT_ALL_PLAYERS':
      return { ...state, selectedPlayers: new Set() }

    case 'TOGGLE_LAYER':
      return {
        ...state,
        layers: { ...state.layers, [action.layer]: !state.layers[action.layer] },
      }

    case 'SET_TIMELINE':
      return { ...state, timelineCurrent: Math.max(0, Math.min(state.durationMs, action.ms)) }

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.value }

    case 'SET_PLAY_SPEED':
      return { ...state, playSpeed: action.value }

    case 'SET_STATUS':
      return { ...state, status: action.value }

    default:
      return state
  }
}

const INITIAL: AppState = {
  matchGroups: new Map(),
  loadedFiles: new Map(),
  fileIndex: { byPath: new Map(), byBasename: new Map(), folders: new Set() },
  parsedCache: new Map(),
  filterMap:   'all',
  filterDate:  'all',
  activeMatchId: null,
  mapId: 'AmbroseValley',
  players: [],
  allEvents: [],
  durationMs: 0,
  selectedPlayers: new Set(),
  layers: {
    paths:   true,
    kills:   true,
    loot:    true,
    storm:   true,
    heatmap: true,
    bots:    true,
  },
  timelineCurrent: 0,
  isPlaying: false,
  playSpeed: 1,
  status: 'STANDBY',
  uploadedFolders: new Set(),
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  const filteredMatches = useCallback((): MatchGroup[] => {
    let groups = [...state.matchGroups.values()]
    if (state.filterMap !== 'all')  groups = groups.filter(g => g.mapId === state.filterMap)
    if (state.filterDate !== 'all') groups = groups.filter(g => g.folder === state.filterDate)
    // Sort: most players first
    return groups.sort((a, b) => (b.humanCount + b.botCount) - (a.humanCount + a.botCount))
  }, [state.matchGroups, state.filterMap, state.filterDate])

  return { state, dispatch, filteredMatches }
}
