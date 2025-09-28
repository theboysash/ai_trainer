export declare class ExerciseTestRunner {
    static testAllExercises(): void;
    static testExerciseConfigs(): void;
    static testShoulderExercises(): void;
    static testExerciseDetection(exercise: string, testCases: any[]): void;
    static testVoiceIntegration(): void;
    static testWorkoutFlow(): void;
    static benchmarkDetection(): void;
}
export declare function simulateWorkout(): void;
export declare const QA_CHECKLIST: {
    'Exercise Detection': string[];
    'Voice Coaching': string[];
    'Workout Management': string[];
    Performance: string[];
};
//# sourceMappingURL=testingProtocol.d.ts.map