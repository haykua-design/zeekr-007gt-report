// Modal overlay — always renders over a fixed dark backdrop (Radix Dialog
// scrim). text-white / text-zinc-* on the lightbox UI is intentional and
// unconditional; this component never appears on a light surface.
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";

type ZoomableImageProps = {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  /** 缩略图最大高度（避免撑爆版面） */
  thumbMaxHeightClassName?: string;
};

export function ZoomableImage({
  src,
  alt,
  caption,
  className,
  thumbMaxHeightClassName = "max-h-[320px]",
}: ZoomableImageProps) {
  const [backgroundMode, setBackgroundMode] = useState<"dark" | "light">("light");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startOx: number; startOy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const minScale = 1;
  const maxScale = 4;

  const hint = useMemo(() => {
    return `滚轮缩放（${minScale}x–${maxScale}x），双击重置`;
  }, []);

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) {
          setScale(1);
          setOffset({ x: 0, y: 0 });
          setIsDragging(false);
          dragRef.current = null;
        }
      }}
    >
      <div className={cn("mt-4", className)}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left"
            aria-label="点击放大查看图片"
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
              <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">
                点击放大
              </div>
            </div>
            <img
              src={src}
              alt={alt}
              className={cn("w-full object-contain", thumbMaxHeightClassName)}
              loading="lazy"
            />
          </button>
        </Dialog.Trigger>
        {caption ? <div className="mt-2 text-xs text-zinc-400">{caption}</div> : null}
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(96vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <Dialog.Title className="min-w-0 truncate text-sm font-medium text-white">
              {caption || alt}
            </Dialog.Title>
            <div className="hidden items-center gap-3 text-xs text-zinc-400 md:flex">
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-zinc-200 tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <span>{hint}</span>
            </div>
            <div className="inline-flex items-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 text-xs transition",
                  backgroundMode === "dark" ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-white/10",
                )}
                onClick={() => setBackgroundMode("dark")}
                aria-pressed={backgroundMode === "dark"}
              >
                黑底
              </button>
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 text-xs transition",
                  backgroundMode === "light" ? "bg-white text-zinc-900" : "text-zinc-300 hover:bg-white/10",
                )}
                onClick={() => setBackgroundMode("light")}
                aria-pressed={backgroundMode === "light"}
              >
                白底
              </button>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
                关闭
              </button>
            </Dialog.Close>
          </div>
          <div className="p-4">
            <div
              ref={viewportRef}
              className={cn(
                "relative flex max-h-[75dvh] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10",
                backgroundMode === "dark" ? "bg-black" : "bg-white",
              )}
              onWheel={(e) => {
                // 在弹窗里用滚轮缩放，避免触发背景滚动
                e.preventDefault();
                e.stopPropagation();

                const delta = e.deltaY;
                const step = 0.12;
                setScale((s) => {
                  const next = delta < 0 ? s * (1 + step) : s / (1 + step);
                  const clamped = Math.min(maxScale, Math.max(minScale, Number(next.toFixed(3))));
                  // 缩回 100% 时，自动回到中心
                  if (clamped <= 1.001) {
                    setOffset({ x: 0, y: 0 });
                  }
                  return clamped;
                });
              }}
              onDoubleClick={() => {
                setScale(1);
                setOffset({ x: 0, y: 0 });
              }}
              role="img"
              aria-label={`${alt}（${hint}）`}
              title={hint}
            >
              <img
                src={src}
                alt={alt}
                className="w-full object-contain"
                style={{
                  maxHeight: "75dvh",
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: "center",
                  transition: "transform 120ms ease-out",
                  cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
                }}
                loading="eager"
                draggable={false}
                onPointerDown={(e) => {
                  if (scale <= 1.001) return;
                  // 只在放大后允许拖动
                  setIsDragging(true);
                  dragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startOx: offset.x,
                    startOy: offset.y,
                  };
                  try {
                    (e.currentTarget as HTMLImageElement).setPointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                }}
                onPointerMove={(e) => {
                  if (!isDragging || !dragRef.current || scale <= 1.001) return;
                  const vp = viewportRef.current;
                  const dx = e.clientX - dragRef.current.startX;
                  const dy = e.clientY - dragRef.current.startY;

                  // 简单边界：按 viewport 尺寸估算允许平移范围
                  const w = vp?.clientWidth ?? 0;
                  const h = vp?.clientHeight ?? 0;
                  const maxX = w ? (w * (scale - 1)) / 2 : Infinity;
                  const maxY = h ? (h * (scale - 1)) / 2 : Infinity;

                  const nextX = dragRef.current.startOx + dx;
                  const nextY = dragRef.current.startOy + dy;

                  const clampedX = Math.max(-maxX, Math.min(maxX, nextX));
                  const clampedY = Math.max(-maxY, Math.min(maxY, nextY));

                  setOffset({ x: clampedX, y: clampedY });
                }}
                onPointerUp={(e) => {
                  if (!isDragging) return;
                  setIsDragging(false);
                  dragRef.current = null;
                  try {
                    (e.currentTarget as HTMLImageElement).releasePointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                }}
                onPointerCancel={() => {
                  setIsDragging(false);
                  dragRef.current = null;
                }}
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
