// Bottom of every page: legal links + data note
import { Link } from 'react-router-dom'
import { SITE } from '../site'

// Worked out once when the site loads
const YEAR = new Date().getFullYear()

export default function Footer() {
  // The cookie banner listens for this event and opens itself again
  const openCookieSettings = () => window.dispatchEvent(new Event('open-cookie-settings'))

  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div>
          <p className="footer-brand">{SITE.name}</p>
          <p className="muted small">
            Prices and timings are copied from each listing's source and change often. Check with the place itself
            before you go or pay.
          </p>
        </div>
        <ul className="footer-links">
          <li>
            <Link to="/privacy">Privacy policy</Link>
          </li>
          <li>
            <Link to="/terms">Terms and conditions</Link>
          </li>
          <li>
            <Link to="/cookies">Cookie policy</Link>
          </li>
          <li>
            <button type="button" className="link-button" onClick={openCookieSettings}>
              Cookie settings
            </button>
          </li>
        </ul>
      </div>
      <div className="wrap muted small footer-bottom">
        © {YEAR} {SITE.name}. Made in Bengaluru.
      </div>
    </footer>
  )
}
