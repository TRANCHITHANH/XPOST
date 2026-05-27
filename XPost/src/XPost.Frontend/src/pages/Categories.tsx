import { useState, useEffect } from 'react';
import { FolderTree, RefreshCw, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string;
    parentId: string | null;
    sortOrder: number;
    socialAccountId: string | null;
    externalId: string | null;
}

export default function Categories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncAccountId, setSyncAccountId] = useState('');
    const [showSyncModal, setShowSyncModal] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data } = await api.get('/category');
            setCategories(data);
        } catch (error) {
            toast.error('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        if (!syncAccountId) {
            toast.error('Vui lòng nhập ID Tài khoản liên kết (SocialAccountId)');
            return;
        }

        setSyncing(true);
        const toastId = toast.loading('Đang đồng bộ từ nền tảng...');
        try {
            const { data } = await api.post(`/category/sync/${syncAccountId}`);
            toast.success(data.message || 'Đồng bộ thành công', { id: toastId });
            setShowSyncModal(false);
            fetchCategories();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi đồng bộ.', { id: toastId });
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm theo mã hoặc tên chuyên mục..."
                        className="block w-full pl-10 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowSyncModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                    >
                        <RefreshCw className="w-4 h-4 text-blue-600" />
                        Đồng bộ từ Nền tảng
                    </button>
                    <button
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md shadow-blue-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Tạo thủ công
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-gray-100 uppercase text-[10px] font-bold tracking-wider text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Tên Chuyên Mục</th>
                                <th className="px-6 py-4">Đường Dẫn (Slug)</th>
                                <th className="px-6 py-4">Nguồn Tích Hợp</th>
                                <th className="px-6 py-4">External ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="inline-flex items-center gap-2 text-gray-500">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                            Đang tải dữ liệu...
                                        </div>
                                    </td>
                                </tr>
                            ) : categories.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                                                <FolderTree className="w-8 h-8 text-blue-500" />
                                            </div>
                                            <p className="text-gray-600 font-medium mb-1">Chưa có Chuyên mục nào!</p>
                                            <p className="text-sm">Hãy tự tạo hoặc bấm đồng bộ tự động từ trang Web của bạn.</p>
                                            <button onClick={() => setShowSyncModal(true)} className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">Bắt đầu Đồng bộ</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                categories.map((cat) => (
                                    <tr key={cat.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                    <FolderTree className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <span className="font-semibold text-gray-900">{cat.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{cat.slug}</td>
                                        <td className="px-6 py-4">
                                            {cat.socialAccountId ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    Đã đồng bộ
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                    Tạo thủ công
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 font-mono text-xs">{cat.externalId || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showSyncModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20">
                        <div className="p-8 pb-6">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-5 -mt-2">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Đồng bộ Nền tảng (Integrations)</h3>
                            <p className="text-sm text-gray-500 leading-relaxed mb-6">
                                Nhập mã định danh của **Tài khoản liên kết** (Nền tảng đích như WordPress). Backend sẽ trực tiếp thu thập toàn bộ cơ sở dữ liệu Danh mục.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Social Account ID</label>
                                    <input
                                        type="text"
                                        value={syncAccountId}
                                        onChange={e => setSyncAccountId(e.target.value)}
                                        placeholder="VD: 123e4567-e89b-12d3..."
                                        className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
                                    />
                                    <p className="mt-2 text-[11px] text-blue-600 font-medium">Lưu ý: Sau này giao diện này sẽ là 1 menu thả xuống chứa danh sách các trang web bạn đã liên kết.</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
                            <button
                                onClick={() => setShowSyncModal(false)}
                                className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20"
                            >
                                {syncing && <RefreshCw className="w-4 h-4 animate-spin" />}
                                {syncing ? 'Đang kết nối...' : 'Bắt đầu kéo dữ liệu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
