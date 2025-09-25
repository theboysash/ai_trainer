// src/exerciseConfigs.ts
import { ExerciseConfig, ExerciseType } from './exerciseSystem';

export const EXERCISE_CONFIGS: Record<ExerciseType, ExerciseConfig> = {
  shoulder_press: {
    name: 'Shoulder Press',
    type: 'shoulder_press',
    landmarks: {
      primary: [12, 14, 16], // Right: shoulder, elbow, wrist
      secondary: [11, 13, 15] // Left: shoulder, elbow, wrist
    },
    thresholds: {
      startAngle: 90,  // Arms horizontal
      endAngle: 160,   // Arms overhead
      minROM: 60,      // Minimum range of motion
      maxVelocity: 180, // Max safe velocity
      stabilityThresh: 0.05
    },
    voiceCues: {
      formTips: [
        "Keep your core tight and shoulders back",
        "Press straight up, don't let your arms drift forward",
        "Control the negative, don't drop the weight",
        "Keep your wrists straight and strong"
      ],
      encouragement: [
        "Power through! Drive those arms up strong",
        "Beautiful pressing form, keep it controlled",
        "Feel those shoulders working, stay tight",
        "Excellent control on the negative"
      ],
      warnings: [
        "Slow down the movement, control is key",
        "Don't arch your back, engage your core",
        "Keep your shoulders square, no tilting",
        "Full range of motion, press all the way up"
      ]
    }
  },

  lateral_raise: {
    name: 'Lateral Raise',
    type: 'lateral_raise',
    landmarks: {
      primary: [12, 14], // Right shoulder, elbow
      secondary: [11, 13] // Left shoulder, elbow
    },
    thresholds: {
      startAngle: 10,   // Arms at sides
      endAngle: 85,     // Arms horizontal
      minROM: 60,
      maxVelocity: 120,
      stabilityThresh: 0.04
    },
    voiceCues: {
      formTips: [
        "Lead with your pinkies, thumbs down slightly",
        "Stop at shoulder height, no higher",
        "Keep a slight bend in your elbows",
        "Control the weight down, don't let it drop"
      ],
      encouragement: [
        "Perfect lateral raise form, keep it smooth",
        "Feel those side delts burning, great work",
        "Beautiful control on both up and down",
        "Excellent mind-muscle connection"
      ],
      warnings: [
        "Don't swing the weight, use control",
        "Keep your torso upright, no leaning",
        "Stop at shoulder height, protect your joints",
        "Slow down the eccentric portion"
      ]
    }
  },

  front_raise: {
    name: 'Front Raise',
    type: 'front_raise',
    landmarks: {
      primary: [12, 14], // Right shoulder, elbow
      secondary: [11, 13] // Left shoulder, elbow
    },
    thresholds: {
      startAngle: 10,   // Arms at sides
      endAngle: 85,     // Arms forward horizontal
      minROM: 60,
      maxVelocity: 110,
      stabilityThresh: 0.04
    },
    voiceCues: {
      formTips: [
        "Keep your arms straight but not locked",
        "Raise to shoulder height, parallel to floor",
        "Don't use momentum, pure muscle control",
        "Keep your shoulders down and back"
      ],
      encouragement: [
        "Smooth front raise, perfect form",
        "Great front delt activation there",
        "Love the controlled tempo, keep it up",
        "Excellent posture throughout the movement"
      ],
      warnings: [
        "Too much swing, focus on control",
        "Keep your core engaged, no back arch",
        "Don't go above shoulder height",
        "Slow down the negative phase"
      ]
    }
  },

  rear_delt_fly: {
    name: 'Rear Delt Fly',
    type: 'rear_delt_fly',
    landmarks: {
      primary: [12, 14], // Right shoulder, elbow
      secondary: [11, 13] // Left shoulder, elbow
    },
    thresholds: {
      startAngle: 20,   // Arms forward
      endAngle: 85,     // Arms wide
      minROM: 50,
      maxVelocity: 100,
      stabilityThresh: 0.05
    },
    voiceCues: {
      formTips: [
        "Squeeze your shoulder blades together",
        "Keep your chest up and core tight",
        "Lead with your pinkies, slight elbow bend",
        "Focus on pulling your elbows back"
      ],
      encouragement: [
        "Perfect rear delt activation, great squeeze",
        "Beautiful posture, feel those rear delts",
        "Excellent mind-muscle connection back there",
        "Love the control, keep squeezing"
      ],
      warnings: [
        "Don't use your back, isolate the rear delts",
        "Keep your core tight, no swaying",
        "Slower tempo, focus on the squeeze",
        "Don't let your shoulders roll forward"
      ]
    }
  },

  bicep_curl: {
    name: 'Bicep Curl',
    type: 'bicep_curl',
    landmarks: {
      primary: [12, 14, 16], // Right shoulder, elbow, wrist
      secondary: [11, 13, 15] // Left shoulder, elbow, wrist
    },
    thresholds: {
      startAngle: 155,  // Arm extended
      endAngle: 40,     // Arm contracted
      minROM: 90,
      maxVelocity: 200,
      stabilityThresh: 0.06
    },
    voiceCues: {
      formTips: [
        "Keep your elbows by your sides",
        "Full range of motion, squeeze at the top",
        "Control the negative, don't drop it",
        "Keep your wrists straight and strong"
      ],
      encouragement: [
        "Perfect curl form, squeeze those biceps",
        "Beautiful control, feel the muscle working",
        "Great range of motion, keep it full",
        "Excellent tempo, biceps are loving this"
      ],
      warnings: [
        "Don't swing your body, isolate the biceps",
        "Keep your elbows still, no cheating",
        "Slow down the negative portion",
        "Full extension at the bottom"
      ]
    }
  }
};

export function getExerciseConfig(type: ExerciseType): ExerciseConfig {
  return EXERCISE_CONFIGS[type];
}

export function getAllExerciseTypes(): ExerciseType[] {
  return Object.keys(EXERCISE_CONFIGS) as ExerciseType[];
}

export function getExercisesByMuscleGroup(muscleGroup: 'shoulders' | 'arms'): ExerciseType[] {
  const shoulderExercises: ExerciseType[] = ['shoulder_press', 'lateral_raise', 'front_raise', 'rear_delt_fly'];
  const armExercises: ExerciseType[] = ['bicep_curl'];
  
  return muscleGroup === 'shoulders' ? shoulderExercises : armExercises;
}