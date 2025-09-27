// src/fitnessDatabase.ts - MongoDB Schema for Fitness Trainer
import { MongoClient } from 'mongodb';
export class FitnessDatabase {
    client;
    db = null;
    connectionString;
    databaseName;
    // Collections
    users;
    weightMeasurements;
    exercises;
    workoutSessions;
    sessionExercises;
    sets;
    reps;
    vbtThresholds;
    constructor(connectionString, databaseName) {
        this.connectionString = connectionString;
        this.databaseName = databaseName;
        this.client = new MongoClient(connectionString, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
    }
    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db(this.databaseName);
            // Initialize collections
            this.users = this.db.collection('users');
            this.weightMeasurements = this.db.collection('weight_measurements');
            this.exercises = this.db.collection('exercises');
            this.workoutSessions = this.db.collection('workout_sessions');
            this.sessionExercises = this.db.collection('session_exercises');
            this.sets = this.db.collection('sets');
            this.reps = this.db.collection('reps');
            this.vbtThresholds = this.db.collection('vbt_thresholds');
            // Create indexes for better performance
            await this.createIndexes();
            // Seed default data
            await this.seedDefaultData();
            console.log('Connected to MongoDB successfully');
            return true;
        }
        catch (error) {
            console.error('MongoDB connection failed:', error);
            return false;
        }
    }
    async disconnect() {
        try {
            await this.client.close();
            console.log('Disconnected from MongoDB');
        }
        catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
        }
    }
    async createIndexes() {
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
        }
        catch (error) {
            console.error('Error creating indexes:', error);
        }
    }
    async seedDefaultData() {
        try {
            // Seed exercises if they don't exist
            const exerciseCount = await this.exercises?.countDocuments();
            if (exerciseCount === 0) {
                const defaultExercises = [
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
                const defaultThresholds = [
                    { exercise_type: 'shoulder_press', training_zone: 'power', min_velocity: 0.3, max_velocity: 1.0, velocity_loss_threshold: 15 },
                    { exercise_type: 'shoulder_press', training_zone: 'strength', min_velocity: 0.25, max_velocity: 0.4, velocity_loss_threshold: 20 },
                    { exercise_type: 'shoulder_press', training_zone: 'hypertrophy', min_velocity: 0.15, max_velocity: 0.3, velocity_loss_threshold: 25 },
                    // Add more as needed...
                ];
                await this.vbtThresholds?.insertMany(defaultThresholds);
                console.log('Default VBT thresholds seeded');
            }
        }
        catch (error) {
            console.error('Error seeding default data:', error);
        }
    }
    // User operations
    async createUser(userData) {
        const user = {
            ...userData,
            created_at: new Date(),
            updated_at: new Date()
        };
        const result = await this.users?.insertOne(user);
        return { ...user, _id: result?.insertedId };
    }
    async getUserById(userId) {
        return await this.users?.findOne({ _id: userId }) || null;
    }
    async updateUser(userId, updates) {
        await this.users?.updateOne({ _id: userId }, { $set: { ...updates, updated_at: new Date() } });
    }
    // Session operations
    async startSession(userId, sessionName) {
        const session = {
            user_id: userId,
            session_name: sessionName,
            started_at: new Date(),
            created_at: new Date()
        };
        const result = await this.workoutSessions?.insertOne(session);
        return { ...session, _id: result?.insertedId };
    }
    async endSession(sessionId) {
        const session = await this.workoutSessions?.findOne({ _id: sessionId });
        if (session) {
            const duration = Math.floor((Date.now() - session.started_at.getTime()) / 1000);
            await this.workoutSessions?.updateOne({ _id: sessionId }, {
                $set: {
                    ended_at: new Date(),
                    total_duration_seconds: duration
                }
            });
        }
    }
    // Exercise operations
    async addSessionExercise(sessionId, exerciseType, targetSets, targetReps) {
        const exercise = await this.exercises?.findOne({ exercise_type: exerciseType });
        if (!exercise) {
            throw new Error(`Exercise ${exerciseType} not found`);
        }
        const sessionExercise = {
            session_id: sessionId,
            exercise_id: exercise._id,
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
    async addSet(setData) {
        const result = await this.sets?.insertOne(setData);
        return { ...setData, _id: result?.insertedId };
    }
    async getSetsBySessionExercise(sessionExerciseId) {
        return await this.sets?.find({ session_exercise_id: sessionExerciseId }).toArray() || [];
    }
    // Rep operations
    async addRep(repData) {
        const result = await this.reps?.insertOne(repData);
        return { ...repData, _id: result?.insertedId };
    }
    // Analytics queries
    async getUserWorkoutHistory(userId, limit = 10) {
        return await this.workoutSessions?.find({ user_id: userId })
            .sort({ started_at: -1 })
            .limit(limit)
            .toArray() || [];
    }
    async getExerciseProgress(userId, exerciseType, days = 30) {
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
    async getVBTThresholds(exerciseType) {
        return await this.vbtThresholds?.find({ exercise_type: exerciseType }).toArray() || [];
    }
    // Health check
    async ping() {
        try {
            await this.db?.admin().ping();
            return true;
        }
        catch {
            return false;
        }
    }
}
// Factory function to create database configuration
export function createDatabaseConfig() {
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
//# sourceMappingURL=fitnessDatabase.js.map