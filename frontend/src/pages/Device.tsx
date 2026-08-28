import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, Search, RotateCcw, Download, HardDrive, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Pagination, usePagination, Modal, EmptyState } from '@code/common';

import { apiFetch } from '../api/client';

interface DeviceType {
  id: number;
  model: string;
  name: string;
  letter: string;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<Device[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 搜索过滤器
  const [searchID, setSearchID] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchTypeID, setSearchTypeID] = useState<number | undefined>(undefined);

  // 分页与排序
  const { page, pageSize, updateParams } = usePagination({ defaultPageSize: 15 });
  const [sortField, setSortField] = useState<string>('device_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 弹窗表单状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    device_type_id: 0,
    letter: '',
    number: '',
    name: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generatingSuffix, setGeneratingSuffix] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 获取用户权限
  const fetchUserPermission = async () => {
    try {
      const user = await apiFetch('/me');
      const isPdmAdmin = Array.isArray(user?.roles) && (user.roles.includes('super_admin') || user.roles.includes('pdm_admin'));
      setIsAdmin(isPdmAdmin);
    } catch (err) {
      console.error('获取权限错误:', err);
    }
  };

  // 获取设备大类
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
      const queryParams: string[] = [];
      if (searchID.trim()) queryParams.push(`device_id=${encodeURIComponent(searchID.trim())}`);
      if (searchName.trim()) queryParams.push(`name=${encodeURIComponent(searchName.trim())}`);
      if (searchTypeID) queryParams.push(`device_type_id=${searchTypeID}`);

      const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';
      const list = await apiFetch(`/devices${queryString}`);
      setData(list || []);
    } catch (err: any) {
      showToast(err.message || '获取设备列表数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPermission();
    fetchDeviceTypes();
  }, []);

  useEffect(() => {
    fetchData();
  }, [searchTypeID]);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchID, searchName]);

  const handleResetSearch = () => {
    setSearchID('');
    setSearchName('');
    setSearchTypeID(undefined);
    updateParams({ page: 1 });
    setTimeout(fetchData, 0);
  };

  // 请求生成不重复的 4 位随机后缀
  const triggerGenerateSuffix = async () => {
    setGeneratingSuffix(true);
    try {
      const res = await apiFetch('/devices/generate-suffix');
      if (res && res.suffix) {
        setFormData(prev => ({ ...prev, number: res.suffix }));
        setFormErrors(prev => ({ ...prev, number: '' }));
      } else {
        showToast('预分配唯一后缀失败', 'error');
      }
    } catch (err: any) {
      showToast(err.message || '获取唯一数字后缀失败', 'error');
    } finally {
      setGeneratingSuffix(false);
    }
  };

  // 选择大类时自动填入字母前缀
  const handleDeviceTypeChange = (typeId: number) => {
    const selected = deviceTypes.find(t => t.id === typeId);
    setFormData(prev => ({
      ...prev,
      device_type_id: typeId,
      letter: selected ? (selected.letter || '') : '',
    }));
    setFormErrors(prev => ({ ...prev, device_type_id: '', letter: '' }));
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      device_type_id: deviceTypes.length > 0 ? deviceTypes[0].id : 0,
      letter: deviceTypes.length > 0 ? deviceTypes[0].letter : '',
      number: '',
      name: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
    triggerGenerateSuffix();
  };

  const handleEdit = (record: Device) => {
    setEditingItem(record);
    setFormData({
      device_type_id: record.device_type_id,
      letter: record.letter,
      number: record.number,
      name: record.name,
      date: record.date || new Date().toISOString().slice(0, 10),
      description: record.description || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDelete = async (record: Device) => {
    if (!window.confirm(`确认注销设备 "${record.name} (${record.device_id})" 吗？\n删除后此设备的4位数字ID将释放，可能在未来重新分配！`)) {
      return;
    }
    try {
      await apiFetch(`/devices/${record.id}`, { method: 'DELETE' });
      showToast('设备注销成功', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || '删除失败', 'error');
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!editingItem) {
      if (!formData.device_type_id) {
        errors.device_type_id = '请选择所属设备类型';
      }
      if (!formData.letter) {
        errors.letter = '请先选择设备类型以获取前缀';
      }
      if (!formData.number.trim()) {
        errors.number = '请输入或生成4位数字后缀';
      } else if (!/^\d{4}$/.test(formData.number.trim())) {
        errors.number = '必须是4位纯数字，如 0128';
      }
    }
    if (!formData.name.trim()) {
      errors.name = '请输入设备实体名称';
    }
    if (!formData.date) {
      errors.date = '请选择登记日期';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        device_type_id: formData.device_type_id,
        letter: formData.letter,
        number: formData.number.trim(),
        name: formData.name.trim(),
        date: formData.date,
        description: formData.description.trim(),
      };

      if (editingItem) {
        await apiFetch(`/devices/${editingItem.id}`, {
          method: 'PUT',
          bodyData: payload,
        });
        showToast('更新设备信息成功', 'success');
      } else {
        await apiFetch('/devices', {
          method: 'POST',
          bodyData: payload,
        });
        showToast('新建设备成功！系统已自动分配唯一的4位后缀。', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 导出 Excel
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
        a.download = `pdm_devices_${dateStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('数据导出成功', 'success');
      })
      .catch(err => {
        showToast(err.message || '导出失败，请稍后重试', 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // 排序切换
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 排序后的全量数据
  const sortedData = useMemo(() => {
    const list = [...data];
    list.sort((a, b) => {
      let valA: string = '';
      let valB: string = '';
      if (sortField === 'device_id') {
        valA = a.device_id || '';
        valB = b.device_id || '';
      } else if (sortField === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortField === 'device_type') {
        valA = a.device_type?.model || '';
        valB = b.device_type?.model || '';
      } else if (sortField === 'date') {
        valA = a.date || '';
        valB = b.date || '';
      }
      const cmp = valA.localeCompare(valB);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, sortField, sortOrder]);

  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex-col gap-lg w-full">
      {/* Toast 提示 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 2000,
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md, 8px)',
          background: toastMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          color: 'var(--color-text-white, #ffffff)',
          boxShadow: 'var(--shadow-md)',
          fontSize: '0.875rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* 顶部 Header 区 */}
      <div className="flex-between flex-wrap gap-md">
        <div>
          <h2 className="flex-center text-primary" style={{ justifyContent: 'flex-start', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.35rem 0', gap: '0.6rem' }}>
            <HardDrive size={24} color="var(--color-primary)" />
            设备 ID 档案管理 (Machine IDs)
          </h2>
          <p className="text-secondary" style={{ margin: 0, fontSize: '0.875rem' }}>
            管控物理硬件唯一标识、前缀字母与 4 位排重随机数字生命周期
          </p>
        </div>
        <div className="flex-center gap-sm">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isAdmin}
            onClick={handleCreate}
            title={!isAdmin ? '只读模式：仅管理员支持录入' : undefined}
          >
            <Plus size={15} />
            录入新设备
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExport}
          >
            <Download size={15} />
            导出 Excel
          </button>
        </div>
      </div>

      {/* 独立检索过滤器 Card */}
      <div className="code-card flex-between flex-wrap gap-md" style={{ padding: '14px 20px' }}>
        <div className="flex-center gap-md flex-wrap">
          <div style={{ position: 'relative', width: '200px' }}>
            <input
              type="text"
              className="code-input w-full"
              placeholder="按设备 ID 搜索..."
              value={searchID}
              onChange={(e) => setSearchID(e.target.value)}
              style={{ paddingLeft: '2rem' }}
            />
            <Search size={14} className="text-secondary" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          <div style={{ position: 'relative', width: '200px' }}>
            <input
              type="text"
              className="code-input w-full"
              placeholder="按设备名称搜索..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{ paddingLeft: '2rem' }}
            />
            <Search size={14} className="text-secondary" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          <div style={{ width: '220px' }}>
            <select
              className="code-select w-full"
              value={searchTypeID || ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                setSearchTypeID(val);
                updateParams({ page: 1 });
              }}
            >
              <option value="">全部设备大类</option>
              {deviceTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.model})</option>
              ))}
            </select>
          </div>

          <button type="button" className="btn btn-secondary" onClick={handleResetSearch}>
            <RotateCcw size={14} />
            重置
          </button>
        </div>

        {!isAdmin && (
          <span className="code-badge code-badge--warning">
            <AlertTriangle size={12} />
            只读模式：仅管理员支持录入及修改
          </span>
        )}
      </div>

      {/* 独立表格与分页 Card */}
      <div className="code-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="code-table">
            <thead>
              <tr>
                <th className="cursor-pointer" style={{ width: '150px' }} onClick={() => handleSort('device_id')}>
                  <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                    设备 ID
                    {sortField === 'device_id' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                    ) : <ArrowUpDown size={13} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th className="cursor-pointer" style={{ width: '220px' }} onClick={() => handleSort('device_type')}>
                  <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                    所属设备大类 (型号)
                    {sortField === 'device_type' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                    ) : <ArrowUpDown size={13} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th className="cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                    设备实体名称
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                    ) : <ArrowUpDown size={13} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th>详细说明</th>
                <th className="cursor-pointer" style={{ width: '130px' }} onClick={() => handleSort('date')}>
                  <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                    登记日期
                    {sortField === 'date' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                    ) : <ArrowUpDown size={13} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th style={{ width: '160px' }}>生成规则详情</th>
                <th style={{ width: '150px', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem' }} className="text-secondary">
                    正在加载设备档案数据...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <EmptyState
                  inTable
                  colSpan={7}
                  title="未检索到设备档案数据"
                  description="可调整筛选项或点击右上角录入新设备"
                />
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="code-badge code-badge--primary" style={{ fontFamily: 'var(--font-family-mono, monospace)', fontWeight: 700, fontSize: '0.85rem' }}>
                        {item.device_id}
                      </span>
                    </td>
                    <td>
                      <div className="flex-col">
                        <strong className="text-primary">{item.device_type?.name || '-'}</strong>
                        <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                          型号: {item.device_type?.model || '-'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong className="text-primary">{item.name}</strong>
                    </td>
                    <td className="text-secondary text-truncate" style={{ maxWidth: '260px' }} title={item.description}>
                      {item.description || <span className="text-muted" style={{ fontStyle: 'italic' }}>暂无描述</span>}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-family-mono, monospace)' }}>
                        {item.date || '-'}
                      </span>
                    </td>
                    <td>
                      <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                        前缀: <strong className="text-primary">{item.letter}</strong> | 后缀: <strong className="text-primary">{item.number}</strong>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex-center gap-xs" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          disabled={!isAdmin}
                          onClick={() => handleEdit(item)}
                          title={!isAdmin ? '需要管理员权限' : '编辑此设备'}
                        >
                          <Edit2 size={13} />
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          disabled={!isAdmin}
                          onClick={() => handleDelete(item)}
                          title={!isAdmin ? '需要管理员权限' : '注销此设备'}
                        >
                          <Trash2 size={13} />
                          注销
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 标准规范通用分页 */}
        {data.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
            <Pagination totalItems={data.length} />
          </div>
        )}
      </div>

      {/* 设备录入/编辑 Modal 弹窗 */}
      <Modal
        open={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        title={editingItem ? '修改设备信息' : '新设备建档录入'}
        width="md"
        footer={null}
      >
        <form onSubmit={handleModalSubmit}>
          <div className="pdm-modal-body" style={{ padding: 0 }}>
            {/* 选择大类 */}
            <div className="pdm-form-group">
              <label className="pdm-form-label">所属设备类型 *</label>
              <select
                className="pdm-select"
                value={formData.device_type_id}
                onChange={(e) => handleDeviceTypeChange(Number(e.target.value))}
                disabled={!!editingItem}
              >
                <option value={0} disabled>选择关联的设备大类型</option>
                {deviceTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.model})</option>
                ))}
              </select>
              {formErrors.device_type_id && <div className="pdm-form-error">{formErrors.device_type_id}</div>}
            </div>

            {/* 新建模式显示前缀与后缀 */}
            {!editingItem ? (
              <div className="pdm-form-group">
                <label className="pdm-form-label">
                  设备 ID (字母前缀与4位随机数字后缀) *
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                    选择大类自动带出前缀，支持随机分配唯一4位后缀
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="pdm-input"
                    placeholder="前缀"
                    value={formData.letter}
                    readOnly
                    style={{ width: '80px', textAlign: 'center', fontWeight: 700, color: 'var(--primary-color)' }}
                  />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>-</span>
                  <input
                    type="text"
                    className="pdm-input"
                    placeholder="4位数字"
                    maxLength={4}
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    style={{ flex: 1, textAlign: 'center', fontWeight: 700, letterSpacing: '2px', color: 'var(--primary-color)' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={triggerGenerateSuffix}
                    disabled={generatingSuffix}
                    style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                  >
                    {generatingSuffix ? '分配中...' : '随机生成'}
                  </button>
                </div>
                {formErrors.letter && <div className="pdm-form-error">{formErrors.letter}</div>}
                {formErrors.number && <div className="pdm-form-error">{formErrors.number}</div>}
              </div>
            ) : (
              <div className="pdm-form-group">
                <label className="pdm-form-label">当前物理设备 ID (只读锁定)</label>
                <input
                  type="text"
                  className="pdm-input"
                  value={editingItem.device_id}
                  disabled
                  style={{ fontWeight: 700, color: 'var(--primary-color)' }}
                />
              </div>
            )}

            <div className="pdm-form-group">
              <label className="pdm-form-label">设备实体名称 *</label>
              <input
                type="text"
                className="pdm-input"
                placeholder="输入特定的物理设备标志名，例如: 1A 或 1B"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {formErrors.name && <div className="pdm-form-error">{formErrors.name}</div>}
            </div>

            <div className="pdm-form-group">
              <label className="pdm-form-label">登记日期 *</label>
              <input
                type="date"
                className="pdm-input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
              {formErrors.date && <div className="pdm-form-error">{formErrors.date}</div>}
            </div>

            <div className="pdm-form-group" style={{ marginBottom: 0 }}>
              <label className="pdm-form-label">详细备注/说明</label>
              <textarea
                rows={4}
                className="pdm-textarea"
                placeholder="记录该设备的物理位置、IP配置、部署状态及使用人员等备注信息..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="pdm-modal-footer" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '正在提交...' : '确认保存'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
