// src/enhancedExerciseSystem.ts - Complete exercise system with all muscle groups
import { angleBetween } from "./curlCounter";
// Enhanced Exercise Configurations
export const ENHANCED_EXERCISE_CONFIGS = {
    // EXISTING SHOULDER EXERCISES
    shoulder_press: {
        name: 'Shoulder Press',
        type: 'shoulder_press',
        muscleGroup: 'shoulders',
        landmarks: {
            primary: [12, 14, 16], // Right: shoulder, elbow, wrist
            secondary: [11, 13, 15] // Left: shoulder, elbow, wrist
        },
        thresholds: {
            startAngle: 90,
            endAngle: 160,
            minROM: 60,
            maxVelocity: 180,
            stabilityThresh: 0.05
        },
        voiceCues: {
            formTips: [
                "Keep your core tight and shoulders back",
                "Press straight up, don't let your arms drift forward",
                "Control the negative, don't drop the weight"
            ],
            encouragement: [
                "Power through! Drive those arms up strong",
                "Beautiful pressing form, keep it controlled"
            ],
            warnings: [
                "Slow down the movement, control is key",
                "Don't arch your back, engage your core"
            ]
        }
    },
    lateral_raise: {
        name: 'Lateral Raise',
        type: 'lateral_raise',
        muscleGroup: 'shoulders',
        landmarks: {
            primary: [12, 14],
            secondary: [11, 13]
        },
        thresholds: {
            startAngle: 10,
            endAngle: 85,
            minROM: 60,
            maxVelocity: 120,
            stabilityThresh: 0.04
        },
        voiceCues: {
            formTips: [
                "Lead with your pinkies, thumbs down slightly",
                "Stop at shoulder height, no higher"
            ],
            encouragement: [
                "Perfect lateral raise form, keep it smooth",
                "Feel those side delts burning, great work"
            ],
            warnings: [
                "Don't swing the weight, use control",
                "Stop at shoulder height, protect your joints"
            ]
        }
    },
    front_raise: {
        name: 'Front Raise',
        type: 'front_raise',
        muscleGroup: 'shoulders',
        landmarks: {
            primary: [12, 14],
            secondary: [11, 13]
        },
        thresholds: {
            startAngle: 10,
            endAngle: 85,
            minROM: 60,
            maxVelocity: 110,
            stabilityThresh: 0.04
        },
        voiceCues: {
            formTips: [
                "Keep your arms straight but not locked",
                "Raise to shoulder height, parallel to floor"
            ],
            encouragement: [
                "Smooth front raise, perfect form",
                "Great front delt activation there"
            ],
            warnings: [
                "Too much swing, focus on control",
                "Don't go above shoulder height"
            ]
        }
    },
    rear_delt_fly: {
        name: 'Rear Delt Fly',
        type: 'rear_delt_fly',
        muscleGroup: 'shoulders',
        landmarks: {
            primary: [12, 14],
            secondary: [11, 13]
        },
        thresholds: {
            startAngle: 20,
            endAngle: 85,
            minROM: 50,
            maxVelocity: 100,
            stabilityThresh: 0.05
        },
        voiceCues: {
            formTips: [
                "Squeeze your shoulder blades together",
                "Keep your chest up and core tight"
            ],
            encouragement: [
                "Perfect rear delt activation, great squeeze",
                "Beautiful posture, feel those rear delts"
            ],
            warnings: [
                "Don't use your back, isolate the rear delts",
                "Slower tempo, focus on the squeeze"
            ]
        }
    },
    // NEW CHEST EXERCISES
    chest_press: {
        name: 'Chest Press',
        type: 'chest_press',
        muscleGroup: 'chest',
        landmarks: {
            primary: [12, 14, 16],
            secondary: [11, 13, 15]
        },
        thresholds: {
            startAngle: 90, // Arms at chest level
            endAngle: 170, // Arms extended
            minROM: 70,
            maxVelocity: 200,
            stabilityThresh: 0.06
        },
        voiceCues: {
            formTips: [
                "Keep your shoulders back and chest up",
                "Press from your chest, not your shoulders",
                "Control the weight on the way down"
            ],
            encouragement: [
                "Powerful chest press, feel those pecs working",
                "Great range of motion, keep it controlled"
            ],
            warnings: [
                "Don't let your shoulders roll forward",
                "Full range of motion, touch your chest"
            ]
        }
    },
    push_ups: {
        name: 'Push-ups',
        type: 'push_ups',
        muscleGroup: 'chest',
        landmarks: {
            primary: [12, 14, 16],
            secondary: [11, 13, 15]
        },
        thresholds: {
            startAngle: 70, // Bottom position
            endAngle: 160, // Top position
            minROM: 80,
            maxVelocity: 150,
            stabilityThresh: 0.04
        },
        voiceCues: {
            formTips: [
                "Keep your body in a straight line",
                "Lower your chest to the ground",
                "Push through your whole hand, not just fingertips"
            ],
            encouragement: [
                "Solid push-up form, keep that plank tight",
                "Great chest and tricep activation"
            ],
            warnings: [
                "Don't let your hips sag or pike up",
                "Full range of motion, chest to ground"
            ]
        }
    },
    // NEW ARM EXERCISES
    bicep_curl: {
        name: 'Bicep Curl',
        type: 'bicep_curl',
        muscleGroup: 'arms',
        landmarks: {
            primary: [12, 14, 16],
            secondary: [11, 13, 15]
        },
        thresholds: {
            startAngle: 155,
            endAngle: 40,
            minROM: 90,
            maxVelocity: 200,
            stabilityThresh: 0.06
        },
        voiceCues: {
            formTips: [
                "Keep your elbows by your sides",
                "Full range of motion, squeeze at the top",
                "Control the negative, don't drop it"
            ],
            encouragement: [
                "Perfect curl form, squeeze those biceps",
                "Great range of motion, keep it full"
            ],
            warnings: [
                "Don't swing your body, isolate the biceps",
                "Keep your elbows still, no cheating"
            ]
        }
    },
    tricep_extension: {
        name: 'Tricep Extension',
        type: 'tricep_extension',
        muscleGroup: 'arms',
        landmarks: {
            primary: [12, 14, 16],
            secondary: [11, 13, 15]
        },
        thresholds: {
            startAngle: 45, // Arms bent overhead
            endAngle: 160, // Arms extended overhead
            minROM: 100,
            maxVelocity: 180,
            stabilityThresh: 0.05
        },
        voiceCues: {
            formTips: [
                "Keep your elbows pointing forward",
                "Only your forearms should move",
                "Full extension at the top, squeeze your triceps"
            ],
            encouragement: [
                "Great tricep isolation, feel that burn",
                "Perfect elbow position, keep them still"
            ],
            warnings: [
                "Don't let your elbows flare out",
                "Control the weight, don't let it drop"
            ]
        }
    },
    // NEW BACK EXERCISE
    rows: {
        name: 'Rows',
        type: 'rows',
        muscleGroup: 'back',
        landmarks: {
            primary: [12, 14, 16],
            secondary: [11, 13, 15]
        },
        thresholds: {
            startAngle: 160, // Arms extended forward
            endAngle: 80, // Arms pulled back
            minROM: 70,
            maxVelocity: 160,
            stabilityThresh: 0.05
        },
        voiceCues: {
            formTips: [
                "Pull with your back, not your arms",
                "Squeeze your shoulder blades together",
                "Keep your chest up and core tight"
            ],
            encouragement: [
                "Powerful row, feel those lats working",
                "Great posture, squeeze those shoulder blades"
            ],
            warnings: [
                "Don't round your back, stay upright",
                "Lead with your elbows, not your hands"
            ]
        }
    },
    // NEW LEG EXERCISE
    squats: {
        name: 'Squats',
        type: 'squats',
        muscleGroup: 'legs',
        landmarks: {
            primary: [24, 26, 28], // Hip, knee, ankle
            secondary: [23, 25, 27] // Other leg
        },
        thresholds: {
            startAngle: 170, // Standing
            endAngle: 90, // Bottom of squat
            minROM: 70,
            maxVelocity: 120,
            stabilityThresh: 0.04
        },
        voiceCues: {
            formTips: [
                "Keep your chest up and core tight",
                "Sit back into your heels",
                "Knees track over your toes"
            ],
            encouragement: [
                "Powerful squat, drive through your heels",
                "Great depth, feel those glutes working"
            ],
            warnings: [
                "Don't let your knees cave in",
                "Keep your weight on your heels, not toes"
            ]
        }
    }
};
export class EnhancedExerciseDetector {
    config;
    velocityHistory = [];
    angleHistory = [];
    state = 'idle';
    repStartTime = 0;
    currentAngle = 0;
    baselineVelocity = null;
    // Rep counting
    reps = 0;
    lastAngle;
    lastTime;
    velocity = 0;
    constructor(config) {
        this.config = config;
    }
    step(landmarks, timestamp) {
        const metrics = this.computeMetrics(landmarks);
        if (!metrics.valid) {
            return {
                reps: this.reps,
                angle: this.currentAngle,
                velocity: this.velocity,
                state: this.state,
                formScore: 0,
                isNewRep: false
            };
        }
        this.currentAngle = metrics.angle;
        const isNewRep = this.updateState(metrics.angle, timestamp);
        const formScore = this.calculateFormScore(metrics);
        return {
            reps: this.reps,
            angle: this.currentAngle,
            velocity: this.velocity,
            state: this.state,
            formScore,
            isNewRep
        };
    }
    computeMetrics(landmarks) {
        const { primary } = this.config.landmarks;
        switch (this.config.type) {
            case 'shoulder_press':
            case 'chest_press':
                return this.computeShoulderPressMetrics(landmarks, primary);
            case 'lateral_raise':
                return this.computeLateralRaiseMetrics(landmarks, primary);
            case 'front_raise':
                return this.computeFrontRaiseMetrics(landmarks, primary);
            case 'rear_delt_fly':
                return this.computeRearDeltMetrics(landmarks, primary);
            case 'push_ups':
                return this.computePushUpMetrics(landmarks, primary);
            case 'bicep_curl':
                return this.computeBicepCurlMetrics(landmarks, primary);
            case 'tricep_extension':
                return this.computeTricepExtensionMetrics(landmarks, primary);
            case 'rows':
                return this.computeRowMetrics(landmarks, primary);
            case 'squats':
                return this.computeSquatMetrics(landmarks, primary);
            default:
                return { angle: 0, valid: false };
        }
    }
    computeShoulderPressMetrics(landmarks, joints) {
        const [shoulderIdx, elbowIdx, wristIdx] = joints;
        if (!this.jointsVisible(landmarks, joints)) {
            return { angle: 0, valid: false };
        }
        const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y, landmarks[shoulderIdx].z];
        const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y, landmarks[elbowIdx].z];
        const wrist = [landmarks[wristIdx].x, landmarks[wristIdx].y, landmarks[wristIdx].z];
        const armVector = [elbow[0] - shoulder[0], elbow[1] - shoulder[1]];
        const horizontalVector = [1, 0];
        const dotProduct = armVector[0] * horizontalVector[0] + armVector[1] * horizontalVector[1];
        const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
        let elevationAngle = Math.acos(dotProduct / armMagnitude) * (180 / Math.PI);
        if (armVector[1] > 0)
            elevationAngle = -elevationAngle;
        elevationAngle += 90;
        return { angle: Math.max(0, Math.min(180, elevationAngle)), valid: true };
    }
    computeLateralRaiseMetrics(landmarks, joints) {
        const [shoulderIdx, elbowIdx] = joints;
        if (!this.jointsVisible(landmarks, joints.slice(0, 2))) {
            return { angle: 0, valid: false };
        }
        const leftShoulder = [landmarks[11].x, landmarks[11].y];
        const rightShoulder = [landmarks[12].x, landmarks[12].y];
        const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y];
        const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y];
        const armVector = [elbow[0] - shoulder[0], elbow[1] - shoulder[1]];
        const shoulderLine = [rightShoulder[0] - leftShoulder[0], rightShoulder[1] - leftShoulder[1]];
        const dotProduct = armVector[0] * shoulderLine[0] + armVector[1] * shoulderLine[1];
        const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
        const shoulderMagnitude = Math.sqrt(shoulderLine[0] ** 2 + shoulderLine[1] ** 2);
        let abductionAngle = Math.acos(Math.abs(dotProduct) / (armMagnitude * shoulderMagnitude)) * (180 / Math.PI);
        return { angle: Math.max(0, Math.min(90, abductionAngle)), valid: true };
    }
    computeFrontRaiseMetrics(landmarks, joints) {
        const [shoulderIdx, elbowIdx] = joints;
        if (!this.jointsVisible(landmarks, joints.slice(0, 2))) {
            return { angle: 0, valid: false };
        }
        const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y];
        const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y];
        const armVector = [elbow[0] - shoulder[0], elbow[1] - shoulder[1]];
        const verticalVector = [0, 1];
        const dotProduct = armVector[0] * verticalVector[0] + armVector[1] * verticalVector[1];
        const armMagnitude = Math.sqrt(armVector[0] ** 2 + armVector[1] ** 2);
        let elevationAngle = Math.acos(Math.abs(dotProduct) / armMagnitude) * (180 / Math.PI);
        return { angle: Math.max(0, Math.min(90, elevationAngle)), valid: true };
    }
    computeRearDeltMetrics(landmarks, joints) {
        return this.computeFrontRaiseMetrics(landmarks, joints); // Similar mechanics
    }
    computePushUpMetrics(landmarks, joints) {
        // For push-ups, measure the shoulder-elbow-wrist angle
        const [shoulderIdx, elbowIdx, wristIdx] = joints;
        if (!this.jointsVisible(landmarks, joints)) {
            return { angle: 0, valid: false };
        }
        const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y, landmarks[shoulderIdx].z];
        const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y, landmarks[elbowIdx].z];
        const wrist = [landmarks[wristIdx].x, landmarks[wristIdx].y, landmarks[wristIdx].z];
        const angle = angleBetween(shoulder, elbow, wrist);
        return { angle: Math.max(0, Math.min(180, angle)), valid: true };
    }
    computeBicepCurlMetrics(landmarks, joints) {
        return this.computePushUpMetrics(landmarks, joints); // Same angle calculation
    }
    computeTricepExtensionMetrics(landmarks, joints) {
        // For tricep extensions, focus on the elbow angle with arms overhead
        const [shoulderIdx, elbowIdx, wristIdx] = joints;
        if (!this.jointsVisible(landmarks, joints)) {
            return { angle: 0, valid: false };
        }
        const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y, landmarks[shoulderIdx].z];
        const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y, landmarks[elbowIdx].z];
        const wrist = [landmarks[wristIdx].x, landmarks[wristIdx].y, landmarks[wristIdx].z];
        // Calculate the forearm angle relative to upper arm
        const angle = angleBetween(shoulder, elbow, wrist);
        return { angle: Math.max(0, Math.min(180, angle)), valid: true };
    }
    computeRowMetrics(landmarks, joints) {
        // For rows, measure how far back the elbow is pulled
        const [shoulderIdx, elbowIdx, wristIdx] = joints;
        if (!this.jointsVisible(landmarks, joints)) {
            return { angle: 0, valid: false };
        }
        const shoulder = [landmarks[shoulderIdx].x, landmarks[shoulderIdx].y];
        const elbow = [landmarks[elbowIdx].x, landmarks[elbowIdx].y];
        // Calculate how far the elbow is behind the shoulder (rowing motion)
        const horizontalDistance = shoulder[0] - elbow[0]; // Positive when elbow is behind shoulder
        const angle = Math.max(0, Math.min(180, 90 + (horizontalDistance * 200))); // Convert to angle
        return { angle, valid: true };
    }
    computeSquatMetrics(landmarks, joints) {
        // For squats, measure the hip-knee-ankle angle
        const [hipIdx, kneeIdx, ankleIdx] = joints;
        if (!this.jointsVisible(landmarks, joints)) {
            return { angle: 0, valid: false };
        }
        const hip = [landmarks[hipIdx].x, landmarks[hipIdx].y, landmarks[hipIdx].z];
        const knee = [landmarks[kneeIdx].x, landmarks[kneeIdx].y, landmarks[kneeIdx].z];
        const ankle = [landmarks[ankleIdx].x, landmarks[ankleIdx].y, landmarks[ankleIdx].z];
        const angle = angleBetween(hip, knee, ankle);
        return { angle: Math.max(0, Math.min(180, angle)), valid: true };
    }
    jointsVisible(landmarks, joints) {
        return joints.every(idx => (landmarks[idx]?.visibility ?? 0) > 0.5);
    }
    updateState(angle, timestamp) {
        if (this.lastAngle == null || this.lastTime == null) {
            this.lastAngle = angle;
            this.lastTime = timestamp;
            return false;
        }
        const dt = Math.max(1e-3, timestamp - this.lastTime);
        this.velocity = (angle - this.lastAngle) / dt;
        this.lastAngle = angle;
        this.lastTime = timestamp;
        if (this.velocity !== 0) {
            this.velocityHistory.push(Math.abs(this.velocity));
            if (this.velocityHistory.length > 10) {
                this.velocityHistory = this.velocityHistory.slice(-8);
            }
            if (!this.baselineVelocity && this.velocityHistory.length >= 3) {
                this.baselineVelocity = this.velocityHistory.slice(0, 3).reduce((a, b) => a + b) / 3;
            }
        }
        return this.detectRep(angle, timestamp);
    }
    detectRep(angle, timestamp) {
        const { startAngle, endAngle, minROM } = this.config.thresholds;
        let isNewRep = false;
        // Determine if this is a "lowering" or "raising" exercise
        const isLoweringExercise = startAngle > endAngle; // Like bicep curls (155° to 40°)
        switch (this.state) {
            case 'idle':
                if (isLoweringExercise ? angle <= startAngle : angle >= startAngle) {
                    this.state = 'eccentric';
                    this.repStartTime = timestamp;
                }
                break;
            case 'eccentric':
                if (isLoweringExercise ? angle <= endAngle : angle >= endAngle) {
                    this.state = 'bottom';
                }
                break;
            case 'bottom':
                if (isLoweringExercise ? angle > endAngle + 5 : angle < endAngle - 5) {
                    this.state = 'concentric';
                }
                break;
            case 'concentric':
                if (isLoweringExercise ? angle >= startAngle : angle <= startAngle) {
                    const rom = Math.abs(startAngle - endAngle);
                    const repTime = timestamp - this.repStartTime;
                    if (rom >= minROM && repTime >= 0.5 && repTime <= 5.0) {
                        this.reps++;
                        isNewRep = true;
                    }
                    this.state = 'top';
                }
                break;
            case 'top':
                if (isLoweringExercise ? angle < startAngle - 5 : angle > startAngle + 5) {
                    this.state = 'eccentric';
                    this.repStartTime = timestamp;
                }
                else if (timestamp - this.repStartTime > 2.0) {
                    this.state = 'idle';
                }
                break;
        }
        return isNewRep;
    }
    calculateFormScore(metrics) {
        let score = 100;
        const currentROM = Math.abs(this.currentAngle - this.config.thresholds.endAngle);
        const targetROM = this.config.thresholds.minROM;
        if (currentROM < targetROM * 0.8) {
            score -= 20;
        }
        else if (currentROM > targetROM * 1.2) {
            score += 10;
        }
        if (this.velocityHistory.length >= 3) {
            const recentVel = this.velocityHistory.slice(-3);
            const variance = this.calculateVariance(recentVel);
            if (variance > 1000)
                score -= 15;
            if (variance < 200)
                score += 5;
        }
        if (Math.abs(this.velocity) > this.config.thresholds.maxVelocity) {
            score -= 15;
        }
        return Math.max(0, Math.min(100, score));
    }
    calculateVariance(arr) {
        const mean = arr.reduce((a, b) => a + b) / arr.length;
        const squareDiffs = arr.map(x => Math.pow(x - mean, 2));
        return squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
    }
    getCurrentVelocityLoss() {
        if (!this.baselineVelocity || this.velocityHistory.length < 3)
            return 0;
        const recent = this.velocityHistory.slice(-3);
        const currentAvg = recent.reduce((a, b) => a + b) / recent.length;
        return Math.max(0, (this.baselineVelocity - currentAvg) / this.baselineVelocity);
    }
    reset() {
        this.reps = 0;
        this.state = 'idle';
        this.velocityHistory = [];
        this.angleHistory = [];
        this.baselineVelocity = null;
        this.lastAngle = undefined;
        this.lastTime = undefined;
    }
    getStats() {
        return {
            reps: this.reps,
            velocityLoss: this.getCurrentVelocityLoss(),
            avgVelocity: this.velocityHistory.length ?
                this.velocityHistory.reduce((a, b) => a + b) / this.velocityHistory.length : 0,
            peakVelocity: this.velocityHistory.length ? Math.max(...this.velocityHistory) : 0
        };
    }
}
// Helper functions
export function getExerciseConfig(type) {
    return ENHANCED_EXERCISE_CONFIGS[type];
}
export function getAllExerciseTypes() {
    return Object.keys(ENHANCED_EXERCISE_CONFIGS);
}
export function getExercisesByMuscleGroup(muscleGroup) {
    return getAllExerciseTypes().filter(exercise => ENHANCED_EXERCISE_CONFIGS[exercise].muscleGroup === muscleGroup);
}
//# sourceMappingURL=enhancedExerciseSystem.js.map