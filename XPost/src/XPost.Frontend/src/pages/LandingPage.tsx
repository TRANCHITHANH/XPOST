import { Link } from 'react-router-dom';
import { Share2, Zap, BarChart2, Shield } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header / Nav */}
            <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">X</div>
                            <span className="font-bold text-xl text-gray-900 tracking-tight">Xpost</span>
                        </div>
                        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
                            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
                            <Link to="/privacy-policy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                            <Link to="/terms-of-service" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">Log In</Link>
                            <Link to="/login" className="text-sm font-bold bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 transition-all">Get Started</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main>
                <div className="relative pt-20 pb-32 overflow-hidden">
                    {/* Background decorations */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight mb-8">
                            Social Media Management <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Made Simple.</span>
                        </h1>
                        <p className="max-w-2xl mx-auto text-lg text-gray-600 mb-10 leading-relaxed">
                            Xpost is the ultimate platform to schedule posts, manage multiple social media accounts, and track advertising performance across Meta, TikTok, and more.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Link to="/login" className="px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl hover:-translate-y-1 transition-all">
                                Start your free trial
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Features */}
                <div id="features" className="bg-white py-24 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-gray-900">Why choose Xpost?</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="p-8 rounded-3xl bg-slate-50 border border-gray-100">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                                    <Share2 className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Multi-platform Publishing</h3>
                                <p className="text-gray-600">Connect your Facebook, TikTok, and X accounts to publish content simultaneously from one dashboard.</p>
                            </div>
                            <div className="p-8 rounded-3xl bg-slate-50 border border-gray-100">
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                                    <BarChart2 className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Ads & Insights</h3>
                                <p className="text-gray-600">Monitor your ad campaigns, track impressions and CTR with real-time data directly from the APIs.</p>
                            </div>
                            <div className="p-8 rounded-3xl bg-slate-50 border border-gray-100">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                                    <Shield className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & Compliant</h3>
                                <p className="text-gray-600">Xpost strictly follows developer policies. We never store your passwords, only secure access tokens.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-gray-900 py-12 border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-gray-900 font-bold text-xs">X</div>
                        <span className="font-bold text-white tracking-tight">Xpost</span>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-400">
                        <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
                        <a href="mailto:support@xpost.vn" className="hover:text-white transition-colors">Contact</a>
                    </div>
                    <p className="text-sm text-gray-500">© {new Date().getFullYear()} Xpost. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
