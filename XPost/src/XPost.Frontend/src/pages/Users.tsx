import { useState, useEffect } from 'react';
import { Search, UserPlus, MoreVertical, Edit2, Lock, Unlock, KeyRound, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { API_BASE_URL } from '../lib/axios';
import { formatDate } from '../utils/formatters';

// Resolve file URL: if relative path, prepend API base URL
const resolveFileUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
};

interface UserItem {
    id: string;
    email: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    createdAtUtc: string;
    roleName: string;
    tenantName: string | null;
    tenantId: string | null;
}

export default function Users() {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phoneNumber: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        fullName: '',
        phoneNumber: ''
    });

    // Dropdown
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    // Role check (để hiển thị cột Công ty cho SuperAdmin)
    const getRole = () => {
        const token = localStorage.getItem('token');
        if (!token) return '';
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || '';
        } catch { return ''; }
    };
    const isSuperAdmin = getRole() === 'SuperAdmin';

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/users');
            setUsers(data);
        } catch {
            toast.error('Không tải được danh sách nhân viên');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        return (u.fullName?.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            u.firstName?.toLowerCase().includes(term) ||
            u.lastName?.toLowerCase().includes(term));
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const toastId = toast.loading('Đang tạo nhân viên mới...');
        try {
            const { data } = await api.post('/users', createForm);
            toast.success(data.message || 'Tạo thành công!', { id: toastId });
            setShowCreateModal(false);
            setCreateForm({ email: '', password: '', firstName: '', lastName: '', phoneNumber: '' });
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi tạo nhân viên', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (u: UserItem) => {
        setSelectedUser(u);
        setEditForm({
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            fullName: u.fullName || '',
            phoneNumber: u.phoneNumber || ''
        });
        setShowEditModal(true);
        setOpenDropdownId(null);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        setSubmitting(true);
        const toastId = toast.loading('Đang lưu...');
        try {
            await api.put(`/users/${selectedUser.id}`, editForm);
            toast.success('Cập nhật thành công', { id: toastId });
            setShowEditModal(false);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi lưu', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        setOpenDropdownId(null);
        const toastId = toast.loading(currentStatus ? 'Đang khóa...' : 'Đang mở khóa...');
        try {
            await api.put(`/users/${id}/toggle-status`);
            toast.success('Đã cập nhật trạng thái', { id: toastId });
            fetchUsers();
        } catch {
            toast.error('Lỗi khi cập nhật trạng thái', { id: toastId });
        }
    };

    const handleResetPassword = async (id: string, email: string) => {
        setOpenDropdownId(null);
        if (!window.confirm(`Đặt lại mật khẩu cho "${email}"?\nMật khẩu mới sẽ được gửi qua Email.`)) return;
        const toastId = toast.loading('Đang đặt lại mật khẩu...');
        try {
            await api.post(`/users/${id}/reset-password`);
            toast.success('Mật khẩu mới đã được gửi qua email', { id: toastId });
        } catch {
            toast.error('Lỗi khi đặt lại mật khẩu', { id: toastId });
        }
    };

    const getInitials = (u: UserItem) => {
        if (u.firstName && u.lastName) return `${u.lastName.charAt(0)}${u.firstName.charAt(0)}`.toUpperCase();
        if (u.fullName) return u.fullName.charAt(0).toUpperCase();
        return u.email.charAt(0).toUpperCase();
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'SuperAdmin': return 'bg-purple-100 text-purple-700';
            case 'TenantAdmin': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm theo tên hoặc email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                    />
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                >
                    <UserPlus className="w-4 h-4" />
                    Thêm nhân viên
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
                <div className="overflow-x-auto pb-32">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-gray-100 uppercase text-[10px] font-bold tracking-wider text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Nhân viên</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">SĐT</th>
                                <th className="px-6 py-4">Vai trò</th>
                                {isSuperAdmin && <th className="px-6 py-4">Công ty</th>}
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4">Ngày tạo</th>
                                <th className="px-6 py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={isSuperAdmin ? 8 : 7} className="text-center py-10">Đang tải...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 8 : 7} className="px-6 py-16 text-center text-gray-400">
                                        {searchTerm ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có nhân viên nào'}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {u.avatarUrl ? (
                                                        <img src={resolveFileUrl(u.avatarUrl)} alt="" className="w-full h-full rounded-full object-cover" />
                                                    ) : getInitials(u)}
                                                </div>
                                                <span className="font-semibold text-gray-900">{u.fullName || `${u.lastName} ${u.firstName}`}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{u.email}</td>
                                        <td className="px-6 py-4 text-gray-600">{u.phoneNumber || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${getRoleBadge(u.roleName)}`}>
                                                <Shield className="w-3 h-3" />
                                                {u.roleName}
                                            </span>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4 text-gray-600">{u.tenantName || '—'}</td>
                                        )}
                                        <td className="px-6 py-4">
                                            {u.isActive ? (
                                                <span className="px-2.5 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">Hoạt động</span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">Đã khóa</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{formatDate(u.createdAtUtc)}</td>
                                        <td className="px-6 py-4 relative">
                                            <button
                                                onClick={() => setOpenDropdownId(openDropdownId === u.id ? null : u.id)}
                                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                            >
                                                <MoreVertical className="w-5 h-5" />
                                            </button>

                                            {openDropdownId === u.id && (
                                                <div className="absolute right-6 top-10 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10 animate-in fade-in slide-in-from-top-2">
                                                    <button onClick={() => handleEditClick(u)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        <Edit2 className="w-4 h-4 text-blue-500" /> Sửa thông tin
                                                    </button>
                                                    <button onClick={() => handleToggleStatus(u.id, u.isActive)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                                        {u.isActive ? <Lock className="w-4 h-4 text-orange-500" /> : <Unlock className="w-4 h-4 text-green-500" />}
                                                        {u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                                    </button>
                                                    <hr className="my-1 border-gray-100" />
                                                    <button onClick={() => handleResetPassword(u.id, u.email)} className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2">
                                                        <KeyRound className="w-4 h-4 text-amber-500" /> Đặt lại mật khẩu
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

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                        <div className="p-8 pb-6">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-5">
                                <UserPlus className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Thêm Nhân viên mới</h3>
                            <p className="text-sm text-gray-500 mb-6">Thông tin đăng nhập sẽ được tự động gửi cho nhân viên qua Email.</p>

                            <form id="createUserForm" onSubmit={handleCreate} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Họ</label>
                                        <input type="text" required value={createForm.lastName} onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên</label>
                                        <input type="text" required value={createForm.firstName} onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email đăng nhập</label>
                                    <input type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Số điện thoại</label>
                                    <input type="text" value={createForm.phoneNumber} onChange={e => setCreateForm({ ...createForm, phoneNumber: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu khởi tạo</label>
                                    <input type="password" required value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </form>
                        </div>
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Hủy</button>
                            <button type="submit" form="createUserForm" disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50">
                                {submitting ? 'Đang tạo...' : 'Tạo nhân viên'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20">
                        <div className="p-8 pb-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Chỉnh sửa nhân viên</h3>
                            <p className="text-sm text-gray-500 mb-6">{selectedUser.email}</p>

                            <form id="editUserForm" onSubmit={handleSaveEdit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Họ</label>
                                        <input type="text" required value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên</label>
                                        <input type="text" required value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Họ tên hiển thị</label>
                                    <input type="text" value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Số điện thoại</label>
                                    <input type="text" value={editForm.phoneNumber} onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })} className="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </form>
                        </div>
                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
                            <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Hủy</button>
                            <button type="submit" form="editUserForm" disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50">
                                {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
