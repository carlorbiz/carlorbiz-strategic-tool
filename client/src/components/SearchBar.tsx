import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useCMS } from '@/contexts/CMSContext';

interface SearchResult {
  tabId: string;
  tabLabel: string;
  tabIcon: string;
  snippet: string;
}

interface SearchBarProps {
  onResultSelect?: (sectionKey: string, searchQuery: string) => void;
}

export function SearchBar({ onResultSelect }: SearchBarProps) {
  const { tabs, folders } = useCMS();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Build a lookup for folder names
  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const folder of folders) {
      map.set(folder.id, folder.label);
    }
    return map;
  }, [folders]);

  const results = useMemo(() => {
    if (query.length < 2) return [];

    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search through all visible tabs
    tabs.filter(t => t.is_visible).forEach(tab => {
      const contentLower = tab.content.toLowerCase();
      const labelLower = tab.label.toLowerCase();

      if (contentLower.includes(lowerQuery) || labelLower.includes(lowerQuery)) {
        // Extract a snippet around the match
        let snippet = '';
        const matchIndex = contentLower.indexOf(lowerQuery);
        if (matchIndex >= 0) {
          const start = Math.max(0, matchIndex - 40);
          const end = Math.min(tab.content.length, matchIndex + lowerQuery.length + 80);
          snippet = (start > 0 ? '...' : '') + tab.content.slice(start, end).replace(/[#*_\[\]]/g, '') + (end < tab.content.length ? '...' : '');
        } else {
          snippet = tab.label;
        }

        const folderLabel = tab.folder_id ? folderMap.get(tab.folder_id) : null;

        searchResults.push({
          tabId: tab.id,
          tabLabel: folderLabel ? `${folderLabel} > ${tab.label}` : tab.label,
          tabIcon: tab.icon,
          snippet,
        });
      }
    });

    return searchResults;
  }, [query, tabs, folderMap]);

  const handleSelect = (sectionKey: string) => {
    onResultSelect?.(sectionKey, query);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          data-search-input
          placeholder="Search the content..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-8 text-foreground bg-white border-gray-300 placeholder:text-gray-400"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg max-h-96 overflow-y-auto">
          <div className="p-1">
            {results.map((result) => (
              <button
                key={result.tabId}
                onClick={() => handleSelect(result.tabId)}
                className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{result.tabIcon}</span>
                  <span className="text-sm font-semibold text-primary">{result.tabLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {isOpen && query.length > 0 && results.length === 0 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg p-4">
          <p className="text-sm text-muted-foreground">
            No results found for "{query}".
          </p>
        </Card>
      )}
    </div>
  );
}
