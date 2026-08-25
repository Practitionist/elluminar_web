"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Netflix-style horizontal carousel row: snap-scrolling track of fixed-width
 * cards with edge chevrons. Children should be shrink-0 width-fixed elements
 * (use `carouselItem` below for the standard card width).
 */
export function CarouselRow({
  title,
  href,
  children,
  className,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section className={cn("group/row relative", className)}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold tracking-tight">
          {href ? (
            <Link href={href} className="transition-colors hover:text-primary">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        <div className="flex gap-1">
          <CarouselButton
            label={`Scroll ${title} left`}
            disabled={atStart}
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft className="size-4" />
          </CarouselButton>
          <CarouselButton
            label={`Scroll ${title} right`}
            disabled={atEnd}
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight className="size-4" />
          </CarouselButton>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={updateEdges}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

function CarouselButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "bg-background/90 border-border hover:bg-muted flex size-8 cursor-pointer items-center justify-center rounded-full border shadow-sm transition-all",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}

/** Standard fixed-width, snap-aligned wrapper for a card inside a CarouselRow. */
export function CarouselItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[270px] shrink-0 snap-start sm:w-[300px]">{children}</div>
  );
}
