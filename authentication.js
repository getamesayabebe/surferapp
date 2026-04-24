// authentication.js - Client-side authentication using Supabase

// Supabase configuration - Replace these with your actual values
const SUPABASE_URL = 'https://xzuwwrsvolibcqwofcuv.supabase.co'; // Replace with your Supabase project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXd3cnN2b2xpYmNxd29mY3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODU4NzEsImV4cCI6MjA5MTY2MTg3MX0.gXN2KKFtpQ8-S1xK8f0QBQ4JIBU2bqygA7sBv9wM_c4'; // Replace with your Supabase anon key

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Expose client globally so other pages can use it directly
window.supabaseClient = supabaseClient;

// Authentication functions
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentSession = null;
        // Store the initialization promise so other pages can await readiness
        this.ready = this.init();
    }

    async init() {
        // Get initial session
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Error getting session:', error);
        }

        this.currentSession = session;
        this.currentUser = session?.user || null;
        this.updateUI();

        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.email);

            this.currentSession = session;
            this.currentUser = session?.user || null;
            this.updateUI();

            if (event === 'SIGNED_IN' && session) {
                const path = window.location.pathname;
                const isAuthPage = path.includes('signin.html') || path.includes('signup.html') || path === '/' || path.endsWith('index.html');
                
                if (isAuthPage) {
                    this.showMessage('Successfully signed in!', 'success');
                    // Redirect after successful sign in
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                }
            } else if (event === 'SIGNED_OUT') {
                const path = window.location.pathname;
                // Only show "signed out" if they weren't already on the signin page
                if (!path.includes('signin.html')) {
                    this.showMessage('Successfully signed out!', 'success');
                    window.location.href = 'signin.html';
                }
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('Token refreshed');
            }
        });

        // Add sign out event listeners after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.attachSignOutListeners());
        } else {
            this.attachSignOutListeners();
        }
    }

    attachSignOutListeners() {
        // Use event delegation for maximum robustness
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#desktopSignOutBtn, #mobileSignOutBtn, #signOutBtn');
            if (btn) {
                e.preventDefault();
                console.log('Sign out button clicked via delegation');
                this.signOut();
            }
        });

        // Also try direct attachment for any existing buttons
        const ids = ['desktopSignOutBtn', 'mobileSignOutBtn', 'signOutBtn'];
        ids.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    console.log('Sign out button clicked via direct onclick');
                    this.signOut();
                };
            }
        });
    }

    async signUp(email, password, fullName) {
        try {
            this.showMessage('Creating account...', 'info');

            const { data, error } = await supabaseClient.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                    }
                }
            });

            if (error) throw error;

            this.showMessage('OTP sent! Please check your email.', 'success');
            return { success: true, data };
        } catch (error) {
            console.error('Signup error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error };
        }
    }

    async verifyOTP(email, token) {
        try {
            this.showMessage('Verifying code...', 'info');

            const { data, error } = await supabaseClient.auth.verifyOtp({
                email: email.trim(),
                token: token.trim(),
                type: 'signup'
            });

            if (error) throw error;

            this.showMessage('Email verified successfully!', 'success');
            return { success: true, data };
        } catch (error) {
            console.error('OTP verification error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error };
        }
    }

    async resendOTP(email) {
        try {
            this.showMessage('Resending code...', 'info');
            const { error } = await supabaseClient.auth.resend({
                type: 'signup',
                email: email.trim(),
            });

            if (error) throw error;

            this.showMessage('New code sent to your email!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Resend error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error };
        }
    }

    async signIn(email, password) {
        try {
            this.showMessage('Signing in...', 'info');

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email.trim(),
                password
            });

            if (error) throw error;

            return { success: true, data };
        } catch (error) {
            console.error('Signin error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error };
        }
    }

    async signOut() {
        try {
            console.log('Initiating sign out...');
            this.showMessage('Signing out...', 'info');

            // Clear local user data first to be safe
            this.currentUser = null;
            this.currentSession = null;

            // Attempt Supabase sign out
            try {
                await supabaseClient.auth.signOut();
            } catch (err) {
                console.warn('Supabase sign out error (ignoring):', err);
            }

            // Clear any lingering surfer-related local storage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('sb-') || key.startsWith('supabase.auth.'))) {
                    localStorage.removeItem(key);
                }
            }

            console.log('Sign out complete, redirecting...');
            this.updateUI();

            // Force redirect immediately
            window.location.href = 'signin.html';

            return { success: true };
        } catch (error) {
            console.error('Signout error:', error);
            this.showMessage(error.message, 'error');
            // Even on error, try to redirect
            window.location.href = 'signin.html';
            return { success: false, error };
        }
    }

    async resetPassword(email) {
        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
            });

            if (error) throw error;

            this.showMessage('Password reset email sent!', 'success');
            return { success: true };
        } catch (error) {
            this.showMessage(error.message, 'error');
            return { success: false, error };
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getCurrentSession() {
        return this.currentSession;
    }

    getAuthToken() {
        return this.currentSession?.access_token;
    }

    isAuthenticated() {
        return !!this.currentUser && !!this.currentSession;
    }

    // Get auth headers for API calls
    getAuthHeaders() {
        const token = this.getAuthToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    updateUI() {
        // Re-attach listeners whenever UI updates (buttons might have been hidden/shown)
        this.attachSignOutListeners();

        // Update navigation based on auth status
        const desktopLogInBtn = document.getElementById('desktopLogInBtn');
        const desktopSignUpBtn = document.getElementById('desktopSignUpBtn');
        const desktopAccountBtn = document.getElementById('desktopAccountBtn');
        const desktopAdminBtn = document.getElementById('desktopAdminBtn');
        const desktopSignOutBtn = document.getElementById('desktopSignOutBtn');

        const mobileLogInBtn = document.getElementById('mobileLogInBtn');
        const mobileSignUpBtn = document.getElementById('mobileSignUpBtn');
        const mobileAccountBtn = document.getElementById('mobileAccountBtn');
        const mobileAdminBtn = document.getElementById('mobileAdminBtn');
        const mobileSignOutBtn = document.getElementById('mobileSignOutBtn');

        if (this.isAuthenticated()) {
            // Hide login/signup buttons
            if (desktopLogInBtn) desktopLogInBtn.classList.add('hidden');
            if (desktopSignUpBtn) desktopSignUpBtn.classList.add('hidden');
            if (mobileLogInBtn) mobileLogInBtn.classList.add('hidden');
            if (mobileSignUpBtn) mobileSignUpBtn.classList.add('hidden');

            // Show account and sign out buttons
            if (desktopAccountBtn) {
                desktopAccountBtn.classList.remove('hidden');
                desktopAccountBtn.classList.add('flex'); // Ensure it uses flex for layout
                const nameSpan = document.getElementById('desktopAccountName');
                const photoImg = document.getElementById('desktopAccountPhoto');
                if (nameSpan) nameSpan.textContent = this.currentUser.user_metadata?.full_name || this.currentUser.email;
                if (photoImg) photoImg.src = this.currentUser.user_metadata?.avatar_url || `https://placehold.co/200x200/4f46e5/ffffff?text=${(this.currentUser.email || 'A').charAt(0).toUpperCase()}`;
            }

            if (mobileAccountBtn) {
                mobileAccountBtn.classList.remove('hidden');
                mobileAccountBtn.classList.add('flex'); // Ensure it uses flex for layout
                const nameSpan = document.getElementById('mobileAccountName');
                const photoImg = document.getElementById('mobileAccountPhoto');
                if (nameSpan) nameSpan.textContent = this.currentUser.user_metadata?.full_name || this.currentUser.email;
                if (photoImg) photoImg.src = this.currentUser.user_metadata?.avatar_url || `https://placehold.co/200x200/4f46e5/ffffff?text=${(this.currentUser.email || 'A').charAt(0).toUpperCase()}`;
            }

            if (desktopSignOutBtn) {
                desktopSignOutBtn.classList.remove('hidden');
                // Use the class that was already there or default to inline-block
                if (!desktopSignOutBtn.classList.contains('inline-flex') && !desktopSignOutBtn.classList.contains('block')) {
                    desktopSignOutBtn.classList.add('inline-block');
                }
            }
            if (mobileSignOutBtn) {
                mobileSignOutBtn.classList.remove('hidden');
                if (!mobileSignOutBtn.classList.contains('block')) {
                    mobileSignOutBtn.classList.add('block');
                }
            }

            // Show admin button if user is admin
            if (this.currentUser.email === 'admin@surfer.com') {
                if (desktopAdminBtn) desktopAdminBtn.classList.remove('hidden');
                if (mobileAdminBtn) mobileAdminBtn.classList.remove('hidden');
            }
        } else {
            // Show login/signup buttons
            if (desktopLogInBtn) desktopLogInBtn.classList.remove('hidden');
            if (desktopSignUpBtn) desktopSignUpBtn.classList.remove('hidden');
            if (mobileLogInBtn) mobileLogInBtn.classList.remove('hidden');
            if (mobileSignUpBtn) mobileSignUpBtn.classList.remove('hidden');

            // Hide account and sign out buttons
            if (desktopAccountBtn) desktopAccountBtn.classList.add('hidden');
            if (mobileAccountBtn) mobileAccountBtn.classList.add('hidden');
            if (desktopSignOutBtn) desktopSignOutBtn.classList.add('hidden');
            if (mobileSignOutBtn) mobileSignOutBtn.classList.add('hidden');
            if (desktopAdminBtn) desktopAdminBtn.classList.add('hidden');
            if (mobileAdminBtn) mobileAdminBtn.classList.add('hidden');
        }
    }

    showMessage(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-[1000] px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg ${
            type === 'success' ? 'bg-green-600' :
            type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Create global auth instance
const auth = new AuthManager();

// Make auth available globally
window.auth = auth;

// Global force sign out function for extreme reliability
window.forceSignOut = () => {
    if (window.auth) {
        window.auth.signOut();
    } else {
        // Fallback if auth instance isn't ready
        localStorage.clear();
        window.location.href = 'signin.html';
    }
};