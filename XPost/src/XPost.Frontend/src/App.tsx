import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MainLayout from './components/layouts/MainLayout';
import PostList from './pages/PostList';
import PostForm from './pages/PostForm';
import SocialAccounts from './pages/SocialAccounts';
import Profile from './pages/Profile';
import Categories from './pages/Categories';
import Tenants from './pages/admin/Tenants';
import CompanyProfile from './pages/settings/CompanyProfile';
import Users from './pages/Users';
import Keywords from './pages/Keywords';
import PageManagement from './pages/PageManagement';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import FacebookAdsDashboard from './pages/FacebookAdsDashboard';
import CreateAdCampaignWizard from './pages/CreateAdCampaignWizard';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <Routes>
        {/* Public routes — no layout shell */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />

        {/* Authenticated routes — wrapped by MainLayout (MasterPage) */}
        <Route element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/posts/create" element={<PostForm />} />
          <Route path="/posts/edit/:id" element={<PostForm />} />
          <Route path="/platforms" element={<SocialAccounts />} />
          <Route path="/platforms/:accountId/manage" element={<PageManagement />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/keywords" element={<Keywords />} />
          <Route path="/facebook-ads" element={<FacebookAdsDashboard />} />
          <Route path="/facebook-ads/create" element={<CreateAdCampaignWizard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/tenants" element={<Tenants />} />
          <Route path="/settings/company" element={<CompanyProfile />} />
          <Route path="/users" element={<Users />} />
          {/* Thêm các trang mới ở đây, ví dụ: */}
          {/* <Route path="/accounts" element={<Accounts />} /> */}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
      <Toaster position="top-right" />
    </Router>
  );
}

export default App;
