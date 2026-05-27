import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import { toLocalDatetimeString } from '../../lib/dateUtils';
import TwitterIcon from '../icons/TwitterIcon';

interface SocialAccount {
    id: string;
    platform: number;
    accountName: string;
    accountIdentifier: string | null;
    avatarUrl: string | null;
    isActive: boolean;
}

interface TargetItem {
    socialAccountId: string;
    scheduledTimeUtc: string;
}

interface TargetSelectorProps {
    value: TargetItem[];
    onChange: (targets: TargetItem[]) => void;
}

const platformNames: Record<number, string> = {
  0: 'Website',
  1: 'Facebook',
  2: 'Twitter/X',
  3: 'Instagram',
  4: 'LinkedIn',
  5: 'TikTok',
  6: 'YouTube',
  7: 'WordPress',
  8: 'Telegram',
  9: 'Zalo',
  11: 'Dev.to',
  12: 'Blogger',
  13: 'Threads',
};

const platformIcons: Record<number, React.ReactNode> = {
    0: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    1: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    2: <TwitterIcon className="w-4 h-4" />,
    3: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
    4: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    5: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
    6: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    7: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21.469 6.825c.84 0 1.531.69 1.531 1.532V21.25c0 .84-.691 1.531-1.531 1.531H2.531A1.531 1.531 0 0 1 1 21.25V8.357c0-.842.69-1.532 1.531-1.532h.001zm-4.97 7.251a.615.615 0 0 0-.044-.885l-3.094-2.776a.618.618 0 0 0-.886.044.615.615 0 0 0 .044.885l3.094 2.776a.618.618 0 0 0 .886-.044zM12 1.219C5.845 1.219.844 6.22.844 12.375c0 .845.1 1.669.283 2.46l.774-.773A10.325 10.325 0 0 1 1.688 12c0-5.69 4.622-10.312 10.312-10.312S22.312 6.31 22.312 12c0 .77-.086 1.52-.246 2.242l.777.777A11.07 11.07 0 0 0 23.156 12C23.156 5.845 18.155.844 12 .844v.375z"/></svg>,
    8: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
    9: <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none"><path fill="#0068FF" d="M24 0C10.745 0 0 10.745 0 24s10.745 24 24 24 24-10.745 24-24S37.255 0 24 0z" /><path fill="#FFFFFF" d="M29.09 34.5H18.91c-1.09 0-1.91-.91-1.91-2v-1.09c0-.545.182-1.09.545-1.454L27.273 18.5H19.09c-1.09 0-2-.91-2-2v-.91c0-1.09.91-2 2-2h10c1.09 0 2 .91 2 2v1.09c0 .545-.182 1.09-.545 1.454L20.727 29.5h8.364c1.09 0 2 .91 2 2v.91c0 1.09-.91 2.09-2 2.09z" /></svg>,
    11: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.81-.26.26-.28.26-1.45 0-1.73-.11-.13-.15-.14-.55-.14H6.5v-.14c0-.1 0-.13.06-.17.06-.05.1-.05.39-.05.44 0 .54.04.66.27.06.12.06.12.18.12.13 0 .15-.02.15-.22 0-.25-.01-.26-.12-.35zm-2.07-.15c-.21.05-.35.21-.35.43 0 .14.04.22.18.34.12.09.12.09.12.55V11.8h-.12c-.15 0-.15 0-.26-.14-.24-.28-.24-1.45 0-1.73.18-.19.4-.26.81-.26.4 0 .66.07.84.23.11.09.12.1.12.35 0 .2-.02.22-.15.22-.12 0-.12 0-.18-.12-.12-.23-.22-.27-.66-.27-.29 0-.33 0-.39.05-.06.04-.06.07-.06.17v.14h.38c.4 0 .44.01.55.14.26.28.26 1.45 0 1.73-.18.19-.4.26-.81.26l-.56.02-.04-2.45-.02-2.44h.58c.38 0 .66.07.84.23.11.09.12.1.12.35 0 .2-.02.22-.15.22-.12 0-.12 0-.18-.12-.12-.23-.22-.27-.66-.27-.38 0-.46.07-.56.24L5.3 11.5l-.01.2v.06l.01-.21.05-.28zM3 12c0-2.61.19-4.32.55-5.07.38-.81 1.08-1.41 1.93-1.68.39-.12 1-.13 5.48-.13 4.48 0 5.09.01 5.48.13.85.27 1.55.87 1.93 1.68.36.75.55 2.46.55 5.07 0 2.61-.19 4.32-.55 5.07-.38.81-1.08 1.41-1.93 1.68-.39.12-1 .13-5.48.13-4.48 0-5.09-.01-5.48-.13-.85-.27-1.55-.87-1.93-1.68C3.19 16.32 3 14.61 3 12zm2.08 0c0 2.43.16 3.96.48 4.6.31.62.91 1.11 1.6 1.32.33.1 1.16.12 4.84.12 3.68 0 4.51-.02 4.84-.12.69-.21 1.29-.7 1.6-1.32.32-.64.48-2.17.48-4.6 0-2.43-.16-3.96-.48-4.6-.31-.62-.91-1.11-1.6-1.32-.33-.1-1.16-.12-4.84-.12-3.68 0-4.51.02-4.84.12-.69.21-1.29.7-1.6 1.32-.32.64-.48 2.17-.48 4.6z"/></svg>,
    12: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.21 7.64c.54.54.79 1.18.79 1.92 0 .74-.25 1.38-.79 1.92s-1.18.79-1.92.79-1.38-.25-1.92-.79-1.18-1.18-1.18-1.92c0-.74.25-1.38.79-1.92s1.18-.79 1.92-.79 1.38.25 1.92.79zm-10.42 2.15c.54.54.79 1.18.79 1.92 0 .74-.25 1.38-.79 1.92s-1.18.79-1.92.79-1.38-.25-1.92-.79-1.18-1.18-1.18-1.92c0-.74.25-1.38.79-1.92s1.18-.79 1.92-.79 1.38.25 1.92.79zm0 6.42c.54.54.79 1.18.79 1.92 0 .74-.25 1.38-.79 1.92s-1.18.79-1.92.79-1.38-.25-1.92-.79-1.18-1.18-1.18-1.92c0-.74.25-1.38.79-1.92s1.18-.79 1.92-.79 1.38.25 1.92.79zM24 12c0 3.31-1.34 6.31-3.51 8.49C18.31 22.66 15.31 24 12 24s-6.31-1.34-8.49-3.51C1.34 18.31 0 15.31 0 12s1.34-6.31 3.51-8.49C5.69 1.34 8.69 0 12 0s6.31 1.34 8.49 3.51C22.66 5.69 24 8.69 24 12z"/></svg>,
};

const platformColors: Record<number, string> = {
  0: 'bg-gray-100 border-gray-300 text-gray-700',
  1: 'bg-blue-50 border-blue-300 text-blue-700',
  2: 'bg-gray-900 border-gray-800 text-white',
  3: 'bg-pink-50 border-pink-300 text-pink-700',
  4: 'bg-blue-50 border-blue-400 text-blue-800',
  5: 'bg-gray-900 border-gray-700 text-white',
  6: 'bg-red-50 border-red-300 text-red-700',
  7: 'bg-indigo-50 border-indigo-300 text-indigo-700',
  8: 'bg-cyan-50 border-cyan-300 text-cyan-700',
  9: 'bg-blue-50 border-blue-300 text-blue-600',
  11: 'bg-gray-900 border-gray-800 text-white',
  12: 'bg-orange-50 border-orange-300 text-orange-600',
  13: 'bg-gray-900 border-gray-800 text-white',
};

export default function TargetSelector({ value, onChange }: TargetSelectorProps) {
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/socialaccounts')
            .then(res => setAccounts(res.data || []))
            .catch(err => console.error('Error fetching social accounts:', err))
            .finally(() => setLoading(false));
    }, []);

    const isSelected = (accountId: string) => value.some(t => t.socialAccountId === accountId);

    const getScheduleTime = (accountId: string) => {
        const target = value.find(t => t.socialAccountId === accountId);
        return target?.scheduledTimeUtc || '';
    };

    const toggleAccount = (accountId: string) => {
        if (isSelected(accountId)) {
            onChange(value.filter(t => t.socialAccountId !== accountId));
        } else {
            // Default to now
            const defaultTime = new Date();
            const localStr = toLocalDatetimeString(defaultTime.toISOString());
            onChange([...value, { socialAccountId: accountId, scheduledTimeUtc: localStr }]);
        }
    };

    const updateSchedule = (accountId: string, time: string) => {
        onChange(value.map(t => t.socialAccountId === accountId ? { ...t, scheduledTimeUtc: time } : t));
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent" />
                Đang tải tài khoản mạng xã hội...
            </div>
        );
    }

    if (accounts.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center">
                <p className="text-sm text-gray-500">Chưa có tài khoản mạng xã hội nào được kết nối.</p>
                <p className="text-xs text-gray-400 mt-1">Vào phần Cài đặt → Tài khoản mạng xã hội để thêm.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {accounts.map(account => {
                const selected = isSelected(account.id);
                const colorClass = platformColors[account.platform] || platformColors[0];
                return (
                    <div
                        key={account.id}
                        className={`rounded-xl border-2 transition-all duration-200 ${selected
                                ? colorClass + ' shadow-sm'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center gap-3 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => toggleAccount(account.id)}
                                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${selected
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-gray-300 hover:border-blue-400'
                                    }`}
                            >
                                {selected && (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>

                            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 flex-shrink-0 border border-gray-200 text-gray-600">
                                {account.avatarUrl ? (
                                    <img src={account.avatarUrl} alt={account.accountName} className="w-full h-full object-cover" />
                                ) : (
                                    platformIcons[account.platform] || platformIcons[0]
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                    {account.accountName}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {platformNames[account.platform] || 'Khác'}
                                    {account.accountIdentifier && ` · ${account.accountIdentifier}`}
                                </div>
                            </div>
                        </div>

                        {selected && (
                            <div className="px-4 pb-3 pt-0">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-600 whitespace-nowrap">⏰ Lên lịch:</label>
                                    <input
                                        type="datetime-local"
                                        value={getScheduleTime(account.id)}
                                        onChange={(e) => updateSchedule(account.id, e.target.value)}
                                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
