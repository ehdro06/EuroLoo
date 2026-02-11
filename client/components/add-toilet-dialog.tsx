"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2, map } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { useAddToiletMutation } from "@/lib/services/api"

interface AddToiletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: { lat: number; lng: number } | null
  userLocation: { lat: number; lng: number } | null
  onSuccess?: () => void
}

export function AddToiletDialog({ open, onOpenChange, location, userLocation, onSuccess }: AddToiletDialogProps) {
  const [addToilet, { isLoading }] = useAddToiletMutation()
  const { toast } = useToast()
  
  const form = useForm({
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
  
  const onSubmit = async (data: any) => {
    if (!location || !userLocation) {
      toast({
        title: "Error",
        description: "Missing location data",
        variant: "destructive",
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
        wheelchair: data.isAccessible ? "yes" : "no",
    }

    try {
        await addToilet(payload).unwrap()
        toast({
        title: "Success",
        description: "Toilet added successfully!",
        })
        onOpenChange(false)
        form.reset()
        onSuccess?.()
    } catch (error: any) {
            console.error(error)
            // Backend returns 400 with message
            let msg = "Failed to add toilet"
            if (error.data && error.data.message) {
                msg = error.data.message
            }
            toast({
            title: "Error",
            description: msg,
            variant: "destructive",
            })
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
