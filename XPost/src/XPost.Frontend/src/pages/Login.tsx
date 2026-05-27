import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const firstName = formData.get('firstName') as string || '';
        const lastName = formData.get('lastName') as string || '';

        try {
            if (isLogin) {
                const res = await api.post('/auth/login', { email, password });
                localStorage.setItem('token', res.data.token);
                toast.success('Logged in successfully');
                window.location.href = '/dashboard';
            } else {
                const payload = {
                    email,
                    password,
                    firstName,
                    lastName,
                    fullName: `${firstName} ${lastName}`.trim()
                };
                await api.post('/auth/register', payload);
                setIsLogin(true);
                toast.success('Registration successful. Please login.');
            }
        } catch (err: any) {
            console.error("Auth error:", err.response?.data);
            if (err.response?.data?.errors) {
                const firstErrorKey = Object.keys(err.response.data.errors)[0];
                toast.error(err.response.data.errors[firstErrorKey][0]);
            } else {
                const data = err.response?.data;
                toast.error(data?.message || data?.Message || data?.title || data?.detail || 'Email hoặc mật khẩu không chính xác.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border border-gray-100">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
                {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>

            <form key={isLogin ? 'login' : 'register'} onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                    <div className="flex gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">First Name</label>
                            <input type="text" name="firstName" required
                                className="mt-1 w-full rounded border border-gray-300 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Last Name</label>
                            <input type="text" name="lastName" required
                                className="mt-1 w-full rounded border border-gray-300 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" name="email" required
                        className="mt-1 w-full rounded border border-gray-300 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input type="password" name="password" required
                        className="mt-1 w-full rounded border border-gray-300 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>

                <button disabled={loading} type="submit"
                    className="w-full bg-blue-600 text-white flex items-center justify-center gap-2 font-semibold p-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {isLogin ? 'Sign In' : 'Sign Up'}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:underline">
                    {isLogin ? 'Sign up' : 'Log in'}
                </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-4 text-xs text-gray-400">
                <Link to="/privacy-policy" className="hover:text-blue-600 transition-colors">Chính sách bảo mật</Link>
                <span>•</span>
                <Link to="/terms-of-service" className="hover:text-blue-600 transition-colors">Điều khoản dịch vụ</Link>
            </div>
        </div>
    );
}
