import './content-script.css';

/**
 * CF Stock Hover Panel 的内容脚本
 * 当选择股票代码时显示一个面板。
 */
(function () {
  const PANEL_ID = 'cf-stock-selection-panel';

  let panelEl = null;
  let codeEl = null;
  let openBtnEl = null;
  let currentCode = '';

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    panelEl = document.createElement('div');
    panelEl.id = PANEL_ID;
    document.documentElement.appendChild(panelEl);

    // 阻止事件传播，以防止面板内部的点击导致面板关闭
    panelEl.addEventListener('mousedown', e => e.stopPropagation());

    // 使用 Shadow DOM 以避免样式冲突
    const shadow = panelEl.attachShadow({ mode: 'open' });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="inner">
        <!-- <div class="title">股票代码</div>
        <div class="code"></div> -->
        <button class="open-btn">查看详情</button>
      </div>
    `;
    shadow.appendChild(wrapper);

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed;
        z-index: 2147483647;
        display: none;
        user-select: none;
      }
      .inner {
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        padding: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-rows: auto auto;
        gap: 6px 10px;
        align-items: center;
      }
      .title {
        grid-column: 1 / 2;
        font-size: 12px;
        color: #666;
      }
      .code {
        grid-column: 1 / 2;
        font-size: 16px;
        font-weight: 600;
        color: #111;
      }
      .open-btn {
        grid-column: 2 / 3;
        grid-row: 1 / 3;
        align-self: center;
        background: #1677ff;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        padding: 6px 10px;
        cursor: pointer;
      }
      .open-btn:hover {
        background: #165dff;
      }
    `;
    shadow.appendChild(style);

    codeEl = shadow.querySelector('.code');
    openBtnEl = shadow.querySelector('.open-btn');

    openBtnEl.addEventListener('click', () => {
      if (!currentCode) return;
      chrome.runtime.sendMessage(
        { type: 'OPEN_STOCK_PAGE', code: currentCode },
        () => { /* no-op */ }
      );
      hidePanel();
    });
  }

  function showPanel(rect, code) {
    if (!panelEl) createPanel();
    
    currentCode = code;
    // 添加一个空值检查，以防止元素被注释掉时出错
    if (codeEl) {
      codeEl.textContent = code;
    }

    const { width: panelWidth, height: panelHeight } = panelEl.getBoundingClientRect();
    const padding = 10;
    
    // 默认情况下，将面板定位在选区下方
    let top = rect.bottom + window.scrollY + padding;
    let left = rect.left + window.scrollX;

    // 如果面板溢出视口，则进行调整
    if (left + panelWidth > window.innerWidth) {
      left = window.innerWidth - panelWidth - padding;
    }
    if (top + panelHeight > window.innerHeight && rect.top > panelHeight + padding) {
      // 如果面板溢出底部并且顶部有空间，则将其移到选区上方
      top = rect.top + window.scrollY - panelHeight - padding;
    }
    
    panelEl.style.left = `${Math.round(left)}px`;
    panelEl.style.top = `${Math.round(top)}px`;
    panelEl.style.display = 'block';
  }

  function hidePanel() {
    if (panelEl) {
      panelEl.style.display = 'none';
    }
    currentCode = '';
  }

  function handleMouseUp(event) {
    // 如果点击发生在面板内部，则不执行任何操作，以允许交互。
    if (event.target.id === PANEL_ID || event.target.shadowRoot) {
      return;
    }

    const selection = window.getSelection();
    const selectionText = selection ? selection.toString().trim() : '';

    if (selection && !selection.isCollapsed && selectionText) {
      // 如果存在非空选择，则显示带有选定文本的面板。
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 确保选区在屏幕上有物理位置。
      if (rect.width > 0 || rect.height > 0) {
        showPanel(rect, selectionText);
      } else {
        hidePanel();
      }
    } else {
      // 如果没有选择或选择为空，则隐藏面板。
      // 这处理了“点击外部”的逻辑。
      hidePanel();
    }
  }

  // 为简单起见，使用单个监听器
  // document.addEventListener('mouseup', handleMouseUp, false);
  
  // 确保在加载时创建面板
  createPanel();
})();
