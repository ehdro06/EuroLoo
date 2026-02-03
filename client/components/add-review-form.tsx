"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAddReviewMutation } from "@/lib/services/api"
import { toast } from "sonner" // Assuming sonner is installed as seen in components list

interface AddReviewFormProps {
  toiletId: number
  onSuccess?: () => void
}

export function AddReviewForm({ toiletId, onSuccess }: AddReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [cleanliness, setCleanliness] = useState("3")
  const [isFree, setIsFree] = useState(true)
  const [fee, setFee] = useState("")
  const [comment, setComment] = useState("")
  
  const [addReview, { isLoading }] = useAddReviewMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      // toast.error("Please select a star rating")
      alert("Please select a star rating") 
      return
    }

    // Construct the composite content
    let finalContent = comment
    const extras: string[] = []
    
    extras.push(`Cleanliness: ${cleanliness}/5`)
    
    if (isFree) {
      extras.push("Fee: Free")
    } else {
      extras.push(`Fee: €${fee || '0'}`)
    }

    if (extras.length > 0) {
      finalContent = `${finalContent}\n\n[Details: ${extras.join(", ")}]`
    }

    try {
      await addReview({
        externalId: `node-${toiletId}`,
        rating,
        content: finalContent.trim(),
      }).unwrap()

      // toast.success("Review submitted!")
      setRating(0)
      setComment("")
      setCleanliness("3")
      setIsFree(true)
      setFee("")
      onSuccess?.()
    } catch (error) {
      console.error("Failed to submit review:", error)
      // toast.error("Failed to submit review")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="text-yellow-400 focus:outline-none"
            >
              <Star
                className={`h-6 w-6 ${rating >= star ? "fill-current" : "text-gray-300"}`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cleanliness">Cleanliness (1-5)</Label>
        <Select value={cleanliness} onValueChange={setCleanliness}>
          <SelectTrigger>
            <SelectValue placeholder="Select cleanliness" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((val) => (
              <SelectItem key={val} value={val.toString()}>
                {val} - {val === 1 ? "Dirty" : val === 5 ? "Spotless" : "Average"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="free" 
            checked={isFree} 
            onCheckedChange={(checked) => setIsFree(checked as boolean)} 
          />
          <Label htmlFor="free">Entry is free?</Label>
        </div>
        {!isFree && (
          <div className="pt-2">
             <Label htmlFor="fee">Fee (€)</Label>
             <Input 
                id="fee"
                type="number" 
                step="0.10" 
                placeholder="0.50" 
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                required={!isFree}
             />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment">Comment</Label>
        <Textarea
          id="comment"
          placeholder="Share your experience..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Submitting..." : "Submit Review"}
      </Button>
    </form>
  )
}
