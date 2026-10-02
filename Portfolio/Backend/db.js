const mongoose = require('mongoose');
const dns = require('dns');

// If local DNS fails to resolve SRV records (common on ISPs and VPNs),
// override DNS servers for the Node process to use public Google & Cloudflare servers.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('⚠️ Warning: Failed to configure fallback DNS servers. Using system resolver:', dnsErr.message);
}

/**
 * Establishes a connection to MongoDB Atlas using Mongoose.
 * Prints detailed error diagnostics if the connection fails.
 */
const connectDB = async () => {
  const connUri = process.env.MONGODB_URI;

  if (!connUri) {
    console.error('❌ CRITICAL: MONGODB_URI environment variable is not defined in the .env file.');
    process.exit(1);
  }

  // Mask database credentials for secure logging
  const maskedUri = connUri.replace(/:([^:@]+)@/, ':****@');

  try {
    // Setup connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB Connected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB Connection Error at runtime:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB connection lost. Attempting to reconnect...');
    });

    // Connect to Atlas
    await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 8000, // Timeout connection after 8 seconds
    });

  } catch (error) {
    console.error('\n❌ MongoDB Connection Error:');
    console.error(`   URI: ${maskedUri}`);
    console.error(`   Error details: ${error.message}`);
    
    // Add context-specific diagnostic hints for common failure modes
    if (error.code === 'ETIMEOUT' || error.syscall === 'querySrv' || error.message.includes('ENOTFOUND')) {
      console.error('\n👉 DIAGNOSTIC TIP: DNS resolution timed out or hostname could not be found.');
      console.error('   This usually happens when:');
      console.error('   1. The cluster hostname in your MONGODB_URI is misspelled.');
      console.error('   2. The cluster was deleted or paused in MongoDB Atlas.');
      console.error('   3. Local firewall, VPN, or network security settings are blocking SRV queries or port 27017.');
    } else if (error.message.includes('bad auth') || error.message.includes('Authentication failed') || error.message.includes('auth failed')) {
      console.error('\n👉 DIAGNOSTIC TIP: Authentication failed.');
      console.error('   Ensure your MongoDB database user credentials (username and password) in MONGODB_URI are correct.');
      console.error('   If your password contains special characters (like @, :, /, or ?), make sure they are URL-encoded.');
    } else {
      console.error('\n👉 DIAGNOSTIC TIP: Network connection timed out. Check if your current IP address is whitelisted in MongoDB Atlas under Network Access.');
    }
    
    throw error; // Re-throw to prevent server startup
  }
};

module.exports = connectDB;
