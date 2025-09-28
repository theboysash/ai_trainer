// src/index.ts - Main Application Entry Point
import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();
// Import the main application
import { VelocityCoachAI } from './completeVelocityCoachSystem.js';
// Initialize the application when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const app = new VelocityCoachAI();
            window.velocityCoachAI = app;
            console.log('🚀 VelocityCoach AI - Complete System Initialized');
            console.log('📊 Features: Enhanced Exercise Detection | MongoDB Integration | VBT Analysis | Kinematic Calculations');
            console.log('💪 Ready for velocity-based training!');
        }
        catch (error) {
            console.error('❌ Failed to initialize VelocityCoach AI:', error);
            // Show user-friendly error message
            const errorContainer = document.createElement('div');
            errorContainer.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #dc2626;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: system-ui, sans-serif;
      `;
            errorContainer.innerHTML = `
        <strong>Initialization Error</strong><br>
        Check console for details. Ensure camera permissions are enabled.
      `;
            document.body.appendChild(errorContainer);
            // Auto-remove error after 10 seconds
            setTimeout(() => {
                document.body.removeChild(errorContainer);
            }, 10000);
        }
    });
}
else {
    // Server-side or test environment
    console.log('VelocityCoach AI loaded in non-browser environment');
}
// Export for external use
export { VelocityCoachAI } from './completeVelocityCoachSystem.js';
export { FitnessDatabase, createDatabaseConfig } from './fitnessDatabase.js';
//# sourceMappingURL=index.js.map