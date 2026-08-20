import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FolderTree, HardDrive, User, LogOut } from 'lucide-react';
import DeviceTypePage from './pages/DeviceType';
import DevicePage from './pages/Device';
import { apiFetch } from './api/client';
import { AUTH_TOKEN_KEY, UnifiedLogin, setupFetchInterceptor } from '@code/common';

// Setup unified global fetch interceptor
setupFetchInterceptor({ appPrefix: '/pdm' });

export default function App({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoadingUser(false);
      return;
    }
    try {
      const data = await apiFetch('/me');
      setUser(data);
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
    navigate('/login');
  };

  // 1. 如果是被 code-bench 宿主嵌套，直接进行路由映射，不需要自带的侧边栏与页眉
  if (isEmbedded) {
    return (
      <div className="pdm-app" style={{ padding: '32px 40px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/pdm/device-type" replace />} />
          <Route path="/pdm" element={<Navigate to="/pdm/device-type" replace />} />
          <Route path="/pdm/" element={<Navigate to="/pdm/device-type" replace />} />
          <Route path="/device-type" element={<DeviceTypePage />} />
          <Route path="/device" element={<DevicePage />} />
          <Route path="/pdm/device-type" element={<DeviceTypePage />} />
          <Route path="/pdm/device" element={<DevicePage />} />
          <Route path="*" element={<Navigate to="/pdm/device-type" replace />} />
        </Routes>
      </div>
    );
  }

  // 2. 如果是独立运行，且正在加载用户信息
  if (loadingUser) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-secondary)' }}>
        <span>正在载入会话状态...</span>
      </div>
    );
  }

  // 3. 独立运行没有登录
  if (!user && location.pathname !== '/login') {
    return (
      <UnifiedLogin
        systemName="Code-PDM 产品数据管理"
        systemSubtitle="设备类型体系与设备标识生命周期管控"
        systemDesc="统一管理设备规格型号定义、唯一标识前缀后缀生成、Excel 批量导入导出与权限审计"
        onLoginSuccess={loadUser}
      />
    );
  }

  const isDeviceType = location.pathname.includes('/device-type') || location.pathname === '/';

  // 4. 独立调试模式下的 Layout
  return (
    <div className="pdm-app" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 独立模式侧边栏 */}
      <aside style={{ width: '240px', background: 'var(--card-bg)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ height: '64px', padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-info) 100%)',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-white, #ffffff)',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}>
            P
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-color)' }}>PDM 数据中心</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>独立调试模式</span>
          </div>
        </div>

        <nav style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <Link
            to="/device-type"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.85rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: isDeviceType ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              color: isDeviceType ? 'var(--primary-color)' : 'var(--text-color)',
              transition: 'all 0.15s'
            }}
          >
            <FolderTree size={16} />
            设备类型管理
          </Link>
          <Link
            to="/device"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.85rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: !isDeviceType ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              color: !isDeviceType ? 'var(--primary-color)' : 'var(--text-color)',
              transition: 'all 0.15s'
            }}
          >
            <HardDrive size={16} />
            设备ID管理
          </Link>
        </nav>
      </aside>

      {/* 主体内容 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: '64px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-color)' }}>
            {isDeviceType ? '设备类型管理' : '设备 ID 档案管理'}
          </h2>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="pdm-tag pdm-tag-blue" style={{ padding: '0.3rem 0.6rem' }}>
                <User size={13} />
                {user.name || user.username} ({Array.isArray(user.roles) && (user.roles.includes('super_admin') || user.roles.includes('pdm_admin')) ? '管理员' : '普通用户'})
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-outline"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              >
                <LogOut size={13} />
                退出
              </button>
            </div>
          )}
        </header>

        <main style={{ padding: '32px 40px', flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/device-type" replace />} />
            <Route path="/device-type" element={<DeviceTypePage />} />
            <Route path="/device" element={<DevicePage />} />
            <Route path="*" element={<Navigate to="/device-type" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
