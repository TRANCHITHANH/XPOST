import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Color Palette ──────────────────────────────────────────────── */
const TEXT_COLORS = [
    { label: 'Mặc định', value: '' },
    { label: 'Đen', value: '#000000' },
    { label: 'Xám đậm', value: '#374151' },
    { label: 'Xám', value: '#6b7280' },
    { label: 'Đỏ', value: '#dc2626' },
    { label: 'Cam', value: '#ea580c' },
    { label: 'Vàng đậm', value: '#ca8a04' },
    { label: 'Xanh lá', value: '#16a34a' },
    { label: 'Xanh dương', value: '#2563eb' },
    { label: 'Tím', value: '#7c3aed' },
    { label: 'Hồng', value: '#db2777' },
    { label: 'Nâu', value: '#92400e' },
];

const BG_COLORS = [
    { label: 'Không nền', value: '' },
    { label: 'Vàng nhạt', value: '#fef08a' },
    { label: 'Xanh lá nhạt', value: '#bbf7d0' },
    { label: 'Xanh dương nhạt', value: '#bfdbfe' },
    { label: 'Tím nhạt', value: '#ddd6fe' },
    { label: 'Hồng nhạt', value: '#fbcfe8' },
    { label: 'Cam nhạt', value: '#fed7aa' },
    { label: 'Đỏ nhạt', value: '#fecaca' },
    { label: 'Xám nhạt', value: '#e5e7eb' },
    { label: 'Vàng đậm', value: '#facc15' },
    { label: 'Xanh lá', value: '#86efac' },
    { label: 'Xanh dương', value: '#93c5fd' },
];

/* ─── Main Component ──────────────────────────────────────────────── */

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Nhập nội dung bài viết...',
    minHeight = '280px',
}: RichTextEditorProps) {
    const isInternalUpdate = useRef(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkNewTab, setLinkNewTab] = useState(true);
    const [linkNofollow, setLinkNofollow] = useState(false);
    const [linkSponsored, setLinkSponsored] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3, 4] },
                bulletList: { keepMarks: true },
                orderedList: { keepMarks: true },
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: 'https',
                HTMLAttributes: {
                    class: 'text-blue-600 underline cursor-pointer',
                },
            }),
            Image.configure({
                HTMLAttributes: { class: 'rounded-lg max-w-full h-auto my-4' },
            }),
            Placeholder.configure({ placeholder }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            TextStyle,
            Color,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            isInternalUpdate.current = true;
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none',
                style: `min-height: ${minHeight}`,
            },
            handleClick: (view, pos, event) => {
                // Intercept clicks on links to open edit modal instead of navigating
                const target = event.target as HTMLElement;
                const linkEl = target.closest('a');
                if (linkEl) {
                    event.preventDefault();
                    event.stopPropagation();
                    // Position cursor on the link
                    const { state } = view;
                    const $pos = state.doc.resolve(pos);
                    const linkMark = $pos.marks().find(m => m.type.name === 'link');
                    if (linkMark) {
                        const existingRel = (linkMark.attrs.rel || '') as string;
                        setLinkUrl(linkMark.attrs.href || '');
                        setLinkNewTab(linkMark.attrs.target === '_blank');
                        setLinkNofollow(existingRel.includes('nofollow'));
                        setLinkSponsored(existingRel.includes('sponsored'));
                        setShowLinkModal(true);
                    }
                    return true;
                }
                return false;
            },
        },
    });

    // Sync external value changes (e.g. loading post data for edit)
    useEffect(() => {
        if (!editor) return;
        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }
        const currentHTML = editor.getHTML();
        if (value !== currentHTML && value !== '<p></p>') {
            editor.commands.setContent(value || '');
        }
    }, [value, editor]);

    const openLinkModal = useCallback(() => {
        if (!editor) return;
        const attrs = editor.getAttributes('link');
        const existingRel = (attrs.rel || '') as string;
        setLinkUrl(attrs.href || '');
        setLinkNewTab(attrs.target === '_blank' || !attrs.href);
        setLinkNofollow(existingRel.includes('nofollow'));
        setLinkSponsored(existingRel.includes('sponsored'));
        setShowLinkModal(true);
    }, [editor]);

    const applyLink = useCallback(() => {
        if (!editor) return;
        if (!linkUrl) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            const relParts: string[] = [];
            if (linkNewTab) relParts.push('noopener', 'noreferrer');
            if (linkNofollow) relParts.push('nofollow');
            if (linkSponsored) relParts.push('sponsored');
            editor.chain().focus().extendMarkRange('link').setLink({
                href: linkUrl,
                target: linkNewTab ? '_blank' : null,
                rel: relParts.length > 0 ? relParts.join(' ') : null,
            }).run();
        }
        setShowLinkModal(false);
        setLinkUrl('');
    }, [editor, linkUrl, linkNewTab, linkNofollow, linkSponsored]);

    const removeLink = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setShowLinkModal(false);
        setLinkUrl('');
    }, [editor]);

    const addImage = useCallback(() => {
        if (!editor) return;
        const url = window.prompt('Nhập URL hình ảnh:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);

    const insertTable = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-visible transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 relative">
            {/* Fixed Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 px-2.5 py-2 border-b border-gray-100 bg-gray-50/80 relative z-20">
                {/* Text Formatting */}
                <ToolbarGroup>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="In đậm (Ctrl+B)"
                    >
                        <span className="font-bold text-sm">B</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="In nghiêng (Ctrl+I)"
                    >
                        <span className="italic text-sm font-serif">I</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        isActive={editor.isActive('underline')}
                        title="Gạch chân (Ctrl+U)"
                    >
                        <span className="underline text-sm">U</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        isActive={editor.isActive('strike')}
                        title="Gạch ngang"
                    >
                        <span className="line-through text-sm">S</span>
                    </ToolbarButton>
                </ToolbarGroup>

                <ToolbarDivider />

                {/* Text Color & Background Color */}
                <ToolbarGroup>
                    <ColorPicker
                        colors={TEXT_COLORS}
                        currentColor={editor.getAttributes('textStyle').color || ''}
                        onSelect={(color) => {
                            if (color) {
                                editor.chain().focus().setColor(color).run();
                            } else {
                                editor.chain().focus().unsetColor().run();
                            }
                        }}
                        icon={
                            <div className="flex flex-col items-center">
                                <span className="text-sm font-bold leading-none">A</span>
                                <div
                                    className="w-4 h-1 rounded-sm mt-0.5"
                                    style={{ backgroundColor: editor.getAttributes('textStyle').color || '#374151' }}
                                />
                            </div>
                        }
                        title="Màu chữ"
                    />
                    <ColorPicker
                        colors={BG_COLORS}
                        currentColor={editor.getAttributes('highlight').color || ''}
                        onSelect={(color) => {
                            if (color) {
                                editor.chain().focus().toggleHighlight({ color }).run();
                            } else {
                                editor.chain().focus().unsetHighlight().run();
                            }
                        }}
                        icon={
                            <div className="flex flex-col items-center">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <div
                                    className="w-4 h-1 rounded-sm mt-0.5"
                                    style={{ backgroundColor: editor.getAttributes('highlight').color || '#fef08a' }}
                                />
                            </div>
                        }
                        title="Nền chữ"
                    />
                </ToolbarGroup>

                <ToolbarDivider />

                {/* Headings */}
                <ToolbarGroup>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        title="Tiêu đề 2"
                    >
                        <span className="text-xs font-extrabold">H2</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        isActive={editor.isActive('heading', { level: 3 })}
                        title="Tiêu đề 3"
                    >
                        <span className="text-xs font-extrabold">H3</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                        isActive={editor.isActive('heading', { level: 4 })}
                        title="Tiêu đề 4"
                    >
                        <span className="text-xs font-extrabold">H4</span>
                    </ToolbarButton>
                </ToolbarGroup>

                <ToolbarDivider />

                {/* Lists */}
                <ToolbarGroup>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        title="Danh sách gạch đầu dòng"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        title="Danh sách đánh số"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13" />
                            <text x="1" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1</text>
                            <text x="1" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">2</text>
                            <text x="1" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">3</text>
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                        title="Trích dẫn"
                    >
                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.183 11 15c0 1.933-1.567 3.5-3.5 3.5-1.288 0-2.46-.697-2.917-1.679zM14.583 17.321C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.69 21 13.183 21 15c0 1.933-1.567 3.5-3.5 3.5-1.288 0-2.46-.697-2.917-1.679z" />
                        </svg>
                    </ToolbarButton>
                </ToolbarGroup>

                <ToolbarDivider />

                {/* Alignment */}
                <ToolbarGroup>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        isActive={editor.isActive({ textAlign: 'left' })}
                        title="Căn trái"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        isActive={editor.isActive({ textAlign: 'center' })}
                        title="Căn giữa"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        isActive={editor.isActive({ textAlign: 'right' })}
                        title="Căn phải"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18" />
                        </svg>
                    </ToolbarButton>
                </ToolbarGroup>

                <ToolbarDivider />

                {/* Insert */}
                <ToolbarGroup>
                    <ToolbarButton
                        onClick={openLinkModal}
                        isActive={editor.isActive('link')}
                        title="Chèn liên kết"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton onClick={addImage} title="Chèn hình ảnh">
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton onClick={insertTable} title="Chèn bảng (3×3)">
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        isActive={editor.isActive('codeBlock')}
                        title="Khối code"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Đường kẻ ngang"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" d="M3 12h18" />
                        </svg>
                    </ToolbarButton>
                </ToolbarGroup>

                <ToolbarDivider />

                {/* Table controls — only visible when inside a table */}
                {editor.isActive('table') && (
                    <>
                        <ToolbarGroup>
                            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Thêm cột">
                                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M15 3v18M12 9v6M9 12h6" />
                                </svg>
                            </ToolbarButton>
                            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Thêm hàng">
                                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M3 15h18M9 12v6M12 12v6" />
                                </svg>
                            </ToolbarButton>
                            <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Xóa cột">
                                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M15 3v18" strokeDasharray="3 3" />
                                    <path d="M10 10l4 4M14 10l-4 4" strokeWidth={2.5} />
                                </svg>
                            </ToolbarButton>
                            <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Xóa hàng">
                                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M3 15h18" strokeDasharray="3 3" />
                                    <path d="M10 10l4 4M14 10l-4 4" strokeWidth={2.5} />
                                </svg>
                            </ToolbarButton>
                            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Xóa bảng">
                                <svg className="w-4.5 h-4.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </ToolbarButton>
                        </ToolbarGroup>
                        <ToolbarDivider />
                    </>
                )}

                {/* Undo / Redo */}
                <ToolbarGroup>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Hoàn tác (Ctrl+Z)"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                        </svg>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Làm lại (Ctrl+Y)"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
                        </svg>
                    </ToolbarButton>
                </ToolbarGroup>

                <ToolbarDivider />

                {/* Emoji */}
                <EmojiPicker onSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()} />
            </div>

            {/* Link Modal */}
            {showLinkModal && (
                <LinkModal
                    url={linkUrl}
                    newTab={linkNewTab}
                    nofollow={linkNofollow}
                    sponsored={linkSponsored}
                    hasExistingLink={editor.isActive('link')}
                    onUrlChange={setLinkUrl}
                    onNewTabChange={setLinkNewTab}
                    onNofollowChange={setLinkNofollow}
                    onSponsoredChange={setLinkSponsored}
                    onApply={applyLink}
                    onRemove={removeLink}
                    onClose={() => setShowLinkModal(false)}
                />
            )}

            {/* Bubble Menu — appears on text selection */}
            {editor && (
                <BubbleMenu editor={editor}
                    className="flex items-center gap-0.5 px-1.5 py-1 bg-gray-900 rounded-lg shadow-xl border border-gray-700 z-50"
                >
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                    >
                        <span className="font-bold text-xs">B</span>
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                    >
                        <span className="italic text-xs font-serif">I</span>
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        isActive={editor.isActive('underline')}
                    >
                        <span className="underline text-xs">U</span>
                    </BubbleButton>
                    <BubbleButton onClick={openLinkModal} isActive={editor.isActive('link')}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        isActive={editor.isActive('highlight')}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </BubbleButton>
                </BubbleMenu>
            )}

            {/* Editor Content */}
            <div className="px-4 py-3">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

/* ─── Link Modal ──────────────────────────────────────────────────── */

function LinkModal({
    url,
    newTab,
    nofollow,
    sponsored,
    hasExistingLink,
    onUrlChange,
    onNewTabChange,
    onNofollowChange,
    onSponsoredChange,
    onApply,
    onRemove,
    onClose,
}: {
    url: string;
    newTab: boolean;
    nofollow: boolean;
    sponsored: boolean;
    hasExistingLink: boolean;
    onUrlChange: (v: string) => void;
    onNewTabChange: (v: boolean) => void;
    onNofollowChange: (v: boolean) => void;
    onSponsoredChange: (v: boolean) => void;
    onApply: () => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onApply();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            {/* Popover */}
            <div className="absolute left-1/2 -translate-x-1/2 top-14 z-50 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Chèn liên kết
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* URL Input */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                    <input
                        ref={inputRef}
                        type="url"
                        value={url}
                        onChange={(e) => onUrlChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
                    />
                </div>

                {/* Link Options — Checkboxes */}
                <div className="space-y-2.5 mb-4">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tùy chọn liên kết</p>

                    <LinkCheckbox
                        checked={newTab}
                        onChange={onNewTabChange}
                        label="Mở liên kết trong 1 thẻ mới"
                        description='target="_blank"'
                    />
                    <LinkCheckbox
                        checked={nofollow}
                        onChange={onNofollowChange}
                        label='Thêm rel="nofollow"'
                        description="Ngăn công cụ tìm kiếm theo dõi liên kết"
                    />
                    <LinkCheckbox
                        checked={sponsored}
                        onChange={onSponsoredChange}
                        label='Thêm rel="sponsored"'
                        description="Đánh dấu liên kết quảng cáo / tài trợ"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={!url.trim()}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {hasExistingLink ? 'Cập nhật' : 'Chèn liên kết'}
                    </button>
                    {hasExistingLink && (
                        <button
                            type="button"
                            onClick={onRemove}
                            className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            Gỡ liên kết
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Hủy
                    </button>
                </div>
            </div>
        </>
    );
}

function LinkCheckbox({
    checked,
    onChange,
    label,
    description,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description: string;
}) {
    return (
        <label className="flex items-start gap-2.5 cursor-pointer group">
            <div className="pt-0.5">
                <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        checked
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 group-hover:border-blue-400'
                    }`}
                    onClick={() => onChange(!checked)}
                >
                    {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            </div>
            <div className="min-w-0">
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                    {label}
                </span>
                <p className="text-[11px] text-gray-400 leading-tight">{description}</p>
            </div>
        </label>
    );
}

/* ─── Color Picker Dropdown ──────────────────────────────────────── */

function ColorPicker({
    colors,
    currentColor,
    onSelect,
    icon,
    title,
}: {
    colors: { label: string; value: string }[];
    currentColor: string;
    onSelect: (color: string) => void;
    icon: React.ReactNode;
    title: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                title={title}
                className={`
                    w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150
                    ${isOpen ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'}
                `}
            >
                {icon}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 p-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">{title}</p>
                    <div className="grid grid-cols-6 gap-1">
                        {colors.map((c) => (
                            <button
                                key={c.value || 'default'}
                                type="button"
                                title={c.label}
                                onClick={() => { onSelect(c.value); setIsOpen(false); }}
                                className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${currentColor === c.value
                                        ? 'border-blue-500 ring-2 ring-blue-200'
                                        : 'border-gray-200 hover:border-gray-400'
                                    }`}
                                style={{
                                    backgroundColor: c.value || '#ffffff',
                                    ...((!c.value) ? {
                                        backgroundImage: 'linear-gradient(135deg, #fff 45%, #ef4444 45%, #ef4444 55%, #fff 55%)',
                                    } : {}),
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Toolbar Sub-components ────────────────────────────────────── */

function ToolbarButton({
    children,
    onClick,
    isActive = false,
    disabled = false,
    title,
}: {
    children: React.ReactNode;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`
                w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150
                ${isActive
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
                }
            `}
        >
            {children}
        </button>
    );
}

function BubbleButton({
    children,
    onClick,
    isActive = false,
}: {
    children: React.ReactNode;
    onClick: () => void;
    isActive?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                w-7 h-7 flex items-center justify-center rounded transition-colors
                ${isActive ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}
            `}
        >
            {children}
        </button>
    );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarDivider() {
    return <div className="w-px h-6 bg-gray-200 mx-1.5" />;
}

/* ─── Emoji Picker ───────────────────────────────────────────────── */

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
    {
        label: 'Mặt cười',
        icon: '😀',
        emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😋','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🥳','🤠','😎','🤓','🧐'],
    },
    {
        label: 'Cử chỉ',
        icon: '👋',
        emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','🦿','🦵','🦶','👂','👃','👀','👁️','🧠','🫀','🫁','🗣️','👤','👥'],
    },
    {
        label: 'Trái tim',
        icon: '❤️',
        emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💝','💘','💟','♥️','🫶','💑','💏','👨‍❤️‍👨','👩‍❤️‍👩','💐','🌹','🌷','🌺','🌸','💮','🏵️','🌻','🌼','🍀','🎋','🎍'],
    },
    {
        label: 'Động vật',
        icon: '🐶',
        emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️'],
    },
    {
        label: 'Đồ ăn',
        icon: '🍔',
        emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥖','🍞','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫕','🥪','🌮','🌯','🫔','🥙'],
    },
    {
        label: 'Du lịch',
        icon: '✈️',
        emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🚨','🚥','🚦','🛑','✈️','🛫','🛬','🪂','💺','🚀','🛸','🚁','⛵','🚢','🛶','⚓','🗼','🗽','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋'],
    },
    {
        label: 'Đối tượng',
        icon: '💡',
        emojis: ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🗑️','🛢️','💰','💴','💵','💶','💷','🪙','💸','💳','🧾','💎'],
    },
    {
        label: 'Biểu tượng',
        icon: '⭐',
        emojis: ['⭐','🌟','✨','⚡','🔥','💥','☄️','🌈','☀️','🌤️','⛅','🌥️','🌦️','🌧️','⛈️','🌩️','❄️','💨','💧','💦','☔','🌊','✅','❌','❓','❗','‼️','⁉️','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','▶️','⏸️','⏹️','⏺️','⏏️','🔀','🔁','🔂','⏩','⏪'],
    },
    {
        label: 'Cờ',
        icon: '🏁',
        emojis: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇦🇨','🇦🇩','🇦🇪','🇦🇫','🇦🇬','🇦🇮','🇦🇱','🇦🇲','🇦🇴','🇦🇶','🇦🇷','🇦🇸','🇦🇹','🇦🇺','🇦🇼','🇦🇽','🇦🇿','🇧🇦','🇧🇧','🇧🇩','🇧🇪','🇧🇫','🇧🇬','🇧🇭','🇧🇮','🇧🇯','🇧🇱','🇧🇲','🇧🇳','🇧🇴','🇧🇶','🇧🇷','🇧🇸','🇧🇹','🇧🇻','🇧🇼','🇧🇾','🇧🇿','🇨🇦','🇨🇨','🇨🇩','🇨🇫','🇨🇬','🇨🇭','🇨🇮','🇨🇰','🇨🇱','🇨🇲','🇨🇳','🇨🇴','🇨🇵','🇨🇷','🇨🇺','🇨🇻','🇨🇼','🇨🇽','🇨🇾','🇨🇿','🇩🇪','🇩🇬','🇩🇯','🇩🇰','🇩🇲','🇩🇴','🇩🇿','🇪🇦','🇪🇨','🇪🇪','🇪🇬','🇪🇭','🇪🇷','🇪🇸','🇪🇹','🇪🇺','🇫🇮','🇫🇯','🇫🇰','🇫🇲','🇫🇴','🇫🇷','🇬🇦','🇬🇧','🇬🇩','🇬🇪','🇬🇫','🇬🇬','🇬🇭','🇬🇮','🇬🇱','🇬🇲','🇬🇳','🇬🇵','🇬🇶','🇬🇷','🇬🇸','🇬🇹','🇬🇺','🇬🇼','🇬🇾','🇭🇰','🇭🇲','🇭🇳','🇭🇷','🇭🇹','🇭🇺','🇮🇨','🇮🇩','🇮🇪','🇮🇱','🇮🇲','🇮🇳','🇮🇴','🇮🇶','🇮🇷','🇮🇸','🇮🇹','🇯🇪','🇯🇲','🇯🇴','🇯🇵','🇰🇪','🇰🇬','🇰🇭','🇰🇮','🇰🇲','🇰🇳','🇰🇵','🇰🇷','🇰🇼','🇰🇾','🇰🇿','🇱🇦','🇱🇧','🇱🇨','🇱🇮','🇱🇰','🇱🇷','🇱🇸','🇱🇹','🇱🇺','🇱🇻','🇱🇾','🇲🇦','🇲🇨','🇲🇩','🇲🇪','🇲🇫','🇲🇬','🇲🇭','🇲🇰','🇲🇱','🇲🇲','🇲🇳','🇲🇴','🇲🇵','🇲🇶','🇲🇷','🇲🇸','🇲🇹','🇲🇺','🇲🇻','🇲🇼','🇲🇽','🇲🇾','🇲🇿','🇳🇦','🇳🇨','🇳🇪','🇳🇫','🇳🇬','🇳🇮','🇳🇱','🇳🇴','🇳🇵','🇳🇷','🇳🇺','🇳🇿','🇴🇲','🇵🇦','🇵🇪','🇵🇫','🇵🇬','🇵🇭','🇵🇰','🇵🇱','🇵🇲','🇵🇳','🇵🇷','🇵🇸','🇵🇹','🇵🇼','🇵🇾','🇶🇦','🇷🇪','🇷🇴','🇷🇸','🇷🇺','🇷🇼','🇸🇦','🇸🇧','🇸🇨','🇸🇩','🇸🇪','🇸🇬','🇸🇭','🇸🇮','🇸🇯','🇸🇰','🇸🇱','🇸🇲','🇸🇳','🇸🇴','🇸🇷','🇸🇸','🇸🇹','🇸🇻','🇸🇽','🇸🇾','🇸🇿','🇹🇦','🇹🇨','🇹🇩','🇹🇫','🇹🇬','🇹🇭','🇹🇯','🇹🇰','🇹🇱','🇹🇲','🇹🇳','🇹🇴','🇹🇷','🇹🇹','🇹🇻','🇹🇼','🇹🇿','🇺🇦','🇺🇬','🇺🇲','🇺🇳','🇺🇸','🇺🇾','🇺🇿','🇻🇦','🇻🇨','🇻🇪','🇻🇬','🇻🇮','🇻🇳','🇻🇺','🇼🇫','🇼🇸','🇽🇰','🇾🇪','🇾🇹','🇿🇦','🇿🇲','🇿🇼','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🏴󠁧󠁢󠁳󠁣󠁴󠁿','🏴󠁧󠁢󠁷󠁬󠁳󠁿'],
    },
];

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                title="Chèn biểu tượng cảm xúc"
                className={`
                    w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150
                    ${isOpen ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'}
                `}
            >
                <span className="text-base leading-none">😊</span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 z-50 w-80 animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 overflow-x-auto scrollbar-none">
                        {EMOJI_CATEGORIES.map((cat, i) => (
                            <button
                                key={cat.label}
                                type="button"
                                onClick={() => setActiveTab(i)}
                                title={cat.label}
                                className={`
                                    w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-base transition-all
                                    ${activeTab === i ? 'bg-blue-100 scale-110' : 'hover:bg-gray-100'}
                                `}
                            >
                                {cat.icon}
                            </button>
                        ))}
                    </div>

                    {/* Emoji Grid */}
                    <div className="p-2 max-h-52 overflow-y-auto">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">
                            {EMOJI_CATEGORIES[activeTab].label}
                        </p>
                        <div className="grid grid-cols-9 gap-0.5">
                            {EMOJI_CATEGORIES[activeTab].emojis.map((emoji, i) => (
                                <button
                                    key={`${emoji}-${i}`}
                                    type="button"
                                    onClick={() => {
                                        onSelect(emoji);
                                        setIsOpen(false);
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-md text-lg hover:bg-blue-50 hover:scale-125 transition-all duration-100 cursor-pointer"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
