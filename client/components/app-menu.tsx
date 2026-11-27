"use client"

import Image from "next/image"
import Link from "next/link"
import { Menu, Plus, ShieldCheck, X } from "lucide-react"
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface AppMenuProps {
  onSignIn: () => void
  onAddToilet: () => void
  isAddingToilet: boolean
}

/**
 * Everything that isn't used on every visit: who we are, signing in, adding a toilet and the
 * legal pages. Kept out of the way so the map can have the whole screen.
 */
export function AppMenu({ onSignIn, onAddToilet, isAddingToilet }: AppMenuProps) {
  const { user } = useUser()
  const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-black hover:bg-slate-100"

  return (
    <Dialog>
      <DialogTrigger
        aria-label="Menu"
        className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-md hover:bg-slate-50"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 flex h-full max-h-none w-[min(20rem,85vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-r-2xl border-0 border-r border-black/10 bg-white p-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-none"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <Image src="/icon.svg" width={46} height={46} alt="" className="h-8 w-8" />
            <DialogTitle className="text-lg font-semibold text-black">EuroLoo</DialogTitle>
          </div>
          <DialogClose aria-label="Close menu" className="rounded-full p-2 text-black/70 hover:bg-slate-100 hover:text-black">
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogClose>
        </div>

        <DialogDescription className="px-4 pt-3 text-sm text-black/70">
          Find nearby public toilets fast. Privacy-first by default.
        </DialogDescription>

        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Main">
          <SignedOut>
            <DialogClose className={row} onClick={onSignIn}>
              Sign in
            </DialogClose>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-3 px-3 py-2">
              <UserButton />
              <span className="truncate text-sm text-black/70">{user?.username ?? user?.firstName ?? "Signed in"}</span>
            </div>
            {user?.publicMetadata?.role === "admin" && (
              <a href="/admin" className={row}>
                Admin
              </a>
            )}
          </SignedIn>

          <DialogClose className={row} onClick={onAddToilet}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {isAddingToilet ? "Cancel adding a toilet" : "Add a missing toilet"}
          </DialogClose>

          <div className="my-2 border-t border-black/10" />

          <Link href="/privacy" className={row}>
            Privacy
          </Link>
          <Link href="/terms" className={row}>
            Terms
          </Link>
        </nav>

        <p className="flex items-center gap-2 border-t border-black/10 px-4 py-3 text-xs text-black/70">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          No tracking. Powered by OpenStreetMap open data.
        </p>
      </DialogContent>
    </Dialog>
  )
}
