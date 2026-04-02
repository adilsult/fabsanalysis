import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/landing/HeroSection'
import WhySection from '../components/landing/WhySection'
import HowItWorksSection from '../components/landing/HowItWorksSection'
import FeaturesSection from '../components/landing/FeaturesSection'
import PricingSection from '../components/landing/PricingSection'
import FaqSection from '../components/landing/FaqSection'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      <main>
        <HeroSection />
        <WhySection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  )
}
