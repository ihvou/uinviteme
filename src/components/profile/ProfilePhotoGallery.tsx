import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfilePhotoGalleryProps {
  photos: string[];
  fallbackPhotoUrl?: string | null;
  displayName?: string | null;
  className?: string;
}

export function ProfilePhotoGallery({
  photos,
  fallbackPhotoUrl,
  displayName,
  className,
}: ProfilePhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const photoUrls = useMemo(() => {
    const allPhotos = [...photos, fallbackPhotoUrl].filter(Boolean) as string[];
    return Array.from(new Set(allPhotos));
  }, [fallbackPhotoUrl, photos]);

  useEffect(() => {
    if (activeIndex >= photoUrls.length) setActiveIndex(0);
  }, [activeIndex, photoUrls.length]);

  const hasMultiple = photoUrls.length > 1;
  const alt = displayName ? `${displayName} profile photo` : "Profile photo";

  const showPrevious = () => {
    if (!hasMultiple) return;
    setActiveIndex((current) =>
      current === 0 ? photoUrls.length - 1 : current - 1,
    );
  };

  const showNext = () => {
    if (!hasMultiple) return;
    setActiveIndex((current) => (current + 1) % photoUrls.length);
  };

  const getInitials = () => {
    if (!displayName) return "?";
    return displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("mx-auto mb-5 w-full max-w-[280px]", className)}>
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-lg bg-gradient-hero shadow-sm"
        onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
        onTouchEnd={(event) => {
          if (touchStartX === null) return;
          const delta = touchStartX - (event.changedTouches[0]?.clientX ?? touchStartX);
          setTouchStartX(null);
          if (Math.abs(delta) < 40) return;
          if (delta > 0) showNext();
          else showPrevious();
        }}
      >
        {photoUrls.length > 0 ? (
          <img
            src={photoUrls[activeIndex]}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-5xl font-bold text-primary-foreground">
              {getInitials()}
            </span>
          </div>
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={showPrevious}
              className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={showNext}
              className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {photoUrls.map((photoUrl, index) => (
            <button
              key={photoUrl}
              type="button"
              aria-label={`Show photo ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition",
                index === activeIndex ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
