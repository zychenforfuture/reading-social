import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { api } from '../lib/utils';

// 预设头像（使用 DiceBear Bottts + Adventurer 风格）
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Max',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Lily',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Milo',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Alice',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Bob',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Diana',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Eve',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Frank',
];

function AvatarDisplay({ avatarUrl, username, size = 80 }: { avatarUrl?: string; username?: string; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="头像"
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-white shadow"
      />
    );
  }
  const initial = (username || '?')[0].toUpperCase();
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="rounded-full bg-teal-500 text-white flex items-center justify-center font-bold border-2 border-white shadow"
    >
      {initial}
    </div>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useUserStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'avatar' | 'password'>('avatar');

  // 头像 tab 状态
  const [selectedAvatar, setSelectedAvatar] = useState<string>(user?.avatar_url || '');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 密码 tab 状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  // 拖拽上传状态
  const [dragging, setDragging] = useState(false);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      setAvatarMsg('只支持图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMsg('图片大小不能超过 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedAvatar(result);
      setAvatarMsg('');
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleSaveAvatar() {
    if (!selectedAvatar) {
      setAvatarMsg('请选择一张头像');
      return;
    }
    setAvatarSaving(true);
    setAvatarMsg('');
    try {
      const result = await api.updateProfile(selectedAvatar);
      updateUser({ avatar_url: result.user.avatar_url });
      setAvatarMsg('头像已更新！');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败，请重试';
      setAvatarMsg(msg);
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwdError('');
    setPwdMsg('');
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwdError('请填写所有密码字段');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      setPwdError('新密码长度不能少于 6 位');
      return;
    }
    setPwdSaving(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setPwdMsg('密码修改成功！');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '修改失败，请重试';
      setPwdError(message);
    } finally {
      setPwdSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 页面标题 */}
        <h1 className="text-2xl font-bold text-gray-800 mb-6">个人中心</h1>

        {/* Tab 栏 */}
        <div className="flex border-b border-gray-200 mb-6">
          {(['avatar', 'password'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-teal-500 text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'avatar' ? '修改头像' : '修改密码'}
            </button>
          ))}
        </div>

        {/* 修改头像 */}
        {activeTab === 'avatar' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            {/* 当前头像信息 */}
            <div className="flex items-center gap-4">
              <AvatarDisplay
                avatarUrl={selectedAvatar || user?.avatar_url}
                username={user?.username}
                size={72}
              />
              <div>
                <p className="text-sm text-gray-500">当前头像</p>
                <p className="font-semibold text-gray-800">{user?.username}</p>
                <p className="text-sm text-gray-400">{user?.email}</p>
              </div>
            </div>

            {/* 上传区域 */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                >
                  上传新图片
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragging ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm text-gray-400">拖拽图片到此或点击上传</p>
                <p className="text-xs text-gray-300 mt-1">支持 JPG、PNG、GIF，最大 2MB</p>
              </div>
            </div>

            {/* 预设头像 */}
            <div>
              <p className="text-sm text-gray-500 mb-3">或选择预设头像</p>
              <div className="grid grid-cols-6 gap-3">
                {PRESET_AVATARS.map((url) => (
                  <button
                    key={url}
                    onClick={() => { setSelectedAvatar(url); setAvatarMsg(''); }}
                    className={`rounded-full overflow-hidden border-2 transition-all ${
                      selectedAvatar === url
                        ? 'border-teal-500 scale-110 shadow-md'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                    style={{ width: 56, height: 56 }}
                    title={url.split('seed=')[1]}
                  >
                    <img src={url} alt="预设头像" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* 消息提示 */}
            {avatarMsg && (
              <p className={`text-sm ${avatarMsg.includes('！') ? 'text-green-600' : 'text-red-500'}`}>
                {avatarMsg}
              </p>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSaveAvatar}
                disabled={avatarSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {avatarSaving ? '保存中…' : '保存更改'}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 修改密码 */}
        {activeTab === 'password' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            {/* 原密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">原密码</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入原密码"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showOld ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">密码长度至少 6 位</p>
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* 错误/成功消息 */}
            {pwdError && <p className="text-sm text-red-500">{pwdError}</p>}
            {pwdMsg && <p className="text-sm text-green-600">{pwdMsg}</p>}

            {/* 操作按钮 */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleChangePassword}
                disabled={pwdSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {pwdSaving ? '提交中…' : '确认修改'}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
