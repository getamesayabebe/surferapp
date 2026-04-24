const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'admin@surfer.com';

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

// Middleware to verify Supabase session
async function verifySupabaseSession(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.substring(7);
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error) {
            req.user = null;
        } else {
            req.user = user;
        }
    } catch (error) {
        req.user = null;
    }
    next();
}

// Apply session verification to protected routes
app.use('/api/profile', verifySupabaseSession);
app.use('/api/auth-status', verifySupabaseSession);

// Auth status endpoint - verify Supabase session
app.get('/api/auth-status', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ signedIn: false });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.json({ signedIn: false });
        }

        // Check if user is banned (you can implement this in your Supabase database)
        const isBanned = user.email === 'banned@example.com'; // Replace with actual ban check

        res.json({
            signedIn: true,
            user: user.email,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            photo: user.user_metadata?.avatar_url || '',
            role: user.email === 'admin@surfer.com' ? 'admin' : 'user',
            banned: isBanned
        });
    } catch (error) {
        res.status(500).json({ error: 'Authentication check failed' });
    }
});

// Profile endpoint
app.get('/api/profile', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Get additional user data from Supabase if needed
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error('Profile fetch error:', error);
        }

        res.json({
            email: req.user.email,
            name: req.user.user_metadata?.full_name || req.user.email.split('@')[0],
            photo: req.user.user_metadata?.avatar_url || '',
            role: req.user.email === 'admin@surfer.com' ? 'admin' : 'user',
            banned: false, // Implement ban check
            profile: profile || null
        });
    } catch (error) {
        res.status(500).json({ error: 'Profile fetch failed' });
    }
});

// Update profile endpoint
app.put('/api/profile', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { name, photo } = req.body;

        // Update user metadata in Supabase Auth
        const { error: updateError } = await supabase.auth.updateUser({
            data: {
                full_name: name,
                avatar_url: photo
            }
        });

        if (updateError) {
            return res.status(400).json({ error: updateError.message });
        }

        // Update or insert profile in database
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: req.user.id,
                email: req.user.email,
                full_name: name,
                avatar_url: photo,
                updated_at: new Date().toISOString()
            });

        if (profileError) {
            console.error('Profile update error:', profileError);
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Profile update failed' });
    }
});

// Admin endpoints - get all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user || user.email !== 'admin@surfer.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get all users from Supabase Auth
        const { data: users, error } = await supabase.auth.admin.listUsers();

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        // Get profiles data
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('*');

        const safeUsers = users.users.map(u => {
            const profile = profiles?.find(p => p.id === u.id);
            return {
                id: u.id,
                email: u.email,
                name: u.user_metadata?.full_name || u.email.split('@')[0],
                photo: u.user_metadata?.avatar_url || '',
                role: u.email === 'admin@surfer.com' ? 'admin' : 'user',
                banned: false, // Implement ban logic
                created_at: u.created_at,
                last_sign_in: u.last_sign_in_at
            };
        });

        res.json({ users: safeUsers });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Admin endpoint - update user
app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user || user.email !== 'admin@surfer.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const targetId = req.params.id;
        const { name, photo } = req.body;

        // Update user metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(targetId, {
            user_metadata: {
                full_name: name,
                avatar_url: photo
            }
        });

        if (updateError) {
            return res.status(400).json({ error: updateError.message });
        }

        res.json({ message: 'User updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Admin endpoint - delete user
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user || user.email !== 'admin@surfer.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const targetId = req.params.id;

        // Don't allow deleting admin
        const { data: targetUser } = await supabase.auth.admin.getUserById(targetId);
        if (targetUser?.user?.email === 'admin@surfer.com') {
            return res.status(400).json({ error: 'Cannot delete admin account' });
        }

        const { error } = await supabase.auth.admin.deleteUser(targetId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Endpoint to handle contact form submission
app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Configure your email transporter
    // For Gmail, use an App Password (see: https://support.google.com/accounts/answer/185833)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'getadagim5@gmail.com', // Recipient and Sender
            pass: 'xcxd gogf gvab rbnq' // Replace with your actual Gmail App Password
        }
    });

    const mailOptions = {
        from: 'getadagim5@gmail.com',
        to: 'getadagim5@gmail.com',
        subject: `New Contact Message from ${name}`,
        text: `
Name: ${name}
Email: ${email}
Message: ${message}
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent from ${email} via /api/contact`);
        res.status(200).json({ message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send message. Please check your App Password.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Supabase URL: ${SUPABASE_URL ? 'Configured' : 'Not configured'}`);
    console.log(`Make sure to set your environment variables in .env file`);
});