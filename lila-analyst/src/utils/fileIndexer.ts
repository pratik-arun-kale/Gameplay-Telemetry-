/**
 * FileIndexer: Global file map for lazy loading and dynamic path resolution
 * - Stores File objects indexed by path, basename, and full paths
 * - Supports dynamic lookups so match references resolve across multiple uploaded folders
 * - Allows staged uploads without requiring all files at once
 */

export interface FileEntry {
  file: File
  folder?: string       // e.g., 'February_10'
  basename: string      // filename only
  webkitPath?: string   // full path from webkitdirectory
}

export interface FileIndex {
  // Map by full path (e.g., 'February_10/uuid_uuid.json')
  byPath: Map<string, FileEntry>
  // Map by basename (e.g., 'uuid_uuid.json') - fastest lookup
  byBasename: Map<string, FileEntry[]>
  // Track all uploaded folders (e.g., Set(['February_10', 'February_11']))
  folders: Set<string>
}

export function createFileIndex(): FileIndex {
  return {
    byPath: new Map(),
    byBasename: new Map(),
    folders: new Set(),
  }
}

/**
 * Add files to the index, extracting folder and path info
 */
export function indexFiles(index: FileIndex, files: File[]): void {
  for (const file of files) {
    // Skip non-JSON files and matches.json (handled separately)
    if (!file.name.endsWith('.json')) continue
    if (file.name === 'matches.json') continue

    const webkitPath = (file as any).webkitRelativePath || ''
    const parts = webkitPath.split('/')
    const basename = file.name
    const folder = parts.length > 1 ? parts[0] : undefined

    const entry: FileEntry = {
      file,
      folder,
      basename,
      webkitPath,
    }

    // Index by multiple keys for flexible lookups
    if (webkitPath) {
      index.byPath.set(webkitPath, entry)
      // Also normalize backslashes for Windows
      index.byPath.set(webkitPath.replace(/\\/g, '/'), entry)
    }

    // Index by basename
    if (!index.byBasename.has(basename)) {
      index.byBasename.set(basename, [])
    }
    index.byBasename.get(basename)!.push(entry)

    // Track folder
    if (folder) {
      index.folders.add(folder)
    }
  }
}

/**
 * Find a file by various lookup strategies:
 * 1. Exact path match (e.g., 'February_10/uuid_uuid.json')
 * 2. Basename match (e.g., 'uuid_uuid.json')
 * 3. Partial path match
 * Returns the best match or null if not found
 */
export function findFile(index: FileIndex, lookup: string): FileEntry | null {
  // Normalize path separators
  const normalized = lookup.replace(/\\/g, '/')

  // Try exact path match first (fastest)
  if (index.byPath.has(normalized)) {
    return index.byPath.get(normalized)!
  }

  // Try basename lookup (effective for cross-folder matches)
  const basename = normalized.split('/').pop()!
  const basenameMatches = index.byBasename.get(basename)
  if (basenameMatches && basenameMatches.length > 0) {
    return basenameMatches[0]
  }

  // Try partial path match (e.g., 'uuid_uuid.json' from 'February_10/uuid_uuid.json')
  for (const [path, entry] of index.byPath) {
    if (path.endsWith(normalized) || path.endsWith(`/${normalized}`)) {
      return entry
    }
  }

  return null
}

/**
 * Get all files in a specific folder
 */
export function getFilesByFolder(index: FileIndex, folder: string): FileEntry[] {
  return Array.from(index.byPath.values()).filter(e => e.folder === folder)
}

/**
 * Get file statistics for debugging/UI
 */
export function getIndexStats(index: FileIndex): {
  totalFiles: number
  folders: string[]
  basenamesCount: number
} {
  return {
    totalFiles: index.byPath.size,
    folders: Array.from(index.folders).sort(),
    basenamesCount: index.byBasename.size,
  }
}
