import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Space, Modal, Form, Popconfirm, message, Tooltip, Empty, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { apiFetch } from '../api/client';

const modelRegex = /^[a-zA-Z]{1,2}:?[0-9]+$/;

interface DeviceType {
  id: number;
  model: string;
  name: string;
  description: string;
  created_at: string;
}

export default function DeviceTypePage() {
  const [data, setData] = useState<DeviceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 搜索关键字
  const [searchModel, setSearchModel] = useState('');
  const [searchName, setSearchName] = useState('');

  // 弹窗表单状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeviceType | null>(null);
  const [form] = Form.useForm();

  // 获取当前用户权限
  const fetchUserPermission = async () => {
    try {
      const user = await apiFetch('/me');
      setIsAdmin(!!user.is_admin);
    } catch (err) {
      console.error('获取权限失败:', err);
    }
  };

  // 获取设备类型列表
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = [];
      if (searchModel) queryParams.push(`model=${encodeURIComponent(searchModel)}`);
      if (searchName) queryParams.push(`name=${encodeURIComponent(searchName)}`);
      
      const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';
      const list = await apiFetch(`/device-types${queryString}`);
      setData(list || []);
    } catch (err: any) {
      message.error(err.message || '获取设备类型数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPermission();
    fetchData();
  }, []);

  const handleResetSearch = () => {
    setSearchModel('');
    setSearchName('');
    setTimeout(() => {
      fetchData();
    }, 0);
  };

  // 打开新建弹窗
  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: DeviceType) => {
    setEditingItem(record);
    form.setFieldsValue({
      model: record.model,
      name: record.name,
      description: record.description,
    });
    setIsModalOpen(true);
  };

  // 删除操作
  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/device-types/${id}`, { method: 'DELETE' });
      message.success('删除设备类型成功');
      fetchData();
    } catch (err: any) {
      message.error(err.message || '删除失败，该类型下可能有关联的设备');
    }
  };

  // 提交表单 (新建/修改)
  const handleModalSubmit = async (values: any) => {
    try {
      if (editingItem) {
        // 修改
        await apiFetch(`/device-types/${editingItem.id}`, {
          method: 'PUT',
          bodyData: values,
        });
        message.success('更新设备类型成功');
      } else {
        // 新建
        await apiFetch('/device-types', {
          method: 'POST',
          bodyData: values,
        });
        message.success('新建设备类型成功');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return; // Form validation failed
      message.error(err.message || '操作失败');
    }
  };

  // 导出 Excel 格式 xlsx
  const handleExport = () => {
    const token = localStorage.getItem('code_shield_token');
    const baseUrl = (window as any).__POWERED_BY_PORTAL__ ? '/pdm/api' : '/api';
    
    setLoading(true);
    fetch(`${baseUrl}/export/excel`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('导出数据失败');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `pdm_export_${dateStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('数据导出成功');
      })
      .catch(err => {
        message.error(err.message || '导出失败，请稍后重试');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // 表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      sorter: (a: DeviceType, b: DeviceType) => a.id - b.id,
    },
    {
      title: '设备型号 (Machine Type)',
      dataIndex: 'model',
      key: 'model',
      render: (text: string) => <strong style={{ color: 'var(--primary-color)' }}>{text}</strong>,
    },
    {
      title: '设备大类名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '详细说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>暂无说明</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (text: string) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: DeviceType) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            disabled={!isAdmin}
            onClick={() => handleEdit(record)}
            style={{ color: isAdmin ? '#1890ff' : undefined }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该设备类型吗？"
            description="删除后不可恢复。若其下有关联的设备，将报错禁止删除。"
            disabled={!isAdmin}
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              disabled={!isAdmin}
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card
        title="设备类型管理 (Machine Types)"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!isAdmin}
              onClick={handleCreate}
            >
              新建设备类型
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
            >
              导出 Excel
            </Button>
          </Space>
        }
        bordered={false}
        style={{
          borderRadius: '12px',
          background: 'var(--card-bg)',
          color: 'var(--text-color)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* 顶部搜索栏 */}
        <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Input
            placeholder="按设备型号搜索..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchModel}
            onChange={(e) => setSearchModel(e.target.value)}
            style={{ width: '220px', borderRadius: '8px' }}
            onPressEnter={fetchData}
          />
          <Input
            placeholder="按大类名称搜索..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{ width: '220px', borderRadius: '8px' }}
            onPressEnter={fetchData}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleResetSearch}>
            重置
          </Button>
          {!isAdmin && (
            <Tag color="warning" style={{ marginLeft: 'auto', borderRadius: '4px', padding: '4px 8px' }}>
              只读模式：仅管理员支持编辑
            </Tag>
          )}
        </div>

        {/* 数据展示表格 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="未检索到设备类型数据" /> }}
          style={{ background: 'transparent' }}
        />
      </Card>

      {/* 新建/编辑 Modal 弹窗 */}
      <Modal
        title={editingItem ? '编辑设备类型' : '创建新设备类型'}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        okText="确认"
        cancelText="取消"
        destroyOnClose
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleModalSubmit}
          style={{ marginTop: '20px' }}
        >
          <Form.Item
            name="model"
            label={
              <Space>
                <span>设备型号 (Machine Type)</span>
                <Tooltip title="用户可见的型号，由1-2位字母+数字组成，中间可带英文冒号。例如：E10、AB:99">
                  <span style={{ color: '#1890ff', cursor: 'pointer', fontSize: '12px' }}>格式要求</span>
                </Tooltip>
              </Space>
            }
            rules={[
              { required: true, message: '请输入设备型号' },
              { pattern: /^[a-zA-Z]{1,2}:?[0-9]+$/, message: '型号格式无效，应为1-2位字母+数字组成，如 E:101' }
            ]}
          >
            <Input placeholder="例如: E10 或 AB:99" />
          </Form.Item>

          <Form.Item
            name="name"
            label="设备大类名称"
            rules={[{ required: true, message: '请输入设备类型名称' }]}
          >
            <Input placeholder="输入描述性的类型名称，如：边缘核心计算模块" />
          </Form.Item>

          <Form.Item
            name="description"
            label="详细说明"
          >
            <Input.TextArea rows={4} placeholder="描述此大类设备的技术规格、适用场景等说明内容..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
