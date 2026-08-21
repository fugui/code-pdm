import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, Search, RotateCcw, Download, Info, AlertTriangle, FolderTree } from 'lucide-react';
import { Pagination, usePagination, Modal } from '@code/common';
import { apiFetch } from '../api/client';

const modelRegex = /^[a-zA-Z]{1,2}:?[0-9]+$/;

interface DeviceType {
  id: number;
  model: string;
  letter: string;
  name: string;
  description: string;
  created_at: string;
}

export default function DeviceTypePage() {
  const [data, setData] = useState<DeviceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 搜索关键字
  const [searchModel, setSearchModel] = useState('');
  const [searchName, setSearchName] = useState('');

  // 分页状态
  const [searchParams] = useSearchParams();
  const { page, pageSize } = usePagination({ defaultPageSize: 15 });

  // 弹窗状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeviceType | null>(null);
  const [formData, setFormData] = useState({
    model: '',
    letter: '',
    name: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 获取当前用户权限
  const fetchUserPermission = async () => {
    try {
      const user = await apiFetch('/me');
      const isPdmAdmin = Array.isArray(user?.roles) && (user.roles.includes('super_admin') || user.roles.includes('pdm_admin'));
      setIsAdmin(isPdmAdmin);
    } catch (err) {
      console.error('获取权限失败:', err);
    }
  };

  // 获取设备类型列表
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams: string[] = [];
      if (searchModel.trim()) queryParams.push(`model=${encodeURIComponent(searchModel.trim())}`);
      if (searchName.trim()) queryParams.push(`name=${encodeURIComponent(searchName.trim())}`);

      const queryString = queryParams.length ? `?${queryParams.join('&')}` : '';
      const list = await apiFetch(`/device-types${queryString}`);
      setData(list || []);
    } catch (err: any) {
      showToast(err.message || '获取设备类型数据失败', 'error');
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
    setFormData({ model: '', letter: '', name: '', description: '' });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: DeviceType) => {
    setEditingItem(record);
    setFormData({
      model: record.model,
      letter: record.letter,
      name: record.name,
      description: record.description || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // 删除操作
  const handleDelete = async (item: DeviceType) => {
    if (!window.confirm(`确认删除设备类型 "${item.name} (${item.model})" 吗？\n删除后不可恢复。若其下有关联的设备，将报错禁止删除。`)) {
      return;
    }
    try {
      await apiFetch(`/device-types/${item.id}`, { method: 'DELETE' });
      showToast('删除设备类型成功', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || '删除失败，该类型下可能有关联的设备', 'error');
    }
  };

  // 校验表单
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.model.trim()) {
      errors.model = '请输入设备型号';
    } else if (!modelRegex.test(formData.model.trim())) {
      errors.model = '型号格式无效，应为1-2位字母+数字组成，如 E10、AB:99';
    }

    if (!editingItem) {
      if (!formData.letter.trim()) {
        errors.letter = '请输入设备ID首字母';
      } else if (!/^[a-zA-Z]$/.test(formData.letter.trim())) {
        errors.letter = '必须是单个英文字母 A-Z';
      }

      if (!formData.name.trim()) {
        errors.name = '请输入设备大类名称';
      }
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
        model: formData.model.trim(),
        letter: formData.letter.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      if (editingItem) {
        await apiFetch(`/device-types/${editingItem.id}`, {
          method: 'PUT',
          bodyData: payload,
        });
        showToast('更新设备类型成功', 'success');
      } else {
        await apiFetch('/device-types', {
          method: 'POST',
          bodyData: payload,
        });
        showToast('创建设备类型成功', 'success');
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
        a.download = `pdm_device_types_${dateStr}.xlsx`;
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

  // 计算当前分页数据
  const paginatedData = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FolderTree size={24} color="var(--primary-color)" />
            设备类型管理 (Machine Types)
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            统一管控硬件产品规格型号定义、ID 字母前缀与大类属性
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            disabled={!isAdmin}
            onClick={handleCreate}
            title={!isAdmin ? '只读模式：仅管理员支持创建' : undefined}
          >
            <Plus size={15} />
            新建设备类型
          </button>
          <button
            className="btn btn-success"
            onClick={handleExport}
          >
            <Download size={15} />
            导出 Excel
          </button>
        </div>
      </div>

      {/* 顶部独立搜索栏 Card */}
      <div className="pdm-card" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '220px' }}>
          <input
            type="text"
            className="pdm-input"
            placeholder="按设备型号搜索..."
            value={searchModel}
            onChange={(e) => setSearchModel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            style={{ paddingLeft: '2rem' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        <div style={{ position: 'relative', width: '220px' }}>
          <input
            type="text"
            className="pdm-input"
            placeholder="按大类名称搜索..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            style={{ paddingLeft: '2rem' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        <button className="btn btn-primary" onClick={fetchData}>
          <Search size={14} />
          查询
        </button>
        <button className="btn btn-outline" onClick={handleResetSearch}>
          <RotateCcw size={14} />
          重置
        </button>

        {!isAdmin && (
          <span className="pdm-tag pdm-tag-warning" style={{ marginLeft: 'auto' }}>
            <AlertTriangle size={12} />
            只读模式：仅管理员支持编辑
          </span>
        )}
      </div>

      {/* 数据展示表格与分页 Card */}
      <div className="pdm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="pdm-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table className="pdm-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>设备型号</th>
                <th style={{ width: '130px' }}>ID 前缀字母</th>
                <th style={{ width: '220px' }}>设备大类名称</th>
                <th>详细说明</th>
                <th style={{ width: '180px' }}>创建时间</th>
                <th style={{ width: '150px', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    正在加载设备类型数据...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    未检索到设备类型数据
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="pdm-tag pdm-tag-blue" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                        {item.model}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '0.95rem' }}>{item.letter}</strong>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-color)' }}>{item.name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                      {item.description || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>暂无描述</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-text"
                          disabled={!isAdmin}
                          onClick={() => handleEdit(item)}
                          title={!isAdmin ? '需要管理员权限' : '编辑此类型'}
                        >
                          <Edit2 size={13} />
                          编辑
                        </button>
                        <button
                          className="btn btn-text btn-text-danger"
                          disabled={!isAdmin}
                          onClick={() => handleDelete(item)}
                          title={!isAdmin ? '需要管理员权限' : '删除此类型'}
                        >
                          <Trash2 size={13} />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 通用规范分页组件 */}
        {data.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
            <Pagination totalItems={data.length} />
          </div>
        )}
      </div>

      {/* 新建/编辑 Modal 弹窗 */}
      <Modal
        open={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        title={editingItem ? '编辑设备类型' : '创建新设备类型'}
        width="md"
        footer={null}
      >
        <form onSubmit={handleModalSubmit}>
          <div className="pdm-modal-body" style={{ padding: 0 }}>
            <div className="pdm-form-group">
              <label className="pdm-form-label">
                设备型号 (Machine Type) *
                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                  1-2位字母+数字，可带冒号，如 E10、AB:99
                </span>
              </label>
              <input
                type="text"
                className="pdm-input"
                placeholder="例如: E10 或 AB:99"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
              {formErrors.model && <div className="pdm-form-error">{formErrors.model}</div>}
            </div>

            <div className="pdm-form-group">
              <label className="pdm-form-label">
                设备ID首字母 (Prefix Letter) *
              </label>
              <input
                type="text"
                className="pdm-input"
                placeholder="单个英文字母，如: E, L, T"
                maxLength={1}
                value={formData.letter}
                onChange={(e) => setFormData({ ...formData, letter: e.target.value.toUpperCase() })}
                disabled={!!editingItem}
              />
              {formErrors.letter && <div className="pdm-form-error">{formErrors.letter}</div>}
            </div>

            <div className="pdm-form-group">
              <label className="pdm-form-label">
                设备大类名称 (Type Name) *
              </label>
              <input
                type="text"
                className="pdm-input"
                placeholder="输入类型描述名称，如：边缘核心计算模块"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!!editingItem}
              />
              {formErrors.name && <div className="pdm-form-error">{formErrors.name}</div>}
            </div>

            <div className="pdm-form-group" style={{ marginBottom: 0 }}>
              <label className="pdm-form-label">详细说明</label>
              <textarea
                rows={4}
                className="pdm-textarea"
                placeholder="描述此大类设备的技术规格、适用场景等说明内容..."
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
