import {
  HeroSection,
  CredentialCenterpieceSection,
  StatsBar,
  HowItWorksSection,
  ProjectsShowcaseSection,
  CoursesShowcaseSection,
  TestimonialsSection,
  FeaturesSection,
  MentorWallSection,
  SuccessStoriesSection,
  PricingSection,
  FAQSection,
} from "@/components/marketing";

export default function HomePage() {
  return (
    <>
      {/* Hero — the banner you love, kept */}
      <HeroSection />

      {/* The differentiator: a verifiable credential, up front */}
      <CredentialCenterpieceSection />

      {/* Proof-you-can-audit stats band */}
      <StatsBar />

      {/* Three steps between you and proof */}
      <HowItWorksSection />

      {/* Projects that read like real tickets */}
      <ProjectsShowcaseSection />

      {/* Courses that go deep */}
      <CoursesShowcaseSection />

      {/* Loved by people who ship */}
      <TestimonialsSection />

      {/* Why it's different — the single ink dark break */}
      <FeaturesSection />

      {/* Reviewed by people you'd want on your PR */}
      <MentorWallSection />

      {/* Real people. Real switches. */}
      <SuccessStoriesSection />

      {/* Pricing — kept, lightly refreshed */}
      <PricingSection />

      {/* FAQ */}
      <FAQSection />

      {/* Closing "Ready to prove it?" CTA lives in the gradient footer */}
    </>
  );
}
