"use client"

import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { useAddToiletMutation } from "@/lib/services/api"
import { getErrorMessage } from "@/lib/errors"

interface AddToiletFormValues {
  name: string
  operator: string
  fee: string
  isFree: boolean
  isAccessible: boolean
  openingHours: string
}

interface AddToiletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: { lat: number; lng: number } | null
  userLocation: { lat: number; lng: number } | null
  onSuccess?: () => void
}

export function AddToiletDialog({ open, onOpenChange, location, userLocation, onSuccess }: AddToiletDialogProps) {
  const [addToilet, { isLoading }] = useAddToiletMutation()
  
  const form = useForm<AddToiletFormValues>({
    defaultValues: {
      name: "",
      operator: "",
      fee: "",
      isFree: false,
      isAccessible: false,
      openingHours: "",
    },
  })

  // We need to capture location when the user submits or opens the dialog
  // Let's do it on submit to ensure freshness, or check availability first.
  
  const onSubmit = async (data: AddToiletFormValues) => {
    if (!location || !userLocation) {
      toast.error("Error", {
        description: "Missing location data",
      })
      return
    }

    const payload = {
        ...data,
        lat: location.lat,
        lng: location.lng,
        userLat: userLocation.lat, // Required by backend for verification
        userLng: userLocation.lng, 
        isPaid: !data.isFree,
        fee: data.isFree ? "no" : (data.fee || "Unknown"), // Only set fee to Unknown if paid but fee unspecified
        wheelchair: data.isAccessible ? "yes" : "no",
    }

    try {
        await addToilet(payload).unwrap()
        toast.success("Toilet added successfully!")
        onOpenChange(false)
        form.reset()
        onSuccess?.()
    } catch (error) {
            console.error(error)
            toast.error(getErrorMessage(error, "Failed to add toilet"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Toilet</DialogTitle>
          <DialogDescription>
            Confirm details for the selected location.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Public Toilet" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isFree"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Free to use?</FormLabel>
                   
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {!form.watch("isFree") && (
                <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Fee (e.g. 0.50 EUR)</FormLabel>
                    <FormControl>
                        <Input placeholder="0.50" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}

             <FormField
              control={form.control}
              name="isAccessible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Wheelchair Accessible?</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Location
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
