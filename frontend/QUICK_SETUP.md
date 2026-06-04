# 🚀 Quick Clerk Setup Guide

## Step 1: Get Your Clerk Publishable Key

1. **Sign up for Clerk**: Go to [https://clerk.com](https://clerk.com) and create a free account
2. **Create Application**: 
   - Click "Add Application" 
   - Choose "React" as the framework
   - Give it a name like "RetailPulse Medical"
3. **Get Your Key**:
   - Navigate to **API Keys** in your Clerk dashboard
   - Copy the **Publishable Key** (starts with `pk_test_` for development)

## Step 2: Update Your Application

1. Open `src/main.jsx` in your editor
2. Replace line 10:
   ```javascript
   // FROM:
   const clerkPubKey = "pk_test_YOUR_CLERK_PUBLISHABLE_KEY_HERE";
   
   // TO:
   const clerkPubKey = "pk_test_your_actual_copied_key_here";
   ```

## Step 3: Configure Allowed URLs

In your Clerk Dashboard, add these URLs to **Allowed Origins**:

**Development URLs:**
- `http://localhost:5175`
- `http://localhost:5173`
- `http://localhost:3000`

**Production URLs (when deployed):**
- `https://your-domain.com`

## Step 4: Restart the Application

The browser will automatically reload, or you can:
- Refresh the page
- Or restart the dev server: `npm run dev`

## 🎉 You're Done!

Now you can:
- ✅ Sign up new users
- ✅ Sign in existing users  
- ✅ Access protected routes
- ✅ See user profile in navbar
- ✅ Sign out functionality

## 🔧 Troubleshooting

**Error: "Invalid publishable key"**
- Double-check you copied the full key (starts with `pk_test_`)
- Make sure there are no extra spaces

**Error: "Origin not allowed"**
- Add your localhost URL to Clerk dashboard
- Wait 1-2 minutes for changes to take effect

**Still having issues?**
- Check the full setup guide: `CLERK_SETUP.md`
- Visit [Clerk Documentation](https://clerk.com/docs)

## 🎯 Test Your Authentication

1. Go to `http://localhost:5175`
2. Click "Sign up" to create a test account
3. Try signing in
4. Access protected routes like `/dashboard`
5. Test the sign out functionality

---

**Need help?** Clerk has excellent documentation and support at [clerk.com/docs](https://clerk.com/docs)
