"use client"

import { MapPin, Euro, Clock, Accessibility, X, MessageSquarePlus, Star, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Toilet } from "@/hooks/use-overpass"
import { AddReviewForm } from "./add-review-form"
import { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { useGetReviewsByToiletQuery } from "@/lib/services/api"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ToiletDrawerProps {
  toilet: Toilet | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToiletDrawer({ toilet, open, onOpenChange }: ToiletDrawerProps) {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const externalId = toilet ? `node-${toilet.id}` : ""
  
  const { data: reviews, isLoading: isLoadingReviews } = useGetReviewsByToiletQuery(
    externalId, 
    { skip: !toilet }
  )

  if (!open || !toilet) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[1001] bg-black/40" onClick={() => onOpenChange(false)} aria-hidden="true" />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[1002] rounded-t-2xl border-t border-black/10 bg-white shadow-2xl max-h-[85vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="mx-auto max-w-2xl p-6">
          {/* Handle */}
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-black/20" />

          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 id="drawer-title" className="text-2xl font-semibold tracking-tight text-black">
                {toilet.name || "Public Toilet"}
              </h2>
              {toilet.operator && <p className="mt-1 text-sm text-black/60">Operated by {toilet.operator}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close details">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {/* Fee */}
            <div className="flex items-center gap-3">
              <Euro className="h-5 w-5 text-black/60" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-black">Fee</p>
                <p
                  className={`text-sm font-semibold ${
                    toilet.isFree ? "text-green-600" : toilet.isPaid ? "text-amber-600" : "text-black/60"
                  }`}
                >
                  {toilet.isFree
                    ? "Free"
                    : toilet.isPaid
                      ? toilet.fee === "yes"
                        ? "Paid (Sanifair)"
                        : `Paid (${toilet.fee})`
                      : "Unknown"}
                </p>
              </div>
            </div>

            {/* Opening Hours */}
            {toilet.openingHours && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-black/60" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-black">Opening Hours</p>
                  <p className="text-sm text-black/60">{toilet.openingHours}</p>
                </div>
              </div>
            )}

            {/* Accessibility */}
            <div className="flex items-center gap-3">
              <Accessibility className="h-5 w-5 text-black/60" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-black">Accessibility</p>
                <p className={`text-sm font-semibold ${toilet.isAccessible ? "text-green-600" : "text-black/60"}`}>
                  {toilet.isAccessible ? "Wheelchair Accessible" : toilet.wheelchair ? toilet.wheelchair : "Unknown"}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-black/60" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-black">Coordinates</p>
                <p className="text-sm text-black/60">
                  {toilet.lat.toFixed(5)}, {toilet.lon.toFixed(5)}
                </p>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

           {/* Review Section */}
           <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Reviews</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="gap-2"
              >
                <MessageSquarePlus className="h-4 w-4" />
                {showReviewForm ? "Cancel Review" : "Add Review"}
              </Button>
            </div>

            {showReviewForm && (
              <div className="rounded-lg border p-4 bg-slate-50">
                <AddReviewForm toiletId={toilet.id} onSuccess={() => setShowReviewForm(false)} />
              </div>
            )}
            
            {/* Reviews List */}
            <div className="space-y-4">
              {isLoadingReviews ? (
                <div className="text-sm text-center text-muted-foreground py-4">Loading reviews...</div>
              ) : reviews && reviews.length > 0 ? (
                <div className="divide-y">
                  {reviews.map((review) => (
                    <div key={review.id} className="py-4 first:pt-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-slate-100">
                               <User className="h-3 w-3 text-slate-500" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Anonymous User</span>
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${review.rating >= star ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`}
                                />
                              ))}
                              <span className="text-[10px] text-muted-foreground ml-2">
                                {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Just now'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap pl-8">
                        {review.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No reviews yet. Be the first to share your experience!
                </div>
              )}
            </div>
          </div>



          {/* Directions Button */}
          <Button className="mt-6 w-full" asChild>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get directions to this toilet"
            >
              Get Directions
            </a>
          </Button>
        </div>
      </div>
    </>
  )
}
