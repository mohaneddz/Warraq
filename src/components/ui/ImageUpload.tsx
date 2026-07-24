import { useState, useRef, DragEvent, ChangeEvent, useEffect } from "react";
import { Upload, X, Edit } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  shape?: "circle" | "cover" | "rect";
  label?: string;
  fallbackInitials?: string;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}



export function ImageUpload({ value, onChange, shape = "cover", label, fallbackInitials }: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Original Full-Size Image state
  const [originalImage, setOriginalImage] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setOriginalImage(null);
    }
  }, [value]);

  // Crop & Zoom States
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

  const startCropper = (dataUrl: string) => {
    setOriginalImage(dataUrl);
    setRawImage(dataUrl);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setIsCropOpen(true);
  };

  const handleRecrop = () => {
    const src = originalImage || value;
    if (src) {
      setRawImage(src);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
      setIsCropOpen(true);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          startCropper(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to read image file.");
    } finally {
      setLoading(false);
    }
  };

  const handleTauriFileSelect = async () => {
    try {
      setLoading(true);
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readFile } = await import("@tauri-apps/plugin-fs");

      const selected = await open({
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp"],
          },
        ],
        multiple: false,
      });

      if (!selected) {
        setLoading(false);
        return;
      }

      // Read selected file
      const fileBytes = await readFile(selected);
      const ext = selected.split(".").pop()?.toLowerCase() || "jpeg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const dataUrl = `data:${mimeType};base64,${uint8ArrayToBase64(fileBytes)}`;
      startCropper(dataUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to select image natively.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const triggerSelect = () => {
    if (isTauri) {
      void handleTauriFileSelect();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Draggable image movement
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingImage(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingImage(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.05 : -0.05;
    setZoom((prevZoom) => {
      const nextZoom = prevZoom + factor;
      return Math.min(3, Math.max(0.2, nextZoom));
    });
  };

  const handleCropSave = () => {
    if (!rawImage) return;
    setLoading(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");

      canvas.width = shape === "circle" ? 300 : shape === "rect" ? 480 : 360;
      canvas.height = shape === "circle" ? 300 : shape === "rect" ? 300 : 540;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        onChange(rawImage);
        setIsCropOpen(false);
        setRawImage(null);
        setLoading(false);
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const containerWidth = 320;
      const containerHeight = 320;

      const cropW = shape === "circle" ? 200 : shape === "rect" ? 280 : 200;
      const cropH = shape === "circle" ? 200 : shape === "rect" ? 175 : 300;

      const cropLeft = (containerWidth - cropW) / 2;
      const cropTop = (containerHeight - cropH) / 2;

      let renderWidth = img.width;
      let renderHeight = img.height;
      const scaleToFit = Math.min(containerWidth / img.width, containerHeight / img.height);
      renderWidth = img.width * scaleToFit;
      renderHeight = img.height * scaleToFit;

      const centerX = (containerWidth / 2) + offset.x;
      const centerY = (containerHeight / 2) + offset.y;

      const scaledImgX = centerX - (renderWidth * zoom) / 2;
      const scaledImgY = centerY - (renderHeight * zoom) / 2;

      const sourceX = (cropLeft - scaledImgX) / (scaleToFit * zoom);
      const sourceY = (cropTop - scaledImgY) / (scaleToFit * zoom);
      const sourceW = cropW / (scaleToFit * zoom);
      const sourceH = cropH / (scaleToFit * zoom);

      try {
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceW, sourceH,
          0, 0, canvas.width, canvas.height
        );
        const resultBase64 = canvas.toDataURL("image/jpeg", 0.75);
        onChange(resultBase64);
      } catch {
        onChange(rawImage);
      }

      setIsCropOpen(false);
      setRawImage(null);
      setLoading(false);
    };
    img.src = rawImage;
  };

  const aspectClass =
    shape === "circle"
      ? "aspect-square rounded-full w-20 h-20"
      : shape === "rect"
        ? "aspect-[1.6] rounded-xl w-32 h-20"
        : "aspect-[2/3] rounded-xl w-full max-w-[200px]";

  return (
    <div className="flex flex-col items-center justify-center w-fit space-y-2 select-none">
      {label && (
        <span className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 self-start">
          {label}
        </span>
      )}

      <div className="relative">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={value ? undefined : triggerSelect}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed overflow-hidden transition-all duration-200 shadow-sm ${aspectClass} ${isDragOver
              ? "border-emerald bg-emerald/5 ring-4 ring-emerald/10"
              : "border-black/10 dark:border-white/10 bg-[#fcfbf8] dark:bg-[#111d1a] hover:border-emerald dark:hover:border-[#1b9277] hover:bg-black/[0.01]"
            } ${value ? "cursor-default" : "cursor-pointer"}`}
        >
          {value ? (
            <>
              <img src={value} alt="Preview" className="w-full h-full object-cover transition duration-300" />
              <div className="absolute inset-0 bg-black/45 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5 p-1">
                <button
                  type="button"
                  title="Recrop image"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRecrop();
                  }}
                  className="w-7 h-7 flex items-center justify-center bg-white hover:bg-[#f4ebdd] text-[#122222] rounded-full shadow-md transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                >
                  <Edit size={12} />
                </button>
                <button
                  type="button"
                  title="Upload new image"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSelect();
                  }}
                  className="w-7 h-7 flex items-center justify-center bg-[#1a4d40] hover:bg-[#1a4d40]/90 text-white rounded-full shadow-md transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                >
                  <Upload size={12} />
                </button>
              </div>
            </>
          ) : fallbackInitials ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <div className="w-full h-full rounded-full bg-emerald text-white flex items-center justify-center text-[22px] font-bold shadow-inner">
                {fallbackInitials}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="p-2 bg-white text-[#122222] rounded-full shadow-md">
                  <Upload size={14} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
              {loading ? (
                <div className="w-6 h-6 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <div className="p-2 bg-emerald/10 dark:bg-emerald/20 text-emerald rounded-full">
                    <Upload size={18} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-[#122222] dark:text-white">
                      Drag & drop or Click
                    </p>
                    <p className="text-[9px] text-[#122222]/40 dark:text-white/40">
                      PNG, JPG or WEBP
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
            disabled={loading}
          />
        </div>

        {value && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1.5 -right-1.5 z-20 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow-md hover:scale-105"
            title="Remove image"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Dynamic Crop & Zoom Modal Window */}
      {isCropOpen && rawImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none">
          <div className="bg-white dark:bg-[#1d2926] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl p-6 w-full max-w-sm flex flex-col items-center">

            <h3 className="font-bold text-[15px] text-[#122222] dark:text-white mb-1 self-start">
              Crop & Position Image
            </h3>
            <p className="text-[11px] text-[#122222]/50 dark:text-white/50 mb-4 self-start">
              Drag to position. Scroll to zoom in and out.
            </p>

            {/* Draggable Viewport */}
            <div
              className="w-[320px] h-[320px] bg-black/5 dark:bg-white/5 rounded-xl overflow-hidden relative cursor-move border border-black/10 dark:border-white/10"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <img
                src={rawImage}
                alt="To Crop"
                draggable={false}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transition: isDraggingImage ? "none" : "transform 0.1s ease-out",
                  maxHeight: "100%",
                  maxWidth: "100%",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  margin: "auto"
                }}
              />

              {/* Mask overlay container */}
              <div className="absolute inset-0 pointer-events-none flex flex-col">
                <div className="flex-1 bg-black/40" />
                <div className="flex">
                  <div className="flex-1 bg-black/40" />

                  {/* The crop boundary indicator */}
                  <div
                    className={`shrink-0 border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] ${shape === "circle"
                        ? "rounded-full w-[200px] h-[200px]"
                        : shape === "rect"
                          ? "rounded-xl w-[280px] h-[175px]"
                          : "rounded-xl w-[200px] h-[300px]"
                      }`}
                  />

                  <div className="flex-1 bg-black/40" />
                </div>
                <div className="flex-1 bg-black/40" />
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="w-full mt-5 space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-[#122222]/60 dark:text-white/60">
                <span>Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#1a4d40] dark:accent-[#1b9277]"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 w-full mt-6">
              <button
                type="button"
                onClick={() => { setIsCropOpen(false); setRawImage(null); }}
                className="flex-1 py-2 px-4 rounded-lg border border-black/10 dark:border-white/10 text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropSave}
                className="flex-1 py-2 px-4 bg-[#1a4d40] dark:bg-[#1b9277] text-white rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity"
              >
                Apply Crop
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
