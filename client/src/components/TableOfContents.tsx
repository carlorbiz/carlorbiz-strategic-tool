import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GithubSlugger from 'github-slugger';

interface TOCItem {
  id: string;
  level: number;
  title: string;
}

interface TableOfContentsProps {
  content: string;
  maxDepth?: number; // Max heading level to include (default 4 = H2–H4)
}

/**
 * Auto-generating Table of Contents that parses markdown headings
 * and creates clickable links matching rehype-slug's generated IDs.
 */
export function TableOfContents({ content, maxDepth = 4 }: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const items = useMemo(() => {
    const slugger = new GithubSlugger();
    const toc: TOCItem[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Match markdown headings H2-H4 (skip H1 since that's the tab title)
      const match = line.match(/^(#{2,4})\s+(.+?)(?:\s*\{#.*?\})?$/);
      if (match) {
        const level = match[1].length;
        if (level > maxDepth) continue;
        // Strip inline markdown (bold, italic, links) to get plain text
        const title = match[2]
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .trim();
        const id = slugger.slug(title);
        toc.push({ id, level, title });
      }
    }

    return toc;
  }, [content, maxDepth]);

  if (items.length < 2) return null;

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="border border-primary/20 rounded-lg bg-primary/5 mb-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between px-4 py-3 h-auto text-sm font-medium text-foreground hover:bg-primary/10"
      >
        <span>Quick Navigation</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {isOpen && (
        <nav className="px-4 pb-4 space-y-0.5 max-h-72 overflow-y-auto">
          {items.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => handleClick(item.id)}
              className={`block w-full text-left px-3 py-1.5 rounded text-sm hover:bg-primary/10 transition-colors text-foreground hover:text-primary truncate ${
                item.level === 2 ? 'font-semibold' :
                item.level === 3 ? 'ml-4 text-muted-foreground' :
                'ml-8 text-xs text-muted-foreground'
              }`}
              title={item.title}
            >
              {item.title}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
