// ---------------------------------------------------------------
// MetroMap.jsx
// A simplified drawing of the three running Namma Metro lines.
// Not to scale. On page load, anime.js draws the lines in.
// ---------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { drawMetroMap } from '../lib/motion'

// Where to put the label text relative to the dot
const OFFSET: Record<string, [number, number, 'start' | 'middle' | 'end']> = {
  right: [12, 5, 'start'],
  left: [-12, 5, 'end'],
  above: [0, -12, 'middle'],
  below: [6, 22, 'start'],
  'above-left': [-6, -14, 'end'],
  'below-left': [-10, 26, 'end'],
}

// [x, y, label, labelSide, isInterchange]
const STOPS: [number, number, string, string, boolean?][] = [
  [60, 30, 'Madavara', 'right'],
  [20, 300, 'Challaghatta', 'below'],
  [190, 190, 'Majestic', 'below-left', true],
  [250, 190, 'MG Road', 'above'],
  [390, 130, 'Whitefield', 'above-left'],
  [190, 270, 'RV Road', 'left', true],
  [270, 290, 'Silk Board', 'right'],
  [150, 380, 'Silk Institute', 'left'],
  [320, 380, 'Bommasandra', 'left'],
]

export default function MetroMap() {
  const ref = useRef<SVGSVGElement>(null)

  // Run the drawing animation once, after the SVG is on screen.
  // drawMetroMap returns a cleanup function that stops the trains.
  useEffect(() => drawMetroMap(ref.current), [])

  return (
    <figure className="metro-map">
      <svg ref={ref} viewBox="0 0 410 400" role="img" aria-labelledby="metro-title">
        <title id="metro-title">Simplified map of Namma Metro's Purple, Green and Yellow lines</title>
        {/* Green: Madavara (north) to Silk Institute (south) */}
        <path
          id="line-green"
          className="metro-line"
          stroke="var(--green)"
          d="M60 30 L190 160 L190 280 L150 320 L150 380"
        />
        {/* Purple: Challaghatta (west) to Whitefield (east) */}
        <path
          id="line-purple"
          className="metro-line"
          stroke="var(--purple)"
          d="M20 300 L130 190 L280 190 L340 130 L390 130"
        />
        {/* Yellow: RV Road to Bommasandra (south-east) */}
        <path
          id="line-yellow"
          className="metro-line"
          stroke="var(--yellow)"
          d="M190 270 L250 270 L280 300 L280 340 L320 380"
        />

        {STOPS.map(([x, y, label, side, interchange]) => {
          const [dx, dy, anchor] = OFFSET[side]
          return (
            <g key={label}>
              <circle
                className="metro-stop"
                cx={x}
                cy={y}
                r={interchange ? 8 : 5.5}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
              <text className="metro-label" x={x + dx} y={y + dy} textAnchor={anchor}>
                {label}
              </text>
            </g>
          )
        })}

        {/* Trains: drawn at (0,0); anime.js moves them along each line */}
        {[
          ['line-purple', 'var(--purple)'],
          ['line-green', 'var(--green)'],
          ['line-yellow', 'var(--yellow)'],
        ].map(([path, color]) => (
          <rect
            key={path}
            className="metro-train"
            data-path={path}
            x="-11"
            y="-5"
            width="22"
            height="10"
            rx="4"
            fill={color}
          />
        ))}
      </svg>
      <figcaption className="muted small">
        Namma Metro, simplified. Pink and Blue lines are still under construction.
      </figcaption>
    </figure>
  )
}
