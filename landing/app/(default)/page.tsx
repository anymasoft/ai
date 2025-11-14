export const metadata = {
  title: "Home - Video Reader AI",
  description: "Instant YouTube subtitle translation in one click",
};

import Hero from "@/components/hero-home";
import BusinessCategories from "@/components/business-categories";
import FeaturesPlanet from "@/components/features-planet";
import Pricing from "@/components/pricing";
import LargeTestimonial from "@/components/large-testimonial";
import Cta from "@/components/cta";

export default function Home() {
  return (
    <>
      <Hero />
      <BusinessCategories />
      <FeaturesPlanet />
      <Pricing />
      <LargeTestimonial />
      <Cta />
    </>
  );
}
