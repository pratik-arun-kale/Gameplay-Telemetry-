import { useCallback } from 'react'
import type { MatchInfo, PlayerFile } from '../types'
import { buildMatchGroups, mergeMatchFiles } from '../utils/dataLoader'
import { parseRealMatchId, isHuman } from '../utils/mapUtils'
import type { AppState, Action } from './useAppState'

type Dispatch = (action: Action) => void

export function useFileLoader(state: AppState, dispatch: Dispatch) {

  const loadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    dispatch({ type: 'SET_STATUS', value: `LOADING ${arr.length} FILE${arr.length !== 1 ? 'S' : ''}…` })

    let matchIndex: MatchInfo[] | null = null
    const playerFiles = new Map<string, unknown>()

    for (const file of arr) {
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)

        if (
          file.name === 'matches.json' ||
          (Array.isArray(parsed) && parsed.length > 0 && 'json_file' in parsed[0])
        ) {
          matchIndex = parsed as MatchInfo[]
        } else if (parsed && typeof parsed === 'object' && 'match_info' in parsed && 'events' in parsed) {
          // Index by multiple keys so look-ups succeed regardless of path format
          const pf = parsed as PlayerFile
          const basename = file.name
          playerFiles.set(basename, pf)
          // Also key by the json_file path stored in match_info
          if (pf.match_info?.json_file) {
            playerFiles.set(pf.match_info.json_file, pf)
            playerFiles.set(pf.match_info.json_file.split('/').pop()!, pf)
          }
        }
      } catch {
        console.warn('Failed to parse', file.name)
      }
    }

    if (playerFiles.size > 0) {
      dispatch({ type: 'MERGE_FILES', files: playerFiles })
    }

    if (matchIndex) {
      const groups = buildMatchGroups(matchIndex)

      // Annotate mapId from any already-loaded player files
      for (const [realId, group] of groups) {
        for (const fp of group.filePaths) {
          const data = playerFiles.get(fp) ?? playerFiles.get(fp.split('/').pop()!) as PlayerFile | undefined
          if (data && (data as PlayerFile).events?.length) {
            group.mapId = (data as PlayerFile).events[0].map_id
            break
          }
        }
      }

      dispatch({ type: 'SET_INDEX', groups })
    }

    dispatch({ type: 'SET_STATUS', value: 'READY' })
  }, [dispatch])

  // ── Load and activate a match ─────────────────────────────────────────────

  const loadMatch = useCallback(async (realMatchId: string) => {
    const group = state.matchGroups.get(realMatchId)
    if (!group) return

    dispatch({ type: 'SET_STATUS', value: 'LOADING MATCH…' })

    const playerFileDatas: PlayerFile[] = []

    for (const fp of group.filePaths) {
      // Try multiple key variants
      const basename = fp.split('/').pop()!
      const data = (state.loadedFiles.get(fp) ??
                    state.loadedFiles.get(basename) ??
                    state.loadedFiles.get(fp.replace('/', '\\'))) as PlayerFile | undefined

      if (data?.events?.length) {
        playerFileDatas.push(data)
      }
    }

    if (!playerFileDatas.length) {
      dispatch({ type: 'SET_STATUS', value: 'NO DATA — LOAD PLAYER JSON FILES' })
      return
    }

    const { mapId, players, allEvents, durationMs } = mergeMatchFiles(playerFileDatas)

    // Update mapId in group index
    dispatch({ type: 'UPDATE_MAP_ID', realMatchId, mapId })

    dispatch({
      type: 'LOAD_MATCH',
      matchId: realMatchId,
      players,
      allEvents,
      durationMs,
      mapId,
    })

    dispatch({ type: 'SET_STATUS', value: 'MATCH LOADED' })
  }, [state.matchGroups, state.loadedFiles, dispatch])

  return { loadFiles, loadMatch }
}
