/**
 * Format string to date with standard locale.
 */
export const formatDate = (dateString: string | Date, locale: string = 'vi-VN'): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

/**
 * Format number to currency style (VND).
 */
export const formatCurrency = (amount: number, currency: string = 'VND', locale: string = 'vi-VN'): string => {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount);
};
