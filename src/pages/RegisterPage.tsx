import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/language'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const t = useT()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError(t('register.errorMismatch'))
      return
    }
    if (password.length < 6) {
      setError(t('register.errorMinLength'))
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password)

    if (error) {
      if (error.message.includes('already registered')) {
        setError(t('register.errorAlreadyRegistered'))
      } else {
        setError(t('register.errorGeneric'))
      }
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-charcoal mb-2">{t('register.successTitle')}</h2>
          <p className="text-sm font-sans text-muted">
            {t('register.successDesc')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8">
          <span className="font-sans text-2xl font-bold text-charcoal">
            FABS <span className="text-gold font-normal">Facial Analysis</span>
          </span>
        </Link>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-cream-dark">
          <h1 className="font-serif text-2xl font-semibold text-charcoal mb-2">{t('register.title')}</h1>
          <p className="text-sm font-sans text-muted mb-6">{t('register.subtitle')}</p>

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
              <label className="block text-xs font-sans font-medium text-muted mb-1.5">{t('register.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-cream-dark rounded-xl px-4 py-3 text-sm font-sans text-charcoal bg-cream focus:outline-none focus:border-charcoal/40 transition-colors"
                placeholder={t('register.passwordPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-muted mb-1.5">{t('register.confirmPassword')}</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? t('register.loading') : t('register.submit')}
            </button>
          </form>

          <p className="text-center text-sm font-sans text-muted mt-6">
            {t('register.hasAccount')}{' '}
            <Link to="/login" className="text-charcoal hover:underline font-medium">
              {t('register.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
