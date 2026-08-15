import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Space, ConfigProvider, theme, Tag } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');
import { DatabaseOutlined, ApartmentOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import DeviceTypePage from './pages/DeviceType';
import DevicePage from './pages/Device';
import { apiFetch } from './api/client';
import { useTheme, AUTH_TOKEN_KEY, UnifiedLogin } from '@code/common';

const { Header, Sider, Content } = Layout;

export default function App({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const { theme: currentTheme } = useTheme('dark');

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
      localStorage.removeItem('code_shield_token');
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

  // 统一的 Slate 蓝灰主题 Token 配置，与 Code-Bench 宿主及其它子系统完全一致
  const antdThemeConfig = useMemo(() => ({
    algorithm: currentTheme === 'light' ? theme.defaultAlgorithm : theme.darkAlgorithm,
    token: {
      colorPrimary: '#3b82f6',
      colorBgBase: currentTheme === 'light' ? '#ffffff' : '#0f172a',
      colorBgContainer: currentTheme === 'light' ? '#ffffff' : '#1e293b',
      colorBgElevated: currentTheme === 'light' ? '#ffffff' : '#1e293b',
      colorBgLayout: currentTheme === 'light' ? '#f8fafc' : '#0f172a',
      colorBorder: currentTheme === 'light' ? '#cbd5e1' : '#334155',
      colorBorderSecondary: currentTheme === 'light' ? '#e2e8f0' : '#334155',
      colorText: currentTheme === 'light' ? '#0f172a' : '#f8fafc',
      colorTextSecondary: currentTheme === 'light' ? '#64748b' : '#94a3b8',
    },
    components: {
      Table: {
        headerBg: currentTheme === 'light' ? '#f8fafc' : '#0f172a',
        headerColor: currentTheme === 'light' ? '#475569' : '#94a3b8',
        rowHoverBg: currentTheme === 'light' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.08)',
        borderColor: currentTheme === 'light' ? '#e2e8f0' : '#334155',
        colorBgContainer: currentTheme === 'light' ? '#ffffff' : '#1e293b',
      },
      Card: {
        colorBgContainer: currentTheme === 'light' ? '#ffffff' : '#1e293b',
        colorBorderSecondary: currentTheme === 'light' ? '#e2e8f0' : '#334155',
      },
      Modal: {
        contentBg: currentTheme === 'light' ? '#ffffff' : '#1e293b',
        headerBg: currentTheme === 'light' ? '#ffffff' : '#1e293b',
      },
      Input: {
        colorBgContainer: currentTheme === 'light' ? '#ffffff' : '#0f172a',
        colorBorder: currentTheme === 'light' ? '#cbd5e1' : '#334155',
      },
      Select: {
        colorBgContainer: currentTheme === 'light' ? '#ffffff' : '#0f172a',
        colorBgElevated: currentTheme === 'light' ? '#ffffff' : '#1e293b',
        colorBorder: currentTheme === 'light' ? '#cbd5e1' : '#334155',
      },
    },
  }), [currentTheme]);

  // 1. 如果是被 code-bench 宿主嵌套，直接进行路由映射，不需要 PDM 自带的侧边栏与页眉
  if (isEmbedded) {
    return (
      <ConfigProvider locale={zhCN} theme={antdThemeConfig}>
        <div className="pdm-app">
          <Routes>
            <Route path="/device-type" element={<DeviceTypePage />} />
            <Route path="/device" element={<DevicePage />} />
            <Route path="/pdm/device-type" element={<DeviceTypePage />} />
            <Route path="/pdm/device" element={<DevicePage />} />
            <Route path="*" element={<DeviceTypePage />} />
          </Routes>
        </div>
      </ConfigProvider>
    );
  }

  // 2. 如果是独立运行，且正在加载用户信息
  if (loadingUser) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8' }}>
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

  // 选中菜单项判断
  const getSelectedKey = () => {
    if (location.pathname.includes('/device-type')) return 'device-type';
    if (location.pathname.includes('/device')) return 'device';
    return 'device-type';
  };

  // 独立运行的 Layout
  return (
    <ConfigProvider locale={zhCN} theme={antdThemeConfig}>
      <div className="pdm-app">
        <Layout style={{ minHeight: '100vh', background: 'var(--bg-color)', transition: 'background-color 0.3s' }}>
          <Sider
            width={240}
            style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--border-color)', transition: 'background-color 0.3s, border-color 0.3s' }}
          >
            <div style={{ height: '64px', padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>
                P
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-color)' }}>PDM 数据中心</span>
                <span style={{ fontSize: '10px', color: '#8c8c8c' }}>独立调试模式</span>
              </div>
            </div>
            <Menu
              mode="inline"
              selectedKeys={[getSelectedKey()]}
              style={{ background: 'transparent', borderRight: 0, marginTop: '16px' }}
              items={[
                {
                  key: 'device-type',
                  icon: <ApartmentOutlined />,
                  label: <Link to="/device-type">设备类型管理</Link>,
                },
                {
                  key: 'device',
                  icon: <DatabaseOutlined />,
                  label: <Link to="/device">设备ID管理</Link>,
                },
              ]}
            />
          </Sider>
          
          <Layout style={{ background: 'transparent' }}>
            <Header style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', transition: 'background-color 0.3s, border-color 0.3s' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-color)' }}>
                {getSelectedKey() === 'device' ? '设备 ID 档案管理' : '设备类型管理'}
              </span>
              {user && (
                <Space>
                  <Tag color={Array.isArray(user.roles) && (user.roles.includes('super_admin') || user.roles.includes('pdm_admin')) ? 'gold' : 'blue'} icon={<UserOutlined />} style={{ padding: '4px 8px', borderRadius: '4px' }}>
                    {user.name || user.username} ({Array.isArray(user.roles) && (user.roles.includes('super_admin') || user.roles.includes('pdm_admin')) ? '管理员' : '普通用户'})
                  </Tag>
                  <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} style={{ color: 'var(--text-color)', opacity: 0.8 }}>
                    退出登录
                  </Button>
                </Space>
              )}
            </Header>
            <Content style={{ margin: '24px', overflow: 'initial' }}>
              <Routes>
                <Route path="/device-type" element={<DeviceTypePage />} />
                <Route path="/device" element={<DevicePage />} />
                <Route path="*" element={<DeviceTypePage />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </div>
    </ConfigProvider>
  );
}
