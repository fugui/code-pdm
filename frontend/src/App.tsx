import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Space, message, ConfigProvider, theme, Tag } from 'antd';
import { DatabaseOutlined, ApartmentOutlined, UserOutlined, LogoutOutlined, LockOutlined } from '@ant-design/icons';
import DeviceTypePage from './pages/DeviceType';
import DevicePage from './pages/Device';
import { apiFetch } from './api/client';

const { Header, Sider, Content } = Layout;

// 独立运行时的简易登录面板
function StandaloneLogin({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      message.warning('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        bodyData: { username, password },
      });
      localStorage.setItem('code_shield_token', data.token);
      message.success('登录成功');
      onLoginSuccess();
    } catch (err: any) {
      message.error(err.message || '登录失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0b1120',
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        width: '380px',
        padding: '30px',
        background: '#1e293b',
        borderRadius: '16px',
        border: '1px solid #334155',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '24px',
            fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
          }}>
            P
          </div>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '20px', fontWeight: 600 }}>产品数据管理 (PDM)</h2>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '13px' }}>独立开发测试登录端</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>用户名</label>
            <input
              type="text"
              placeholder="请输入用户名 (如 admin 或 user)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>密码</label>
            <input
              type="password"
              placeholder="请输入密码 (如 admin123 或 user123)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            style={{
              height: '42px',
              borderRadius: '8px',
              background: '#3b82f6',
              border: 'none',
              fontWeight: 600,
              marginTop: '10px'
            }}
          >
            登录系统
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function App({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem('code_shield_token');
    if (!token) {
      setUser(null);
      setLoadingUser(false);
      return;
    }
    try {
      const data = await apiFetch('/me');
      setUser(data);
    } catch (err) {
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
    localStorage.removeItem('code_shield_token');
    setUser(null);
    navigate('/login');
  };

  // 1. 如果是被 code-bench 宿主嵌套，直接进行路由映射，不需要 PDM 自带的侧边栏与页眉
  if (isEmbedded) {
    return (
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <Routes>
          <Route path="/device-types" element={<DeviceTypePage />} />
          <Route path="/devices" element={<DevicePage />} />
          <Route path="/pdm/device-types" element={<DeviceTypePage />} />
          <Route path="/pdm/devices" element={<DevicePage />} />
          <Route path="*" element={<DeviceTypePage />} />
        </Routes>
      </ConfigProvider>
    );
  }

  // 2. 如果是独立运行，且正在加载用户信息
  if (loadingUser) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0b1120', color: '#64748b' }}>
        <span>正在载入会话状态...</span>
      </div>
    );
  }

  // 3. 独立运行没有登录
  if (!user && location.pathname !== '/login') {
    return <StandaloneLogin onLoginSuccess={loadUser} />;
  }

  // 选中菜单项判断
  const getSelectedKey = () => {
    if (location.pathname.startsWith('/devices')) return 'devices';
    return 'device-types';
  };

  // 独立运行的 Layout
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#0b1120' }}>
        <Sider
          width={240}
          style={{ background: '#0f172a', borderRight: '1px solid #1e293b' }}
        >
          <div style={{ height: '64px', padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #1e293b' }}>
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
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>PDM 数据中心</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>独立调试模式</span>
            </div>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            style={{ background: 'transparent', borderRight: 0, marginTop: '16px' }}
            items={[
              {
                key: 'device-types',
                icon: <ApartmentOutlined />,
                label: <Link to="/device-types">设备类型管理</Link>,
              },
              {
                key: 'devices',
                icon: <DatabaseOutlined />,
                label: <Link to="/devices">设备ID管理</Link>,
              },
            ]}
          />
        </Sider>
        
        <Layout style={{ background: 'transparent' }}>
          <Header style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
              {getSelectedKey() === 'devices' ? '设备 ID 档案管理' : '设备类型管理'}
            </span>
            {user && (
              <Space>
                <Tag color={user.is_admin ? 'gold' : 'blue'} icon={<UserOutlined />} style={{ padding: '4px 8px', borderRadius: '4px' }}>
                  {user.name || user.username} ({user.is_admin ? '管理员' : '普通用户'})
                </Tag>
                <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} style={{ color: '#94a3b8' }}>
                  退出登录
                </Button>
              </Space>
            )}
          </Header>
          <Content style={{ margin: '24px', overflow: 'initial' }}>
            <Routes>
              <Route path="/device-types" element={<DeviceTypePage />} />
              <Route path="/devices" element={<DevicePage />} />
              <Route path="*" element={<DeviceTypePage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
