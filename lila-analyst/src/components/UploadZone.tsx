import React, { useRef, useState, useCallback } from 'react'

interface Props {
  onFiles: (files: FileList | File[]) => void
}

export function UploadZone({ onFiles }: Props) {
  const inputRef   = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
  }, [onFiles])

  return (
    <div
      className={`upload-zone ${drag ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="up-icon">⬆</div>
      <div className="up-text">
        <strong>Drop JSON files here</strong>
        <span>matches.json + player JSONs</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".json"
        style={{ display: 'none' }}
        onChange={e => e.target.files && onFiles(e.target.files)}
      />
    </div>
  )
}
