"use client"

import { MapPin, Euro, Clock, Accessibility, X, MessageSquarePlus, Star, User, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Toilet } from "@/hooks/use-overpass"
import { AddReviewForm } from "./add-review-form"
import { useState, useEffect } from "react"
import { Separator } from "@/components/ui/separator"
import { useGetReviewsByToiletQuery, useReportToiletMutation, useVerifyToiletMutation } from "@/lib/services/api"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { useUser, useClerk } from "@clerk/nextjs"

interface ToiletDrawerProps {
  toilet: Toilet | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToiletDrawer({ toilet, open, onOpenChange }: ToiletDrawerProps) {
  const { user } = useUser()
  const { openSignIn } = useClerk()
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [hasVotedLocally, setHasVotedLocally] = useState(false) 
  const externalId = toilet?.externalId || ""
  
  // Local state to handle the verified badge status.
  // Initialized from props, but can be overridden by successful mutation response 
  // to prevent flickering before the next global fetch.
  const [isVerified, setIsVerified] = useState(toilet?.isVerified || false);

  const { data: reviews, isLoading: isLoadingReviews } = useGetReviewsByToiletQuery(
    externalId, 
    { skip: !toilet }
  )

  const [verifyToilet, { isLoading: isVerifying }] = useVerifyToiletMutation()
  const [reportToilet, { isLoading: isReporting }] = useReportToiletMutation()

  // Sync state with props when parent updates
  useEffect(() => {
    if (toilet) {
      setIsVerified(toilet.isVerified || false);
      
      const votedToilets = JSON.parse(localStorage.getItem('votedToilets') || '[]')
      setHasVotedLocally(votedToilets.includes(toilet.id))
    }
  }, [toilet])

  const markAsVoted = (id: number) => {
    setHasVotedLocally(true)
    const votedToilets = JSON.parse(localStorage.getItem('votedToilets') || '[]')
    if (!votedToilets.includes(id)) {
      localStorage.setItem('votedToilets', JSON.stringify([...votedToilets, id]))
    }
  }

  const handleVerify = async () => {
    if (!toilet) return

    if (!user) {
      toast.info("Please sign in", { description: "You need an account to verify toilets." })
      setTimeout(() => openSignIn(), 1500)
      return
    }
    
    // 1. Hide the poll box instantly (optimistic)
    setHasVotedLocally(true)
    
    try {
      // 2. Send Request
      await verifyToilet(toilet.id).unwrap()
      toast.success("Thanks for verifying!")
      
      // 3. Check badge status
      // We rely on the cache invalidation to re-fetch the toilet data globally
      // but for immediate feedback we assume success
      setIsVerified(true) // Optimistic
    } catch (err: any) {
      console.error("Failed to verify toilet", err)
      setHasVotedLocally(false) // Re-enable buttons
      const msg = err.data?.message || err.message || "Failed to verify"
      toast.error(msg)
    }
  }

  const handleReport = async () => {
    if (!toilet) return

    if (!user) {
      toast.info("Please sign in", { description: "You need an account to report issues." })
      setTimeout(() => openSignIn(), 1500)
      return
    }

    setHasVotedLocally(true)

    try {
      await reportToilet(toilet.id).unwrap()
      toast.success("Report submitted. Thanks!")
    } catch (err: any) {
      console.error("Failed to report", err)
      setHasVotedLocally(false)
      const msg = err.data?.message || err.message || "Failed to report"
      toast.error(msg)
    }
  }

  if (!open || !toilet) return null

  const showPollBox = !isVerified && !hasVotedLocally;

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
              <div className="flex items-center gap-2">
                <h2 id="drawer-title" className="text-2xl font-semibold tracking-tight text-black">
                  {toilet.name || "Public Toilet"}
                </h2>
                {isVerified && (
                  <CheckCircle className="h-5 w-5 text-blue-500" aria-label="Verified Location" />
                )}
                {!isVerified && (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    Unverified
                  </span>
                )}
              </div>
              {toilet.operator && <p className="mt-1 text-sm text-black/60">Operated by {toilet.operator}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close details">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Verification Actions */}
          {showPollBox && (
            <div className="mb-6 rounded-lg bg-slate-50 p-4">
              <p className="mb-3 text-sm font-medium text-slate-900">Is this toilet actually here?</p>
              <div className="flex gap-3">
                <Button 
                  size="sm" 
                  variant="default" // Primary action: Verify
                  onClick={handleVerify} 
                  disabled={isVerifying}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Yes, it exists
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleReport} 
                  disabled={isReporting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  No, it's missing
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Community reports help us keep the map accurate.
              </p>
            </div>
          )}

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
                <AddReviewForm externalId={externalId} onSuccess={() => setShowReviewForm(false)} />
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
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-slate-900">
                              {review.author?.username || "Traveler"}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${review.rating >= star ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Just now'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap">
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
