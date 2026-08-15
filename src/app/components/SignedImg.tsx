import { ImageOff } from "lucide-react";
import { useSignedUrl } from "@/lib/render/useSignedUrl";

interface SignedImgProps {
  src: string | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
}

/** Drop-in <img> for chrome surfaces (asset grids, palette tiles, previews)
 * whose src may be a storage reference. Signing failures render a clear
 * failed marker instead of a broken-image icon; nothing renders while the
 * signature is being minted. Canvas surfaces don't use this — they have
 * their own failed states sized to the field box. */
export function SignedImg({ src, alt, className, style, draggable }: SignedImgProps) {
  const image = useSignedUrl(src);
  if (image.failed) {
    return (
      <span
        title={`${alt || "Image"} unavailable`}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          ...style,
        }}
      >
        <ImageOff className="w-4 h-4" aria-label={`${alt || "Image"} unavailable`} />
      </span>
    );
  }
  if (!image.url) return null;
  return (
    <img src={image.url} alt={alt} className={className} style={style} draggable={draggable} />
  );
}
