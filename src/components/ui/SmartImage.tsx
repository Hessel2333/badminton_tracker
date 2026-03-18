"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  quality?: number;
};

function canUseNextImage(src: string) {
  if (src.startsWith("/")) return true;

  try {
    const hostname = new URL(src).hostname;
    return hostname === "public.blob.vercel-storage.com" || hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function SmartImage({
  src,
  alt,
  className,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  loading,
  quality
}: SmartImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imageClassName = cn(
    className,
    "transition-opacity duration-300 ease-out",
    isLoaded ? "opacity-100" : "animate-pulse bg-panel/80 opacity-0"
  );

  if (canUseNextImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        className={imageClassName}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading}
        quality={quality}
        onLoad={() => setIsLoaded(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
      <img
      src={src}
      alt={alt}
      className={imageClassName}
      loading={priority || loading === "eager" ? "eager" : "lazy"}
      decoding="async"
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      onLoad={() => setIsLoaded(true)}
      onError={() => setIsLoaded(true)}
    />
  );
}
