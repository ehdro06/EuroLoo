"use client"

import { useCallback } from "react"
import { useClerk } from "@clerk/nextjs"

// Opens the Clerk sign-in modal and returns the user to the exact current URL
// afterwards (including map position and open toilet), even when sign-in goes
// through a full-page redirect such as Google OAuth.
export function useSignInHere() {
  const { openSignIn } = useClerk()
  return useCallback(() => {
    const returnUrl = window.location.href
    openSignIn({ forceRedirectUrl: returnUrl, signUpForceRedirectUrl: returnUrl })
  }, [openSignIn])
}
