// scripts/test-connection.ts
import dotenv from 'dotenv';
import { FitnessDatabase, createDatabaseConfig } from '../src/fitnessDatabase.js';
// Load environment variables
dotenv.config();
async function testConnection() {
    try {
        console.log('🔍 Testing MongoDB connection...');
        console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
        const config = createDatabaseConfig();
        // Don't expose the full connection string for security
        const maskedUri = config.connectionString.replace(/\/\/.*@/, '//***:***@');
        console.log('📡 Connecting to:', maskedUri);
        console.log('📊 Database:', config.databaseName);
        const db = new FitnessDatabase(config.connectionString, config.databaseName);
        console.log('⏳ Attempting connection...');
        const connected = await db.connect();
        if (connected) {
            console.log('✅ Connection successful!');
            // Test ping
            console.log('⏳ Testing database ping...');
            const isAlive = await db.ping();
            console.log('🏓 Database ping:', isAlive ? '✅ SUCCESS' : '❌ FAILED');
            if (isAlive) {
                // Create a test user
                console.log('⏳ Creating test user...');
                const testUser = await db.createUser({
                    name: 'Test User ' + Date.now(),
                    age: 25,
                    weight: 70,
                    height: 175,
                    training_experience: 'intermediate'
                });
                console.log('👤 Test user created:', testUser.name);
                console.log('🆔 User ID:', testUser._id);
                // Test session creation
                console.log('⏳ Testing session creation...');
                const testSession = await db.startSession(testUser._id, 'Test Session');
                console.log('🏋️ Test session created:', testSession._id);
                // End session
                await db.endSession(testSession._id);
                console.log('✅ Test session completed');
            }
            // Clean up connection
            await db.disconnect();
            console.log('🔌 Connection closed successfully');
            console.log('\n🎉 All database tests passed!');
        }
        else {
            console.error('❌ Connection failed');
            console.log('\n🔧 Troubleshooting tips:');
            console.log('1. Check your MONGODB_URI in .env file');
            console.log('2. Verify network access (IP whitelist for Atlas)');
            console.log('3. Check username/password credentials');
            console.log('4. Ensure MongoDB service is running (for local)');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('❌ Connection test failed with error:');
        console.error(error);
        // Provide specific error guidance
        if (error instanceof Error) {
            if (error.message.includes('authentication failed')) {
                console.log('\n🔧 Authentication Error - Check:');
                console.log('- Username and password in MONGODB_URI');
                console.log('- User permissions in MongoDB Atlas');
            }
            else if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
                console.log('\n🔧 Connection Error - Check:');
                console.log('- Internet connection');
                console.log('- MongoDB Atlas cluster status');
                console.log('- Network access settings (IP whitelist)');
            }
            else if (error.message.includes('Unknown file extension')) {
                console.log('\n🔧 TypeScript Error - Run:');
                console.log('npm run db:test');
            }
        }
        process.exit(1);
    }
}
// Run the test
testConnection().catch(console.error);
//# sourceMappingURL=test-connection.js.map