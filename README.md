# Supabase Authentication Setup

This project uses Supabase for authentication. Follow these steps to set it up:

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be set up (this may take a few minutes)

## 2. Get Your Project Credentials

1. In your Supabase dashboard, go to Settings → API
2. Copy the following values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon/Public Key**: Your public anon key
   - **Service Role Key**: Your service role key (keep this secret!)

## 3. Configure Environment Variables

Update the `.env` file in your project root:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here

# Session Secret (generate a random string)
SESSION_SECRET=your_random_secret_string_here

# Email Configuration (optional, for contact form)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
```

## 4. Set Up Database Schema

1. In your Supabase dashboard, go to the SQL Editor
2. Run the SQL commands from `supabase-setup.sql` to create the necessary tables and policies

## 5. Configure Authentication Settings

In your Supabase dashboard:

1. Go to Authentication → Settings
2. Configure:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Redirect URLs**: Add `http://localhost:3000` and your production URL
3. **Email Templates**: Customize the email confirmation and password reset templates if desired

## 6. Update Client-Side Configuration

Update `authentication.js`:

```javascript
// Replace these with your actual values
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your_actual_anon_key_here';
```

## 7. Install Dependencies and Start

```bash
npm install
npm start
```

## 8. Test Authentication

1. Open your browser to `http://localhost:3000`
2. Try signing up with a real email address
3. Check your email for the confirmation link
4. Try signing in after confirming your email

## Features Included

- ✅ User registration with email confirmation
- ✅ User login/logout
- ✅ Password reset functionality
- ✅ Protected routes with JWT tokens
- ✅ User profile management
- ✅ Admin user management (for admin@surfer.com)
- ✅ Automatic profile creation on signup
- ✅ Row Level Security (RLS) policies

## Important Notes

- **Security**: Never commit your `.env` file or expose your service role key
- **Email Confirmation**: By default, Supabase requires email confirmation. You can disable this in Authentication → Settings if needed for development
- **Admin User**: The email `admin@surfer.com` is treated as an admin user with special privileges
- **CORS**: The server is configured to allow requests from any origin for development

## Troubleshooting

- **Auth not working**: Check that your Supabase URL and keys are correct
- **Database errors**: Make sure you've run the SQL setup script
- **Email not sending**: Check your Supabase email settings
- **CORS errors**: Ensure your Supabase site URL matches your development server

## Production Deployment

When deploying to production:

1. Update the Supabase site URL and redirect URLs
2. Set secure environment variables
3. Enable HTTPS
4. Consider enabling additional security features in Supabase