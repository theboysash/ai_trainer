import { ExerciseConfig, ExerciseType } from './exerciseSystem';
export declare const EXERCISE_CONFIGS: Record<ExerciseType, ExerciseConfig>;
export declare function getExerciseConfig(type: ExerciseType): ExerciseConfig;
export declare function getAllExerciseTypes(): ExerciseType[];
export declare function getExercisesByMuscleGroup(muscleGroup: 'shoulders' | 'arms'): ExerciseType[];
//# sourceMappingURL=exerciseConfigs.d.ts.map