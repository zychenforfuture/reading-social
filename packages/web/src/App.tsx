import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/admin/AdminLayout';
import HomePage from './pages/HomePage';
import DocumentPage from './pages/DocumentPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProfilePage from './pages/ProfilePage';
import ProfileMessages from './pages/ProfileMessages';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDocuments from './pages/admin/AdminDocuments';
import AdminComments from './pages/admin/AdminComments';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="documents/:id" element={<DocumentPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/messages" element={<ProfileMessages />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="documents" element={<AdminDocuments />} />
        <Route path="comments" element={<AdminComments />} />
      </Route>
    </Routes>
  );
}

export default App;
