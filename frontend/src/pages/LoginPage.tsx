import type { FormEvent } from 'react'

type Props = {
  username: string
  password: string
  loading: boolean
  error: string
  onChangeUsername: (v: string) => void
  onChangePassword: (v: string) => void
  onSubmit: (e: FormEvent) => void
}

export default function LoginPage({
  username,
  password,
  loading,
  error,
  onChangeUsername,
  onChangePassword,
  onSubmit,
}: Props) {
  return (
    <div className="container">
      <div className="card">
        <h1>MyFin</h1>

        <form onSubmit={onSubmit} autoComplete="off">
          <div className="row">
            <label className="label">Username</label>
            <input className="input" autoComplete="username" value={username} onChange={(e) => onChangeUsername(e.target.value)} />
          </div>
          <div className="row">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => onChangePassword(e.target.value)}
            />
          </div>
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {error ? <div className="error">{error}</div> : null}
      </div>
    </div>
  )
}
