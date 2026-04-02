import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/language'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const t = useT()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(t('login.error'))
    } else {
      navigate('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="block text-center mb-8">
          <span className="font-sans text-2xl font-bold text-charcoal">
            FABS <span className="text-gold font-normal">Facial Analysis</span>
          </span>
        </Link>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-cream-dark">
          <h1 className="font-serif text-2xl font-semibold text-charcoal mb-6">{t('login.title')}</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-sans font-medium text-muted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-cream-dark rounded-xl px-4 py-3 text-sm font-sans text-charcoal bg-cream focus:outline-none focus:border-charcoal/40 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-muted mb-1.5">{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-cream-dark rounded-xl px-4 py-3 text-sm font-sans text-charcoal bg-cream focus:outline-none focus:border-charcoal/40 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs font-sans text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('login.loading') : t('login.submit')}
            </button>
          </form>

          <p className="text-center text-sm font-sans text-muted mt-6">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="text-charcoal hover:underline font-medium">
              {t('login.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
