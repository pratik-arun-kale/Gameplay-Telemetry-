import React, { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  onFiles: (files: FileList | File[]) => void
  status?: string
}

async function readEntry(entry: any): Promise<File[]> {
  if (!entry) return []

  if (entry.isFile) {
    return new Promise(resolve => {
      entry.file((file: File) => resolve([file]))
    })
  }

  if (entry.isDirectory) {
    return new Promise((resolve) => {
      const reader = entry.createReader()
      let files: File[] = []

      const readBatch = () => {
        reader.readEntries(async (entries: any[]) => {
          if (!entries.length) {
            resolve(files)
            return
          }

          const nested = await Promise.all(entries.map(readEntry))
          files = files.concat(...nested)
          readBatch()
        })
      }

      readBatch()
    })
  }

  return []
}

export function UploadZone({ onFiles, status }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [])

  // Watch status to determine loading state
  useEffect(() => {
    if (status?.includes('INDEXING') || status?.includes('LOADING')) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [status])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)

    const fileList = e.dataTransfer.files
    if (fileList && fileList.length) {
      onFiles(fileList)
      return
    }

    const items = Array.from(e.dataTransfer.items || [])
    if (!items.length) return

    const nestedFiles = await Promise.all(items.map(async (item) => {
      const entry = (item as any).webkitGetAsEntry?.() ?? (item as any).getAsEntry?.()
      if (entry) return readEntry(entry)
      const file = item.getAsFile?.()
      return file ? [file] : []
    }))

    const files = nestedFiles.flat().filter(Boolean)
    if (files.length) onFiles(files)
  }, [onFiles])

  return (
    <div
      className={`upload-zone ${drag ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
      onClick={() => !isLoading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); !isLoading && setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="up-icon">{isLoading ? '⟳' : '⬆'}</div>
      <div className="up-text">
        <strong>{isLoading ? 'Processing...' : 'Drop Dataset'}</strong>
        <span>
          {isLoading 
            ? status || 'Indexing files...'
            : 'Entire root folder or individual date folders (February_10, etc.)'}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".json"
        disabled={isLoading}
        style={{ display: 'none' }}
        onChange={e => {
          e.target.files && onFiles(e.target.files)
          e.target.value = ''  // Reset so same folder can be uploaded again
        }}
      />
    </div>
  )
}
