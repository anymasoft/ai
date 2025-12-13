"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"

export function AccessDeniedError() {
  const router = useRouter()

  return (
    <div className='mx-auto flex min-h-dvh flex-col items-center justify-center gap-8 p-8 md:gap-12 md:p-16'>
      <div className='flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10'>
        <AlertCircle className='h-10 w-10 text-destructive' />
      </div>
      <div className='text-center'>
        <h1 className='mb-4 text-3xl font-bold'>Access Denied</h1>
        <h2 className="mb-3 text-2xl font-semibold">Your account has been disabled</h2>
        <p className='mb-6 max-w-lg text-muted-foreground'>
          Your access to YouTube Analytics has been temporarily restricted. If you believe this is a mistake, please contact our support team for assistance.
        </p>
        <div className='mt-6 flex flex-col items-center justify-center gap-3 md:mt-8 md:flex-row'>
          <Button
            className='cursor-pointer'
            onClick={() => router.push('/')}
          >
            Return to Home
          </Button>
          <Button
            variant='outline'
            className='flex cursor-pointer items-center gap-1'
            onClick={() => window.location.href = 'mailto:support@example.com'}
          >
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  )
}
