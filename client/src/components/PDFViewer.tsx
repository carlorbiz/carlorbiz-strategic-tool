import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ZoomIn,
  ZoomOut,
  Download,
  Loader2,
  AlertCircle,
  Maximize2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

// Configure PDF.js worker from the public directory
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PDFViewerProps {
  fileUrl: string;
  title: string;
}

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
/** Number of pages to keep rendered above/below the visible area */
const RENDER_BUFFER = 2;

export function PDFViewer({ fileUrl, title }: PDFViewerProps) {
  const isMobile = useIsMobile();
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setLoading(false);
      setError(null);
    },
    []
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || "Failed to load PDF");
    setLoading(false);
  }, []);

  // ResizeObserver for responsive container width
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // IntersectionObserver to track which pages are visible
  useEffect(() => {
    if (numPages === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = Number(
              (entry.target as HTMLElement).dataset.pageNumber
            );
            if (entry.isIntersecting) {
              next.add(pageNum);
            } else {
              next.delete(pageNum);
            }
          }
          return next;
        });
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    // Observe all page sentinel elements
    pageRefs.current.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [numPages]);

  // Update current page number from visible pages (lowest visible = current)
  useEffect(() => {
    if (visiblePages.size > 0) {
      const lowest = Math.min(...visiblePages);
      setCurrentPage(lowest);
    }
  }, [visiblePages]);

  // Determine which pages to render (visible + buffer)
  const pagesToRender = useMemo(() => {
    if (numPages === 0) return new Set<number>();
    const toRender = new Set<number>();
    for (const pageNum of visiblePages) {
      for (
        let i = Math.max(1, pageNum - RENDER_BUFFER);
        i <= Math.min(numPages, pageNum + RENDER_BUFFER);
        i++
      ) {
        toRender.add(i);
      }
    }
    // Always render at least page 1 on initial load
    if (toRender.size === 0) toRender.add(1);
    return toRender;
  }, [visiblePages, numPages]);

  // Register a page ref for the IntersectionObserver
  const setPageRef = useCallback(
    (pageNum: number, el: HTMLDivElement | null) => {
      if (el) {
        pageRefs.current.set(pageNum, el);
        observerRef.current?.observe(el);
      } else {
        const existing = pageRefs.current.get(pageNum);
        if (existing) {
          observerRef.current?.unobserve(existing);
        }
        pageRefs.current.delete(pageNum);
      }
    },
    []
  );

  const zoomIn = useCallback(() => {
    setFitWidth(false);
    setScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setFitWidth(false);
    setScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setFitWidth(true);
    setScale(1);
  }, []);

  // Scroll to a specific page
  const scrollToPage = useCallback((pageNum: number) => {
    const el = pageRefs.current.get(pageNum);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handlePageInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 1 && val <= numPages) {
        scrollToPage(val);
      }
    },
    [numPages, scrollToPage]
  );

  // Calculate page width for fit-to-width mode
  const pageWidth = fitWidth
    ? containerWidth - 32 // 32px padding, fill available width
    : undefined;

  return (
    <div className="space-y-0">
      {/* Sticky Toolbar */}
      <Card className="bg-card border shadow-sm sticky top-0 z-10 rounded-b-none">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Page Indicator with jump-to-page */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Page</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={currentPage}
                onChange={handlePageInput}
                className="w-12 h-8 text-center border rounded-md bg-background text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-muted-foreground">
                of {numPages || "..."}
              </span>
            </div>

            {/* Zoom Controls + Download */}
            <div className="flex items-center gap-1.5">
              {!isMobile && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={zoomOut}
                    disabled={!fitWidth && scale <= MIN_ZOOM}
                    className="h-8 w-8"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetZoom}
                    className="h-8 px-2 text-xs"
                  >
                    {fitWidth ? (
                      <span className="flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" /> Fit
                      </span>
                    ) : (
                      `${Math.round(scale * 100)}%`
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={zoomIn}
                    disabled={!fitWidth && scale >= MAX_ZOOM}
                    className="h-8 w-8"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* Download */}
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <Button
                  variant="outline"
                  size={isMobile ? "icon" : "sm"}
                  className="h-8"
                >
                  <Download className="h-4 w-4" />
                  {!isMobile && <span className="ml-1.5">Download</span>}
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scrollable PDF Display */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto rounded-b-lg border border-t-0 bg-muted/30 min-h-[400px] max-h-[80vh]"
      >
        {error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive/60" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">Unable to load PDF</p>
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            </div>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download {title} instead
              </Button>
            </a>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4 py-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <div
                    key={pageNum}
                    ref={(el) => setPageRef(pageNum, el)}
                    data-page-number={pageNum}
                    className="relative"
                    style={{
                      minHeight: pagesToRender.has(pageNum)
                        ? undefined
                        : "600px",
                    }}
                  >
                    {pagesToRender.has(pageNum) ? (
                      <Page
                        pageNumber={pageNum}
                        width={pageWidth}
                        scale={fitWidth ? undefined : scale}
                        className="shadow-lg"
                        loading={
                          <div
                            className="flex items-center justify-center bg-background border rounded"
                            style={{
                              width: pageWidth ?? 800,
                              height: 600,
                            }}
                          >
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        }
                      />
                    ) : (
                      <div
                        className="bg-background/50 border rounded w-full"
                        style={{
                          height: 600,
                        }}
                      />
                    )}
                  </div>
                )
              )}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
