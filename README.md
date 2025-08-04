# MindTree

https://github.com/sumrian/MindTree.git

背景：
应用管理基础的列表显示较为杂乱且没有明显的层级关系，用户使用层级深的应用需要填入大量父级数据，体验不友好，构思使用树形图来交互，使得数据聚焦在当前节点，优化用户体验。
选型：
由于是 react 项目一开始想用 svg 作为视图，组件进行交互，传值非常方便，组件的动态渲染与现成组件库而样式可以直接 cv。
考虑到另一个 vue 项目后续也可能有这个需求，降级到 js 层面实现，js 的好处自然是通用，对于开发来说弊端极大，一开始使用手动渲染 dom 用 js 切换 class 加一些缓动来实现，交互实在不尽人意。
最终方案选择 echarts 作为基础，进行二次封装，保持原先逻辑不变，单击节点应该展开或者收起符合交互习惯，那么其余操作选择用右键节点触发一个菜单，菜单根据传入的菜单参数 dom 渲染，右键后菜单项暴露事件来触发函数，使用函数来实现与 react，vue 等交互。
整体架构使用选项式，通过传入大量参数来进行内部处理，最后通过菜单项的事件实现交互。
d.ts

```
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



PowerShell

```

难点： 1.动态的渲染 dom，js 是只会运行一次的，也就是说要通过 js 来渲染初始 dom 那么菜单不会发生变化。
初始化时候传入菜单项数据，交互使用右击事件获取节点的数据，定义一个 type 属性来判断节点类型，同时初始化时候传入一个过滤函数来过滤传入菜单项实现需要的渲染的菜单，有一个全局的方法对象 Events 用来传默认方法，同时菜单项数据上可以在 handle 上添加当前菜单项需要的方法，优先使用 handle 再使用 Events。 2.使用现代化框架如 react 本质上是会一直运行 一个 tsx 文件，那么就会一直运行 MindTree 库的初始化函数，这个库有大量的事件绑定，那么要保证销毁组件时候必须清理掉所有的事件绑定，如何维护事件注册是一个头疼点。
参考 react 的合成事件思想也使用事件委托把大量处理放在外层，后续销毁时候只需要销毁外层事件，暴露 destroy 通知现代化框架在组件销毁时候调用来触发销毁函数。 3.性能问题，这个是非常头疼的问题，尤其是业务方要求菜单可以移动。
`cursor: move;
/_ 欺骗浏览器使用硬件加速 _/
transform: translate3d(0, 0, 0);

PowerShell

先使用 gpu 渲染菜单（会为菜单创建一个复合层给 gpu 处理，复合层独立渲染。）
其实性能问题一般是节流重绘频繁造成的，封装一个节流函数控制 16.667ms（模拟 60fps）触发一次事件，在拖拽时候明细有提升。
移动过快依然会卡顿，那么切入另一个优化点 在浏览器空闲时候去渲染。使用 requestAnimationFrame 来使得浏览器空闲时候进行渲染。 4.事件流问题，拖拽事件和点击事件会冲突，拖拽菜单松手后菜单被隐藏，因为 mousedown 和 mousemove 被连续触发满足了 click 的触发条件。另外点击最后一个节点的单击也会冒泡到 document 上，document 上单击会隐藏菜单。以及后续可能会增加新的交互处理。
一开始在 mousedown 时候移除了 document 上的 click 监听，在 mousemove 的最后把 document 的 click 监听推入延时队列（直接恢复会触发 click 因为 click 在 mousemove 后触发）恢复原逻辑。后续发现单击最后一个子节点的冒泡难以处理，频繁的移除和添加事件不是一个好方案。
新增一个变量来控制是否隐藏菜单,只需要修改这个变量就能控制当前的菜单隐藏逻辑

shouldHideMenu = false;
setTimeout(() => {
shouldHideMenu = true;
}, 0);

document.addEventListener('click', (e) => {
if (shouldHideMenu && !state.contextMenu.contains(e.target)) {
hideContextMenu();
}
});

JavaScript

持续优化： 1.菜单可以拖拽:
点击角落节点菜单会在角落出现，有部分点击不到，使用先拖拽树的位置再打开菜单交互不友好，改为可以拖拽的菜单，面对的性能问题难点 3 解决 2.最后一个节点没有子节点那么单击不会有展开和收起，单击打开菜单优化交互体验：
判断是否有子节点来注册单击事件打开菜单。
