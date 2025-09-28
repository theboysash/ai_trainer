export class VBTVoiceAgent {
    synthesis;
    voice = null;
    isEnabled = true;
    messageQueue = [];
    lastSpoken = 0;
    MIN_SPEAK_INTERVAL = 6000;
    // VBT Intensities from your PDF
    intensities = {
        light: {
            name: 'light',
            vlThreshold: 0.20, // 15-20% VL threshold
            velocityRange: [0.8, 1.2], // m/s
            oneRMRange: [40, 60], // % of 1RM
            sets: [3, 4],
            reps: [6, 8]
        },
        moderate: {
            name: 'moderate',
            vlThreshold: 0.25, // 20-25% VL threshold
            velocityRange: [0.6, 0.8],
            oneRMRange: [65, 75],
            sets: [4, 5],
            reps: [6, 10]
        },
        intense: {
            name: 'intense',
            vlThreshold: 0.40, // 30-40% VL threshold (or FPI >= 0.8)
            velocityRange: [0.4, 0.6],
            oneRMRange: [80, 90],
            sets: [3, 5],
            reps: [3, 6]
        }
    };
    currentIntensity = this.intensities.moderate;
    // Exercise-specific tracking
    exerciseData = new Map();
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.initializeVoice();
        this.startMessageProcessor();
    }
    initializeVoice() {
        const loadVoices = () => {
            const voices = this.synthesis.getVoices();
            this.voice = voices.find(v => v.name.includes('Google') ||
                v.name.includes('Microsoft') ||
                v.lang.startsWith('en')) || voices[0];
        };
        loadVoices();
        this.synthesis.onvoiceschanged = loadVoices;
    }
    startMessageProcessor() {
        setInterval(() => {
            if (this.messageQueue.length > 0 && Date.now() - this.lastSpoken > this.MIN_SPEAK_INTERVAL) {
                const message = this.messageQueue.shift();
                this.speakImmediate(message);
            }
        }, 1000);
    }
    updateIntensity(intensity) {
        this.currentIntensity = this.intensities[intensity];
        this.queueMessage({
            type: 'instruction',
            message: `Training intensity set to ${intensity}. Target velocity loss threshold: ${Math.round(this.currentIntensity.vlThreshold * 100)}%.`,
            priority: 'high'
        });
    }
    analyzeWorkoutStep(stepData) {
        const exercise = stepData.exercise;
        // Initialize exercise tracking if needed
        if (!this.exerciseData.has(exercise)) {
            this.exerciseData.set(exercise, {
                velocityHistory: [],
                baseline: null,
                lastVLWarning: 0,
                setStartVelocity: null
            });
        }
        const data = this.exerciseData.get(exercise);
        // Track velocities
        if (stepData.velocity !== 0) {
            this.trackVelocity(exercise, Math.abs(stepData.velocity));
        }
        // VBT Analysis during active movement
        if (stepData.state !== 'idle' && stepData.reps > 0) {
            this.checkVelocityLoss(stepData, data);
            this.checkWeightAdjustment(stepData, data);
        }
        // Set completion coaching
        if (stepData.isNewRep && stepData.reps > 0) {
            this.handleRepCompletion(stepData);
        }
    }
    trackVelocity(exercise, velocity) {
        const data = this.exerciseData.get(exercise);
        data.velocityHistory.push(velocity);
        // Set baseline from first 2-3 reps
        if (!data.baseline && data.velocityHistory.length >= 3) {
            data.baseline = data.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
            data.setStartVelocity = data.baseline;
        }
        // Keep history manageable
        if (data.velocityHistory.length > 15) {
            data.velocityHistory = data.velocityHistory.slice(-12);
        }
    }
    checkVelocityLoss(stepData, data) {
        if (!data.baseline || data.velocityHistory.length < 4)
            return;
        const recent = data.velocityHistory.slice(-3);
        const currentAvg = recent.reduce((a, b) => a + b) / recent.length;
        const velocityLoss = (data.baseline - currentAvg) / data.baseline;
        const threshold = this.getVLThreshold(stepData.exercise);
        const now = Date.now();
        // Critical VL check - implement your PDF logic
        if (velocityLoss >= threshold && now - data.lastVLWarning > 8000) {
            this.queueVLWarning(stepData.exercise, velocityLoss, threshold, true);
            data.lastVLWarning = now;
        }
        // Approaching threshold
        else if (velocityLoss >= threshold * 0.85 && now - data.lastVLWarning > 12000) {
            this.queueVLWarning(stepData.exercise, velocityLoss, threshold, false);
            data.lastVLWarning = now;
        }
    }
    getVLThreshold(exercise) {
        // Exercise-specific adjustments to your base thresholds
        const baseThreshold = this.currentIntensity.vlThreshold;
        const exerciseModifiers = {
            shoulder_press: 1.0, // Compound movement
            lateral_raise: 0.85, // Isolation, stricter
            front_raise: 0.85,
            rear_delt_fly: 0.75, // Light isolation, very strict
            bicep_curl: 0.9
        };
        const modifier = exerciseModifiers[exercise] || 1.0;
        return baseThreshold * modifier;
    }
    queueVLWarning(exercise, vl, threshold, critical) {
        const vlPercent = Math.round(vl * 100);
        const thresholdPercent = Math.round(threshold * 100);
        let message;
        if (critical) {
            if (vl >= 0.40) {
                message = `Stop the ${exercise} set immediately! Velocity loss at ${vlPercent}% is well above your ${thresholdPercent}% limit.`;
            }
            else {
                message = `Velocity loss reached ${vlPercent}%. Your ${thresholdPercent}% threshold exceeded. Consider ending this set.`;
            }
        }
        else {
            message = `Velocity dropping to ${vlPercent}%. Approaching your ${thresholdPercent}% threshold.`;
        }
        this.queueMessage({
            type: 'warning',
            message,
            priority: critical ? 'high' : 'medium'
        });
    }
    checkWeightAdjustment(stepData, data) {
        // Only on set completion - you can trigger this when sets complete
        if (stepData.isSetComplete && data.baseline && data.velocityHistory.length >= 5) {
            const setVL = this.calculateSetVelocityLoss(data);
            const adjustment = this.getWeightAdjustmentRecommendation(stepData.exercise, setVL);
            if (adjustment) {
                setTimeout(() => {
                    this.queueMessage({
                        type: 'adjustment',
                        message: adjustment,
                        priority: 'medium'
                    });
                }, 3000);
            }
        }
    }
    calculateSetVelocityLoss(data) {
        if (!data.baseline || data.velocityHistory.length < 4)
            return 0;
        const finalVelocities = data.velocityHistory.slice(-3);
        const finalAvg = finalVelocities.reduce((a, b) => a + b) / finalVelocities.length;
        return (data.baseline - finalAvg) / data.baseline;
    }
    getWeightAdjustmentRecommendation(exercise, setVL) {
        const targetThreshold = this.getVLThreshold(exercise);
        const tolerance = 0.05; // 5% tolerance
        // Implementation of your PDF logic: "IF SET X AND VL<T_VL -> ADJUST WEIGHT BY 2.5-5% 1RM"
        if (setVL < targetThreshold - tolerance) {
            return `Set velocity loss was only ${Math.round(setVL * 100)}%. Consider increasing weight by 2.5-5% next set to reach your ${Math.round(targetThreshold * 100)}% target zone.`;
        }
        else if (setVL > targetThreshold + tolerance) {
            return `High velocity loss at ${Math.round(setVL * 100)}%. Consider reducing weight by 2.5-5% next set to stay in your ${Math.round(targetThreshold * 100)}% target zone.`;
        }
        return `Perfect velocity loss at ${Math.round(setVL * 100)}%. You're right in your target training zone.`;
    }
    handleRepCompletion(stepData) {
        // Moderate encouragement to avoid spam
        if (stepData.reps % 4 === 0 || stepData.reps >= stepData.targetReps) {
            const messages = [
                `${stepData.reps} reps completed. Maintain your form.`,
                `Good control on rep ${stepData.reps}. Stay consistent.`,
                `${stepData.reps} down. Focus on your target velocity.`
            ];
            const message = messages[Math.floor(Math.random() * messages.length)];
            this.queueMessage({
                type: 'encouragement',
                message,
                priority: 'low'
            });
        }
    }
    // Exercise transition callbacks
    onExerciseStart(exercise) {
        // Reset tracking for new exercise
        const data = this.exerciseData.get(exercise);
        if (data) {
            data.baseline = null;
            data.velocityHistory = [];
            data.setStartVelocity = null;
        }
        this.queueMessage({
            type: 'instruction',
            message: `Starting ${exercise}. Focus on controlled movement within your ${this.currentIntensity.name} training zone.`,
            priority: 'medium'
        });
    }
    onSetComplete(exercise, setData) {
        const data = this.exerciseData.get(exercise);
        if (!data)
            return;
        const setVL = this.calculateSetVelocityLoss(data);
        let performanceMsg = '';
        if (setVL <= this.getVLThreshold(exercise)) {
            performanceMsg = 'Excellent velocity maintenance.';
        }
        else if (setVL <= this.getVLThreshold(exercise) * 1.2) {
            performanceMsg = 'Good power output.';
        }
        else {
            performanceMsg = 'High fatigue detected.';
        }
        this.queueMessage({
            type: 'celebration',
            message: `${exercise} set complete. ${setData.reps} reps. ${performanceMsg}`,
            priority: 'medium'
        });
        // Reset for next set
        data.baseline = null;
        data.velocityHistory = [];
    }
    onWorkoutComplete() {
        this.queueMessage({
            type: 'celebration',
            message: `Workout complete! Great work staying within your velocity-based training targets.`,
            priority: 'high'
        });
    }
    // Message management
    queueMessage(message) {
        // Avoid duplicates
        if (this.messageQueue.some(m => m.message === message.message))
            return;
        // Priority queue
        if (message.priority === 'high') {
            this.messageQueue.unshift(message);
        }
        else {
            this.messageQueue.push(message);
        }
        // Limit queue size
        if (this.messageQueue.length > 4) {
            this.messageQueue = this.messageQueue.slice(-4);
        }
    }
    speakImmediate(message) {
        if (!this.isEnabled || !this.voice)
            return;
        const utterance = new SpeechSynthesisUtterance(message.message);
        utterance.voice = this.voice;
        utterance.rate = message.priority === 'high' ? 1.0 : 0.9;
        utterance.pitch = message.type === 'celebration' ? 1.1 : 1.0;
        utterance.volume = 0.8;
        this.synthesis.speak(utterance);
        this.lastSpoken = Date.now();
    }
    // Public methods
    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }
    clearQueue() {
        this.messageQueue = [];
        this.synthesis.cancel();
    }
    getCurrentIntensity() {
        return this.currentIntensity;
    }
    getStatus() {
        return {
            enabled: this.isEnabled,
            intensity: this.currentIntensity.name,
            vlThreshold: this.currentIntensity.vlThreshold,
            queueLength: this.messageQueue.length,
            exerciseCount: this.exerciseData.size
        };
    }
}
//# sourceMappingURL=vbtVoiceIntegration.js.map