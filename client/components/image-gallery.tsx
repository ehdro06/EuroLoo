"use client"

import { useState, useRef } from "react"
import { Camera, Loader2, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGetToiletImagesQuery, useGetPresignedUrlMutation, useConfirmImageUploadMutation } from "@/lib/services/api"
import { toast } from "sonner"

// Must match ALLOWED_IMAGE_TYPES on the server
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
import { useUser, useClerk } from "@clerk/nextjs"

export function ImageGallery({ toiletId }: { toiletId: number }) {
  const { user } = useUser()
  const { openSignIn } = useClerk()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { data: images, isLoading } = useGetToiletImagesQuery(toiletId)
  const [getPresignedUrl] = useGetPresignedUrlMutation()
  const [confirmUpload] = useConfirmImageUploadMutation()
  const [isUploading, setIsUploading] = useState(false)

  const handleUploadClick = () => {
    if (!user) {
      toast.info("Please sign in", { description: "You need an account to upload photos." })
      openSignIn()
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Basic validation
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Invalid file type", { description: "Please select a JPEG, PNG or WebP image." })
      return
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("File too large", { description: "Maximum file size is 5MB." })
      return
    }

    setIsUploading(true)
    try {
      // 1. Get presigned URL
      const { uploadUrl, fileUrl } = await getPresignedUrl({ contentType: file.type }).unwrap()

      // 2. Upload file directly to GCP Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to cloud storage')
      }

      // 3. Confirm with our API
      await confirmUpload({ toiletId, fileUrl }).unwrap()
      toast.success("Photo uploaded successfully!")
    } catch (error) {
      console.error("Upload failed", error)
      toast.error("Upload failed", { description: "There was a problem uploading your photo." })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Photos
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleUploadClick}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {isUploading ? "Uploading..." : "Add Photo"}
        </Button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept={ALLOWED_IMAGE_TYPES.join(",")} 
          className="hidden" 
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : images && images.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {images.map((img) => (
            <div key={img.id} className="relative aspect-square w-48 shrink-0 snap-center overflow-hidden rounded-xl border bg-muted">
              {/* Using standard img tag for external URLs without configured Next.js domains */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={img.url} 
                alt="Toilet" 
                className="h-full w-full object-cover transition-transform hover:scale-105"
                loading="lazy"
              />
              {img.user?.username && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-[10px] text-white font-medium truncate">By {img.user.username}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center bg-slate-50">
          <ImageIcon className="h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-900">No photos yet</p>
          <p className="text-xs text-slate-500 max-w-[200px] mt-1">Be the first to upload a photo of this toilet.</p>
        </div>
      )}
    </div>
  )
}
