// ---------------------------------------------------------------
// motion.js
// All anime.js animations live here, so components stay simple.
// anime.js v4 docs: https://animejs.com/documentation
//
// Why it feels smooth:
//   - Spring easing (createSpring): motion settles like a real object
//     instead of stopping dead. Springs are anime.js v4 only.
//   - waapi.animate: runs on the browser's compositor thread (the GPU),
//     so it stays smooth even when the page is busy.
//   - We only animate transform + opacity (cheap for the browser).
//
// Features unique to anime.js v4 used here:
//   splitText      -> headline letters rise one by one
//   createMotionPath -> little trains run along the metro lines
//   createDrawable -> the metro lines draw themselves
//   createLayout   -> lists glide to their new order (FLIP)
//   scrambleText   -> search examples "decode" letter by letter
// ---------------------------------------------------------------

import { useLayoutEffect, useRef, type DependencyList } from 'react'
import {
  animate,
  stagger,
  createTimeline,
  createSpring,
  createLayout,
  splitText,
  scrambleText,
  svg,
  waapi,
  utils,
  type AutoLayout,
  type JSAnimation,
} from 'animejs'

// Some people turn on "reduce motion" in their OS settings
// (motion can make them dizzy). We respect that and skip animations.
export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Two springs used across the site. Lower damping = more bounce.
const softSpring = createSpring({ stiffness: 120, damping: 16 }) // calm settle
const popSpring = createSpring({ stiffness: 300, damping: 12 }) // quick bounce

// ---- Page + list entrances ---------------------------------------

// Quick fade when you navigate (runs on the GPU via WAAPI)
export function fadeInPage(selector: string): void {
  if (reduceMotion()) return
  waapi.animate(selector, { opacity: [0, 1], translate: ['0 8px', '0 0'], duration: 320, ease: 'out(3)' })
}

// Cards rise in one after another on first load of a list
export function revealList(selector: string): void {
  if (reduceMotion()) return
  waapi.animate(selector, {
    opacity: [0, 1],
    translate: ['0 14px', '0 0'],
    delay: stagger(30, { start: 60 }),
    duration: 520,
    ease: 'out(4)',
  })
}

// ---- FLIP lists with createLayout ----------------------------------
// "FLIP" = First, Last, Invert, Play: remember where every card was,
// let React re-render, then animate each card from its OLD spot to its
// NEW spot. Cards that are new fade + rise in.
//
// How to use in a component:
//   const { ref, record } = useFlip('.result-card', [items])
//   <ul ref={ref}> ...
//   call record() right BEFORE changing state (filters, order...)
export function useFlip<T extends HTMLElement = HTMLUListElement>(childSelector: string, deps: DependencyList) {
  const ref = useRef<T>(null)
  const layoutRef = useRef<AutoLayout | null>(null)
  const recorded = useRef(false)

  // useLayoutEffect runs after React updates the page but before the
  // browser paints it, so there's no flicker.
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || reduceMotion()) return
    // (Re)create the layout helper if the list element changed
    if (!layoutRef.current || layoutRef.current.root !== root) {
      layoutRef.current = createLayout(root, {
        children: childSelector,
        duration: 520,
        ease: 'out(4)',
        enterFrom: { opacity: 0, transform: 'translateY(16px) scale(0.98)' },
      })
    }
    if (recorded.current) {
      layoutRef.current.animate()
      recorded.current = false
    }
    // deps are passed in by the caller on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return {
    ref,
    record() {
      if (layoutRef.current && !reduceMotion()) {
        layoutRef.current.record()
        recorded.current = true
      }
    },
  }
}

// ---- Hero ----------------------------------------------------------

// Headline letters rise up one by one with a spring
export function riseHeadline(el: HTMLElement | null): () => void {
  if (!el || reduceMotion()) return () => {}
  // splitText wraps each word and letter in its own <span>.
  // accessible: screen readers still read the normal sentence.
  const split = splitText(el, { words: { wrap: 'clip' }, chars: true, accessible: true })
  animate(split.chars, {
    translateY: ['110%', '0%'],
    opacity: [0, 1],
    delay: stagger(22),
    ease: softSpring,
  })
  return () => split.revert() // undo the <span>s if the component unmounts
}

// THE signature moment: the metro lines draw themselves, stations pop
// in, labels appear, then small trains start running along the lines.
export function drawMetroMap(root: SVGSVGElement | null): () => void {
  if (!root || reduceMotion()) return () => {}
  const lines = root.querySelectorAll('.metro-line')
  const stops = root.querySelectorAll('.metro-stop')
  const labels = root.querySelectorAll('.metro-label')
  const trains = root.querySelectorAll<SVGElement>('.metro-train')

  utils.set(trains, { opacity: 0 })
  const running: JSAnimation[] = []

  const tl = createTimeline({ defaults: { ease: 'inOut(3)' } })
  tl.add(svg.createDrawable(lines), { draw: ['0 0', '0 1'], duration: 1500, delay: stagger(200) }, 300)
    .add(stops, { scale: [0, 1], opacity: [0, 1], ease: popSpring, delay: stagger(45) }, '-=600')
    .add(labels, { opacity: [0, 1], translateY: [6, 0], duration: 450, delay: stagger(35) }, '-=500')
    .call(() => {
      // Each train follows its own line path, back and forth, forever
      trains.forEach((train, i) => {
        const path = root.querySelector<SVGPathElement>(`#${train.dataset.path}`)
        if (!path) return
        utils.set(train, { opacity: 1 })
        running.push(
          animate(train, {
            ...svg.createMotionPath(path), // gives translateX, translateY and rotate along the path
            duration: 9000 + i * 1800,
            ease: 'inOut(2)', // trains slow down at each end like at a terminus
            loop: true,
            alternate: true,
          }),
        )
      })
    })

  // Cleanup: stop everything if the component unmounts
  return () => {
    tl.pause()
    running.forEach((a) => a.pause())
  }
}

// ---- Small interactions ----------------------------------------------

// Rotating search examples "decode" into the next example
export function swapText(el: HTMLElement | null, newText: string): void {
  if (!el) return
  if (reduceMotion()) {
    el.textContent = newText
    return
  }
  animate(el, {
    innerHTML: scrambleText({ text: newText, chars: 'lowercase', revealRate: 90, settleDuration: 220 }),
  })
}

// Quick springy bounce on a button (save, add to plan)
export function pop(el: HTMLElement | null): void {
  if (!el || reduceMotion()) return
  animate(el, { scale: [0.8, 1], ease: popSpring })
}

// Count a number up or down smoothly, e.g. the plan's total time.
// format turns the number into text ("6 h 40 min").
export function countTo(el: HTMLElement | null, from: number, to: number, format: (n: number) => string): void {
  if (!el) return
  if (reduceMotion() || from === to) {
    el.textContent = format(to)
    return
  }
  const state = { value: from }
  animate(state, {
    value: to,
    duration: 700,
    ease: 'out(3)',
    onUpdate: () => {
      el.textContent = format(Math.round(state.value))
    },
  })
}

// Grow the coloured legs of a route from the top (metro route, day plan)
export function drawRouteLegs(selector: string): void {
  if (!document.querySelector(selector)) return
  if (reduceMotion()) return
  waapi.animate(selector, {
    scale: ['1 0', '1 1'],
    duration: 600,
    delay: stagger(140),
    ease: 'out(3)',
  })
}

// Slide the cookie banner up from the bottom
export function slideUp(el: HTMLElement | null): void {
  if (!el || reduceMotion()) return
  animate(el, { translateY: ['120%', '0%'], opacity: [0, 1], ease: softSpring, delay: 900 })
}
