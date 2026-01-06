import { LoginForm1 } from "./components/login-form-1"
import { Logo } from "@/components/logo"
import Link from "next/link"
import { AccessDeniedError } from "@/app/auth/errors/access-denied/components/access-denied-error"

type SignInPageProps = {
  searchParams: Promise<{
    error?: string
    reason?: string
    returnUrl?: string
  }>
}

export default async function Page(props: SignInPageProps) {
  const searchParams = await props.searchParams
  const error = searchParams?.error

  // Если это AccessDenied error, показать our custom access denied page
  if (error === "AccessDenied") {
    return <AccessDeniedError />
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <Logo size={24} />
          </div>
          Beem Analytics
        </Link>
        <LoginForm1 returnUrl={searchParams?.returnUrl} />
      </div>
    </div>
  )
}
