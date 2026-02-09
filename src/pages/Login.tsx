// =============================================================================
// DiBeliin Admin - Login Page
// =============================================================================
// Premium login page with gradient background and glass card

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                setError(authError.message);
                toast.error('Login failed: ' + authError.message);
                return;
            }

            toast.success('Welcome back!');
            navigate('/inventory');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An error occurred';
            setError(message);
            toast.error('Login failed: ' + message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-emerald-50" />

            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-100/20 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

            {/* Pattern Overlay */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            />

            {/* Login Card */}
            <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/80 backdrop-blur-xl animate-fade-in">
                <CardHeader className="text-center space-y-6 pb-2">
                    {/* Logo */}
                    <div className="mx-auto relative">
                        <div className="absolute inset-0 bg-amber-400/20 blur-xl rounded-full scale-150" />
                        <img
                            src="/Logo DiBeliin Admin.png"
                            alt="DiBeliin Admin"
                            className="relative h-24 w-auto drop-shadow-lg"
                        />
                    </div>

                    <div className="space-y-2">
                        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            DiBeliin Admin
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-base">
                            Sign in to manage your coffee shop accounts
                        </CardDescription>
                    </div>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5 pt-4">
                        {/* Error Alert */}
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3 animate-fade-in">
                                <div className="p-1.5 bg-red-100 rounded-lg">
                                    <Lock className="h-4 w-4" />
                                </div>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 font-medium">
                                Email Address
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@dibeliin.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className="h-12 pl-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:border-amber-400 focus:ring-amber-400/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-700 font-medium">
                                Password
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className="h-12 pl-12 bg-slate-50/50 border-slate-200 focus:bg-white focus:border-amber-400 focus:ring-amber-400/20 transition-all"
                                />
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex-col gap-4 pt-2">
                        <Button
                            type="submit"
                            className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-5 w-5" />
                                    Sign In
                                </>
                            )}
                        </Button>

                        <p className="text-sm text-slate-400 text-center">
                            Jastip Management System v1.0
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
