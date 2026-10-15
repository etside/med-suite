import { useState } from "react";
import { ImageOff } from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

const ProductImage = ({ src, alt, className = "", fallbackClassName = "" }: ProductImageProps) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className} ${fallbackClassName}`}
        aria-label={alt}
      >
        <ImageOff className="h-1/2 w-1/2 max-h-6 max-w-6 opacity-60" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export default ProductImage;
