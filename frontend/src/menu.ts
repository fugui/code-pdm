export interface SubMenuItem {
  id?: string;
  path: string;
  label: string;
  headerTitle?: string;
  icon?: string;
  adminOnly?: boolean;
  hidden?: boolean;
}

export interface MenuGroup {
  groupKey?: string;
  title: string;
  adminOnly?: boolean;
  items: SubMenuItem[];
}

export interface ModuleMenuConfig {
  moduleKey: string;
  moduleName: string;
  groups: MenuGroup[];
}

export const pdmMenuConfig: ModuleMenuConfig = {
  moduleKey: 'pdm',
  moduleName: '产品数据管理 (PDM)',
  groups: [
    {
      title: '设备管理',
      items: [
        { path: '/device-type', label: '设备类型管理', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
        { path: '/device', label: '设备ID管理', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' }
      ]
    }
  ]
};

export const menuGroups: MenuGroup[] = pdmMenuConfig.groups;
export const menuItems: SubMenuItem[] = pdmMenuConfig.groups.flatMap(group => group.items);

export default pdmMenuConfig;

