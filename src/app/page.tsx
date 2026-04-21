import { redirect } from 'next/navigation'

// Root route — middleware will handle redirecting to /login or /dashboard
// This is a fallback in case middleware doesn't catch it
export default function Home() {
  redirect('/dashboard')
}
