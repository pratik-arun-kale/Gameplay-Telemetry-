import React, {
  useRef, useEffect, useState, useCallback
} from 'react'
import type { Player, ProcessedEvent, Layers, MapId } from '../types'
import { renderFrame } from '../utils/renderer'

import AmbroseValleyImg from '../../../minimaps/AmbroseValley_Minimap.png'
import GrandRiftImg from '../../../minimaps/GrandRift_Minimap.png'
import LockdownImg from '../../../minimaps/Lockdown_Minimap.jpg'

const MAP_ASSETS: Record<string, string> = {
  AmbroseValley: AmbroseValleyImg,
  GrandRift: GrandRiftImg,
  Lockdown: LockdownImg,
}

interface Props {
  mapId: MapId
  players: Player[]
  allEvents: ProcessedEvent[]
  selectedPlayers: Set<string>
  cutoffRel: number
  layers: Layers
  hasMatch: boolean
}

const CANVAS_SIZE = 1024

export function MapCanvas({
  mapId, players, allEvents, selectedPlayers,
  cutoffRel, layers, hasMatch,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Zoom / pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  // Tooltip
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // Map image state
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapDrag, setMapDrag] = useState(false)
  const [customMapSources, setCustomMapSources] = useState<Partial<Record<MapId, string>>>({})
  const customMapSourcesRef = useRef<Partial<Record<MapId, string>>>({})

  const mapSrc = customMapSources[mapId] ?? MAP_ASSETS[mapId] ?? ''

  const detectMapIdFromFilename = useCallback((filename: string): MapId | null => {
    const normalized = filename.toLowerCase()
    if (normalized.includes('ambrose')) return 'AmbroseValley'
    if (normalized.includes('grandrift') || normalized.includes('grand_rift') || normalized.includes('grand rift')) return 'GrandRift'
    if (normalized.includes('lockdown')) return 'Lockdown'
    return null
  }, [])

  const handleMapDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setMapDrag(true)
  }, [])

  const handleMapDragLeave = useCallback(() => {
    setMapDrag(false)
  }, [])

  const handleMapDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setMapDrag(false)

    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return

    const imageFile = files.find(file => file.type.startsWith('image/'))
    if (!imageFile) return

    const targetMap = detectMapIdFromFilename(imageFile.name) ?? mapId
    const objectUrl = URL.createObjectURL(imageFile)

    setCustomMapSources(prev => {
      const existing = prev[targetMap]
      if (existing) URL.revokeObjectURL(existing)
      return { ...prev, [targetMap]: objectUrl }
    })
  }, [detectMapIdFromFilename, mapId])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    if (mapSrc) {
      img.src = mapSrc
      img.onload = () => setMapLoaded(true)
      if (img.complete) {
        setMapLoaded(true)
      } else {
        setMapLoaded(false)
      }
    } else {
      img.src = ''
      setMapLoaded(false)
    }
  }, [mapSrc])

  useEffect(() => {
    const prevSources = customMapSourcesRef.current
    const removedUrls = Object.entries(prevSources)
      .filter(([key, url]) => customMapSources[key as MapId] !== url)
      .map(([, url]) => url)

    removedUrls.forEach(URL.revokeObjectURL)
    customMapSourcesRef.current = customMapSources

    return () => {
      Object.values(customMapSourcesRef.current).forEach(URL.revokeObjectURL)
    }
  }, [customMapSources])

  // ── Draw whenever inputs change ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderFrame(ctx, CANVAS_SIZE, allEvents, players, selectedPlayers, cutoffRel, layers)
  }, [allEvents, players, selectedPlayers, cutoffRel, layers])

  // ── Zoom ────────────────────────────────────────────────────────────────────
  const applyZoom = useCallback((delta: number) => {
    setZoom(z => Math.max(0.4, Math.min(5, z + delta)))
  }, [])

  const resetView = useCallback(() => {
    setZoom(1); setPan({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    applyZoom(e.deltaY < 0 ? 0.15 : -0.15)
  }, [applyZoom])

  // ── Pan ─────────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragging.current = true
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }, [pan])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    setPan({
      x: dragOrigin.current.px + (e.clientX - dragOrigin.current.mx) / zoom,
      y: dragOrigin.current.py + (e.clientY - dragOrigin.current.my) / zoom,
    })
  }, [zoom])

  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  // ── Tooltip on canvas hover ─────────────────────────────────────────────────
  const onCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !allEvents.length) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width)
    const my = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height)

    const nonPos = allEvents.filter(
      ev => ev.event !== 'Position' && ev.event !== 'BotPosition' && ev.tsRel <= cutoffRel
    )
    let nearest: ProcessedEvent | null = null
    let nearDist = 18
    for (const ev of nonPos) {
      const d = Math.hypot(ev.px - mx, ev.py - my)
      if (d < nearDist) { nearDist = d; nearest = ev }
    }

    if (nearest) {
      const uid = nearest.isBot ? `BOT ${nearest.userId}` : nearest.userId.substring(0, 8)
      const ms = nearest.tsRel
      const t = `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')}`
      setTooltip({ x: e.clientX + 14, y: e.clientY - 10, text: `${nearest.event} | ${uid} | ${t}` })
    } else {
      setTooltip(null)
    }
  }, [allEvents, cutoffRel])

  const transform = `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`

  return (
    <div
      className={`map-area ${mapDrag ? 'drag-over' : ''}`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDragOver={handleMapDragOver}
      onDragLeave={handleMapDragLeave}
      onDrop={handleMapDrop}
    >
      {!hasMatch && (
        <div className="empty-state">
          <div className="es-icon">⬡</div>
          <div className="es-text">
            SELECT A MATCH TO BEGIN
          </div>
        </div>
      )}

      <div
        ref={wrapRef}
        className="map-wrap"
        style={{ transform, display: hasMatch ? 'block' : 'none' }}
        onMouseDown={onMouseDown}
        onWheel={handleWheel}
      >
        {!mapLoaded && hasMatch && (
          <div className="map-placeholder">
            LOADING MAP...<br />
            <span className="dim">({mapId})</span>
          </div>
        )}
        <img
          ref={imgRef}
          className="map-img"
          alt="minimap"
          style={{ display: mapLoaded ? 'block' : 'none' }}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="overlay-canvas"
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onMouseMove={onCanvasMouseMove}
          onMouseLeave={() => setTooltip(null)}
          onDragOver={handleMapDragOver}
          onDragLeave={handleMapDragLeave}
          onDrop={handleMapDrop}
        />
        {hasMatch && (
          <div className="map-label">{mapId.toUpperCase()}</div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={() => applyZoom(0.25)}>+</button>
        <button className="zoom-btn" onClick={() => applyZoom(-0.25)}>−</button>
        <button className="zoom-btn zoom-reset" onClick={resetView}>⊙</button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
