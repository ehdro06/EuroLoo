'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { neobrutalism } from '@clerk/themes'

export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: neobrutalism,
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
