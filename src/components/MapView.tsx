// ---------------------------------------------------------------
// MapView.tsx
// A real, zoomable map using Leaflet + OpenStreetMap (free, no API key).
//
// Pages load this file lazily, so the map library (~150 KB) is only
// downloaded when a map is actually on screen.
//
// Pins show the AREA a place is in (nudged apart so they don't stack),
// not its exact street address.
// ---------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { METRO_LINES, STATION_COORDS } from '../lib/transit'

export interface MapPoint {
  lat: number
  lng: number
  label: string
  sub?: string
  /** Where clicking the popup link goes, e.g. /place/food/f-mtr */
  href?: string
  /** Pin colour (CSS colour) */
  color?: string
  /** Show a number in the pin (day planner stops) */
  number?: number
}

interface Props {
  points: MapPoint[]
  /** Join the points with a line, in order (day planner route) */
  route?: boolean
  /** Draw the Namma Metro lines underneath */
  showMetro?: boolean
  height?: number
  label: string
}

const BENGALURU: L.LatLngTuple = [12.9716, 77.5946]

// Turn text into safe HTML (place names go inside popup HTML)
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export default function MapView({ points, route = false, showMetro = false, height = 380, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const navigate = useNavigate()

  // 1. Create the map once
  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, {
      center: BENGALURU,
      zoom: 11,
      scrollWheelZoom: false, // so scrolling the page doesn't zoom the map by accident
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    if (showMetro) {
      for (const line of METRO_LINES) {
        const coords = line.stations.map((s) => STATION_COORDS[s]).filter(Boolean)
        L.polyline(
          coords.map((c) => [c.lat, c.lng] as L.LatLngTuple),
          { color: line.color, weight: 4, opacity: 0.55 },
        ).addTo(map)
      }
    }

    // Links inside popups: use React Router instead of a full page reload
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[data-route]')
      if (link) {
        e.preventDefault()
        navigate(link.getAttribute('data-route')!)
      }
    }
    const el = containerRef.current
    el.addEventListener('click', onClick)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      el.removeEventListener('click', onClick)
      map.remove()
      mapRef.current = null
    }
  }, [showMetro, navigate])

  // 2. Redraw the pins whenever the points change
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    for (const p of points) {
      const icon = L.divIcon({
        className: 'map-pin-wrap',
        html: `<span class="map-pin" style="--pin:${p.color ?? 'var(--jacaranda)'}">${p.number ?? ''}</span>`,
        iconSize: p.number ? [28, 28] : [16, 16],
        iconAnchor: p.number ? [14, 14] : [8, 8],
      })
      const popup =
        `<strong>${escapeHtml(p.label)}</strong>` +
        (p.sub ? `<br><span>${escapeHtml(p.sub)}</span>` : '') +
        (p.href ? `<br><a href="${p.href}" data-route="${p.href}">Open</a>` : '')
      L.marker([p.lat, p.lng], { icon, title: p.label, alt: p.label }).bindPopup(popup).addTo(layer)
    }

    if (route && points.length > 1) {
      L.polyline(
        points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        {
          color: '#5f3fc4',
          weight: 4,
          dashArray: '8 8',
        },
      ).addTo(layer)
    }

    // Zoom so every pin fits
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14)
    else if (points.length > 1)
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 15 })
  }, [points, route])

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map" style={{ height }} role="region" aria-label={label} />
      <p className="muted small map-note">Pins show the area, not the exact address.</p>
    </div>
  )
}
