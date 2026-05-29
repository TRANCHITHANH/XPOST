import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, Eye, Server, RefreshCw, Users, Mail, Globe } from 'lucide-react';

export default function PrivacyPolicy() {
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
            id: 'collect',
            title: '1. Thu thập thông tin cá nhân',
            icon: Eye,
            content: 'Chúng tôi thu thập thông tin để cung cấp dịch vụ tốt hơn cho tất cả người dùng. Các thông tin này bao gồm: thông tin bạn cung cấp cho chúng tôi (tên, email, số điện thoại khi đăng ký tài khoản) và thông tin thu thập được từ việc bạn sử dụng dịch vụ của chúng tôi (dữ liệu log, thiết bị, hệ điều hành).'
        },
        {
            id: 'api-usage',
            title: '2. Tích hợp API và Dữ liệu Mạng xã hội',
            icon: Server,
            content: 'Xpost hỗ trợ kết nối và đăng bài qua API chính thức của các nền tảng bên thứ ba (Facebook, Instagram, TikTok, YouTube, X/Twitter, v.v.). Khi bạn liên kết tài khoản mạng xã hội của mình, chúng tôi sẽ yêu cầu các quyền truy cập tối thiểu cần thiết để thực hiện đăng bài, lên lịch và báo cáo số liệu thống kê theo yêu cầu của bạn. Chúng tôi cam kết không lưu trữ mật khẩu tài khoản mạng xã hội của bạn và tuân thủ tuyệt đối quy định bảo mật của từng nền tảng.'
        },
        {
            id: 'use-info',
            title: '3. Sử dụng thông tin thu thập',
            icon: RefreshCw,
            content: 'Chúng tôi sử dụng thông tin thu thập được để vận hành, duy trì, cải tiến và cá nhân hóa các tính năng của Xpost. Ngoài ra, thông tin liên lạc của bạn có thể được dùng để gửi thông báo hệ thống quan trọng, xác thực bảo mật tài khoản hoặc phản hồi các yêu cầu hỗ trợ kỹ thuật.'
        },
        {
            id: 'security',
            title: '4. Bảo mật dữ liệu',
            icon: Lock,
            content: 'Xpost áp dụng các biện pháp bảo mật công nghệ cao bao gồm mã hóa SSL/TLS cho tất cả truyền tải dữ liệu, mã hóa lưu trữ token truy cập API, và tường lửa đa tầng bảo vệ cơ sở dữ liệu. Chỉ những nhân sự được ủy quyền mới có quyền truy cập dữ liệu để xử lý sự cố kỹ thuật.'
        },
        {
            id: 'third-party',
            title: '5. Chia sẻ thông tin với bên thứ ba',
            icon: Users,
            content: 'Chúng tôi không bán, trao đổi hoặc chuyển giao thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào vì mục đích thương mại. Thông tin chỉ được chia sẻ khi có yêu cầu pháp lý từ cơ quan có thẩm quyền hoặc nhằm bảo vệ quyền lợi, tài sản và an toàn của hệ thống Xpost cùng người dùng.'
        },
        {
            id: 'contact',
            title: '6. Cập nhật chính sách & Liên hệ',
            icon: Mail,
            content: 'Chính sách quyền riêng tư này có thể được cập nhật định kỳ để phù hợp với các thay đổi pháp lý và tính năng mới của hệ thống. Mọi thay đổi sẽ được công bố trên trang này. Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ bộ phận hỗ trợ của Xpost qua email: support@Xpost.vn.'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-blue-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Navigation Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 cursor-pointer"
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
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mb-4">
                            <Shield className="w-8 h-8 animate-pulse" />
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                            Chính Sách Quyền Riêng Tư
                        </h1>
                        <p className="text-sm text-gray-500 mt-2">
                            Cập nhật lần cuối: Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                        </p>
                    </div>

                    {/* Intro */}
                    <div className="prose max-w-none text-gray-600 mb-10 leading-relaxed">
                        <p>
                            Chào mừng bạn đến với <strong>Xpost</strong> (Hệ thống quản lý và đăng bài tự động đa nền tảng). Chúng tôi tôn trọng quyền riêng tư của bạn và cam kết bảo vệ dữ liệu cá nhân của bạn một cách tốt nhất. Chính sách này giải thích cách chúng tôi thu thập, sử dụng, tiết lộ và bảo vệ thông tin của bạn khi bạn sử dụng dịch vụ của chúng tôi.
                        </p>
                    </div>

                    {/* Policy Sections */}
                    <div className="space-y-8">
                        {sections.map((section) => (
                            <section key={section.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0 mt-0.5">
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
