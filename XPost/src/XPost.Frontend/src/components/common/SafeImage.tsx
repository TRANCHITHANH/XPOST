import { useState, useEffect } from 'react';
import api from '../../lib/axios';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
}

export default function SafeImage({ src, ...props }: SafeImageProps) {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!src) {
            setImageSrc('');
            return;
        }

        // If it is a local base64 or absolute external image, load it directly
        if (src.startsWith('data:') || (src.startsWith('http') && !src.includes('ngrok-free.dev'))) {
            setImageSrc(src);
            return;
        }

        // Otherwise, fetch it via Axios to bypass ngrok browser warnings
        let active = true;
        setLoading(true);
        
        // Remove trailing or leading duplicate slashes
        const fetchUrl = src.startsWith('http') ? src : src.startsWith('/') ? src : `/${src}`;

        const fetchImage = async () => {
            try {
                const res = await api.get(fetchUrl, { responseType: 'blob' });
                if (active) {
                    const objectUrl = URL.createObjectURL(res.data);
                    setImageSrc(objectUrl);
                }
            } catch (err) {
                console.error("Failed to load safe image", err);
                if (active) {
                    // Fallback to direct URL if fetch fails
                    setImageSrc(src);
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchImage();

        return () => {
            active = false;
        };
    }, [src]);

    if (loading && !imageSrc) {
        return (
            <div className="flex items-center justify-center w-full h-full min-h-[50px]">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    if (!imageSrc) return null;

    return <img src={imageSrc} {...props} />;
}
