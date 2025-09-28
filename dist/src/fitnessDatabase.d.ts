import { ObjectId } from 'mongodb';
export type ExerciseType = 'squats' | 'shoulder_press' | 'lateral_raise' | 'front_raise' | 'rear_delt_fly' | 'chest_press' | 'push_ups' | 'bicep_curl' | 'tricep_extension' | 'rows';
export interface User {
    _id?: ObjectId;
    name: string;
    age: number;
    weight: number;
    height: number;
    training_experience: 'novice' | 'intermediate' | 'advanced';
    created_at: Date;
    updated_at: Date;
}
export interface WeightMeasurement {
    _id?: ObjectId;
    user_id: ObjectId;
    date_measured: Date;
    weight: number;
}
export interface Exercise {
    _id?: ObjectId;
    name: string;
    exercise_type: ExerciseType;
    muscle_group: string;
    equipment_needed?: string;
    instructions?: string;
    created_at: Date;
}
export interface WorkoutSession {
    _id?: ObjectId;
    user_id: ObjectId;
    session_name?: string;
    started_at: Date;
    ended_at?: Date;
    total_duration_seconds?: number;
    notes?: string;
    created_at: Date;
}
export interface SessionExercise {
    _id?: ObjectId;
    session_id: ObjectId;
    exercise_id: ObjectId;
    exercise_type: ExerciseType;
    order_in_session: number;
    target_sets: number;
    target_reps: number;
    started_at: Date;
    completed_at?: Date;
}
export interface Set {
    _id?: ObjectId;
    session_exercise_id: ObjectId;
    set_number: number;
    weight: number;
    reps: number;
    avg_velocity_set: number;
    velocity_loss_pct: number;
    stop_reason: 'completed' | 'velocity_threshold' | 'form_breakdown' | 'manual';
    form_score?: number;
    started_at: Date;
    completed_at: Date;
}
export interface Rep {
    _id?: ObjectId;
    set_id: ObjectId;
    rep_number: number;
    peak_velocity: number;
    avg_velocity: number;
    rom_degrees: number;
    form_score?: number;
    timestamp: Date;
}
export interface VBTThreshold {
    _id?: ObjectId;
    exercise_type: ExerciseType;
    training_zone: 'power' | 'strength' | 'hypertrophy' | 'endurance';
    min_velocity: number;
    max_velocity: number;
    velocity_loss_threshold: number;
}
export interface DatabaseConfig {
    connectionString: string;
    databaseName: string;
    options?: {
        maxPoolSize?: number;
        serverSelectionTimeoutMS?: number;
        socketTimeoutMS?: number;
    };
}
export declare class FitnessDatabase {
    private client;
    private db;
    private connectionString;
    private databaseName;
    private users?;
    private weightMeasurements?;
    private exercises?;
    private workoutSessions?;
    private sessionExercises?;
    private sets?;
    private reps?;
    private vbtThresholds?;
    constructor(connectionString: string, databaseName: string);
    connect(): Promise<boolean>;
    disconnect(): Promise<void>;
    private createIndexes;
    private seedDefaultData;
    createUser(userData: Omit<User, '_id' | 'created_at' | 'updated_at'>): Promise<User>;
    getUserById(userId: ObjectId): Promise<User | null>;
    updateUser(userId: ObjectId, updates: Partial<User>): Promise<void>;
    startSession(userId: ObjectId, sessionName?: string): Promise<WorkoutSession>;
    endSession(sessionId: ObjectId): Promise<void>;
    addSessionExercise(sessionId: ObjectId, exerciseType: ExerciseType, targetSets: number, targetReps: number): Promise<SessionExercise>;
    addSet(setData: Omit<Set, '_id'>): Promise<Set>;
    getSetsBySessionExercise(sessionExerciseId: ObjectId): Promise<Set[]>;
    addRep(repData: Omit<Rep, '_id'>): Promise<Rep>;
    getUserWorkoutHistory(userId: ObjectId, limit?: number): Promise<WorkoutSession[]>;
    getExerciseProgress(userId: ObjectId, exerciseType: ExerciseType, days?: number): Promise<any[]>;
    getVBTThresholds(exerciseType: ExerciseType): Promise<VBTThreshold[]>;
    ping(): Promise<boolean>;
}
export declare function createDatabaseConfig(): DatabaseConfig;
//# sourceMappingURL=fitnessDatabase.d.ts.map