import Image from "next/image";
import { API_BASE_URL, resolveImageUrl } from "@/lib/api";

/**
 * Image uploaded through the CMS/course editor. Those live on the API host,
 * so they go through Next's image optimizer — resized per screen, served as
 * WebP/AVIF and cached on Vercel's CDN. A URL an admin pasted from some
 * other site isn't on the optimizer's allow-list, so it's shown as-is.
 */
export function CmsImage({
  src,
  alt,
  className,
  style,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  sizes: string;
  priority?: boolean;
}) {
  const url = resolveImageUrl(src);
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!url.startsWith(API_BASE_URL)}
      className={className}
      style={style}
    />
  );
}
