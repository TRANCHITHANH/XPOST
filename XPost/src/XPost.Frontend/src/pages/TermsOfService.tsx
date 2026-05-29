import { useNavigate } from 'react-router-dom';
import { Scale, ArrowLeft, UserCheck, ShieldAlert, AlertOctagon, RefreshCcw, Landmark, Mail, Globe } from 'lucide-react';

export default function TermsOfService() {
    const navigate = useNavigate();
    const isAuthenticated = !!localStorage.getItem('token');

    const handleBack = () => {
        if (isAuthenticated) {
            navigate('/dashboard');
        } else {
            navigate('/login');
        }
    };

    const sections = [
        {
            id: 'accept',
            title: '1. Chấp thuận điều khoản',
            icon: UserCheck,
            content: 'Bằng việc đăng ký tài khoản, đăng nhập hoặc sử dụng dịch vụ của Xpost, bạn đồng ý tuân thủ và chịu sự ràng buộc bởi các Điều khoản dịch vụ này. Nếu bạn không đồng ý với bất kỳ phần nào của các điều khoản này, vui lòng ngừng sử dụng dịch vụ ngay lập tức.'
        },
        {
            id: 'account',
            title: '2. Tài khoản và Bảo mật',
            icon: Landmark,
            content: 'Bạn có trách nhiệm bảo mật thông tin tài khoản và mật khẩu đăng nhập Xpost của mình. Bạn hoàn toàn chịu trách nhiệm về tất cả các hoạt động xảy ra dưới tài khoản của bạn. Vui lòng thông báo ngay cho chúng tôi nếu phát hiện bất kỳ hành vi sử dụng trái phép nào đối với tài khoản của mình.'
        },
        {
            id: 'abuse',
            title: '3. Quy định sử dụng & Chống lạm dụng',
            icon: ShieldAlert,
            content: 'Bạn cam kết sử dụng Xpost cho các mục đích hợp pháp và không vi phạm bất kỳ luật lệ hiện hành nào. Nghiêm cấm tuyệt đối việc sử dụng Xpost để phát tán: nội dung lừa đảo, thư rác (spam), mã độc, thông tin xúc phạm, khiêu dâm hoặc kích động bạo lực. Chúng tôi có quyền tạm ngưng hoặc xóa vĩnh viễn tài khoản của bạn nếu phát hiện hành vi lạm dụng mà không cần thông báo trước.'
        },
        {
            id: 'platforms',
            title: '4. Tuân thủ Chính sách Mạng xã hội bên thứ ba',
            icon: Globe,
            content: 'Xpost là công cụ kết nối với các mạng xã hội (Facebook, TikTok, v.v.) qua các API chính thức. Việc sử dụng Xpost đồng nghĩa với việc bạn cũng phải tuân thủ nghiêm ngặt Điều khoản dịch vụ và Chính sách cộng đồng của các nền tảng mạng xã hội đó. Mọi vi phạm chính sách của bên thứ ba dẫn đến việc khóa trang hoặc hạn chế tài khoản mạng xã hội đều nằm ngoài phạm vi trách nhiệm của Xpost.'
        },
        {
            id: 'liability',
            title: '5. Giới hạn trách nhiệm',
            icon: AlertOctagon,
            content: 'Xpost được cung cấp theo nguyên trạng và chúng tôi không đảm bảo dịch vụ sẽ hoàn toàn không có lỗi, không bị gián đoạn. Chúng tôi không chịu trách nhiệm đối với bất kỳ thiệt hại trực tiếp, gián tiếp, vô ý hay đặc biệt nào phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ, hoặc do sự cố kỹ thuật từ nhà cung cấp API bên thứ ba.'
        },
        {
            id: 'changes',
            title: '6. Thay đổi điều khoản & Liên hệ',
            icon: RefreshCcw,
            content: 'Chúng tôi có quyền điều chỉnh, sửa đổi Điều khoản dịch vụ này bất kỳ lúc nào để phù hợp với tình hình thực tế. Bản cập nhật mới nhất sẽ được đăng tải trực tiếp tại trang này. Tiếp tục sử dụng dịch vụ sau khi có thay đổi đồng nghĩa với việc bạn chấp nhận những điều khoản mới đó. Mọi câu hỏi xin gửi về: support@Xpost.vn.'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Navigation Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {isAuthenticated ? 'Về Bảng điều khiển' : 'Quay lại Đăng nhập'}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">X</div>
                        <span className="font-bold text-lg text-gray-800 tracking-tight">Xpost</span>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/60 p-8 sm:p-12">
                    {/* Header */}
                    <div className="text-center border-b border-gray-100 pb-8 mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl mb-4">
                            <Scale className="w-8 h-8 animate-pulse" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                            Điều Khoản Dịch Vụ
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">
                            Cập nhật lần cuối: Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                        </p>
                    </div>

                    {/* Intro */}
                    <div className="prose max-w-none text-gray-600 mb-10 leading-relaxed">
                        <p>
                            Chào mừng bạn sử dụng phần mềm và dịch vụ <strong>Xpost</strong>. Các điều khoản dưới đây điều chỉnh việc bạn truy cập và sử dụng dịch vụ đăng bài đa nền tảng của chúng tôi. Vui lòng đọc kỹ các điều khoản này trước khi tạo tài khoản hoặc sử dụng bất kỳ tính năng nào trên hệ thống.
                        </p>
                    </div>

                    {/* Terms Sections */}
                    <div className="space-y-8">
                        {sections.map((section) => (
                            <section key={section.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5">
                                        <section.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800 mb-2">{section.title}</h2>
                                        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>

                    {/* Footer Info */}
                    <div className="mt-12 pt-8 border-t border-gray-100 text-center">
                        <div className="flex justify-center items-center gap-3 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5" />
                                <span>Xpost.vn</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                <span>support@Xpost.vn</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-4">
                            &copy; {new Date().getFullYear()} Xpost System. Tất cả các quyền được bảo lưu.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
