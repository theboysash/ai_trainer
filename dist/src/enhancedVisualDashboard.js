// src/enhancedVisualDashboard.ts
import { VisualInsightSystem } from './visualInsights';
import { SmartProgressTracker } from './smartProgressTracker';
export class EnhancedVisualDashboard {
    insightSystem = new VisualInsightSystem();
    progressTracker = new SmartProgressTracker();
    // DOM elements for insights display
    insightsContainer;
    progressContainer;
    metricsContainer;
    constructor() {
        this.createInsightsPanels();
        this.startRealTimeUpdates();
    }
    createInsightsPanels() {
        // Create insights panel
        this.insightsContainer = document.createElement('div');
        this.insightsContainer.id = 'realTimeInsights';
        this.insightsContainer.innerHTML = `
      <div class="insights-panel">
        <h3 class="insights-title">Real-time Analysis</h3>
        <div class="insights-grid" id="insightsGrid"></div>
      </div>
    `;
        // Enhanced exercise progress display
        this.progressContainer = document.createElement('div');
        this.progressContainer.id = 'enhancedProgress';
        this.progressContainer.innerHTML = `
      <div class="progress-panel">
        <h3 class="progress-title">Exercise Progress</h3>
        <div class="exercise-cards-container" id="exerciseCards"></div>
      </div>
    `;
        // Add CSS for new components
        this.injectEnhancedCSS();
        // Insert into existing dashboard
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.insertBefore(this.insightsContainer, sidebar.firstChild);
            const exercisePanel = document.querySelector('.exercise-panel');
            if (exercisePanel) {
                exercisePanel.appendChild(this.progressContainer);
            }
        }
    }
    injectEnhancedCSS() {
        const style = document.createElement('style');
        style.textContent = `
      /* Real-time Insights Panel */
      .insights-panel {
        background: #162031;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        border: 1px solid #1e293b;
      }
      
      .insights-title {
        font-size: 16px;
        font-weight: 700;
        color: #50d7ff;
        margin: 0 0 15px 0;
      }
      
      .insights-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .insight-card {
        background: #1b2a3a;
        border-radius: 8px;
        padding: 12px;
        border-left: 4px solid;
        transition: all 0.3s ease;
      }
      
      .insight-card.good { border-left-color: #22c55e; }
      .insight-card.warning { border-left-color: #f59e0b; }
      .insight-card.critical { border-left-color: #ef4444; }
      
      .insight-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .insight-type {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .insight-type.good { color: #22c55e; }
      .insight-type.warning { color: #f59e0b; }
      .insight-type.critical { color: #ef4444; }
      
      .insight-trend {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(100, 116, 139, 0.2);
        color: #64748b;
      }
      
      .insight-trend.improving { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
      .insight-trend.declining { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      
      .insight-message {
        font-size: 13px;
        color: #e9edf4;
        margin-bottom: 6px;
        font-weight: 500;
      }
      
      .insight-recommendation {
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.4;
      }
      
      /* Enhanced Exercise Cards */
      .progress-panel {
        margin-top: 20px;
      }
      
      .progress-title {
        font-size: 14px;
        font-weight: 600;
        color: #94a3b8;
        margin: 0 0 12px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .exercise-cards-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      
      .mini-exercise-card {
        background: #1b2a3a;
        border: 1px solid #2d3b4e;
        border-radius: 8px;
        padding: 12px;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      
      .mini-exercise-card.active {
        border-color: #22c55e;
        background: linear-gradient(135deg, #1a2f1a, #1b2a3a);
      }
      
      .mini-exercise-card.completed {
        border-color: #10b981;
        opacity: 0.8;
      }
      
      .mini-card-name {
        font-size: 12px;
        font-weight: 600;
        color: #50d7ff;
        margin-bottom: 6px;
      }
      
      .mini-card-progress {
        font-size: 10px;
        color: #64748b;
        margin-bottom: 8px;
      }
      
      .mini-progress-bar {
        width: 100%;
        height: 3px;
        background: #2d3b4e;
        border-radius: 2px;
        overflow: hidden;
      }
      
      .mini-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #22c55e, #10b981);
        border-radius: 2px;
        transition: width 0.5s ease;
      }
      
      /* Real-time Metrics Enhancement */
      .metric-value.pulsing {
        animation: pulse-metric 2s infinite;
      }
      
      @keyframes pulse-metric {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      .metric.warning .metric-value {
        color: #f59e0b !important;
      }
      
      .metric.critical .metric-value {
        color: #ef4444 !important;
      }
    `;
        document.head.appendChild(style);
    }
    updateDashboard(stepData) {
        // Update insights
        const insights = this.insightSystem.update(stepData);
        this.renderInsights(insights);
        // Update progress tracking
        this.renderProgressCards();
        // Update metrics with enhanced coloring
        this.updateEnhancedMetrics(stepData, insights);
    }
    renderInsights(insights) {
        const grid = document.getElementById('insightsGrid');
        if (!grid)
            return;
        // Show only the most important insights (max 4)
        const prioritizedInsights = insights
            .sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, good: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        })
            .slice(0, 4);
        grid.innerHTML = prioritizedInsights.map(insight => `
      <div class="insight-card ${insight.severity}">
        <div class="insight-header">
          <span class="insight-type ${insight.severity}">${insight.type}</span>
          <span class="insight-trend ${insight.trend}">${insight.trend}</span>
        </div>
        <div class="insight-message">${insight.message}</div>
        <div class="insight-recommendation">${insight.recommendation}</div>
      </div>
    `).join('');
    }
    renderProgressCards() {
        const container = document.getElementById('exerciseCards');
        if (!container)
            return;
        const updateData = this.progressTracker.getUIUpdateData();
        container.innerHTML = updateData.exercises.map(exercise => `
      <div class="mini-exercise-card ${exercise.isActive ? 'active' : ''} ${exercise.isCompleted ? 'completed' : ''}">
        <div class="mini-card-name">${exercise.name}</div>
        <div class="mini-card-progress">${exercise.currentSet}/${exercise.targetSets} sets</div>
        <div class="mini-progress-bar">
          <div class="mini-progress-fill" style="width: ${exercise.progressPercent}%"></div>
        </div>
      </div>
    `).join('');
    }
    updateEnhancedMetrics(stepData, insights) {
        // Add warning/critical classes to metrics based on insights
        const metricElements = {
            form: document.getElementById('metricForm'),
            velocity: document.getElementById('metricVelocity'),
            vl: document.getElementById('metricVL')
        };
        // Reset classes
        Object.values(metricElements).forEach(el => {
            if (el) {
                el.classList.remove('warning', 'critical', 'pulsing');
            }
        });
        // Apply classes based on insights
        insights.forEach(insight => {
            let element = null;
            switch (insight.type) {
                case 'form':
                    element = metricElements.form;
                    break;
                case 'velocity':
                    element = metricElements.vl;
                    break;
            }
            if (element) {
                element.classList.add(insight.severity);
                if (insight.severity === 'critical') {
                    element.classList.add('pulsing');
                }
            }
        });
    }
    // Public methods for workout manager integration
    onSetComplete(exerciseType, setData) {
        this.progressTracker.completeSet(exerciseType, setData);
        this.renderProgressCards();
    }
    onExerciseSwitch(exerciseType) {
        this.progressTracker.switchToExercise(exerciseType);
        this.insightSystem.reset(); // Reset insights for new exercise
        this.renderProgressCards();
    }
    onRestStart() {
        this.renderProgressCards(); // Update to show rest state
    }
    getProgressTracker() {
        return this.progressTracker;
    }
    reset() {
        this.progressTracker.reset();
        this.insightSystem.reset();
        this.renderProgressCards();
        // Clear insights
        const grid = document.getElementById('insightsGrid');
        if (grid) {
            grid.innerHTML = '<div style="color: #64748b; font-size: 12px; text-align: center; padding: 20px;">Start exercising to see real-time analysis</div>';
        }
    }
    startRealTimeUpdates() {
        // Update progress cards every 2 seconds
        setInterval(() => {
            this.renderProgressCards();
        }, 2000);
    }
}
//# sourceMappingURL=enhancedVisualDashboard.js.map