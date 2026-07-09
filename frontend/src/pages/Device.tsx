import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Space, Modal, Form, Select, DatePicker, Popconfirm, message, Tag, Tooltip, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiFetch } from '../api/client';

interface DeviceType {
  id: number;
  model: string;
  name: string;
}

interface Device {
  id: number;
  device_id: string;
  letter: string;
  number: string;
  name: string;
  description: string;
  date: string;
  device_type_id: number;
  device_type?: DeviceType;
  created_at: string;
}

export default function DevicePage() {
  const [data, setData] = useState<Device[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 搜索过滤器
  const [searchID, setSearchID] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchTypeID, setSearchTypeID] = useState<number | undefined>(undefined);

  // 弹窗表单状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Device | null>(null);
  const [form] = Form.useForm();
  const [generatingSuffix, setGeneratingSuffix] = useState(false);

  // 获取用户权限
  const fetchUserPermission = async () => {
    try {
      const user = await apiFetch('/me');
      setIsAdmin(!!user.is_admin);
    } catch (err) {
      console.error('获取权限错误:', err);
    }
  };

  // 获取下拉设备大类
  const fetchDeviceTypes = async () => {
    try {
      const list = await apiFetch('/device-types');
      setDeviceTypes(list || []);
    } catch (err) {
      console.error('获取类型列表失败:', err);
    }
  };

  // 获取设备列表数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = [];
      if (searchID) queryParams.push(`device_id=${encodeURIComponent(searchID)}`);
      if (searchName) queryParams.push(`name=${encodeURIComponent(searchName)}`);
      if (searchTypeID) queryParams.push(`device_type_id=${searchTypeID}`);

      const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';
      const list = await apiFetch(`/devices${queryString}`);
      setData(list || []);
    } catch (err: any) {
      message.error(err.message || '获取设备列表数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPermission();
    fetchDeviceTypes();
    fetchData();
  }, []);

  const handleResetSearch = () => {
    setSearchID('');
    setSearchName('');
    setSearchTypeID(undefined);
    setTimeout(() => {
      fetchData();
    }, 0);
  };

  // 请求后台生成一个当前不重复的 4 位随机后缀
  const triggerGenerateSuffix = async () => {
    setGeneratingSuffix(true);
    try {
      const data = await apiFetch('/devices/generate-suffix');
      if (data && data.suffix) {
        form.setFieldsValue({ number: data.suffix });
      } else {
        message.error('预分配唯一后缀失败');
      }
    } catch (err: any) {
      message.error(err.message || '获取唯一数字后缀失败');
    } finally {
      setGeneratingSuffix(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(), // 默认登记日期为当天
      letter: 'E',   // 默认预设前缀为 E
    });
    setIsModalOpen(true);
    // 开启录入时自动预填一个唯一的4位数字后缀
    triggerGenerateSuffix();
  };

  const handleEdit = (record: Device) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.name,
      device_type_id: record.device_type_id,
      date: record.date ? dayjs(record.date, 'YYYY-MM-DD') : dayjs(),
      description: record.description,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/devices/${id}`, { method: 'DELETE' });
      message.success('设备删除成功');
      fetchData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 序列化日期为 YYYY-MM-DD 字符串
      const payload = {
        ...values,
        date: values.date ? values.date.format('YYYY-MM-DD') : '',
      };

      if (editingItem) {
        // 修改设备信息
        await apiFetch(`/devices/${editingItem.id}`, {
          method: 'PUT',
          bodyData: payload,
        });
        message.success('更新设备属性成功');
      } else {
        // 新建设备
        await apiFetch('/devices', {
          method: 'POST',
          bodyData: payload,
        });
        message.success('新建设备成功！系统已自动分配唯一的4位后缀。');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return; // 校验失败
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

  const columns = [
    {
      title: '设备 ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
      render: (text: string) => <strong style={{ color: 'var(--primary-color)' }}>{text}</strong>,
      sorter: (a: Device, b: Device) => a.device_id.localeCompare(b.device_id),
    },
    {
      title: '所属设备大类 (型号)',
      dataIndex: 'device_type',
      key: 'device_type',
      render: (type?: DeviceType) => type ? (
        <span>{type.name} <Tag style={{ borderRadius: '4px' }}>{type.model}</Tag></span>
      ) : <span style={{ color: '#d9d9d9' }}>未知</span>,
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>暂无描述</span>,
    },
    {
      title: '登记日期',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (text: string) => <Tag color="blue" style={{ borderRadius: '4px' }}>{text}</Tag>,
    },
    {
      title: '分配编码',
      key: 'code',
      width: 130,
      render: (_: any, record: Device) => (
        <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
          前缀: <strong>{record.letter}</strong> | 后缀: <strong>{record.number}</strong>
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: Device) => (
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
            title="确认注销该设备吗？"
            description="删除后此设备的4位数字ID将释放，可能在以后重新分配！"
            disabled={!isAdmin}
            onConfirm={() => handleDelete(record.id)}
            okText="确认注销"
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
        title="设备 ID 档案管理 (Machine IDs)"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!isAdmin}
              onClick={handleCreate}
            >
              录入新设备
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
        {/* 检索过滤器 */}
        <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Input
            placeholder="按设备 ID 搜索..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchID}
            onChange={(e) => setSearchID(e.target.value)}
            style={{ width: '200px', borderRadius: '8px' }}
            onPressEnter={fetchData}
          />
          <Input
            placeholder="按设备名称搜索..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{ width: '200px', borderRadius: '8px' }}
            onPressEnter={fetchData}
          />
          <Select
            placeholder="过滤设备类型..."
            value={searchTypeID}
            onChange={(val) => setSearchTypeID(val)}
            style={{ width: '220px' }}
            allowClear
          >
            {deviceTypes.map(t => (
              <Select.Option key={t.id} value={t.id}>{t.name} ({t.model})</Select.Option>
            ))}
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleResetSearch}>
            重置
          </Button>
          {!isAdmin && (
            <Tag color="warning" style={{ marginLeft: 'auto', borderRadius: '4px', padding: '4px 8px' }}>
              只读模式：仅管理员支持录入及修改
            </Tag>
          )}
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="未检索到任何设备记录" /> }}
          style={{ background: 'transparent' }}
        />
      </Card>

      {/* 设备录入/编辑 Modal */}
      <Modal
        title={editingItem ? '修改设备信息' : '新设备建档录入'}
        open={isModalOpen}
        onOk={handleModalSubmit}
        onCancel={() => setIsModalOpen(false)}
        okText="确认保存"
        cancelText="取消"
        destroyOnClose
        maskClosable={false}
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: '20px' }}
        >
          {/* 新增模式显示首字母与数字后缀组合在同一行 */}
          {!editingItem ? (
            <Form.Item
              label={
                <Space>
                  <span>设备 ID (字母前缀与4位随机数字后缀)</span>
                  <Tooltip title="起首前缀目前仅支持 E 或 L；点击右侧生成按钮，系统将分配全局未使用的4位数字。若不喜欢，可重复点击更换，提交以最终为准。">
                    <span style={{ color: '#1890ff', cursor: 'pointer', fontSize: '12px' }}>使用说明</span>
                  </Tooltip>
                </Space>
              }
              required
              style={{ marginBottom: '24px' }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* 首字母前缀下拉框 */}
                <Form.Item
                  name="letter"
                  noStyle
                  rules={[{ required: true, message: '请选择字母前缀' }]}
                >
                  <Select
                    placeholder="前缀"
                    style={{ width: '90px' }}
                  >
                    <Select.Option value="E">E</Select.Option>
                    <Select.Option value="L">L</Select.Option>
                  </Select>
                </Form.Item>

                <span style={{ color: 'var(--text-secondary)', padding: '0 4px', fontWeight: 'bold' }}>-</span>

                {/* 四位数字后缀输入框 */}
                <Form.Item
                  name="number"
                  noStyle
                  rules={[
                    { required: true, message: '请点击生成数字后缀' },
                    { len: 4, message: '必须是4位数字' },
                  ]}
                >
                  <Input
                    placeholder="生成获取 4 位数字..."
                    readOnly
                    style={{
                      flex: 1,
                      fontWeight: 'bold',
                      color: 'var(--primary-color)',
                      textAlign: 'center',
                      letterSpacing: '1px',
                    }}
                  />
                </Form.Item>

                {/* 生成唯一后缀按钮 */}
                <Button
                  onClick={triggerGenerateSuffix}
                  loading={generatingSuffix}
                  type="dashed"
                  style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                >
                  随机生成
                </Button>
              </div>
            </Form.Item>
          ) : (
            <Form.Item label="当前物理设备 ID (只读锁定)">
              <Input value={editingItem.device_id} disabled style={{ color: 'var(--primary-color)', fontWeight: 'bold' }} />
            </Form.Item>
          )}

          <Form.Item
            name="device_type_id"
            label="所属设备类型"
            rules={[{ required: true, message: '请选择所属的设备类型' }]}
          >
            <Select placeholder="选择关联的设备大类型">
              {deviceTypes.map(t => (
                <Select.Option key={t.id} value={t.id}>{t.name} ({t.model})</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="设备实体名称"
            rules={[{ required: true, message: '请输入设备名称' }]}
          >
            <Input placeholder="输入特定的物理设备标志名，例如: 1A 或 1B" />
          </Form.Item>

          <Form.Item
            name="date"
            label="登记日期"
            rules={[{ required: true, message: '请选择登记日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择出厂/入库登记日期" />
          </Form.Item>

          <Form.Item
            name="description"
            label="详细备注/说明"
          >
            <Input.TextArea rows={4} placeholder="在此记录该设备的物理位置、IP配置、部署状态及使用人员等备注信息..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
