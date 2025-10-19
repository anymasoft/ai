import { CtaSection } from "@/components/CtaSection";
import { FeatureSection } from "@/components/FeatureSection";
import { FeatureSectionThree } from "@/components/FeatureSectionThree";
import { FeatureSectionTwo } from "@/components/FeatureTwoSection";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import Pricing from "@/components/PricingSection";
import { Testimonial9 } from "@/components/TestimonialSection";
import { TimelineSection } from "@/components/TimelineSection";
import Image from "next/image";

export default function Home() {
  return (
    <div className="w-full bg-gradient-to-b from-background to-background/80">
      <Header />
      <HeroSection />
      <FeatureSection />
      <FeatureSectionTwo />
      <FeatureSectionThree />
      <TimelineSection />
      <Testimonial9 />
      <Pricing />
      <CtaSection />
      <Footer />
    </div>
  );
}