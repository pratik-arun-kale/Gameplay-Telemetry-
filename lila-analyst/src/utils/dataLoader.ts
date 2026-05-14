import type {
  MatchInfo, PlayerFile, MatchGroup, Player, ProcessedEvent, MapId
} from '../types'
import {
  parseRealMatchId, isHuman, processEvents,
  playerColor, BOT_COLOR, HUMAN_COLORS
} from './mapUtils'

// ── Build MatchGroup index from matches.json ──────────────────────────────────

export function buildMatchGroups(matchIndex: MatchInfo[]): Map<string, MatchGroup> {
  const groups = new Map<string, MatchGroup>()

  for (const entry of matchIndex) {
    const realId = parseRealMatchId(entry.source_file)
    const existing = groups.get(realId)
    const srcName = entry.source_file.replace('.nakama-0', '')
    const firstPart = srcName.split('_')[0]
    const isBot = /^\d+$/.test(firstPart)

    if (!existing) {
      groups.set(realId, {
        realMatchId: realId,
        folder: entry.folder,
        mapId: 'AmbroseValley', // default; updated when files are loaded
        filePaths: [entry.json_file],
        humanCount: isBot ? 0 : 1,
        botCount: isBot ? 1 : 0,
      })
    } else {
      existing.filePaths.push(entry.json_file)
      if (isBot) existing.botCount++
      else existing.humanCount++
    }
  }
  return groups
}

// ── Process a loaded PlayerFile into Player + events ─────────────────────────

const CANVAS_SIZE = 1024

export function processPlayerFile(
  file: PlayerFile,
  colorIndex: number
): Player {
  const raw = file.events
  if (!raw.length) {
    return { userId: '', isBot: false, color: '#fff', events: [] }
  }

  const userId = raw[0].user_id
  const isBot  = !isHuman(userId)
  const color  = playerColor(colorIndex, isBot)

  const withoutRel = processEvents(raw, CANVAS_SIZE)
  const tsMin = Math.min(...withoutRel.map(e => e.tsMs))

  const events: ProcessedEvent[] = withoutRel
    .map(e => ({ ...e, tsRel: e.tsMs - tsMin }))
    .sort((a, b) => a.tsMs - b.tsMs)

  return { userId, isBot, color, events }
}

// ── Merge multiple PlayerFiles into a single match dataset ───────────────────

export interface MatchData {
  mapId: MapId
  players: Player[]
  allEvents: ProcessedEvent[]   // merged + globally re-normalised
  durationMs: number
}

export function mergeMatchFiles(files: PlayerFile[]): MatchData {
  if (!files.length) return { mapId: 'AmbroseValley', players: [], allEvents: [], durationMs: 0 }

  let humanIdx = 0

  const players: Player[] = files
    .filter(f => f.events.length > 0)
    .map((f) => {
      const uid = f.events[0].user_id
      const isBot = !isHuman(uid)
      const idx = isBot ? -1 : humanIdx++
      return processPlayerFile(f, idx)
    })
    // sort: humans first, then bots
    .sort((a, b) => (a.isBot ? 1 : 0) - (b.isBot ? 1 : 0))

  // Reassign colors in final sorted order
  let hi = 0
  for (const p of players) {
    p.color = playerColor(p.isBot ? -1 : hi++, p.isBot)
  }

  // Global normalise: shift all events so the earliest is t=0
  const allRaw = players.flatMap(p => p.events)
  if (!allRaw.length) return { mapId: 'AmbroseValley', players, allEvents: [], durationMs: 0 }

  const globalMin = Math.min(...allRaw.map(e => e.tsMs))
  const globalMax = Math.max(...allRaw.map(e => e.tsMs))

  // Mutate tsRel on every event to be globally normalised
  for (const p of players) {
    for (const e of p.events) {
      e.tsRel = e.tsMs - globalMin
    }
  }

  const allEvents = allRaw
    .map(e => ({ ...e, tsRel: e.tsMs - globalMin }))
    .sort((a, b) => a.tsRel - b.tsRel)

  const mapId: MapId = (files[0].events[0]?.map_id as MapId) ?? 'AmbroseValley'

  return {
    mapId,
    players,
    allEvents,
    durationMs: globalMax - globalMin,
  }
}
