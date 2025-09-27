import { getExerciseConfig } from './exerciseConfigs';
export class ImprovedVoiceAgent {
    synthesis;
    voice = null;
    isEnabled = true;
    messageQueue = [];
    lastSpoken = 0;
    MIN_SPEAK_INTERVAL = 8000;
    // VBT intensity from your PDF model
    intensityThresholds = {
        light: 0.20, // 15-20% VL threshold
        moderate: 0.25, // 20-25% VL threshold  
        intense: 0.40 // 30-40% VL threshold
    };
    currentIntensity = 'moderate';
    // Smarter message throttling
    messageHistory = new Map();
    MESSAGE_COOLDOWNS = {
        'form_correction': 15000,
        'velocity_warning': 20000,
        'encouragement': 12000,
        'set_complete': 5000,
        'exercise_start': 3000,
        'intensity_update': 2000,
        'weight_adjustment': 5000
    };
    // Exercise-specific tracking
    currentExercise = 'shoulder_press';
    exerciseData = new Map();
    // Priority message system
    MESSAGE_PRIORITIES = {
        'safety_critical': 1,
        'set_milestone': 2,
        'performance': 3,
        'motivation': 4
    };
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.initializeVoice();
        this.startMessageProcessor();
        this.initializeExerciseData();
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
    initializeExerciseData() {
        const exercises = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly', 'bicep_curl'];
        exercises.forEach(exercise => {
            this.exerciseData.set(exercise, {
                velocityHistory: [],
                baseline: null,
                lastFormWarning: 0,
                lastVLWarning: 0,
                repCount: 0
            });
        });
    }
    startMessageProcessor() {
        setInterval(() => {
            if (this.messageQueue.length > 0 && Date.now() - this.lastSpoken > this.MIN_SPEAK_INTERVAL) {
                this.messageQueue.sort((a, b) => {
                    const priorityA = this.getMessagePriority(a);
                    const priorityB = this.getMessagePriority(b);
                    return priorityA - priorityB;
                });
                const message = this.messageQueue.shift();
                this.speakImmediate(message);
            }
        }, 1000);
    }
    getMessagePriority(message) {
        if (message.type === 'warning' && message.message.includes('Stop')) {
            return this.MESSAGE_PRIORITIES.safety_critical;
        }
        if (message.type === 'celebration' || message.message.includes('Starting')) {
            return this.MESSAGE_PRIORITIES.set_milestone;
        }
        if (message.type === 'warning' || message.type === 'instruction') {
            return this.MESSAGE_PRIORITIES.performance;
        }
        return this.MESSAGE_PRIORITIES.motivation;
    }
    // ADDED: Missing updateIntensity method
    updateIntensity(intensity) {
        this.currentIntensity = intensity;
        const thresholds = {
            light: '15-20%',
            moderate: '20-25%',
            intense: '30-40%'
        };
        this.queueMessage({
            type: 'instruction',
            message: `Training intensity set to ${intensity}. Target velocity loss threshold: ${thresholds[intensity]}.`,
            priority: 'high',
            timestamp: Date.now(),
            category: 'intensity_update'
        });
    }
    // ADDED: Missing onExerciseStart method  
    onExerciseStart(exercise) {
        const config = getExerciseConfig(exercise);
        this.queueMessage({
            type: 'instruction',
            message: `Starting ${config.name}. ${config.voiceCues.formTips[0]}`,
            priority: 'medium',
            timestamp: Date.now(),
            category: 'exercise_start'
        });
        // Reset exercise-specific data
        const exerciseDataToReset = this.exerciseData.get(exercise);
        if (exerciseDataToReset) {
            exerciseDataToReset.velocityHistory = [];
            exerciseDataToReset.baseline = null;
            exerciseDataToReset.repCount = 0;
        }
    }
    // Main analysis method
    analyzeWorkoutStep(stepData) {
        if (stepData.exercise !== this.currentExercise) {
            this.currentExercise = stepData.exercise;
            this.onExerciseSwitch(stepData.exercise);
        }
        const exerciseData = this.exerciseData.get(this.currentExercise);
        if (!exerciseData)
            return;
        if (stepData.isResting) {
            this.handleRestPeriod(stepData);
            return;
        }
        if (stepData.velocity !== 0) {
            this.trackExerciseVelocity(this.currentExercise, Math.abs(stepData.velocity));
        }
        if (stepData.state !== 'idle' && stepData.reps > 0) {
            this.checkCriticalIssues(stepData, exerciseData);
        }
        if (stepData.isNewRep && stepData.reps !== exerciseData.repCount) {
            exerciseData.repCount = stepData.reps;
            this.handleRepMilestone(stepData);
        }
    }
    onExerciseSwitch(exercise) {
        const config = getExerciseConfig(exercise);
        this.queueMessage({
            type: 'instruction',
            message: `Starting ${config.name}.`,
            priority: 'high',
            timestamp: Date.now(),
            category: 'exercise_start'
        });
    }
    trackExerciseVelocity(exercise, velocity) {
        const exerciseDataToTrack = this.exerciseData.get(exercise);
        if (!exerciseDataToTrack)
            return;
        exerciseDataToTrack.velocityHistory.push(velocity);
        if (!exerciseDataToTrack.baseline && exerciseDataToTrack.velocityHistory.length >= 4) {
            exerciseDataToTrack.baseline = exerciseDataToTrack.velocityHistory.slice(0, 4).reduce((a, b) => a + b) / 4;
        }
        if (exerciseDataToTrack.velocityHistory.length > 15) {
            exerciseDataToTrack.velocityHistory = exerciseDataToTrack.velocityHistory.slice(-12);
        }
    }
    checkCriticalIssues(stepData, exerciseData) {
        const now = Date.now();
        if (exerciseData.baseline && exerciseData.velocityHistory.length >= 6) {
            this.checkVelocityLoss(stepData, exerciseData, now);
        }
        if (now - exerciseData.lastFormWarning > this.MESSAGE_COOLDOWNS.form_correction) {
            this.checkFormQuality(stepData, exerciseData, now);
        }
    }
    checkVelocityLoss(stepData, exerciseData, now) {
        if (now - exerciseData.lastVLWarning < this.MESSAGE_COOLDOWNS.velocity_warning) {
            return;
        }
        const recent = exerciseData.velocityHistory.slice(-4);
        const currentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const velocityLoss = (exerciseData.baseline - currentAvg) / exerciseData.baseline;
        const threshold = this.getVLThreshold(stepData.exercise);
        if (velocityLoss >= threshold + 0.05) {
            this.queueMessage({
                type: 'warning',
                message: this.getVLWarningMessage(stepData.exercise, velocityLoss, threshold),
                priority: 'high',
                timestamp: now,
                category: 'velocity_warning'
            });
            exerciseData.lastVLWarning = now;
        }
    }
    checkFormQuality(stepData, exerciseData, now) {
        if (stepData.formScore < 60) {
            const config = getExerciseConfig(stepData.exercise);
            const warnings = config.voiceCues.warnings;
            const message = warnings[Math.floor(Math.random() * warnings.length)];
            this.queueMessage({
                type: 'instruction',
                message,
                priority: 'medium',
                timestamp: now,
                category: 'form_correction'
            });
            exerciseData.lastFormWarning = now;
        }
    }
    handleRepMilestone(stepData) {
        if (stepData.reps === Math.floor(stepData.targetReps / 2) || stepData.reps === stepData.targetReps) {
            const now = Date.now();
            if (now - (this.messageHistory.get('encouragement') || 0) > this.MESSAGE_COOLDOWNS.encouragement) {
                this.queueMessage({
                    type: 'encouragement',
                    message: `${stepData.reps} reps down. Keep it controlled.`,
                    priority: 'low',
                    timestamp: now,
                    category: 'encouragement'
                });
                this.messageHistory.set('encouragement', now);
            }
        }
    }
    handleRestPeriod(stepData) {
        if (stepData.restTimeRemaining === 10) {
            this.queueMessage({
                type: 'instruction',
                message: '10 seconds.',
                priority: 'medium',
                timestamp: Date.now(),
                category: 'rest_timer'
            });
        }
    }
    getVLThreshold(exercise) {
        const baseThreshold = this.intensityThresholds[this.currentIntensity];
        const exerciseModifiers = {
            shoulder_press: 1.0,
            lateral_raise: 0.85,
            front_raise: 0.85,
            rear_delt_fly: 0.75,
            bicep_curl: 0.9
        };
        const modifier = exerciseModifiers[exercise] || 1.0;
        return baseThreshold * modifier;
    }
    getVLWarningMessage(exercise, vl, threshold) {
        const exerciseName = getExerciseConfig(exercise).name;
        const vlPercent = Math.round(vl * 100);
        const thresholdPercent = Math.round(threshold * 100);
        if (vl >= 0.40 || (this.currentIntensity === 'intense' && vl >= 0.35)) {
            return `Stop the ${exerciseName} set immediately! Velocity loss at ${vlPercent}% exceeds your ${thresholdPercent}% limit.`;
        }
        else if (vl >= threshold) {
            return `Velocity loss reached ${vlPercent}% on ${exerciseName}. Your ${thresholdPercent}% threshold exceeded. Consider ending this set.`;
        }
        else {
            return `Velocity dropping to ${vlPercent}% on ${exerciseName}. Approaching your ${thresholdPercent}% threshold.`;
        }
    }
    getWeightAdjustmentRecommendation(exercise, setVL) {
        const threshold = this.getVLThreshold(exercise);
        const tolerance = 0.05;
        if (setVL < threshold - tolerance) {
            return `Set velocity loss was only ${Math.round(setVL * 100)}%. Consider adding 2.5-5% more weight next set to reach your ${Math.round(threshold * 100)}% target zone.`;
        }
        else if (setVL > threshold + tolerance) {
            return `High velocity loss at ${Math.round(setVL * 100)}%. Consider reducing weight by 2.5-5% next set to stay in your ${Math.round(threshold * 100)}% target zone.`;
        }
        return `Perfect velocity loss at ${Math.round(setVL * 100)}%. Right in your target training zone.`;
    }
    // Public methods
    onSetComplete(exercise, setData) {
        const config = getExerciseConfig(exercise);
        this.queueMessage({
            type: 'celebration',
            message: `${config.name} set complete. Good work.`,
            priority: 'medium',
            timestamp: Date.now(),
            category: 'set_complete'
        });
        // Add weight adjustment recommendation
        const exerciseDataForAdjustment = this.exerciseData.get(exercise);
        if (exerciseDataForAdjustment && exerciseDataForAdjustment.baseline && exerciseDataForAdjustment.velocityHistory.length >= 4) {
            const setVL = setData.velocityLoss || 0;
            const adjustment = this.getWeightAdjustmentRecommendation(exercise, setVL);
            if (adjustment) {
                setTimeout(() => {
                    this.queueMessage({
                        type: 'instruction',
                        message: adjustment,
                        priority: 'low',
                        timestamp: Date.now(),
                        category: 'weight_adjustment'
                    });
                }, 3000);
            }
        }
        // Reset exercise data for next set
        const exerciseDataForReset = this.exerciseData.get(exercise);
        if (exerciseDataForReset) {
            exerciseDataForReset.velocityHistory = [];
            exerciseDataForReset.baseline = null;
            exerciseDataForReset.repCount = 0;
        }
    }
    onExerciseComplete(exercise) {
        const config = getExerciseConfig(exercise);
        this.queueMessage({
            type: 'celebration',
            message: `${config.name} complete.`,
            priority: 'medium',
            timestamp: Date.now(),
            category: 'exercise_complete'
        });
    }
    onWorkoutComplete() {
        this.queueMessage({
            type: 'celebration',
            message: 'Workout complete. Well done.',
            priority: 'high',
            timestamp: Date.now(),
            category: 'workout_complete'
        });
    }
    queueMessage(message) {
        const lastTime = this.messageHistory.get(message.category) || 0;
        const cooldown = this.MESSAGE_COOLDOWNS[message.category] || 10000;
        if (Date.now() - lastTime < cooldown) {
            return;
        }
        if (this.messageQueue.some(m => m.message === message.message)) {
            return;
        }
        this.messageQueue.push(message);
        this.messageHistory.set(message.category, Date.now());
        if (this.messageQueue.length > 3) {
            this.messageQueue = this.messageQueue.slice(-3);
        }
    }
    speakImmediate(message) {
        if (!this.isEnabled || !this.voice)
            return;
        const utterance = new SpeechSynthesisUtterance(message.message);
        utterance.voice = this.voice;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 0.7;
        this.synthesis.speak(utterance);
        this.lastSpoken = Date.now();
    }
    // Public controls
    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }
    clearQueue() {
        this.messageQueue = [];
        this.synthesis.cancel();
    }
    getStatus() {
        return {
            enabled: this.isEnabled,
            currentExercise: this.currentExercise,
            queueLength: this.messageQueue.length,
            intensity: this.currentIntensity,
            vlThreshold: this.intensityThresholds[this.currentIntensity],
            lastSpoken: Date.now() - this.lastSpoken
        };
    }
}
//# sourceMappingURL=improvedVoiceAgent.js.map