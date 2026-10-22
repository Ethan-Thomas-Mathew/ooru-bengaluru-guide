import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="wrap page empty">
      <h1>This page doesn't exist</h1>
      <p className="muted">The link may be old or mistyped.</p>
      <Link className="btn btn-primary" to="/">
        Go to the home page
      </Link>
    </div>
  )
}
