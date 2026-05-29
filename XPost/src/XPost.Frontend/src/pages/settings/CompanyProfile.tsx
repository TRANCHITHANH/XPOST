import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Save, Building, Mail, Phone, MapPin, Hash, Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { API_BASE_URL } from '../../lib/axios';

const resolveFileUrl = (url?: string | null) => {
    if (!url) return '';
    let resolved = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    if (resolved.includes('ngrok-free.dev') && !import.meta.env.PROD) {
        const localApi = window.location.hostname === 'local.xpost.com' 
            ? 'http://local-api.xpost.com:5243' 
            : 'http://localhost:5243';
        return resolved.replace(/^https:\/\/.*?\.ngrok-free\.dev/i, localApi);
    }
    return resolved;
};

import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Utility to create a Blob from the canvas
function getCroppedImg(image: HTMLImageElement, crop: PixelCrop, fileName: string): Promise<File> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0, 0, crop.width, crop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) return reject(new Error('Canvas is empty'));
            resolve(new File([blob], fileName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
    });
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(
        makeAspectCrop({ unit: '%', width: 50 }, aspect, mediaWidth, mediaHeight),
        mediaWidth, mediaHeight
    );
}

export default function CompanyProfile() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        description: '',
        logoUrl: '',
        taxCode: '',
        representative: '',
        email: '',
        phoneNumber: '',
        address: '',
        postCode: '',
        domain: '',
    });

    // Cropper state
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [imgSrc, setImgSrc] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/tenants/profile');
                setForm({
                    name: data.name || '',
                    description: data.description || '',
                    logoUrl: data.logoUrl || '',
                    taxCode: data.taxCode || '',
                    representative: data.representative || '',
                    email: data.email || '',
                    phoneNumber: data.phoneNumber || '',
                    address: data.address || '',
                    postCode: data.postCode || '',
                    domain: data.domain || '',
                });
            } catch (error) {
                console.error("Không thể tải hồ sơ công ty", error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const toastId = toast.loading('Đang lưu hồ sơ doanh nghiệp...');
        try {
            const { data } = await api.put('/tenants/profile', form);
            toast.success(data.message || 'Đã lưu cấu hình công ty', { id: toastId });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Không thể lưu hồ sơ.', { id: toastId });
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
        setUploadingLogo(true);
        const toastId = toast.loading('Đang xử lý logo...');

        try {
            const file = await getCroppedImg(imgRef.current, completedCrop, 'logo.jpg');
            const formData = new FormData();
            formData.append('file', file);

            const { data } = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setForm(prev => ({ ...prev, logoUrl: data.url }));
            toast.success('Đã tải lên logo công ty', { id: toastId });
        } catch (error: any) {
            toast.error('Lỗi tải ảnh. Vui lòng thử lại.', { id: toastId });
        } finally {
            setUploadingLogo(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Đang tải...</div>;

    return (
        <div className="max-w-4xl animate-in fade-in duration-300">
            <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-slate-50/50">
                    <h2 className="text-xl font-bold text-gray-900">Hồ sơ Doanh nghiệp</h2>
                    <p className="text-sm text-gray-500 mt-1">Quản lý Logo định danh và liên hệ của công ty bạn</p>
                </div>

                <div className="p-8 space-y-8">
                    {/* Group: Logo */}
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className={`w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border filter drop-shadow-sm transition-opacity ${uploadingLogo ? 'opacity-50' : 'opacity-100'}`}>
                                {form.logoUrl ? (
                                     <img src={resolveFileUrl(form.logoUrl)} alt="Company Logo" className="w-full h-full object-cover bg-white" />
                                ) : (
                                    <Building className="w-10 h-10 text-gray-300" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors" title="Thay đổi Logo Công ty">
                                <Camera className="w-4 h-4 text-gray-600" />
                                <input type="file" className="hidden" accept="image/*" onChange={onSelectFile} disabled={uploadingLogo} />
                            </label>
                            {uploadingLogo && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Logo Công ty</h3>
                            <p className="text-sm text-gray-500">Đây là Logo sẽ xuất hiện ở góc trái màn hình của tất cả các tài khoản nhân viên.</p>
                        </div>
                    </div>
                    <hr className="border-gray-100" />

                    {/* Group: Core Info */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">THÔNG TIN CHUNG</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên Doanh Nghiệp</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Building className="h-5 w-5 text-gray-400" /></div>
                                    <input type="text" required name="name" value={form.name} onChange={handleChange} className="block w-full pl-10 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mã Số Thuế</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Hash className="h-5 w-5 text-gray-400" /></div>
                                    <input type="text" name="taxCode" value={form.taxCode} onChange={handleChange} className="block w-full pl-10 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Người Đại Diện</label>
                                <input type="text" name="representative" value={form.representative} onChange={handleChange} className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên Miền (Domain)</label>
                                <input type="text" name="domain" value={form.domain} onChange={handleChange} placeholder="Ví dụ: mycompany.xpost.domain" className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Group: Contact Info */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">LIÊN HỆ & ĐỊA CHỈ</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Pháp Lý</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                                    <input type="email" name="email" value={form.email} onChange={handleChange} className="block w-full pl-10 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">SĐT Công Ty</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-5 w-5 text-gray-400" /></div>
                                    <input type="tel" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} className="block w-full pl-10 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Địa Chỉ Trụ Sở</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MapPin className="h-5 w-5 text-gray-400" /></div>
                                    <input type="text" name="address" value={form.address} onChange={handleChange} className="block w-full pl-10 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button type="button" className="px-6 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 shadow-sm">Hủy Thay Đổi</button>
                    <button type="submit" disabled={saving} className="flex items-center gap-2 px-8 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50">
                        {saving ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Lưu Hồ Sơ
                    </button>
                </div>
            </form>

            {/* Image Cropper Modal */}
            {isCropModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="text-lg font-medium">Cắt Logo Doanh Nghiệp</h3>
                            <button
                                type="button"
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
                                        alt="Upload format"
                                    />
                                </ReactCrop>
                            )}
                        </div>
                        <div className="p-4 flex justify-end gap-3 bg-white">
                            <button
                                type="button"
                                onClick={() => setIsCropModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleCropSubmit}
                                disabled={!completedCrop?.width || !completedCrop?.height}
                                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none transition-all"
                            >
                                Cập nhật Logo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
