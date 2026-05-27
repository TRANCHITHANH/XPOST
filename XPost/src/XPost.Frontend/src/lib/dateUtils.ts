export function normalizeUtcString(utcStr: string): string {
    if (!utcStr) return '';
    // Force string to act as local time without any timezone shifting.
    let normalized = utcStr.replace('Z', '');
    if (normalized.includes('+')) {
        normalized = normalized.substring(0, normalized.indexOf('+'));
    }
    return normalized;
}

export function parseUtcDate(utcStr: string): Date | null {
    if (!utcStr) return null;
    const normalized = normalizeUtcString(utcStr);
    const d = new Date(normalized); // Parsed as local time since there is no Z.
    return isNaN(d.getTime()) ? null : d;
}

export function toLocalDatetimeString(utcStr: string): string {
    const d = parseUtcDate(utcStr);
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function toUtcDatetimeString(localStr: string): string | null {
    if (!localStr) return null;
    try {
        const [datePart, timePart] = localStr.split('T');
        if (!datePart || !timePart) return null;
        const [year, month, day] = datePart.split('-');
        const [hours, minutes, seconds] = timePart.split(':');
        // Return exactly what the user selected in ISO format but WITHOUT 'Z' so backend treats it as Unspecified/Local
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds || '00'}`;
    } catch {
        return null;
    }
}

export function formatDateTimeVN(utcStr: string): { date: string, time: string } | null {
    const d = parseUtcDate(utcStr);
    if (!d) return null;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
        date: `${day}/${month}/${year}`,
        time: `${hours}:${minutes}`
    };
}
