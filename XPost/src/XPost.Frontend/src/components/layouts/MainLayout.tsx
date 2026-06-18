import { useState, useEffect } from 'react';
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, User, ShieldCheck, Settings } from 'lucide-react';
import api, { setLoggingOut } from '../../lib/axios';

/**
 * Icons as Inline SVGs for consistent look without extra dependencies
 */
const Icons = {
    Dashboard: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
    ),
    Posts: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
    ),
    Calendar: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    ),
    Platforms: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
    ),
    Media: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
    ),
    Keywords: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L21 2m-11 11l-2 2m11-11l-2 2" /></svg>
    ),
    Analytics: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
    ),
    Users: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    ),
    Settings: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
    ),
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    ),
    Bell: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
    ),
    Menu: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
    ),
    ChevronRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    ),
    Megaphone: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
    )
};

const getPlatformConfig = (value: number) => {
    switch (value) {
        case 1: return { color: 'text-blue-600', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg> };
        case 3: return { color: 'text-pink-600', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> };
        case 7: return { color: 'text-indigo-600', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.027-.78-.07-1.109zm-7.981.105c.647-.034 1.233-.1 1.233-.1.58-.068.512-.921-.068-.889 0 0-1.744.137-2.866.137-1.055 0-2.865-.137-2.865-.137-.58-.032-.648.856-.068.889 0 0 .552.066 1.133.1l1.682 4.615-2.364 7.088L6.841 6.93c.649-.034 1.233-.1 1.233-.1.581-.068.513-.921-.067-.889 0 0-1.745.137-2.866.137-.201 0-.44-.005-.697-.015C6.273 3.56 8.96 1.907 12 1.907c2.266 0 4.33.867 5.88 2.285-.038-.002-.075-.006-.114-.006-.888 0-1.517.774-1.517 1.604 0 .744.43 1.374.888 2.118.344.587.744 1.341.744 2.43 0 .753-.29 1.626-.674 2.843l-.882 2.95-3.19-9.489.003-.012zM12 22.094c-1.41 0-2.746-.29-3.959-.814l4.208-12.225 4.31 11.81c.028.07.056.092.084.162A10.043 10.043 0 0 1 12 22.094zM1.213 12c0-2.084.607-4.03 1.656-5.666L8.131 20.73C4.128 18.96 1.213 15.79 1.213 12zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" /></svg> };
        case 8: return { color: 'text-cyan-600', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg> };
        case 11: return { color: 'text-gray-900', icon: <svg viewBox="0 0 448 512" className="w-4 h-4" fill="currentColor"><path d="M120.12 208.29c-3.88-2.9-7.77-4.35-11.65-4.35H91.03v104.47h17.45c3.88 0 7.77-1.45 11.65-4.35 3.88-2.9 5.82-7.25 5.82-13.06v-69.65c-.01-5.8-1.96-10.16-5.83-13.06zM448 80v352c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48V80c0-26.51 21.49-48 48-48h352c0 26.51 21.49 48 48 48zm-227.27 102.44c0-3.9-3.17-7.07-7.07-7.07H173.8c-3.9 0-7.07 3.17-7.07 7.07v147.11c0 3.9 3.17 7.07 7.07 7.07h40.41c3.9 0 7.07-3.17 7.07-7.07v-147.11zM158.37 128H48c-8.84 0-16 7.16-16 16v224c0 8.84 7.16 16 16 16h110.37c8.84 0 16-7.16 16-16V144c0-8.84-7.16-16-16-16zm241.63 48.44c0-3.9-3.17-7.07-7.07-7.07h-40.41c-3.9 0-7.07 3.17-7.07 7.07v147.11c0 3.9 3.17 7.07 7.07 7.07h40.41c3.9 0 7.07-3.17 7.07-7.07v-147.11z" /></svg> };
        case 12: return { color: 'text-orange-500', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M16 3H8C5.239 3 3 5.239 3 8v8c0 2.761 2.239 5 5 5h8c2.761 0 5-2.239 5-5V8c0-2.761-2.239-5-5-5zm-2.5 13H10c-1.657 0-3-1.343-3-3s1.343-3 3-3V8h6v2h-6v2h3.5c1.657 0 3 1.343 3 3s-1.343 3-3 3z" /></svg> };
        case 2: return { color: 'text-black', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M14.258 10.152L23.176 0h-2.113l-7.747 8.813L7.133 0H0l9.352 13.328L0 24h2.113l8.176-9.309L16.867 24h7.133zm-2.895 3.293l-.949-1.328L2.875 1.56H5.93l6.082 8.508.949 1.328 7.854 10.985h-3.055z" /></svg> };
        case 6: return { color: 'text-black', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12c0 6.627 5.372 12 12 12s12-5.373 12-12c0-6.628-5.372-12-12-12zm-1.026 15.656h-2.61V8.344h2.61v7.312zm-1.306-8.31a1.514 1.514 0 1 1 0-3.028 1.514 1.514 0 0 1 0 3.028zm7.391 8.31h-2.61v-3.79c0-.904-.016-2.067-1.259-2.067-1.261 0-1.453.985-1.453 2.001v3.856h-2.61V8.344h2.505v.998h.036c.349-.66 1.199-1.355 2.467-1.355 2.639 0 3.125 1.737 3.125 3.996v3.673z" /></svg> };
        case 5: return { color: 'text-black', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M15.426 6.848h-6.848c-1.308 0-2.368 1.06-2.368 2.368v5.568c0 1.308 1.06 2.368 2.368 2.368h6.848c1.308 0 2.368-1.06 2.368-2.368V9.216c0-1.308-1.06-2.368-2.368-2.368zM12 15.664c-1.611 0-2.916-1.305-2.916-2.916 0-1.611 1.305-2.916 2.916-2.916 1.611 0 2.916 1.305 2.916 2.916 0 1.611-1.305 2.916-2.916 2.916z" /></svg> };
        default: return { color: 'text-gray-500', icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle></svg> };
    }
};

const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Icons.Dashboard },
    { name: 'Keywords AI', path: '/keywords', icon: Icons.Keywords },
    { name: 'Posts', path: '/posts', icon: Icons.Posts },
    { name: 'Categories', path: '/categories', icon: Icons.Menu },
    { name: 'Calendar', path: '/calendar', icon: Icons.Calendar },
    {
        name: 'Platforms',
        path: '/platforms',
        icon: Icons.Platforms,
        isDynamicSubItems: true
    },
    {
        name: 'Ads Manager',
        path: '/facebook-ads',
        icon: Icons.Megaphone,
        isStaticSubItems: true,
        subItems: [
            {
                name: 'Facebook Ads',
                path: '/facebook-ads',
                color: 'text-blue-600',
                icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            },
            {
                name: 'TikTok Ads',
                path: '/tiktok-ads',
                color: 'text-black',
                icon: <svg viewBox="0 0 448 512" className="w-4 h-4" fill="currentColor"><path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25v178.66A172.93 172.93 0 1 1 152.3 176.5a171.18 171.18 0 0 1 73-16.14h38.66v72.82c-7.77-1.39-15.82-2.11-24-2.11a100.08 100.08 0 1 0 100.07 100.07V0h73.74a209.18 209.18 0 0 0 34.33 97.63c22.61 24.32 53.64 38.64 88.08 41.5v70.78z" /></svg>
            }
        ]
    },
    { name: 'Media Library', path: '/media', icon: Icons.Media },
    { name: 'Analytics', path: '/analytics', icon: Icons.Analytics },
    { name: 'Users', path: '/users', icon: Icons.Users },
    { name: 'Company', path: '/settings/company', icon: Icons.Settings },
    { name: 'System Tenants', path: '/admin/tenants', icon: Icons.Settings },
];

export default function MainLayout() {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>(['Platforms', 'Ads Manager']);
    const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
    const location = useLocation();
    const navigate = useNavigate();

    // Fetch accounts
    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await api.get('/socialaccounts');
                setConnectedAccounts(res.data);
            } catch (err) {
                console.error('Failed to fetch accounts:', err);
            }
        };
        fetchAccounts();

        // Listen to custom event when account is added/removed
        const onAccountsChange = () => fetchAccounts();
        window.addEventListener('social_accounts_updated', onAccountsChange);
        return () => window.removeEventListener('social_accounts_updated', onAccountsChange);
    }, []);

    // Lấy thông tin user từ JWT để phần quyền Menu
    const getPayload = () => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return null;
        }
    };

    const payload = getPayload();
    const role = payload ? (payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || '') : '';
    const email = payload ? (payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || payload.email || 'User') : 'User';

    const filteredMenuItems = menuItems.filter(item => {
        if (item.name === 'System Tenants' && role !== 'SuperAdmin') return false;
        return true;
    });

    const handleLogout = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoggingOut();
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setIsProfileOpen(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Format breadcrumb from path
    const pathParts = location.pathname.split('/').filter(x => x);
    let lastPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'Dashboard';
    // If the last part is a GUID, use the preceding part (e.g., 'Edit Post' instead of '80dc...')
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastPart) && pathParts.length > 1) {
        lastPart = `${pathParts[pathParts.length - 2]} ${pathParts[pathParts.length - 3] || 'Item'}`;
        // cleanup e.g. "edit posts" -> "Edit posts"
    }
    const pageTitle = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
            {/* 1. Header (Topbar) */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-xl border-b border-gray-100 z-50 px-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
                    >
                        <Icons.Menu />
                    </button>

                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">X</div>
                        <span className="font-bold text-xl tracking-tight hidden sm:block">XPost</span>
                    </div>

                    {/* Desktop Search */}
                    <div className="hidden md:flex items-center bg-gray-100 px-3 py-1.5 rounded-full ml-8 w-64 border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all">
                        <Icons.Search />
                        <input
                            type="text"
                            placeholder="Search anything..."
                            className="bg-transparent border-none focus:ring-0 text-sm w-full ml-2 outline-none"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Notifications */}
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors">
                        <Icons.Bell />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>

                    {/* User Profile */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsProfileOpen(!isProfileOpen); }}
                            className="flex items-center gap-2 p-1 pl-3 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold leading-none">{email.split('@')[0]}</p>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{role || 'Vô Danh'}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold uppercase">
                                {email.charAt(0)}
                            </div>
                        </button>

                        {/* Profile Dropdown */}
                        {isProfileOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                                <button onClick={(e) => { e.stopPropagation(); navigate('/profile'); setIsProfileOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                    <User className="w-4 h-4" />
                                    Profile Settings
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); navigate('/profile'); setIsProfileOpen(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                    <ShieldCheck className="w-4 h-4" />
                                    Account Security
                                </button>
                                <hr className="my-2 border-gray-100" />
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex flex-1 pt-16">
                {/* 2. Left Sidebar Navigation */}
                <aside
                    className={`
            fixed inset-y-0 left-0 pt-16 bg-[#FAFAFA] border-r border-gray-100 transition-all duration-300 z-40
            ${isSidebarCollapsed ? 'w-20' : 'w-64'}
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:sticky lg:h-[calc(100vh-64px)]
          `}
                >
                    {/* Desktop Toggle Button */}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="absolute -right-3 top-4 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm hidden lg:flex"
                    >
                        <div className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`}>
                            <Icons.ChevronRight />
                        </div>
                    </button>

                    <nav className="p-4 flex flex-col gap-1 h-full overflow-y-auto custom-scrollbar">
                        {filteredMenuItems.map((item) => (
                            <div key={item.name} className="flex flex-col gap-1">
                                {(item as any).isDynamicSubItems ? (
                                    <>
                                        <div
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                                                setExpandedMenus(prev =>
                                                    prev.includes(item.name) ? prev.filter(m => m !== item.name) : [...prev, item.name]
                                                );
                                            }}
                                            className={`
                                              flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 group cursor-pointer
                                              ${location.pathname.startsWith(item.path)
                                                    ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-gray-100/80 text-gray-900 font-medium'
                                                    : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`${isSidebarCollapsed ? 'mx-auto' : ''}`}>
                                                    <item.icon />
                                                </div>
                                                {!isSidebarCollapsed && <span className="text-sm">{item.name}</span>}
                                            </div>
                                            {!isSidebarCollapsed && (
                                                <div className={`transition-transform duration-200 ${expandedMenus.includes(item.name) ? 'rotate-90' : ''}`}>
                                                    <Icons.ChevronRight />
                                                </div>
                                            )}

                                            {isSidebarCollapsed && (
                                                <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                                    {item.name}
                                                </div>
                                            )}
                                        </div>
                                        {/* Render Dynamic SubItems */}
                                        {expandedMenus.includes(item.name) && !isSidebarCollapsed && (
                                            <div className="flex flex-col gap-1 pl-9 mt-1 mb-2">
                                                {/* Manage connection item */}
                                                <NavLink
                                                    to={item.path}
                                                    className={({ isActive }) => `text-sm py-2 px-3 rounded-lg transition-colors flex items-center gap-2
                                                        ${isActive && location.pathname === item.path ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-blue-600 hover:bg-black/5'}`}
                                                    end
                                                >
                                                    {location.pathname === item.path && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                                                    <Settings className="w-4 h-4 text-gray-400" />
                                                    Quản lý kết nối
                                                </NavLink>

                                                {/* Accounts items */}
                                                {connectedAccounts.map((account: any) => {
                                                    const subPath = `${item.path}/${account.id}/manage`;
                                                    const config = getPlatformConfig(account.platform);
                                                    const isSubActive = location.pathname === subPath;
                                                    return (
                                                        <NavLink
                                                            key={account.id}
                                                            to={subPath}
                                                            className={({ isActive }) => `text-sm py-2 px-3 rounded-lg transition-colors flex items-center gap-2
                                                                ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-blue-600 hover:bg-black/5'}`}
                                                        >
                                                            {isSubActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                                                            <div className={config.color}>{config.icon}</div>
                                                            <span className="truncate max-w-[120px]">{account.accountName}</span>
                                                        </NavLink>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : (item as any).isStaticSubItems ? (
                                    <>
                                        <div
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                                                setExpandedMenus(prev =>
                                                    prev.includes(item.name) ? prev.filter(m => m !== item.name) : [...prev, item.name]
                                                );
                                            }}
                                            className={`
                                              flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 group cursor-pointer
                                              ${location.pathname.startsWith(item.path) || (item.subItems as any[]).some(sub => location.pathname.startsWith(sub.path))
                                                    ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-gray-100/80 text-gray-900 font-medium'
                                                    : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`${isSidebarCollapsed ? 'mx-auto' : ''}`}>
                                                    <item.icon />
                                                </div>
                                                {!isSidebarCollapsed && <span className="text-sm">{item.name}</span>}
                                            </div>
                                            {!isSidebarCollapsed && (
                                                <div className={`transition-transform duration-200 ${expandedMenus.includes(item.name) ? 'rotate-90' : ''}`}>
                                                    <Icons.ChevronRight />
                                                </div>
                                            )}

                                            {isSidebarCollapsed && (
                                                <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                                    {item.name}
                                                </div>
                                            )}
                                        </div>
                                        {/* Render Static SubItems */}
                                        {expandedMenus.includes(item.name) && !isSidebarCollapsed && (
                                            <div className="flex flex-col gap-1 pl-9 mt-1 mb-2">
                                                {(item.subItems as any[]).map((sub) => (
                                                    <NavLink
                                                        key={sub.name}
                                                        to={sub.path}
                                                        className={({ isActive }) => `text-sm py-2 px-3 rounded-lg transition-colors flex items-center gap-2
                                                             ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-blue-600 hover:bg-black/5'}`}
                                                    >
                                                        {location.pathname === sub.path && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                                                        <div className={sub.color}>{sub.icon}</div>
                                                        <span className="truncate">{sub.name}</span>
                                                    </NavLink>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <NavLink
                                        to={item.path}
                                        className={({ isActive }) => `
                                            flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group
                                            ${isActive
                                                ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-gray-100/80 text-gray-900 font-medium'
                                                : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'}
                                        `}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <div className={`${isSidebarCollapsed ? 'mx-auto' : ''}`}>
                                                    <item.icon />
                                                </div>
                                                {!isSidebarCollapsed && <span className="text-sm">{item.name}</span>}

                                                {isActive && !isSidebarCollapsed && (
                                                    <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                                )}

                                                {isSidebarCollapsed && (
                                                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                                        {item.name}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </NavLink>
                                )}
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* 3. Main Content Area */}
                <main className="flex-1 flex flex-col p-4 md:p-8 min-w-0">
                    <div className={`w-full ${location.pathname.includes('-ads') ? '' : 'max-w-7xl mx-auto'}`}>
                        {/* Breadcrumb */}
                        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                            <a href="/" className="hover:text-blue-600">Home</a>
                            <Icons.ChevronRight />
                            <span className="text-gray-600">{pageTitle}</span>
                        </nav>

                        {/* Page Header */}
                        <header className="mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{pageTitle}</h1>
                            <p className="text-sm text-gray-500 mt-1">Manage your system activity and insights.</p>
                        </header>

                        {/* Dynamic Content */}
                        <div className="min-h-[400px]">
                            <Outlet /> {/* Renders the child route components */}
                        </div>
                    </div>

                    {/* 4. Footer */}
                    <footer className="mt-auto pt-12 pb-6 border-t border-gray-100">
                        <div className="text-center">
                            <p className="text-xs text-gray-400">
                                &copy; {new Date().getFullYear()} <span className="font-semibold text-gray-600">XPost System</span>. All rights reserved.
                            </p>
                            <div className="flex items-center justify-center gap-4 mt-2">
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] uppercase font-bold tracking-widest">Version 1.0.0-beta</span>
                                <div className="flex items-center gap-1 text-[10px] text-gray-300">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                    System Online
                                </div>
                            </div>
                        </div>
                    </footer>
                </main>
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
      `}} />
        </div>
    );
}
