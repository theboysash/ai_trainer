// src/fitnessDatabase.ts - MongoDB Schema for Fitness Trainer
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

// Remove the pymongo import - that's for Python, not TypeScript

export type ExerciseType = 
  | 'squats' 
  | 'shoulder_press' 
  | 'lateral_raise' 
  | 'front_raise' 
  | 'rear_delt_fly'
  | 'chest_press' 
  | 'push_ups' 
  | 'bicep_curl' 
  | 'tricep_extension' 
  | 'rows';

// User schema based on the provided database design
export interface User {
  _id?: ObjectId;
  name: string;
  age: number;
  weight: number; // kg
  height: number; // cm  
  training_experience: 'novice' | 'intermediate' | 'advanced';
  created_at: Date;
  updated_at: Date;
}

// Weight tracking over time
export interface WeightMeasurement {
  _id?: ObjectId;
  user_id: ObjectId;
  date_measured: Date;
  weight: number; // kg
}

// Exercise definitions
export interface Exercise {
  _id?: ObjectId;
  name: string;
  exercise_type: ExerciseType;
  muscle_group: string;
  equipment_needed?: string;
  instructions?: string;
  created_at: Date;
}

// Workout session
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

// Session exercises (exercises performed in a session)
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

// Individual sets
export interface Set {
  _id?: ObjectId;
  session_exercise_id: ObjectId;
  set_number: number;
  weight: number; // kg
  reps: number;
  avg_velocity_set: number; // m/s
  velocity_loss_pct: number; // percentage
  stop_reason: 'completed' | 'velocity_threshold' | 'form_breakdown' | 'manual';
  form_score?: number; // 0-100
  started_at: Date;
  completed_at: Date;
}

// Individual reps within sets
export interface Rep {
  _id?: ObjectId;
  set_id: ObjectId;
  rep_number: number;
  peak_velocity: number; // m/s
  avg_velocity: number; // m/s
  rom_degrees: number; // range of motion
  form_score?: number; // 0-100
  timestamp: Date;
}

// VBT thresholds for different training zones
export interface VBTThreshold {
  _id?: ObjectId;
  exercise_type: ExerciseType;
  training_zone: 'power' | 'strength' | 'hypertrophy' | 'endurance';
  min_velocity: number; // m/s
  max_velocity: number; // m/s
  velocity_loss_threshold: number; // percentage
}

// Database configuration
export interface DatabaseConfig {
  connectionString: string;
  databaseName: string;
  options?: {
    maxPoolSize?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
  };
}

export class FitnessDatabase {
  private client: MongoClient;
  private db: Db | null = null;
  private connectionString: string;
  private databaseName: string;

  // Collections
  private users?: Collection<User>;
  private weightMeasurements?: Collection<WeightMeasurement>;
  private exercises?: Collection<Exercise>;
  private workoutSessions?: Collection<WorkoutSession>;
  private sessionExercises?: Collection<SessionExercise>;
  private sets?: Collection<Set>;
  private reps?: Collection<Rep>;
  private vbtThresholds?: Collection<VBTThreshold>;

  constructor(connectionString: string, databaseName: string) {
    this.connectionString = connectionString;
    this.databaseName = databaseName;
    this.client = new MongoClient(connectionString, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }

  async connect(): Promise<boolean> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      
      // Initialize collections
      this.users = this.db.collection<User>('users');
      this.weightMeasurements = this.db.collection<WeightMeasurement>('weight_measurements');
      this.exercises = this.db.collection<Exercise>('exercises');
      this.workoutSessions = this.db.collection<WorkoutSession>('workout_sessions');
      this.sessionExercises = this.db.collection<SessionExercise>('session_exercises');
      this.sets = this.db.collection<Set>('sets');
      this.reps = this.db.collection<Rep>('reps');
      this.vbtThresholds = this.db.collection<VBTThreshold>('vbt_thresholds');

      // Create indexes for better performance
      await this.createIndexes();
      
      // Seed default data
      await this.seedDefaultData();
      
      console.log('Connected to MongoDB successfully');
      return true;
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // User indexes
      await this.users?.createIndex({ name: 1 });
      
      // Session indexes
      await this.workoutSessions?.createIndex({ user_id: 1, started_at: -1 });
      
      // Set indexes for performance queries
      await this.sets?.createIndex({ session_exercise_id: 1, set_number: 1 });
      
      // Rep indexes
      await this.reps?.createIndex({ set_id: 1, rep_number: 1 });
      
      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }

  private async seedDefaultData(): Promise<void> {
    try {
      // Seed exercises if they don't exist
      const exerciseCount = await this.exercises?.countDocuments();
      if (exerciseCount === 0) {
        const defaultExercises: Exercise[] = [
          { name: 'Squats', exercise_type: 'squats', muscle_group: 'legs', created_at: new Date() },
          { name: 'Shoulder Press', exercise_type: 'shoulder_press', muscle_group: 'shoulders', created_at: new Date() },
          { name: 'Lateral Raise', exercise_type: 'lateral_raise', muscle_group: 'shoulders', created_at: new Date() },
          { name: 'Front Raise', exercise_type: 'front_raise', muscle_group: 'shoulders', created_at: new Date() },
          { name: 'Rear Delt Fly', exercise_type: 'rear_delt_fly', muscle_group: 'shoulders', created_at: new Date() },
          { name: 'Chest Press', exercise_type: 'chest_press', muscle_group: 'chest', created_at: new Date() },
          { name: 'Push Ups', exercise_type: 'push_ups', muscle_group: 'chest', created_at: new Date() },
          { name: 'Bicep Curl', exercise_type: 'bicep_curl', muscle_group: 'arms', created_at: new Date() },
          { name: 'Tricep Extension', exercise_type: 'tricep_extension', muscle_group: 'arms', created_at: new Date() },
          { name: 'Rows', exercise_type: 'rows', muscle_group: 'back', created_at: new Date() }
        ];
        
        await this.exercises?.insertMany(defaultExercises);
        console.log('Default exercises seeded');
      }

      // Seed VBT thresholds
      const thresholdCount = await this.vbtThresholds?.countDocuments();
      if (thresholdCount === 0) {
        const defaultThresholds: VBTThreshold[] = [
          { exercise_type: 'shoulder_press', training_zone: 'power', min_velocity: 0.3, max_velocity: 1.0, velocity_loss_threshold: 15 },
          { exercise_type: 'shoulder_press', training_zone: 'strength', min_velocity: 0.25, max_velocity: 0.4, velocity_loss_threshold: 20 },
          { exercise_type: 'shoulder_press', training_zone: 'hypertrophy', min_velocity: 0.15, max_velocity: 0.3, velocity_loss_threshold: 25 },
          // Add more as needed...
        ];
        
        await this.vbtThresholds?.insertMany(defaultThresholds);
        console.log('Default VBT thresholds seeded');
      }
    } catch (error) {
      console.error('Error seeding default data:', error);
    }
  }

  // User operations
  async createUser(userData: Omit<User, '_id' | 'created_at' | 'updated_at'>): Promise<User> {
    const user: User = {
      ...userData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await this.users?.insertOne(user);
    return { ...user, _id: result?.insertedId };
  }

  async getUserById(userId: ObjectId): Promise<User | null> {
    return await this.users?.findOne({ _id: userId }) || null;
  }

  async updateUser(userId: ObjectId, updates: Partial<User>): Promise<void> {
    await this.users?.updateOne(
      { _id: userId },
      { $set: { ...updates, updated_at: new Date() } }
    );
  }

  // Session operations
  async startSession(userId: ObjectId, sessionName?: string): Promise<WorkoutSession> {
    const session: WorkoutSession = {
      user_id: userId,
      session_name: sessionName,
      started_at: new Date(),
      created_at: new Date()
    };
    
    const result = await this.workoutSessions?.insertOne(session);
    return { ...session, _id: result?.insertedId };
  }

  async endSession(sessionId: ObjectId): Promise<void> {
    const session = await this.workoutSessions?.findOne({ _id: sessionId });
    if (session) {
      const duration = Math.floor((Date.now() - session.started_at.getTime()) / 1000);
      await this.workoutSessions?.updateOne(
        { _id: sessionId },
        { 
          $set: { 
            ended_at: new Date(),
            total_duration_seconds: duration
          }
        }
      );
    }
  }

  // Exercise operations
  async addSessionExercise(sessionId: ObjectId, exerciseType: ExerciseType, targetSets: number, targetReps: number): Promise<SessionExercise> {
    const exercise = await this.exercises?.findOne({ exercise_type: exerciseType });
    if (!exercise) {
      throw new Error(`Exercise ${exerciseType} not found`);
    }

    const sessionExercise: SessionExercise = {
      session_id: sessionId,
      exercise_id: exercise._id!,
      exercise_type: exerciseType,
      order_in_session: 1, // You might want to calculate this
      target_sets: targetSets,
      target_reps: targetReps,
      started_at: new Date()
    };

    const result = await this.sessionExercises?.insertOne(sessionExercise);
    return { ...sessionExercise, _id: result?.insertedId };
  }

  // Set operations
  async addSet(setData: Omit<Set, '_id'>): Promise<Set> {
    const result = await this.sets?.insertOne(setData);
    return { ...setData, _id: result?.insertedId };
  }

  async getSetsBySessionExercise(sessionExerciseId: ObjectId): Promise<Set[]> {
    return await this.sets?.find({ session_exercise_id: sessionExerciseId }).toArray() || [];
  }

  // Rep operations
  async addRep(repData: Omit<Rep, '_id'>): Promise<Rep> {
    const result = await this.reps?.insertOne(repData);
    return { ...repData, _id: result?.insertedId };
  }

  // Analytics queries
  async getUserWorkoutHistory(userId: ObjectId, limit: number = 10): Promise<WorkoutSession[]> {
    return await this.workoutSessions?.find({ user_id: userId })
      .sort({ started_at: -1 })
      .limit(limit)
      .toArray() || [];
  }

  async getExerciseProgress(userId: ObjectId, exerciseType: ExerciseType, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // This would need an aggregation pipeline to join collections
    // Simplified version for now
    const sessions = await this.workoutSessions?.find({
      user_id: userId,
      started_at: { $gte: startDate }
    }).toArray() || [];

    return sessions; // You'd want to join with sets and exercises here
  }

  async getVBTThresholds(exerciseType: ExerciseType): Promise<VBTThreshold[]> {
    return await this.vbtThresholds?.find({ exercise_type: exerciseType }).toArray() || [];
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      await this.db?.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Factory function to create database configuration
export function createDatabaseConfig(): DatabaseConfig {
  // Load environment variables
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    databaseName: process.env.DB_NAME || 'velocity_coach_fitness',
    options: {
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '') || (isProduction ? 20 : 5),
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT || '') || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT || '') || 45000,
    }
  };
}

// Export types for use in other modules
