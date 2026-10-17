"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * Renders a PDF lesson with pdf.js onto <canvas> elements, one per page.
 *
 * Replaces an <iframe> pointed at the PDF, which relied on the browser's
 * built-in viewer: Android Chrome has none (the iframe stayed blank or the
 * file downloaded instead), and on desktop that viewer's toolbar offers
 * download/print. Pages render lazily as they scroll into view, at the
 * container's width, so long documents stay light.
 */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setDoc(null);
    setError(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();
        // The signed stream URL is self-authorizing; no cookies needed.
        loaded = await pdfjs.getDocument({ url, withCredentials: false }).promise;
        if (cancelled) loaded.destroy();
        else setDoc(loaded);
      } catch {
        if (!cancelled) setError("This document couldn't be displayed. Try reopening the lesson.");
      }
    })();
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [url]);

  // Re-render pages at the new width when the container is resized.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      setWidth((prev) => (Math.abs(prev - next) > 24 ? next : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label={title}
      className="h-full w-full overflow-y-auto bg-slate-100 p-2 sm:p-4"
      onContextMenu={(e) => e.preventDefault()}
    >
      {error && <p className="py-10 text-center text-sm text-slate">{error}</p>}
      {!error && !doc && <p className="py-10 text-center text-sm text-slate">Loading document…</p>}
      {doc && width > 0 && (
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i} doc={doc} pageNumber={i + 1} width={Math.min(width - 16, 896)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PdfPage({ doc, pageNumber, width }: { doc: PDFDocumentProxy; pageNumber: number; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [aspect, setAspect] = useState(1.294); // A4/Letter-ish until the real size is known

  // Only render pages near the viewport.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || width <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setAspect(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvasContext: ctx, viewport });
      await task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width, visible]);

  return (
    <div ref={wrapperRef} className="bg-white shadow-sm" style={{ width, height: Math.round(width * aspect) }}>
      <canvas ref={canvasRef} className="block h-full w-full" data-page={pageNumber} />
    </div>
  );
}
