import { useCallback } from 'react'
import type { MatchInfo, PlayerFile } from '../types'
import { buildMatchGroups, mergeMatchFiles } from '../utils/dataLoader'
import type { AppState, Action } from './useAppState'

type Dispatch = (action: Action) => void

export function useFileLoader(state: AppState, dispatch: Dispatch) {

  const loadFiles = useCallback(async (files: File[]) => {
    dispatch({ type: 'SET_STATUS', value: `LOADING ${files.length} FILE${files.length !== 1 ? 'S' : ''}…` })

    let matchIndex: MatchInfo[] | null = null
    const playerFiles = new Map<string, unknown>()

    for (const file of files) {
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)

        // Detect matches.json: array with items containing 'json_file' key
        if (
          file.name === 'matches.json' ||
          (Array.isArray(parsed) && parsed.length > 0 && 'json_file' in parsed[0])
        ) {
          matchIndex = parsed as MatchInfo[]
          console.debug(`[FileLoader] Loaded matches.json with ${matchIndex.length} entries`)
          continue
        }

        // Detect player file: object with match_info + events
        if (parsed && typeof parsed === 'object' && 'match_info' in parsed && 'events' in parsed) {
          const pf = parsed as PlayerFile

          // Store under EVERY possible key variant so lookup always works:
          playerFiles.set(file.name, pf)

          const jf = pf.match_info?.json_file
          if (jf) {
            playerFiles.set(jf, pf)
            playerFiles.set(jf.split('/').pop()!, pf)
            playerFiles.set(jf.replace(/\//g, '\\'), pf)
          }

          const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
          if (relPath) {
            playerFiles.set(relPath, pf)
            playerFiles.set(relPath.replace(/\\/g, '/'), pf)
          }
        }
      } catch {
        console.debug(`[FileLoader] Skipped unparseable file: ${file.name}`)
      }
    }

    if (playerFiles.size > 0) {
      dispatch({ type: 'MERGE_FILES', files: playerFiles })
    }

    if (matchIndex) {
      const groups = buildMatchGroups(matchIndex)

      // DO NOT pre-detect map here — will be done when replay files are loaded
      console.debug(`[FileLoader] Built ${groups.size} match groups from matches.json`)

      dispatch({ type: 'SET_INDEX', groups })
    }

    const total = playerFiles.size
    dispatch({
      type: 'SET_STATUS',
      value: matchIndex
        ? `READY — ${groups?.size || 0} matches, ${total} player files`
        : total > 0
          ? `${total} player files loaded — now load matches.json`
          : 'matches.json loaded — now load player JSON folders',
    })
  }, [dispatch])

  // ── Activate a match with proper loading state ─────────────────────────────

  const loadMatch = useCallback(async (realMatchId: string) => {
    const group = state.matchGroups.get(realMatchId)
    if (!group) {
      console.error('[LoadMatch] Match not found:', realMatchId)
      return
    }

    // IMPORTANT: Clear previous state before loading new match
    dispatch({ type: 'START_LOADING_MATCH' })
    dispatch({ type: 'SET_STATUS', value: 'LOADING MATCH…' })

    const playerFileDatas: PlayerFile[] = []
    const missing: string[] = []

    console.debug(`[LoadMatch] Loading ${group.filePaths.length} files for match ${realMatchId.slice(0, 8)}`)

    // Sort filePaths deterministically
    const sortedPaths = [...group.filePaths].sort()

    for (const fp of sortedPaths) {
      const basename = fp.split('/').pop()!
      // Try every key variant
      const data = (
        state.loadedFiles.get(fp) ??
        state.loadedFiles.get(basename) ??
        state.loadedFiles.get(fp.replace(/\//g, '\\')) ??
        state.loadedFiles.get(fp.replace(/\\/g, '/'))
      ) as PlayerFile | undefined

      if (data?.events?.length) {
        const mapId = data.events[0]?.map_id
        console.debug(`[LoadMatch] File loaded: ${basename} (map: ${mapId}, events: ${data.events.length})`)
        playerFileDatas.push(data)
      } else {
        console.warn(`[LoadMatch] Missing file: ${fp}`)
        missing.push(basename)
      }
    }

    if (!playerFileDatas.length) {
      dispatch({
        type: 'SET_STATUS',
        value: `⚠ NO DATA FOR MATCH — load the ${group.folder} folder`,
      })
      console.error('[LoadMatch] No player files found for match', realMatchId)
      return
    }

    // Merge files and detect map
    const { mapId, players, allEvents, durationMs } = mergeMatchFiles(playerFileDatas)

    console.debug(`[LoadMatch] Map detected: ${mapId} (from ${playerFileDatas.length} files)`)

    // Update group with confirmed map (only after detection)
    if (mapId) {
      dispatch({ type: 'UPDATE_MAP_ID', realMatchId, mapId })
    } else {
      console.error('[LoadMatch] No map detected for match', realMatchId)
    }

    // Finally, dispatch fully loaded match state
    dispatch({
      type: 'LOAD_MATCH',
      matchId: realMatchId,
      players,
      allEvents,
      durationMs,
      mapId: mapId,
    })

    const statusMsg = missing.length > 0
      ? `LOADED (⚠ ${missing.length} FILES MISSING)`
      : `LOADED · ${players.filter(p => !p.isBot).length}H · ${players.filter(p => p.isBot).length}B`
    dispatch({ type: 'SET_STATUS', value: statusMsg })
  }, [state.matchGroups, state.loadedFiles, dispatch])

  return { loadFiles, loadMatch }
}

