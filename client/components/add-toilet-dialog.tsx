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
  children?: React.ReactNode
}

export function AddToiletDialog({ children }: AddToiletDialogProps) {
  const [open, setOpen] = useState(false)
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
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude
        const userLng = position.coords.longitude
        
        // For this feature, we assume the user is standing AT the toilet location.
        // So toilet lat/lng = user lat/lng.
        // If we wanted to allow pin dropping, we'd need to pass coordinates in.
        const payload = {
            ...data,
            lat: userLat,
            lng: userLng,
            userLat, // Required by backend for verification
            userLng, // in case we allowed differing coords later
            isPaid: !data.isFree,
            wheelchair: data.isAccessible ? "yes" : "no",
        }

        try {
          await addToilet(payload).unwrap()
          toast({
            title: "Success",
            description: "Toilet added successfully!",
          })
          setOpen(false)
          form.reset()
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
      },
      (error) => {
        toast({
            title: "Location Error",
            description: "Could not retrieve your location. Please enable GPS.",
            variant: "destructive",
        })
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>Add Toilet</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Toilet</DialogTitle>
          <DialogDescription>
            Add a toilet at your current location. Please verify you are standing near it.
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
