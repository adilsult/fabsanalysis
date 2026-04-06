import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/language'

export default function SuccessPage() {
  const { refreshAccess } = useAuth()
  const t = useT()

  useEffect(() => {
    const timer = setTimeout(async () => {
      await refreshAccess()
    }, 2000)
    return () => clearTimeout(timer)
  }, [refreshAccess])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-serif text-3xl font-semibold text-charcoal mb-3">{t('success.title')}</h1>
        <p className="font-sans text-muted mb-8 leading-relaxed">
          {t('success.desc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/analysis" className="btn-primary">
            {t('success.startAnalysis')}
          </Link>
          <Link to="/dashboard" className="btn-outline">
            {t('success.dashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}
