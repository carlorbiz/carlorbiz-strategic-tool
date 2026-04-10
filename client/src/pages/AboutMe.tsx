import { AccordionPage } from '@/components/AccordionPage';

export default function AboutMePage() {
  return (
    <div className="min-h-screen">
      <AccordionPage
        folderSlug="about-me"
        title="About Carla"
        intro="Three decades leading transformation across hospitality, healthcare, and professional services. One unshakeable belief: your biggest constraint is often your greatest strategic advantage."
        heroImage="/images/carla-about.webp"
        heroImageAlt="Carla Taylor"
      />
    </div>
  );
}
