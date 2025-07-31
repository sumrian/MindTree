interface TreeNodeData {
  name: string;
  children?: TreeNodeData[];
  collapsed?: boolean;
  type?: string;
  current?: {
    [key: string]: any;
  };
  [key: string]: any;
}
interface HandleOptions {
  [key: `on${string}`]: (node: TreeNodeData) => void;
}

interface MenuOption {
  key: string;
  text: string;
  icon: string;
  handle?: HandleOptions;
}

interface MenuOptions {
  items?: MenuOption[];
}

interface ChartOptions {
  tooltip?: any;
  series?: any[];
  [key: string]: any;
}

interface Events {
  filterMenu?: (type: string, menuOption: MenuOption) => MenuOption;
  [key: `on${string}`]: (node: TreeNodeData) => void;
}

interface MindTreeOptions {
  el: string | HTMLElement;
  data: TreeNodeData;
  options?: ChartOptions;
  menuOptions?: MenuOptions;
  events?: Events;
}

interface MindTreeInstance {
  setData: (newData: TreeNodeData) => void;
  getCurrentNode: () => TreeNodeData | null;
  getChart: () => any;
  destroy: () => void;
}

declare function createMindTree(options: MindTreeOptions): MindTreeInstance;

export {
  TreeNodeData,
  MenuOption,
  MenuOptions,
  ChartOptions,
  Events,
  MindTreeOptions,
  MindTreeInstance,
};

export default createMindTree;
