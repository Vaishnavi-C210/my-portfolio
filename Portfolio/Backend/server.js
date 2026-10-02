const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./db');
const Contact = require('./models/Contact');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Middlewares
app.use(cors());
app.use(express.json());

// 2. Handle clean shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

// 3. API Endpoints

// Server status health check
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'UP',
    database: isConnected ? 'CONNECTED' : 'DISCONNECTED',
    timestamp: new Date()
  });
});

// Contact Form submission POST endpoint
app.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    // 4. Manual Validation Checks (consistent with previous design)
    const errors = [];
    if (!name || typeof name !== 'string' || !name.trim()) {
      errors.push('Name is required');
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        errors.push('Please provide a valid email address');
      }
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      errors.push('Message is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }

    // Ensure database is active before inserting
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database connection is not established.'
      });
    }

    // Use the Contact model to save submissions
    const newContact = new Contact({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject ? subject.trim() : '',
      message: message.trim()
    });

    const savedContact = await newContact.save();

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received successfully.',
      data: {
        id: savedContact._id,
        name: savedContact.name,
        email: savedContact.email,
        createdAt: savedContact.createdAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// 5. Catch-all Route for 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// 6. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 7. Establish Connection and Start Server
const startServer = async () => {
  try {
    // Wait for database connection first
    await connectDB();
    
    // Start listening only when connected
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start the server due to database connection issue.');
    process.exit(1);
  }
};

startServer();
