"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { UploadIcon } from "~/components/ui/upload";
import { CircleCheckIcon } from "~/components/ui/circle-check";
import { ImagePlus, X } from "lucide-react";

interface ProofUploaderProps {
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  currentProofUrl?: string;
  verificationFailed?: boolean;
  className?: string;
}

export function ProofUploader({
  onUpload,
  isUploading = false,
  currentProofUrl,
  verificationFailed = false,
  className,
}: ProofUploaderProps) {
  const [preview, setPreview] = useState<string | null>(
    verificationFailed ? null : (currentProofUrl || null)
  );
  const [isRetrying, setIsRetrying] = useState(verificationFailed);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (selectedFile) {
      await onUpload(selectedFile);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setSelectedFile(null);
  };

  return (
    <Card className={cn("border-border/50 bg-card/50 backdrop-blur-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImagePlus className="size-5 text-primary" />
          Submit Proof
        </CardTitle>
      </CardHeader>
      <CardContent>
        {preview ? (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative rounded-sm overflow-hidden border border-border/50">
              <img
                src={preview}
                alt="Proof preview"
                className="w-full h-auto max-h-[400px] object-contain bg-background"
              />
              {(!currentProofUrl || isRetrying) && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleClear}
                  disabled={isUploading}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {/* Actions */}
            {(!currentProofUrl || isRetrying) && selectedFile && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={isUploading}
                  className="flex-1"
                >
                  Choose Different
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isUploading}
                  className="flex-1 gap-2 glow-primary"
                >
                  {isUploading ? (
                    "Uploading..."
                  ) : (
                    <>
                      <UploadIcon size={16} />
                      Submit for Verification
                    </>
                  )}
                </Button>
              </div>
            )}

            {currentProofUrl && !isRetrying && (
              <div className="space-y-3">
                {verificationFailed ? (
                  <>
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <X className="size-4" />
                      <span>Verification failed - you can submit new proof</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRetrying(true);
                        setPreview(null);
                        setSelectedFile(null);
                      }}
                      className="w-full"
                    >
                      Submit New Proof
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-success text-sm">
                    <CircleCheckIcon size={16} />
                    <span>Proof submitted - awaiting verification</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-sm border-2 border-dashed p-8 transition-all",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border/50 hover:border-primary/50 hover:bg-primary/5"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleChange}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <UploadIcon size={32} className="text-primary" />
            </div>
            <p className="font-medium text-center">
              {dragActive ? "Drop your image here" : "Drag & drop your proof"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Supports: JPG, PNG, GIF (max 10MB)
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
