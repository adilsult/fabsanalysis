import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useT } from '../../lib/language'

export default function HeroSection() {
  const navigate = useNavigate()
  const { user, hasAccess } = useAuth()
  const t = useT()

  function handleCTA() {
    if (user && hasAccess) {
      navigate('/analysis')
    } else if (user) {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const badges = [
    { icon: '🔬', text: t('hero.badge.science') },
    { icon: '🔒', text: t('hero.badge.privacy') },
    { icon: '⚡', text: t('hero.badge.speed') },
    { icon: '✨', text: t('hero.badge.params') },
    { icon: '💳', text: t('hero.badge.payment') },
  ]

  return (
    <section className="min-h-screen bg-cream flex flex-col items-center justify-center pt-16 px-6 md:px-12 lg:px-24 text-center">
      <div className="max-w-4xl mx-auto">
        {/* Headline */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-charcoal leading-tight mb-6">
          {t('hero.title')}{' '}
          <em className="italic text-gold not-italic" style={{ fontStyle: 'italic' }}>
            {t('hero.titleAccent')}
          </em>
        </h1>

        {/* Subheadline */}
        <p className="font-sans text-base md:text-lg lg:text-xl text-muted max-w-2xl mx-auto leading-relaxed mb-10">
          {t('hero.subtitle')}
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button onClick={handleCTA} className="btn-primary text-base px-8 py-4 w-full sm:w-auto">
            {user && hasAccess ? t('hero.ctaHasAccess') : t('hero.ctaNoAccess')}
          </button>
          <button
            onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-sm font-sans text-muted hover:text-charcoal transition-colors"
          >
            {t('hero.howItWorks')}
          </button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-xs font-sans text-muted">
          {badges.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-1.5">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-5 h-8 border-2 border-muted/30 rounded-full flex justify-center pt-1.5">
          <div className="w-1 h-2 bg-muted/40 rounded-full" />
        </div>
      </div>
    </section>
  )
}
