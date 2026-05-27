import { useState, useEffect } from 'react';
import { Building2, Search, ShieldCheck, MoreVertical, Edit2, Lock, Unlock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { formatDate } from '../../utils/formatters';

interface Tenant {
    id: string;
    name: string;
    domain: string;
    isActive: boolean;
    createdAt: string;
}

export default function Tenants() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        companyName: '',
        domain: '',
        adminEmail: '',
        adminPassword: '',
        adminFirstName: '',
        adminLastName: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Edit Tenant State
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        domain: ''
    });

    // Dropdown state logic (simple)
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    const fetchTenants = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/tenants');
            setTenants(res.data);
        } catch (error) {
            console.error('Lỗi khi tải danh sách công ty:', error);
            toast.error('Không tải được danh sách doanh nghiệp');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const toastId = toast.loading('Đang khởi tạo doanh nghiệp mới...');
        try {
            const { data } = await api.post('/admin/tenants', form);
            toast.success(data.message || 'Tạo thành công!', { id: toastId });
            setShowModal(false);
            fetchTenants();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi tạo công ty', { id: toastId });
            setSubmitting(false);
        }
    };

    const handleEditClick = (t: Tenant) => {
        setSelectedTenant(t);
        setEditForm({ name: t.name, domain: t.domain || '' });
        setShowEditModal(true);
        setOpenDropdownId(null);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenant) return;
        setSubmitting(true);
        const toastId = toast.loading('Đang lưu thông tin...');
        try {
            await api.put(`/admin/tenants/${selectedTenant.id}`, editForm);
            toast.success('Lưu thành công', { id: toastId });
            setShowEditModal(false);
            fetchTenants();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi lưu', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        setOpenDropdownId(null);
        const toastId = toast.loading(currentStatus ? 'Đang khóa khách hàng...' : 'Đang mở khóa...');
        try {
            await api.put(`/admin/tenants/${id}/toggle-status`);
            toast.success('Đã cập nhật trạng thái', { id: toastId });
            fetchTenants();
        } catch (error: any) {
            toast.error('Lỗi khi cập nhật trạng thái', { id: toastId });
        }
    };

    const handleDelete = async (id: string, name: string) => {
        setOpenDropdownId(null);
        if (!window.confirm(`Bạn có CHẮC CHẮN muốn XÓA công ty "${name}" không?`)) return;
        const toastId = toast.loading('Đang xóa khách hàng...');
        try {
            await api.delete(`/admin/tenants/${id}`);
            toast.success('Đã xóa khách hàng', { id: toastId });
            fetchTenants();
        } catch (error: any) {
            toast.error('Lỗi khi xóa', { id: toastId });
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
                        placeholder="Tìm kiếm công ty/khách hàng..."
                        className="block w-full pl-10 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                >
                    <Building2 className="w-4 h-4" />
                    Mở mới Doanh nghiệp
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
                <div className="overflow-x-auto pb-32">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-gray-100 uppercase text-[10px] font-bold tracking-wider text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Tên Công Ty</th>
                                <th className="px-6 py-4">Tên Miền</th>
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4">Ngày tham gia</th>
                                <th className="px-6 py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={4} className="text-center py-10">Đang tải...</td></tr>
                            ) : tenants.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center text-gray-400">
                                        Chưa có công ty nào được cấu hình
                                    </td>
                                </tr>
                            ) : (
                                tenants.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-semibold text-gray-900">{t.name}</td>
                                        <td className="px-6 py-4 text-blue-600">{t.domain}</td>
                                        <td className="px-6 py-4">
                                            {t.isActive ? (
                                                <span className="px-2.5 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">Hoạt động</span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">Đã khóa</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">{formatDate(t.createdAt)}</td>
                                        <td className="px-6 py-4 relative">
                                            <button 
                                                onClick={() => setOpenDropdownId(openDropdownId === t.id ? null : t.id)}
                                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                            >
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                            
                                            {openDropdownId === t.id && (
                                                <div className="absolute right-6 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10 animate-in fade-in slide-in-from-top-2">
                                                    <button onClick={() => handleEditClick(t)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        <Edit2 className="w-4 h-4 text-blue-500" /> Sửa thông tin
                                                    </button>
                                                    <button onClick={() => handleToggleStatus(t.id, t.isActive)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        {t.isActive ? <Lock className="w-4 h-4 text-orange-500" /> : <Unlock className="w-4 h-4 text-green-500" />}
                                                        {t.isActive ? 'Khóa dịch vụ' : 'Mở khóa dịch vụ'}
                                                    </button>
                                                    <hr className="my-1 border-gray-100" />
                                                    <button onClick={() => handleDelete(t.id, t.name)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                                        <Trash2 className="w-4 h-4 text-red-500" /> Xóa Khách hàng
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                        <div className="p-8 pb-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Cấp phát Môi trường Khách hàng</h3>
                            <p className="text-sm text-gray-500 mb-6">Mỗi Doanh nghiệp sẽ được cấp phát 1 môi trường Database độc lập bằng TenantID.</p>

                            <form id="tenantForm" onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Công Ty</label>
                                        <input type="text" required value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Miền (Domain)</label>
                                        <input type="text" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div className="col-span-2">
                                        <hr className="my-2" />
                                        <p className="font-bold text-gray-800 text-sm">Tài khoản Giám đốc (TenantAdmin)</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ</label>
                                        <input type="text" required value={form.adminLastName} onChange={e => setForm({ ...form, adminLastName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
                                        <input type="text" required value={form.adminFirstName} onChange={e => setForm({ ...form, adminFirstName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Đăng Nhập</label>
                                        <input type="email" required value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu khởi tạo</label>
                                        <input type="password" required value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" />
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
                            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Hủy</button>
                            <button type="submit" form="tenantForm" disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-500/20 disabled:opacity-50">
                                {submitting ? 'Đang xử lý...' : 'Tạo mới Công ty'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && selectedTenant && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20">
                        <div className="p-8 pb-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Chỉnh sửa Khách hàng</h3>
                            <p className="text-sm text-gray-500 mb-6">Cập nhật thông tin nhanh cho công ty này.</p>

                            <form id="editForm" onSubmit={handleSaveEdit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Công Ty</label>
                                    <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Miền (Domain)</label>
                                    <input type="text" value={editForm.domain} onChange={e => setEditForm({ ...editForm, domain: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </form>
                        </div>
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
                            <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Hủy</button>
                            <button type="submit" form="editForm" disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50">
                                {submitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
