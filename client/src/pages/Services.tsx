import { AccordionPage } from '@/components/AccordionPage';

export default function ServicesPage() {
  return (
    <div className="min-h-screen">
      <AccordionPage
        folderSlug="services"
        title="Services"
        intro={`I build three things — and they work together.

**Strategic Clarity** — Cut through complexity to find the one decision that changes everything.
**Implementation Infrastructure** — Live systems that outlast the consulting engagement.
**AI Knowledge Systems** — Your expertise, structured into a platform your team actually uses.

Every engagement starts with understanding what you are at your best — not what the market says you should be.

[Watch: The Central Question →](/services#the-central-question)`}
        heroImage="/images/carla-services.webp"
        heroImageAlt="Carla Taylor — Strategic Consulting"
        firstGroupHeading="Custom-Built Knowledge Systems"
        firstGroupContent={`### Why AI changes everything

AI doesn't replace strategic thinking — it amplifies it. The organisations that will thrive are those that structure their deep expertise into systems that AI can enhance, not those that outsource their thinking to AI.`}
        sectionBreaks={[
          {
            afterIndex: 5,
            heading: "Strategic Planning & Implementation",
          },
          {
            afterIndex: 8,
            heading: "Engagement & Pricing",
            content: `### How engagements work

Every engagement maps to one of three situations:

1. **"We've done strategy but nothing happens"** — I build the execution system: live tracking, decision frameworks, and accountability architecture so strategy becomes action.
2. **"We're overwhelmed and reactive"** — I build decision architecture: a shared framework that cuts through noise so your team aligns around what actually matters.
3. **"We want AI but don't know where to start"** — I structure your deep expertise into a knowledge system (Nera) that your organisation owns and uses daily.`
          },
        ]}
      />
    </div>
  );
}
