import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import { User, ShieldCheck, Mail, Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { API_BASE_URL } from '../lib/axios';

// Resolve avatar URL: if relative path, prepend API base URL
const resolveFileUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
};

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ProfileData {
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    countryCode: string;
    avatarUrl?: string;
}

// Utility to create a Blob from the canvas
function getCroppedImg(image: HTMLImageElement, crop: PixelCrop, fileName: string): Promise<File> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('No 2d context');
    }

    // Draw image on canvas
    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('Canvas is empty'));
                return;
            }
            resolve(new File([blob], fileName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
    });
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(
        makeAspectCrop(
            { unit: '%', width: 50 },
            aspect,
            mediaWidth,
            mediaHeight
        ),
        mediaWidth,
        mediaHeight
    );
}

export default function Profile() {
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [profile, setProfile] = useState<ProfileData>({
        email: '',
        fullName: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        countryCode: '',
        avatarUrl: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Cropper state
    const [imgSrc, setImgSrc] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/profile');
            setProfile({
                ...data,
                countryCode: data.countryCode || '',
                phoneNumber: data.phoneNumber || '',
                avatarUrl: data.avatarUrl || ''
            });
        } catch (error) {
            toast.error('Failed to load profile details');
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/profile', profile);
            toast.success('Hồ sơ đã được cập nhật thành công');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Mật khẩu xác nhận không khớp');
            return;
        }

        setSaving(true);
        try {
            await api.post('/profile/change-password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            toast.success('Mật khẩu đã được thay đổi thành công');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi đổi mật khẩu');
        } finally {
            setSaving(false);
        }
    };

    const onSelectFile = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined);
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImgSrc(reader.result?.toString() || '');
                setIsCropModalOpen(true);
            });
            reader.readAsDataURL(e.target.files[0]);
        }
        e.target.value = ''; // Reset
    };

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1));
    };

    const handleCropSubmit = async () => {
        if (!completedCrop || !imgRef.current) return;
        setIsCropModalOpen(false);
        setUploadingAvatar(true);
        const toastId = toast.loading('Đang xử lý và tải ảnh lên...');

        try {
            const file = await getCroppedImg(imgRef.current, completedCrop, 'avatar.jpg');
            const formData = new FormData();
            formData.append('file', file);

            const { data } = await api.post('/profile/avatar', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
            toast.success('Ảnh đại diện đã được cập nhật thành công', { id: toastId });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi tải ảnh. Vui lòng thử lại sau', { id: toastId });
        } finally {
            setUploadingAvatar(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <User className="w-4 h-4" />
                        Thông tin cá nhân
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'security' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        Bảo mật tài khoản
                    </button>
                </div>

                <div className="p-6 md:p-8">
                    {activeTab === 'profile' && (
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="relative">
                                    <div className={`w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border filter drop-shadow-sm transition-opacity ${uploadingAvatar ? 'opacity-50' : 'opacity-100'}`}>
                                        {profile.avatarUrl ? (
                                            <img src={resolveFileUrl(profile.avatarUrl)} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-12 h-12 text-gray-400" />
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors" title="Thay đổi ảnh đại diện">
                                        <Camera className="w-4 h-4 text-gray-600" />
                                        <input type="file" className="hidden" accept="image/*" onChange={onSelectFile} disabled={uploadingAvatar} />
                                    </label>
                                    {uploadingAvatar && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">{profile.fullName || 'Người Dùng'}</h3>
                                    <p className="text-sm text-gray-500">Cập nhật ảnh đại diện và thông tin cá nhân của bạn.</p>
                                </div>
                            </div>

                            <form onSubmit={handleProfileUpdate} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input
                                            type="email"
                                            value={profile.email}
                                            disabled
                                            className="block w-full pl-10 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">Email không thể thay đổi sau khi đăng ký.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ (First Name)</label>
                                        <input
                                            type="text"
                                            value={profile.firstName}
                                            onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                                            className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên (Last Name)</label>
                                        <input
                                            type="text"
                                            value={profile.lastName}
                                            onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                                            className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên đầy đủ (Hiển thị)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={profile.fullName}
                                            onChange={e => setProfile({ ...profile, fullName: e.target.value })}
                                            className="block w-full pl-10 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                                    <PhoneInput
                                        international
                                        countryCallingCodeEditable={false}
                                        defaultCountry="VN"
                                        value={profile.phoneNumber}
                                        onChange={(val) => setProfile({ ...profile, phoneNumber: val || '' })}
                                        className="flex rounded-xl shadow-sm border border-gray-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 transition-colors px-4 py-2.5 text-sm [&>input]:border-none [&>input]:focus:ring-0 [&>input]:px-3"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                                    >
                                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.currentPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.newPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.confirmPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full px-6 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-black focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Image Cropper Modal */}
            {isCropModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="text-lg font-medium">Cắt ảnh đại diện</h3>
                            <button
                                onClick={() => setIsCropModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 flex justify-center bg-gray-50 border-b border-gray-100 max-h-[60vh] overflow-y-auto">
                            {imgSrc && (
                                <ReactCrop
                                    crop={crop}
                                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                                    onComplete={(c) => setCompletedCrop(c)}
                                    aspect={1}
                                    circularCrop
                                >
                                    <img
                                        ref={imgRef}
                                        src={imgSrc}
                                        onLoad={onImageLoad}
                                        className="max-h-[50vh] object-contain"
                                        alt="Upload"
                                    />
                                </ReactCrop>
                            )}
                        </div>
                        <div className="p-4 flex justify-end gap-3 bg-white">
                            <button
                                onClick={() => setIsCropModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCropSubmit}
                                disabled={!completedCrop?.width || !completedCrop?.height}
                                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none transition-all"
                            >
                                Lưu ảnh
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
