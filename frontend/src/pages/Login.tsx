import Layout from "@/components/Layout";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login as apiLogin, setAuthTokens, setStoredUser } from "@/lib/api";

export default function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()
    const location = useLocation()

    const from = (location.state as any)?.from?.pathname || '/dashboard'

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const res = await apiLogin(email, password)
            setAuthTokens(res.accessToken, res.refreshToken)
            setStoredUser(res.user)
            navigate(from, { replace: true })
        } catch (err: any) {
            setError(err.message || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-claret h-screen text-claret font-pompiere">
            <header className="fixed top-0 left-0 w-full h-16 flex justify-between px-4 md:px-10 items-center">
                <h1 className="font-modern font-black text-4xl text-pink">heph</h1>
            </header>

            <div className="flex items-center justify-center h-screen pt-16">
                <form onSubmit={handleSubmit} className="bg-pink border border-claret shadow-2xl rounded-2xl min-h-1/2 md:min-h-3/5 w-11/12 md:w-1/3 p-12 flex flex-col">
                    <h2 className="font-pompiere text-[32px] md:text-5xl z-20 text-claret text-center mb-4 md:mb-8 font-black">Hi baby, welcome back!</h2>

                    <div className="flex flex-1 flex-col gap-8 md:gap-12 justify-center">
                        {error ? (
                            <div className="rounded-xl border border-claret/30 bg-claret p-3 text-pink">
                                <p className="font-semibold">{error}</p>
                            </div>
                        ) : null}

                        <label htmlFor="email" className="font-semibold text-lg md:text-xl">
                            Email
                            <input value={email} onChange={(e) => setEmail(e.target.value)} id="email" type="email" className="border border-claret rounded-2xl p-3 md:p-4 w-full focus:outline-none focus:ring-1 focus:ring-claret bg-pink" />
                        </label>

                        <label htmlFor="password" className="font-semibold text-lg md:text-xl">
                            Password
                            <input value={password} onChange={(e) => setPassword(e.target.value)} id="password" type="password" className="border border-claret rounded-2xl p-3 md:p-4 w-full focus:outline-none focus:ring-1 focus:ring-claret bg-pink" />
                        </label>

                        <button disabled={loading} type="submit" className="border border-claret rounded-2xl p-2 md:p-4 focus:outline-none focus:ring-offset-2 focus:ring-offset-pink focus:ring-2 focus:ring-claret bg-claret text-pink uppercase tracking-widest text-xl hover:bg-claret/90 transition-all w-full">
                            {loading ? 'Logging in…' : 'Login'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}