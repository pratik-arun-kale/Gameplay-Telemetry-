import { useCallback } from 'react'
import type { MatchInfo, PlayerFile } from '../types'
import { buildMatchGroups, mergeMatchFiles } from '../utils/dataLoader'
import { parseRealMatchId, isHuman } from '../utils/mapUtils'
import type { AppState, Action } from './useAppState'
import { createFileIndex, indexFiles, findFile, getIndexStats } from '../utils/fileIndexer'

type Dispatch = (action: Action) => void

export function useFileLoader(state: AppState, dispatch: Dispatch) {

  const loadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    dispatch({ type: 'SET_STATUS', value: `INDEXING ${arr.length} FILE${arr.length !== 1 ? 'S' : ''}…` })

    let matchIndex: MatchInfo[] | null = null
    const jsonFiles: File[] = []
    const folderSet = new Set<string>()

    // First pass: separate matches.json from data files
    for (const file of arr) {
      try {
        // Extract folder from webkitRelativePath if available
        const webkitPath = (file as any).webkitRelativePath || ''
        const pathParts = webkitPath.split('/')
        if (pathParts.length > 1 && pathParts[0]) {
          folderSet.add(pathParts[0])
        }

        if (file.name === 'matches.json' || file.name.endsWith('.json')) {
          const text = await file.text()
          const parsed = JSON.parse(text)

          // Check if this is matches.json (array of MatchInfo)
          if (
            file.name === 'matches.json' ||
            (Array.isArray(parsed) && parsed.length > 0 && 'json_file' in parsed[0])
          ) {
            matchIndex = parsed as MatchInfo[]
          } else if (parsed && typeof parsed === 'object' && 'match_info' in parsed && 'events' in parsed) {
            // This is a player file - don't parse yet, just collect it
            jsonFiles.push(file)
          }
        }
      } catch (e) {
        console.warn(`Failed to parse ${file.name}:`, e)
      }
    }

    // Build file index (no parsing of data yet)
    const fileIndex = createFileIndex()
    indexFiles(fileIndex, jsonFiles)
    dispatch({ type: 'SET_FILE_INDEX', index: fileIndex })
    dispatch({ type: 'SET_UPLOADED_FOLDERS', folders: folderSet })

    const stats = getIndexStats(fileIndex)
    console.log('Indexed files:', stats)

    // Process matches.json only once
    if (matchIndex) {
      const groups = buildMatchGroups(matchIndex)
      dispatch({ type: 'SET_INDEX', groups })
      dispatch({ type: 'SET_STATUS', value: `READY — ${stats.totalFiles} FILES INDEXED FROM ${stats.folders.length} FOLDER${stats.folders.length !== 1 ? 'S' : ''}` })
    } else if (jsonFiles.length > 0) {
      dispatch({ type: 'SET_STATUS', value: `⚠ NO MATCHES.JSON FOUND — ${stats.totalFiles} FILES INDEXED` })
    } else {
      dispatch({ type: 'SET_STATUS', value: '⚠ NO JSON FILES FOUND' })
    }
  }, [dispatch])

  // ── Load and activate a match (lazy load only needed files) ─────────────────

  const loadMatch = useCallback(async (realMatchId: string) => {
    const group = state.matchGroups.get(realMatchId)
    if (!group) return

    dispatch({ type: 'SET_STATUS', value: 'LOADING MATCH…' })

    const playerFileDatas: PlayerFile[] = []
    const missingFiles: string[] = []

    // Try to load each file referenced in the match group
    for (const filePath of group.filePaths) {
      try {
        // Check cache first
        let cached = state.parsedCache.get(filePath)
        if (cached) {
          playerFileDatas.push(cached as PlayerFile)
          continue
        }

        // Try to find file in index
        const fileEntry = findFile(state.fileIndex, filePath)
        if (!fileEntry) {
          console.warn(`File not found: ${filePath}`)
          missingFiles.push(filePath)
          continue
        }

        // Lazy load: read and parse the file
        const text = await fileEntry.file.text()
        const parsed = JSON.parse(text) as PlayerFile

        if (parsed?.events?.length) {
          playerFileDatas.push(parsed)
          // Cache for future use
          dispatch({ type: 'ADD_PARSED_CACHE', key: filePath, data: parsed })
        }
      } catch (e) {
        console.error(`Error loading file ${filePath}:`, e)
        missingFiles.push(filePath)
      }
    }

    if (!playerFileDatas.length) {
      const msg = missingFiles.length > 0
        ? `⚠ MISSING ${missingFiles.length} FILE${missingFiles.length !== 1 ? 'S' : ''} — UPLOAD DATA FOR ${group.folder || 'MISSING FOLDER'}`
        : '⚠ NO DATA — UPLOAD PLAYER JSON FILES'
      dispatch({ type: 'SET_STATUS', value: msg })
      console.warn(`Missing files for match ${realMatchId}:`, missingFiles)
      return
    }

    const { mapId, players, allEvents, durationMs } = mergeMatchFiles(playerFileDatas)

    // Update mapId in group index
    dispatch({ type: 'UPDATE_MAP_ID', realMatchId, mapId })

    const statusMsg = missingFiles.length > 0
      ? `MATCH LOADED (⚠ MISSING ${missingFiles.length} FILE${missingFiles.length !== 1 ? 'S' : ''})`
      : 'MATCH LOADED'

    dispatch({
      type: 'LOAD_MATCH',
      matchId: realMatchId,
      players,
      allEvents,
      durationMs,
      mapId,
    })

    dispatch({ type: 'SET_STATUS', value: statusMsg })
  }, [state.matchGroups, state.fileIndex, state.parsedCache, dispatch])

  return { loadFiles, loadMatch }
}
