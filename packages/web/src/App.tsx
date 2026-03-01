import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DocumentPage from './pages/DocumentPage';
import LoginPage from './pages/LoginPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="documents/:id" element={<DocumentPage />} />
      </Route>
    </Routes>
  );
}

export default App;
