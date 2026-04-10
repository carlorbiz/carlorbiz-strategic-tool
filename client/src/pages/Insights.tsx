import { AccordionPage } from '@/components/AccordionPage';

export default function InsightsPage() {
  return (
    <div className="min-h-screen">
      <AccordionPage
        folderSlug="insights"
        title="Insights"
        intro="Strong opinions, practical frameworks, and real examples — each one designed to change what you do tomorrow morning. Not thought leadership. Decision leadership."
        heroImage="/images/carla-insights.webp"
        heroImageAlt="Carla Taylor — Insights"
      />
    </div>
  );
}
