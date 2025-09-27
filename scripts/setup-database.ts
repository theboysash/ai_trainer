// scripts/setup-database.ts
import dotenv from 'dotenv';
import { FitnessDatabase, createDatabaseConfig } from '../src/fitnessDatabase.js';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  try {
    console.log('🚀 Setting up VelocityCoach AI Database...');
    console.log('=====================================');
    
    const config = createDatabaseConfig();
    
    // Don't expose sensitive connection details
    const maskedUri = config.connectionString.replace(/\/\/.*@/, '//***:***@');
    console.log('📡 Target:', maskedUri);
    console.log('📊 Database:', config.databaseName);
    console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
    
    const db = new FitnessDatabase(config.connectionString, config.databaseName);
    
    console.log('\n⏳ Connecting to MongoDB...');
    const connected = await db.connect();
    
    if (connected) {
      console.log('✅ Connected to MongoDB successfully!');
      console.log('✅ Collections created and indexed');
      console.log('✅ Default exercise data seeded');
      console.log('✅ VBT thresholds configured');
      
      // Test basic operations
      console.log('\n⏳ Testing basic operations...');
      
      // Create a demo user
      const demoUser = await db.createUser({
        name: 'VelocityCoach Demo User',
        age: 28,
        weight: 75,
        height: 180,
        training_experience: 'intermediate'
      });
      console.log('👤 Demo user created:', demoUser.name);
      
      // Create a test session
      const demoSession = await db.startSession(demoUser._id!, 'Setup Test Session');
      console.log('🏋️ Demo session created');
      
      // Add a test exercise
      const sessionExercise = await db.addSessionExercise(
        demoSession._id!,
        'shoulder_press',
        3,
        8
      );
      console.log('💪 Exercise added to session');
      
      // End the session
      await db.endSession(demoSession._id!);
      console.log('✅ Demo session completed');
      
      console.log('\n📊 Database Statistics:');
      // You could add collection count queries here
      
    } else {
      console.error('❌ Failed to connect to database');
      console.log('\n🔧 Setup failed. Please check:');
      console.log('1. MONGODB_URI in your .env file');
      console.log('2. Network connectivity');
      console.log('3. MongoDB Atlas configuration (if using Atlas)');
      process.exit(1);
    }
    
    await db.disconnect();
    console.log('\n🎉 Database setup completed successfully!');
    console.log('=====================================');
    console.log('Your VelocityCoach AI database is ready to use.');
    console.log('\nNext steps:');
    console.log('1. Run: npm run db:test (to verify everything works)');
    console.log('2. Start your application: npm run dev');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:');
    console.error(error);
    
    if (error instanceof Error) {
      if (error.message.includes('authentication')) {
        console.log('\n💡 Try: Check your MongoDB credentials');
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        console.log('\n💡 Try: Check your internet connection and MongoDB Atlas settings');
      }
    }
    
    console.log('\n🔧 For help, check the MongoDB setup guide in the documentation.');
    process.exit(1);
  }
}

// Run the setup
setupDatabase().catch(console.error);