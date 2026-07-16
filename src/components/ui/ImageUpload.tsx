import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  shape?: "circle" | "cover";
  label?: string;
}

function compressImage(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while restricting dimensions
        if (width / height > maxWidth / maxHeight) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG with 75% quality
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        resolve(compressedBase64);
      };
      img.onerror = () => reject(new Error("Failed to load image. Make sure it is a valid image file."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({ value, onChange, shape = "cover", label }: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }

    setLoading(true);
    try {
      const maxWidth = shape === "circle" ? 300 : 360;
      const maxHeight = shape === "circle" ? 300 : 540;
      const compressed = await compressImage(file, maxWidth, maxHeight);
      onChange(compressed);
    } catch (err: any) {
      toast.error(err.message || "Failed to process image.");
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
    fileInputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const aspectClass = shape === "circle" ? "aspect-square rounded-full max-w-[140px]" : "aspect-[2/3] rounded-xl w-full max-w-[200px]";

  return (
    <div className="flex flex-col items-center justify-center w-full space-y-2 select-none">
      {label && (
        <span className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 self-start">
          {label}
        </span>
      )}
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed overflow-hidden cursor-pointer transition-all duration-200 shadow-sm ${aspectClass} ${
          isDragOver
            ? "border-emerald bg-emerald/5 ring-4 ring-emerald/10"
            : "border-black/10 dark:border-white/10 bg-[#fcfbf8] dark:bg-[#111d1a] hover:border-emerald dark:hover:border-[#1b9277] hover:bg-black/[0.01]"
        }`}
      >
        {value ? (
          <>
            <img src={value} alt="Preview" className="w-full h-full object-cover transition duration-300" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <span className="text-[12px] text-white font-bold bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">
                Change Image
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow-md hover:scale-105"
              title="Remove image"
            >
              <X size={14} />
            </button>
          </>
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
    </div>
  );
}
