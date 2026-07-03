import {
  HeroSection,
  StatsBar,
  EmpowerSection,
  HowItWorksSection,
  FeaturesSection,
  CoursesSection,
  ProjectsSection,
  PremiumFeaturesSection,
  SocialProofSection,
  TestimonialsSection,
  FAQSection,
  PricingSection,
} from "@/components/marketing";

export default function HomePage() {
  return (
    <>
      {/* Hero Section with Showcase Cards */}
      <HeroSection />

      {/* Vibrant Stats Bar */}
      <StatsBar />

      {/* Empower Learning Section with Icon Grid */}
      <EmpowerSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Features Section with Dark Background */}
      <FeaturesSection />

      {/* Courses Section - Zigzag Layout */}
      <CoursesSection />

      {/* Projects Section - Zigzag Layout (Image Left, Text Right) */}
      <ProjectsSection />

      {/* Premium Features Section */}
      <PremiumFeaturesSection />

      {/* Social Proof Section - Creative Bento Layout */}
      <SocialProofSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* FAQ Section */}
      <FAQSection />

      {/* Pricing Section */}
      <PricingSection />
    </>
  );
}
