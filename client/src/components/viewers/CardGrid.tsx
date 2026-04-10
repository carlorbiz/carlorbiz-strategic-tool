import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CardItem {
  title: string;
  tagline: string;
  href: string;
  category?: string;
}

interface CardGridProps {
  data: string; // JSON string of CardItem[]
}

export function CardGrid({ data }: CardGridProps) {
  let cards: CardItem[] = [];
  try {
    cards = JSON.parse(data);
  } catch {
    return (
      <p className="text-sm text-muted-foreground italic">
        Unable to load card data.
      </p>
    );
  }

  // Group by category
  const grouped = new Map<string, CardItem[]>();
  for (const card of cards) {
    const key = card.category ?? '';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(card);
  }

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([category, items]) => (
        <div key={category}>
          {category && (
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              {category}
            </h4>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((card: CardItem) => (
              <a
                key={card.href}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="h-full transition-all hover:border-[var(--color-brand-accent)]/40 hover:shadow-md">
                  <CardContent className="py-5 px-5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-heading font-bold text-sm text-foreground leading-tight group-hover:text-[var(--color-brand-primary)] transition-colors">
                        {card.title}
                      </h5>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {card.tagline}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-[var(--color-brand-accent)] transition-colors mt-0.5" />
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
