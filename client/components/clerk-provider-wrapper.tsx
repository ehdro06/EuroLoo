'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { neobrutalism } from '@clerk/themes'

const SIGN_IN_NOTICE = 'By signing in you agree to the Terms of Service and Privacy Policy.'

export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      // Shown in the sign-in and sign-up windows
      localization={{
        signIn: { start: { subtitle: SIGN_IN_NOTICE, subtitleCombined: SIGN_IN_NOTICE } },
        signUp: { start: { subtitle: SIGN_IN_NOTICE, subtitleCombined: SIGN_IN_NOTICE } },
      }}
      appearance={{
        baseTheme: neobrutalism,
        // Adds Terms and Privacy links to the sign-in and sign-up windows
        layout: { termsPageUrl: '/terms', privacyPageUrl: '/privacy' },
        variables: { 
          colorPrimary: '#000000', 
          colorText: '#000000',
        },
        elements: {
          formButtonPrimary: 'bg-black text-white hover:bg-black/80',
          footerActionLink: 'text-black hover:text-black/80',
          card: 'bg-white border text-black shadow-xl rounded-xl',
        }
      }}
    >
      {children}
    </ClerkProvider>
  )
}
