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
        { path: '/device-type', label: '设备类型管理' },
        { path: '/device', label: '设备ID管理' }
      ]
    }
  ]
};

export const menuGroups: MenuGroup[] = pdmMenuConfig.groups;
export const menuItems: SubMenuItem[] = pdmMenuConfig.groups.flatMap(group => group.items);

export default pdmMenuConfig;

