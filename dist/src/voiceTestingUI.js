export class VoiceTestingUI {
    agent;
    container;
    statusDisplay;
    constructor(agent) {
        this.agent = agent;
        this.createUI();
        this.updateStatus();
        setInterval(() => this.updateStatus(), 1000);
    }
    createUI() {
        // Main container
        this.container = document.createElement('div');
        this.container.id = 'voice-testing-ui';
        this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 280px;
      background: rgba(11, 14, 19, 0.95);
      border: 1px solid #2a3441;
      border-radius: 12px;
      padding: 20px;
      z-index: 10000;
      font-family: ui-sans-serif, system-ui;
      color: #e9edf4;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    `;
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Voice Agent Testing';
        title.style.cssText = `
      margin: 0 0 15px 0;
      color: #50d7ff;
      font-size: 16px;
      font-weight: 600;
    `;
        // Status display
        this.statusDisplay = document.createElement('div');
        this.statusDisplay.style.cssText = `
      background: #162031;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
      font-size: 12px;
      line-height: 1.4;
    `;
        // Intensity selector
        const intensitySection = this.createIntensitySelector();
        // Test buttons section
        const testSection = this.createTestButtons();
        // Control buttons section
        const controlSection = this.createControlButtons();
        // Assemble UI
        this.container.appendChild(title);
        this.container.appendChild(this.statusDisplay);
        this.container.appendChild(intensitySection);
        this.container.appendChild(testSection);
        this.container.appendChild(controlSection);
        document.body.appendChild(this.container);
    }
    createIntensitySelector() {
        const section = document.createElement('div');
        section.style.marginBottom = '15px';
        const label = document.createElement('div');
        label.textContent = 'Training Intensity:';
        label.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #a0a9b8;
    `;
        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = `
      display: flex;
      gap: 5px;
    `;
        const intensities = [
            { name: 'light', color: '#22c55e' },
            { name: 'moderate', color: '#f59e0b' },
            { name: 'intense', color: '#ef4444' }
        ];
        intensities.forEach(({ name, color }) => {
            const btn = document.createElement('button');
            btn.textContent = name;
            btn.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        background: ${color}20;
        border: 1px solid ${color}40;
        color: ${color};
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      `;
            btn.onmouseover = () => {
                btn.style.background = `${color}30`;
                btn.style.borderColor = `${color}60`;
            };
            btn.onmouseout = () => {
                btn.style.background = `${color}20`;
                btn.style.borderColor = `${color}40`;
            };
            btn.onclick = () => {
                this.agent.setIntensity(name);
                // Update button states
                buttonGroup.querySelectorAll('button').forEach(b => {
                    b.style.background = b === btn ? `${color}40` : `${color}20`;
                    b.style.borderColor = b === btn ? `${color}80` : `${color}40`;
                });
            };
            buttonGroup.appendChild(btn);
        });
        section.appendChild(label);
        section.appendChild(buttonGroup);
        return section;
    }
    createTestButtons() {
        const section = document.createElement('div');
        section.style.marginBottom = '15px';
        const label = document.createElement('div');
        label.textContent = 'Test Voice Messages:';
        label.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #a0a9b8;
    `;
        const tests = [
            { type: 'warning', label: 'VL Warning', icon: '⚠️' },
            { type: 'instruction', label: 'Form Tips', icon: '💪' },
            { type: 'celebration', label: 'Set Complete', icon: '🎉' },
            { type: 'adjustment', label: 'Weight Adj.', icon: '⚖️' },
            { type: 'encouragement', label: 'Motivation', icon: '🔥' }
        ];
        const buttonGrid = document.createElement('div');
        buttonGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    `;
        tests.forEach(({ type, label, icon }) => {
            const btn = this.createTestButton(label, icon, () => this.agent.testMessage(type));
            buttonGrid.appendChild(btn);
        });
        section.appendChild(label);
        section.appendChild(buttonGrid);
        return section;
    }
    createControlButtons() {
        const section = document.createElement('div');
        const controls = [
            {
                label: 'Toggle Voice',
                icon: '🔊',
                action: () => {
                    const enabled = this.agent.toggle();
                    this.updateStatus();
                }
            },
            {
                label: 'Clear Queue',
                icon: '🗑️',
                action: () => {
                    this.agent.clearQueue();
                    this.updateStatus();
                }
            }
        ];
        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = `
      display: flex;
      gap: 8px;
    `;
        controls.forEach(({ label, icon, action }) => {
            const btn = this.createTestButton(label, icon, action);
            btn.style.flex = '1';
            buttonGroup.appendChild(btn);
        });
        section.appendChild(buttonGroup);
        return section;
    }
    createTestButton(label, icon, action) {
        const btn = document.createElement('button');
        btn.innerHTML = `<span style="margin-right: 4px;">${icon}</span>${label}`;
        btn.style.cssText = `
      padding: 10px 12px;
      background: #1b2a3a;
      border: 1px solid #2d3b4e;
      color: #e9edf4;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
        btn.onmouseover = () => {
            btn.style.background = '#24384e';
            btn.style.borderColor = '#3a4d63';
        };
        btn.onmouseout = () => {
            btn.style.background = '#1b2a3a';
            btn.style.borderColor = '#2d3b4e';
        };
        btn.onclick = action;
        return btn;
    }
    updateStatus() {
        const status = this.agent.getStatus();
        this.statusDisplay.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Status:</span>
        <span style="color: ${status.enabled ? '#22c55e' : '#ef4444'}; font-weight: 600;">
          ${status.enabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Intensity:</span>
        <span style="color: #50d7ff; font-weight: 600; text-transform: uppercase;">
          ${status.intensity}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>VL Threshold:</span>
        <span style="color: #f59e0b; font-weight: 600;">
          ${Math.round(status.threshold * 100)}%
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Queue:</span>
        <span style="color: ${status.queueLength > 0 ? '#f59e0b' : '#64748b'}; font-weight: 600;">
          ${status.queueLength} messages
        </span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Velocity Data:</span>
        <span style="color: #a855f7; font-weight: 600;">
          ${status.velocityHistory} points
        </span>
      </div>
    `;
    }
    toggle() {
        this.container.style.display = this.container.style.display === 'none' ? 'block' : 'none';
    }
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
//# sourceMappingURL=voiceTestingUI.js.map