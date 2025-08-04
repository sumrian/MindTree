import { init as initEcharts } from "echarts";
// 节流函数 用于优化拖拽的卡顿
const throttle = (fn, delay) => {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
};

const createMindTree = (options) => {
  const {
    el,
    data,
    options: chartOptions = {},
    menuOptions = {},
    events = {},
  } = options;

  const state = {
    container: typeof el === "string" ? document.querySelector(el) : el,
    data,
    chartOptions,
    menuOptions,
    events,
    currentNode: null,
    chart: null,
    contextMenu: null,
    chartContainer: null,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    chartOffset: { x: 0, y: 0 },
  };
  // 菜单拖拽相关变量
  let menuDragging = false;
  let menuStartX = 0;
  let menuStartY = 0;
  let menuOffsetX = 0;
  let menuOffsetY = 0;
  let rafId = null;
  const createContainer = () => {
    state.container.style.position = "relative";
    state.chartContainer = document.createElement("div");
    state.chartContainer.style.width = "100%";
    state.chartContainer.style.height = "100%";
    state.container.appendChild(state.chartContainer);
  };

  const createContextMenu = () => {
    const menu = document.createElement("div");
    menu.className = "mind-tree-menu";
    menu.style.display = "none";

    const menuHtml = state.menuOptions?.items
      ?.map(
        (item) => `
        <div class="menu-item" data-key="${item.key}" data-icon="${item.icon}" >
          <span class="menu-icon ${item.icon}"></span>
          ${item.text}
        </div>
      `
      )
      .join("");

    menu.innerHTML =
      menuHtml ??
      `
        <div class="menu-item" >
          <span class="menu-icon"></span>
          暂无数据
        </div>
      `;
    state.container.appendChild(menu);
    state.contextMenu = menu;

    addMenuStyles();
  };

  const addMenuStyles = () => {
    if (document.querySelector("#mind-tree-styles")) return;

    const style = document.createElement("style");
    style.id = "mind-tree-styles";
    style.textContent = `
      .mind-tree-menu {
        position: absolute;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 4px 0;
        min-width: 160px;
        z-index: 1000;
        font-size: 14px;
        animation: mindTreeFadeIn 0.15s ease-out;
        user-select: none;  
        cursor: move;
        /* 欺骗浏览器使用硬件加速 */
        transform: translate3d(0, 0, 0);
      }

      /* 添加拖动时的样式 */
      .mind-tree-menu.dragging {
        opacity: 0.9;
        transform: scale(1.02);
        transition: all 0.1s;
      }

      .mind-tree-menu .menu-item {
        padding: 10px 16px;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .mind-tree-menu .menu-item:hover {
        background: #f5f5f5;
      }

      .mind-tree-menu .menu-item[data-icon="delete"]:hover {
        color: #ff4d4f;
        background: #fff1f0;
      }

      .mind-tree-menu .menu-icon {
        width: 16px;
        height: 16px;
        margin-right: 8px;
        opacity: 0.7;
      }

      @keyframes mindTreeFadeIn {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  };

  const initChart = () => {
    state.chart = initEcharts(state.chartContainer);
    updateChartOption();
  };

  const updateChartOption = () => {
    const defaultOptions = {
      tooltip: { trigger: "item" },
      series: [
        {
          type: "tree",
          data: [state.data],
          layout: "orthogonal",
          orient: "LR",
          symbol: "circle",
          symbolSize: (data) => {
            return data?.children && !data?.collapsed ? 100 : 8;
          },
          itemStyle: {
            color: "#fff",
            borderColor: "#91d5ff",
            borderWidth: 1,
          },
          label: {
            position: "top",
            fontSize: 14,
            color: "#333",
            backgroundColor: "transparent",
            padding: [4, 8],
            borderRadius: 4,
          },
          emphasis: {
            focus: "descendant",
            itemStyle: {
              color: "#e6f7ff",
              borderColor: "#1890ff",
              borderWidth: 2,
            },
          },
          lineStyle: {
            color: "#d9d9d9",
            width: 1.5,
          },
          expandAndCollapse: true,
          animationDuration: 400,
          animationDurationUpdate: 500,
          roam: true,
          draggable: true,
          ...state.chartOptions,
        },
      ],
    };

    state.chart.setOption(defaultOptions);
  };
  const hideContextMenu = () => {
    state.contextMenu.style.display = "none";
  };
  const bindEvents = () => {
    state.container.addEventListener("contextmenu", (e) => e.preventDefault());
    // 是否隐藏菜单
    let shouldHideMenu = true;

    state.chart.on("click", (params) => {
      if (params?.data) {
        // 没有子节点使用单击显示菜单做交互优化
        if (!params.data?.children?.length) {
          // 关闭菜单逻辑
          shouldHideMenu = false;
          setTimeout(() => {
            shouldHideMenu = true;
          }, 0);

          state.currentNode = params.data;
          showContextMenu(params.event.offsetX, params.event.offsetY);
          state.events.onContextMenu?.(params.data);
        }

        state.events.onClick?.(params.data);
      }
    });

    document.addEventListener("click", (e) => {
      if (shouldHideMenu && !state.contextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });

    state.chart.on("contextmenu", (params) => {
      if (params?.data) {
        state.currentNode = params.data;
        showContextMenu(params.event.offsetX, params.event.offsetY);
        state.events.onContextMenu?.(params.data);
      }
    });

    state.contextMenu.addEventListener("click", (e) => {
      const menuItem = e.target.closest(".menu-item");
      if (!menuItem) return;
      // 目前使用默认事件加自定义事件，自定义事件优先级高，后续考虑是否有改进方法
      const onClick = state.menuOptions?.items?.find(
        (item) => item.key === menuItem.dataset.key
      )?.handle?.onClick;
      if (onClick) {
        handleMenuAction(onClick);
      } else {
        const key = menuItem.dataset.key;
        const defaultHandle =
          state.events[`on${key.charAt(0).toUpperCase() + key.slice(1)}`];
        if (defaultHandle) {
          handleMenuAction(defaultHandle);
        }
      }

      hideContextMenu();
      e.stopPropagation();
    });

    window.addEventListener("resize", () => state.chart.resize());

    // 拖拽逻辑
    state.chart.on("mousedown", (params) => {
      if (!params.data) {
        state.isDragging = true;
        state.dragStartX = params.event.offsetX;
        state.dragStartY = params.event.offsetY;
        state.chartContainer.style.cursor = "grab";
      }
    });

    state.chart.on("mousemove", (params) => {
      if (state.isDragging) {
        const deltaX = params.event.offsetX - state.dragStartX;
        const deltaY = params.event.offsetY - state.dragStartY;

        state.chart.setOption({
          series: [
            {
              type: "tree",
              zoom: 1,
              center: [
                state.chartOffset.x + deltaX,
                state.chartOffset.y + deltaY,
              ],
            },
          ],
        });
      }
    });

    state.chart.on("mouseup", () => {
      if (state.isDragging) {
        state.isDragging = false;
        state.chartContainer.style.cursor = "default";

        const option = state.chart.getOption();
        state.chartOffset.x = option.series[0].center[0];
        state.chartOffset.y = option.series[0].center[1];
      }
    });

    state.chart.on("globalout", () => {
      if (state.isDragging) {
        state.isDragging = false;
        state.chartContainer.style.cursor = "default";
      }
    });

    // 滚轮缩放逻辑
    state.container.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY;
        const option = state.chart.getOption();
        let zoom = option.series[0].zoom || 1;

        zoom *= delta > 0 ? 0.9 : 1.1;
        zoom = Math.max(0.5, Math.min(zoom, 2)); // 限制缩放范围

        state.chart.setOption({
          series: [
            {
              type: "tree",
              zoom: zoom,
            },
          ],
        });
      },
      { passive: false }
    );

    // hover逻辑
    state.chart.on("mouseover", (params) => {
      if (params?.data) {
        state.chartContainer.style.cursor = "pointer";
        state.events.onHover?.(params.data);
      }
    });

    state.chart.on("mouseout", (params) => {
      if (params?.data) {
        state.chartContainer.style.cursor = "default";
        state.events.onHoverEnd?.(params.data);
      }
    });

    // 拖拽优化2 使用 requestAnimationFrame 更新位置
    const updateMenuPosition = (x, y) => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        state.contextMenu.style.left = `${x}px`;
        state.contextMenu.style.top = `${y}px`;
      });
    };

    // 菜单拖拽开始
    state.contextMenu.addEventListener("mousedown", (e) => {
      if (e.target.closest(".menu-item")) return;

      menuDragging = true;
      menuStartX = e.clientX;
      menuStartY = e.clientY;

      const rect = state.contextMenu.getBoundingClientRect();
      menuOffsetX = e.clientX - rect.left;
      menuOffsetY = e.clientY - rect.top;

      state.contextMenu.classList.add("dragging");
      shouldHideMenu = false;
    });
    // 菜单拖拽中
    const handleMenuMove = throttle((e) => {
      if (!menuDragging) return;

      const containerRect = state.container.getBoundingClientRect();
      const menuRect = state.contextMenu.getBoundingClientRect();

      let newX = e.clientX - containerRect.left - menuOffsetX;
      let newY = e.clientY - containerRect.top - menuOffsetY;

      // 边界检查
      newX = Math.max(0, Math.min(newX, containerRect.width - menuRect.width));
      newY = Math.max(
        0,
        Math.min(newY, containerRect.height - menuRect.height)
      );

      updateMenuPosition(newX, newY);

      e.preventDefault();
      e.stopPropagation();
    }, 16.667);

    document.addEventListener("mousemove", handleMenuMove);

    document.addEventListener("mouseup", () => {
      if (menuDragging) {
        menuDragging = false;
        state.contextMenu.classList.remove("dragging");

        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        // 关闭菜单逻辑
        setTimeout(() => {
          shouldHideMenu = true;
        }, 0);
      }
    });

    state.menuMoveHandler = handleMenuMove;
  };

  // 菜单动态渲染逻辑
  const renderDynamicMenu = (node) => {
    if (!state.menuOptions?.items?.length) {
      return `
      <div class="menu-item">
        <span class="menu-icon"></span>
        暂无数据
      </div>
    `;
    }

    const filteredItems = state.menuOptions.items
      .map((item) => {
        // 使用 filterMenu 函数过滤菜单项
        if (state.events.filterMenu) {
          return state.events.filterMenu(node.type, item);
        }
        return item;
      })
      .filter(Boolean)
      .map(
        (item) => `
      <div class="menu-item" data-key="${item.key}" data-icon="${item.icon}">
        <span class="menu-icon ${item.icon}"></span>
        ${item.text}
      </div>
    `
      )
      .join("");

    return (
      filteredItems ||
      `
    <div class="menu-item">
      <span class="menu-icon"></span>
      暂无可用操作
    </div>
  `
    );
  };

  const showContextMenu = (x, y) => {
    state.contextMenu.innerHTML = renderDynamicMenu(state.currentNode);
    state.contextMenu.style.display = "block";
    state.contextMenu.style.left = x + "px";
    state.contextMenu.style.top = y + "px";
  };

  const handleMenuAction = (handle) => {
    if (!state.currentNode) return;
    handle?.(state.currentNode);
  };

  const init = async () => {
    createContainer();
    initChart();
    createContextMenu();
    bindEvents();
  };

  const publicMethods = {
    setData: (newData) => {
      state.data = newData;
      updateChartOption();
    },

    // 当前节点
    getCurrentNode: () => state.currentNode,

    // 图表实例
    getChart: () => state.chart,

    // 销毁实例 后续知识体系完整写个更好的处理
    destroy: () => {
      // 清理 echarts 事件
      if (state.chart) {
        // 清理所有 echarts 事件监听
        state.chart.off("click");
        state.chart.off("contextmenu");
        state.chart.off("mousedown");
        state.chart.off("mousemove");
        state.chart.off("mouseup");
        state.chart.off("globalout");
        state.chart.off("mouseover");
        state.chart.off("mouseout");

        // 销毁 echarts 实例
        state.chart.dispose();
        state.chart = null;
      }

      // 清理 DOM 事件
      if (state.container) {
        // 移除右键菜单事件
        state.container.removeEventListener("contextmenu", (e) =>
          e.preventDefault()
        );
        // 移除滚轮事件
        state.container.removeEventListener("wheel", null, { passive: false });
      }

      // 清理右键菜单事件
      if (state.contextMenu) {
        state.contextMenu.removeEventListener("click", null);
        state.container.removeChild(state.contextMenu);
      }

      // 清理全局事件
      document.removeEventListener("click", hideContextMenu);
      window.removeEventListener("resize", () => state.chart?.resize());

      // 清理 DOM 元素
      if (state.chartContainer && state.container) {
        state.container.removeChild(state.chartContainer);
      }

      // 清理状态
      Object.keys(state).forEach((key) => {
        state[key] = null;
      });

      // 清理菜单拖拽相关事件
      if (state.contextMenu) {
        state.contextMenu.removeEventListener("mousedown", null);
        document.removeEventListener("mousemove", null);
        document.removeEventListener("mouseup", null);
      }

      if (state.menuMoveHandler) {
        document.removeEventListener("mousemove", state.menuMoveHandler);
      }

      // 清理最后的 requestAnimationFrame
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };

  init();
  return publicMethods;
};

export default createMindTree;
