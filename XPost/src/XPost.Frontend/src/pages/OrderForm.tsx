import React, { useState, useEffect } from 'react';
import { ShoppingBag, User, Phone, MapPin, CheckCircle2, Loader2, ArrowRight, ChevronDown, ChevronUp, Plus, Minus, Check, Info, Mail } from 'lucide-react';
import api from '../lib/axios';

// Public API Base URL from environment or fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function OrderForm() {
    const [pageId, setPageId] = useState('');
    const [psid, setPsid] = useState('');
    const [formFields, setFormFields] = useState<{ label: string; options: string[]; selectedValues: string[] }[]>([]);
    
    // Form fields
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    
    // Country and Phone validation states
    const [country, setCountry] = useState<{ name: string; flag: string } | null>(null);
    const [phoneWarning, setPhoneWarning] = useState('');
    const [emailWarning, setEmailWarning] = useState('');
    
    // Statuses
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Selected items with quantities: Record<categoryIndex_optionName, quantity>
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
    
    // Category expanded state
    const [expandedCategories, setExpandedCategories] = useState<Record<number, boolean>>({});
    
    // Summary confirmation checkbox
    const [isConfirmed, setIsConfirmed] = useState(false);

    const detectCountry = (phone: string): { name: string; flag: string } | null => {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleanPhone) return null;

        // Vietnam prefixes
        if (cleanPhone.startsWith('+84') || cleanPhone.match(/^0(3|5|7|8|9|1|2)/)) {
            return { name: 'Việt Nam', flag: '🇻🇳' };
        }
        // US/Canada
        if (cleanPhone.startsWith('+1') || cleanPhone.match(/^1\d{10}/)) {
            return { name: 'Hoa Kỳ', flag: '🇺🇸' };
        }
        // Japan
        if (cleanPhone.startsWith('+81') || cleanPhone.match(/^81\d/)) {
            return { name: 'Nhật Bản', flag: '🇯🇵' };
        }
        // South Korea
        if (cleanPhone.startsWith('+82') || cleanPhone.match(/^82\d/)) {
            return { name: 'Hàn Quốc', flag: '🇰🇷' };
        }
        // UK
        if (cleanPhone.startsWith('+44') || cleanPhone.match(/^44\d/)) {
            return { name: 'Anh Quốc', flag: '🇬🇧' };
        }
        // Singapore
        if (cleanPhone.startsWith('+65') || cleanPhone.match(/^65\d/)) {
            return { name: 'Singapore', flag: '🇸🇬' };
        }

        // General international format check
        if (cleanPhone.startsWith('+') || /^\d{7,15}$/.test(cleanPhone)) {
            return { name: 'Quốc tế', flag: '🌐' };
        }
        return null;
    };

    const handlePhoneChange = (val: string) => {
        setPhoneNumber(val);
        
        // Detect country
        const detected = detectCountry(val);
        setCountry(detected);
        
        // Validate phone number
        if (val) {
            const hasLetters = /[a-zA-Z]/.test(val);
            const isAbnormal = !/^[+]?[0-9\s\-()]*$/.test(val);
            
            if (hasLetters) {
                setPhoneWarning('Số điện thoại không được chứa chữ cái.');
            } else if (isAbnormal) {
                setPhoneWarning('Số điện thoại chứa ký tự lạ không hợp lệ.');
            } else if (!detected) {
                setPhoneWarning('Đầu số điện thoại không đúng định dạng quốc gia nào.');
            } else {
                setPhoneWarning('');
            }
        } else {
            setPhoneWarning('');
        }
    };

    const handleEmailChange = (val: string) => {
        setEmail(val);
        if (val) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(val)) {
                setEmailWarning('Email không đúng định dạng.');
            } else {
                setEmailWarning('');
            }
        } else {
            setEmailWarning('');
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('pageId') || '';
        const senderPsid = params.get('psid') || '';
        const optStr = params.get('options') || '';
        
        setPageId(pId);
        setPsid(senderPsid);

        if (optStr) {
            try {
                const parsed = JSON.parse(optStr);
                if (Array.isArray(parsed)) {
                    const fields = parsed.map((item: any) => ({
                        label: item.label || item.name || 'Lựa chọn',
                        options: Array.isArray(item.options) ? item.options : [],
                        selectedValues: []
                    }));
                    setFormFields(fields);
                    return;
                }
            } catch (e) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(optStr));
                    if (Array.isArray(parsed)) {
                        const fields = parsed.map((item: any) => ({
                            label: item.label || item.name || 'Lựa chọn',
                            options: Array.isArray(item.options) ? item.options : [],
                            selectedValues: []
                        }));
                        setFormFields(fields);
                        return;
                    }
                } catch (err) {
                    // Fallback
                }
            }

            // Fallback to comma-separated string
            const parsedOptions = optStr.split(',')
                .map(o => o.trim())
                .filter(Boolean);
            setFormFields([{
                label: 'Chọn dịch vụ / thiết bị',
                options: parsedOptions,
                selectedValues: []
            }]);
        } else {
            // Default options
            const defaults = ['Thiết bị mạng', 'Bảo trì hệ thống', 'Giải pháp doanh nghiệp'];
            setFormFields([{
                label: 'Chọn dịch vụ / thiết bị',
                options: defaults,
                selectedValues: []
            }]);
        }
    }, []);

    useEffect(() => {
        if (formFields.length > 0) {
            const initial: Record<number, boolean> = {};
            formFields.forEach((_, idx) => {
                initial[idx] = true;
            });
            setExpandedCategories(initial);
        }
    }, [formFields]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) return setErrorMsg('Vui lòng nhập họ và tên.');
        if (!phoneNumber.trim()) return setErrorMsg('Vui lòng nhập số điện thoại.');
        if (phoneWarning) return setErrorMsg('Vui lòng điều chỉnh số điện thoại hợp lệ trước khi đặt hàng.');
        
        // Count total selected items
        const totalSelected = Object.keys(selectedItems).length;
        if (totalSelected === 0) {
            return setErrorMsg('Vui lòng chọn ít nhất một sản phẩm hoặc dịch vụ.');
        }

        if (!address.trim()) return setErrorMsg('Vui lòng nhập địa chỉ nhận hàng.');
        if (!email.trim()) return setErrorMsg('Vui lòng nhập email.');
        if (emailWarning) return setErrorMsg('Vui lòng nhập email hợp lệ.');
        if (!isConfirmed) return setErrorMsg('Vui lòng tích chọn xác nhận thông tin đơn hàng ở bên dưới.');
        
        setErrorMsg('');
        setIsLoading(true);

        try {
            const selectionList = formFields.map((field, fIdx) => {
                const selectedOpts = field.options
                    .filter(opt => selectedItems[`${fIdx}_${opt}`] !== undefined)
                    .map(opt => `${opt} (x${selectedItems[`${fIdx}_${opt}`]})`);
                if (selectedOpts.length === 0) return '';
                return `${field.label}: ${selectedOpts.join(', ')}`;
            }).filter(Boolean);
            const selections = selectionList.join('; ');

            const payload = {
                pageId,
                psid,
                fullName: fullName.trim(),
                phoneNumber: phoneNumber.trim(),
                email: email.trim(),
                address: address.trim(),
                selectedItem: selections
            };

            // Post request to public WebAPI submit order endpoint using configured api instance
            await api.post('/messenger/webhook/submit-order', payload);
            
            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Submit order error:', err);
            setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi gửi đơn hàng. Vui lòng thử lại sau.');
        } finally {
            setIsLoading(false);
        }
    };

    const isSelected = (fIdx: number, opt: string) => {
        return selectedItems[`${fIdx}_${opt}`] !== undefined;
    };

    const getQuantity = (fIdx: number, opt: string) => {
        return selectedItems[`${fIdx}_${opt}`] || 0;
    };

    const toggleSelection = (fIdx: number, opt: string) => {
        const key = `${fIdx}_${opt}`;
        setSelectedItems(prev => {
            const next = { ...prev };
            if (next[key] !== undefined) {
                delete next[key];
            } else {
                next[key] = 1;
            }
            return next;
        });
    };

    const updateQuantity = (fIdx: number, opt: string, delta: number) => {
        const key = `${fIdx}_${opt}`;
        setSelectedItems(prev => {
            if (prev[key] === undefined) return prev;
            const next = { ...prev };
            const newQty = Math.max(1, next[key] + delta);
            next[key] = newQty;
            return next;
        });
    };

    const toggleCategory = (fIdx: number) => {
        setExpandedCategories(prev => ({
            ...prev,
            [fIdx]: !prev[fIdx]
        }));
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in">
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Đơn hàng đang trong quá trình xử lý!</h2>
                    <p className="text-slate-300 text-sm leading-relaxed mb-8">
                        Đơn đặt hàng của anh/chị đang được hệ thống xử lý. Chatbot đã gửi tin nhắn xác nhận đến hộp thư Messenger của anh/chị.
                    </p>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-left text-xs text-slate-400 space-y-2 mb-6">
                        <p><span className="font-bold text-slate-300">Khách hàng:</span> {fullName}</p>
                        <p><span className="font-bold text-slate-300">Số điện thoại:</span> {phoneNumber}</p>
                        <p><span className="font-bold text-slate-300">Email:</span> {email}</p>
                        <p><span className="font-bold text-slate-300">Sản phẩm/Dịch vụ:</span> {
                            formFields.map((field, fIdx) => {
                                const selectedOpts = field.options
                                    .filter(opt => selectedItems[`${fIdx}_${opt}`] !== undefined)
                                    .map(opt => `${opt} (x${selectedItems[`${fIdx}_${opt}`]})`);
                                if (selectedOpts.length === 0) return '';
                                return `${field.label}: ${selectedOpts.join(', ')}`;
                            }).filter(Boolean).join('; ')
                        }</p>
                        <p><span className="font-bold text-slate-300">Địa chỉ:</span> {address}</p>
                    </div>
                    <p className="text-xs text-slate-400 italic">Anh/Chị có thể đóng cửa sổ trình duyệt này để tiếp tục trò chuyện.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
                {/* Decorative glow element */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl -z-10 pointer-events-none"></div>

                {/* Form Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-sm shrink-0">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Nhập thông tin đơn đặt hàng</h1>
                        <p className="text-xs text-slate-400 font-medium">Nhập thông tin đặt hàng dịch vụ & thiết bị nhanh</p>
                    </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-xs font-semibold text-red-400 mb-5 animate-shake">
                        ⚠️ {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Collapsible Dropdowns for Categories with Quantity Selector */}
                    {formFields.map((field, fIdx) => {
                        const isExpanded = !!expandedCategories[fIdx];
                        const selectedCount = field.options.filter(opt => isSelected(fIdx, opt)).length;
                        
                        return (
                            <div className="border border-white/5 bg-slate-900/20 rounded-2xl overflow-hidden" key={fIdx}>
                                <button
                                    type="button"
                                    onClick={() => toggleCategory(fIdx)}
                                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors focus:outline-none"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{field.label}</span>
                                        {selectedCount > 0 && (
                                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                {selectedCount} đã chọn
                                            </span>
                                        )}
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    )}
                                </button>
                                
                                {isExpanded && (
                                    <div className="p-4 pt-0 border-t border-white/5 bg-slate-950/20 grid grid-cols-1 gap-2.5 animate-slide-down">
                                        {field.options.map((opt, idx) => {
                                            const optionSelected = isSelected(fIdx, opt);
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                                                        optionSelected
                                                        ? 'bg-indigo-600/10 border-indigo-500/40 text-white shadow-[0_0_12px_rgba(99,102,241,0.08)]'
                                                        : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-900/60 hover:border-white/10 hover:text-slate-300'
                                                    }`}
                                                >
                                                    {/* Option Label (clickable triggers selection toggle) */}
                                                    <div 
                                                        className="flex-1 cursor-pointer select-none py-1 mr-2"
                                                        onClick={() => toggleSelection(fIdx, opt)}
                                                    >
                                                        <span className="font-semibold text-sm leading-snug">{opt}</span>
                                                    </div>

                                                    {/* Controls Container */}
                                                    <div className="flex items-center gap-2.5 shrink-0">
                                                        {optionSelected && (
                                                            <div className="flex items-center bg-slate-950/80 border border-white/10 rounded-lg p-0.5 shadow-inner animate-fade-in">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateQuantity(fIdx, opt, -1)}
                                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center transition-colors active:scale-95"
                                                                >
                                                                    <Minus className="w-3 h-3" />
                                                                </button>
                                                                <span className="w-6 text-center text-xs font-bold text-white select-none">
                                                                    {getQuantity(fIdx, opt)}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateQuantity(fIdx, opt, 1)}
                                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center transition-colors active:scale-95"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSelection(fIdx, opt)}
                                                            className={`w-5.5 h-5.5 rounded border flex items-center justify-center transition-all ${
                                                                optionSelected
                                                                ? 'bg-indigo-500 border-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                                                                : 'border-white/10 bg-slate-950/50 hover:border-white/20'
                                                            }`}
                                                        >
                                                            {optionSelected && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Full Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Họ và tên</label>
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                placeholder="Họ và tên người nhận"
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Số điện thoại</label>
                        <div className="relative flex items-center">
                            <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={e => handlePhoneChange(e.target.value)}
                                placeholder="Số điện thoại liên hệ"
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-11 pr-28 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-500"
                                required
                            />
                            {country && (
                                <div className="absolute right-3 bg-white/10 border border-white/10 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 select-none backdrop-blur-md">
                                    <span>{country.flag}</span>
                                    <span>{country.name}</span>
                                </div>
                            )}
                        </div>
                        {phoneWarning && (
                            <p className="text-[11px] font-semibold text-rose-400 mt-1 select-none animate-pulse">
                                ⚠️ {phoneWarning}
                            </p>
                        )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => handleEmailChange(e.target.value)}
                                placeholder="Địa chỉ email nhận thông tin"
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-500"
                                required
                            />
                        </div>
                        {emailWarning && (
                            <p className="text-[11px] font-semibold text-rose-400 mt-1 select-none animate-pulse">
                                ⚠️ {emailWarning}
                            </p>
                        )}
                    </div>

                    {/* Address */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Địa chỉ giao hàng / thi công</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                            <textarea
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder="Địa chỉ chi tiết (Số nhà, đường, quận/huyện...)"
                                rows={3}
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-500 resize-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Live Order Summary / Preview */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md animate-fade-in">
                        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                            <Info className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Chi tiết thông tin đã cung cấp</h3>
                        </div>
                        
                        <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-slate-400 font-semibold shrink-0">Họ và tên:</span>
                                <span className="text-white font-bold text-right">{fullName.trim() || <span className="text-slate-600 italic">Chưa nhập</span>}</span>
                            </div>
                            
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-slate-400 font-semibold shrink-0">Số điện thoại:</span>
                                <span className="text-white font-bold text-right flex items-center gap-1">
                                    {country && <span className="text-[10px]">{country.flag}</span>}
                                    {phoneNumber.trim() ? (
                                        <span className={phoneWarning ? 'text-rose-400' : 'text-white'}>{phoneNumber}</span>
                                    ) : (
                                        <span className="text-slate-600 italic">Chưa nhập</span>
                                    )}
                                </span>
                            </div>

                            <div className="flex justify-between items-start gap-2">
                                <span className="text-slate-400 font-semibold shrink-0">Email:</span>
                                <span className="text-white font-bold text-right flex items-center gap-1">
                                    {email.trim() ? (
                                        <span className={emailWarning ? 'text-rose-400' : 'text-white'}>{email}</span>
                                    ) : (
                                        <span className="text-slate-600 italic">Chưa nhập</span>
                                    )}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-slate-400 font-semibold shrink-0">Địa chỉ giao hàng:</span>
                                <span className="text-white font-medium text-right leading-relaxed max-w-[200px] break-words">
                                    {address.trim() || <span className="text-slate-600 italic">Chưa nhập</span>}
                                </span>
                            </div>

                            <div className="border-t border-white/5 my-2 pt-2 space-y-1.5">
                                <span className="text-slate-400 font-semibold block">Sản phẩm / Dịch vụ chọn mua:</span>
                                {Object.keys(selectedItems).length > 0 ? (
                                    <div className="space-y-1.5 pl-2">
                                        {formFields.map((field, fIdx) => {
                                            const selected = field.options.filter(opt => selectedItems[`${fIdx}_${opt}`] !== undefined);
                                            if (selected.length === 0) return null;
                                            return (
                                                <div key={fIdx} className="space-y-1">
                                                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{field.label}:</div>
                                                    <ul className="list-disc list-inside pl-2 space-y-1 text-slate-200">
                                                        {selected.map(opt => (
                                                            <li key={opt} className="text-xs">
                                                                <span className="font-semibold">{opt}</span> 
                                                                <span className="text-indigo-300 font-black ml-1.5">x{selectedItems[`${fIdx}_${opt}`]}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-slate-600 italic block pl-2">Chưa chọn sản phẩm/dịch vụ nào</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Confirmation Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer select-none group">
                        <input
                            type="checkbox"
                            checked={isConfirmed}
                            onChange={e => setIsConfirmed(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center mt-0.5 transition-all ${
                            isConfirmed
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                            : 'border-white/10 bg-slate-900/50 group-hover:border-white/20'
                        }`}>
                            {isConfirmed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="text-xs text-slate-300 leading-normal">
                            Tôi xác nhận các thông tin đơn hàng trên là hoàn toàn chính xác.
                        </span>
                    </label>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-black rounded-xl transition-all shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 disabled:opacity-75 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                Đặt hàng ngay
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
