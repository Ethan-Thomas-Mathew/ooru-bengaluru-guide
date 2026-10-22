// ---------------------------------------------------------------
// Legal.jsx
// Privacy policy, Terms and conditions, Cookie policy.
// All three share one layout with links between them.
//
// NOTE: This is a starting template written for an Indian website
// (Digital Personal Data Protection Act 2023, IT Act 2000).
// Get it reviewed before you launch publicly.
// ---------------------------------------------------------------

import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import { SITE } from '../site'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title)
  return (
    <div className="wrap page legal">
      <nav className="legal-nav" aria-label="Legal pages">
        <NavLink to="/privacy">Privacy policy</NavLink>
        <NavLink to="/terms">Terms and conditions</NavLink>
        <NavLink to="/cookies">Cookie policy</NavLink>
      </nav>
      <article className="legal-body">
        <h1>{title}</h1>
        <p className="muted">Last updated {SITE.legalUpdated}</p>
        {children}
      </article>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>
        {SITE.name} ("we", "us") is a city guide to Bengaluru. This policy explains what information we collect when you
        use the site, why, and what choices you have. We follow India's Digital Personal Data Protection Act, 2023 and
        the Information Technology Act, 2000.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Searches you type.</strong> These are processed in your browser to show results. We do not store them
          on a server.
        </li>
        <li>
          <strong>Your cookie choice.</strong> Saved in your browser so we don't ask again.
        </li>
        <li>
          <strong>Visit counts</strong>, only if you choose "Accept all". These tell us which pages are used, without
          identifying you.
        </li>
      </ul>
      <p>We do not ask for your name, phone number or location, and we do not sell any data.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To show search results and remember your settings.</li>
        <li>To understand which guides are useful, so we can improve them.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask us what data we hold about you, ask us to correct or erase it, and withdraw consent at any time. To
        withdraw cookie consent, use "Cookie settings" at the bottom of any page. For anything else, write to{' '}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. We reply within 30 days.
      </p>

      <h2>Links to other sites</h2>
      <p>
        Listings may link to colleges, businesses or transport operators. Their own privacy policies apply once you
        leave {SITE.name}.
      </p>

      <h2>Children</h2>
      <p>
        The site is for general audiences. We do not knowingly collect data from children under 18. If you believe a
        child has shared data with us, contact us and we will delete it.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, we will update the date at the top of this page.</p>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms and conditions">
      <p>By using {SITE.name} you agree to these terms. If you don't agree, please don't use the site.</p>

      <h2>Information on this site</h2>
      <p>
        Listings, fees, rents, timings and routes are provided for general guidance only. Prices are copied from each
        listing's source (linked on its page) on the date shown, and they change. College fees and food prices are
        approximate. Always confirm details directly with the college, business or transport operator before you make a
        decision or a payment.
      </p>

      <h2>No endorsement</h2>
      <p>
        A place appearing on {SITE.name}, or its position in a list, is not a recommendation or a guarantee of quality.
        College ranks are taken from the Government of India's NIRF 2025 rankings. Star ratings are the average of
        reviews posted by visitors to this site, not official scores.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don't copy the site's content in bulk or scrape it automatically.</li>
        <li>Don't try to break, overload or gain unauthorised access to the site.</li>
        <li>Don't use the site for anything unlawful.</li>
      </ul>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, {SITE.name} is not liable for any loss that comes from relying on information
        shown on the site, including missed transport, changed fees or closed venues.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Courts in Bengaluru, Karnataka have jurisdiction.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    </LegalLayout>
  )
}

export function CookiesPage() {
  return (
    <LegalLayout title="Cookie policy">
      <p>
        Cookies and similar browser storage are small pieces of data a website saves on your device. Here is exactly
        what {SITE.name} saves.
      </p>

      <h2>What we store</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Purpose</th>
              <th scope="col">Kept for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ooru-cookie-consent</code>
              </td>
              <td>Essential</td>
              <td>Remembers whether you chose "Essential only" or "Accept all"</td>
              <td>Until you clear your browser data</td>
            </tr>
            <tr>
              <td>Analytics (planned)</td>
              <td>Optional</td>
              <td>Counts page visits so we know which guides are used. Only set if you accept all.</td>
              <td>Up to 12 months</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Changing your choice</h2>
      <p>
        Use "Cookie settings" in the footer of any page to choose again. You can also clear cookies and site data in
        your browser settings.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    </LegalLayout>
  )
}
