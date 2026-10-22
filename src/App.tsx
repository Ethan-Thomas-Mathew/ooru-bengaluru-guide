// ---------------------------------------------------------------
// App.tsx
// The frame of every page: header on top, the current page in the
// middle, footer + cookie banner at the bottom.
//
// Speed: only the home page is in the first download. Every other page
// is "lazy": its code downloads the first time someone opens it.
// That keeps the first load small and fast.
// ---------------------------------------------------------------

import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import CookieBanner from './components/CookieBanner'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import { fadeInPage } from './lib/motion'

// lazy(() => import(...)) = "load this page's code only when needed"
const Results = lazy(() => import('./pages/Results'))
const Detail = lazy(() => import('./pages/Detail'))
const Saved = lazy(() => import('./pages/Saved'))
const Planner = lazy(() => import('./pages/Planner'))
const Transit = lazy(() => import('./pages/Transit'))
const MoveIn = lazy(() => import('./pages/MoveIn'))
const Newcomer = lazy(() => import('./pages/Newcomer'))
const Admin = lazy(() => import('./pages/Admin'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PrivacyPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.TermsPage })))
const CookiesPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.CookiesPage })))

// Shown for the split second while a page's code downloads
function PageLoading() {
  return (
    <div className="wrap page" aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
    </div>
  )
}

export default function App() {
  const location = useLocation()

  // Every time the page (URL path) changes: scroll to top + quick fade in
  useEffect(() => {
    window.scrollTo(0, 0)
    fadeInPage('main')
  }, [location.pathname])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        {/* key: a crash on one page doesn't stick when you go to another */}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Results />} />
              <Route path="/explore/:categoryId" element={<Results />} />
              <Route path="/place/:categoryId/:id" element={<Detail />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/plan" element={<Planner />} />
              <Route path="/move-in" element={<MoveIn />} />
              <Route path="/move-in/:collegeId" element={<MoveIn />} />
              <Route path="/newcomer" element={<Newcomer />} />
              <Route path="/getting-around" element={<Transit />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/cookies" element={<CookiesPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <CookieBanner />
    </>
  )
}
