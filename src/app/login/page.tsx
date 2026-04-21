'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    console.log('Attempting sign in with:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    console.log('Sign in result - data:', data)
    console.log('Sign in result - error:', error)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      console.log('Success! Redirecting to /dashboard...')
      window.location.href = '/dashboard'
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #cce8e5 0%, #a8d8d4 50%, #7ec8c3 100%)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mb-3 shadow-lg"
            style={{ background: 'linear-gradient(135deg,#e8622a,#f97316)' }}
          >
            A
          </div>
          <h1 className="text-2xl font-extrabold text-[#134e4a]">Abingh Portal</h1>
          <p className="text-[#4a8a85] text-sm mt-1">Client Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="jay@abingh.com"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-bold text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: loading ? '#ccc' : 'linear-gradient(135deg,#e8622a,#f97316)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            First time? Create your account in Supabase and then sign in here.
          </p>
        </div>
      </div>
    </div>
  )
}
