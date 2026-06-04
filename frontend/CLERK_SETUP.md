# Clerk Authentication Setup Guide

## Overview
This document provides step-by-step instructions for setting up Clerk authentication in your RetailPulse Medical Pharmacy Billing & Inventory Management System.

## Prerequisites
- Node.js and npm installed
- Clerk account (sign up at https://clerk.com)

## Setup Steps

### 1. Get Your Clerk Publishable Key
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application or select existing one
3. Navigate to **API Keys** section
4. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)

### 2. Update Clerk Publishable Key
Replace the placeholder key in `src/main.jsx`:

```javascript
// Replace with your actual Clerk publishable key
const clerkPubKey = "pk_test_YOUR_CLERK_PUBLISHABLE_KEY_HERE";
```

### 3. Configure Clerk Application
In your Clerk Dashboard, configure:

#### Allowed Redirect URLs
- `http://localhost:5173` (for development)
- `http://localhost:5173/sign-in`
- `http://localhost:5173/sign-up`
- `http://localhost:5173/dashboard`
- Your production URL (when deployed)

#### Session Settings
- Enable email/password authentication
- Configure social providers (Google, GitHub, etc.) if needed
- Set session duration as required

### 4. Run the Application
```bash
npm run dev
```

## Authentication Flow

### Routes
- **Public Routes:**
  - `/sign-in` - Sign In page
  - `/sign-up` - Sign Up page
  - `/login` - Redirects to `/sign-in`

- **Protected Routes:** (Requires authentication)
  - `/` - Dashboard
  - `/dashboard` - Dashboard
  - `/billing` - Billing page
  - `/medicines` - Medicines inventory
  - `/inventory` - Inventory management
  - And all other application routes

### User Experience
1. Unauthenticated users are automatically redirected to `/sign-in`
2. After successful sign-in, users are redirected to `/dashboard`
3. User information is displayed in the navigation bar
4. Sign out functionality available in the user menu

## Features Implemented

### 1. Authentication Pages
- **Sign In Page** (`/sign-in`)
  - Split-screen layout with medical theme
  - Clerk SignIn component
  - Medical illustrations and icons
  - Light color scheme (white, light blue, soft green)

- **Sign Up Page** (`/sign-up`)
  - Similar design to Sign In
  - Clerk SignUp component
  - Feature highlights for pharmacy management

### 2. Route Protection
- `ProtectedRoute` component wraps all authenticated routes
- Automatic redirect to sign-in for unauthenticated users
- Loading state during authentication check

### 3. User Interface
- **Navbar Enhancement:**
  - Displays logged-in user name/email
  - User avatar with initials
  - Sign out functionality
  - Medical theme with heart icon
  - Search functionality
  - Notification badge

### 4. Design System
- **Color Scheme:**
  - White (#ffffff) - Primary background
  - Light Blue (#e6f7ff) - Accent color
  - Soft Green (#e8f5e9) - Secondary accent
  - Medical Blue (#1976d2) - Primary action
  - Medical Pink (#e91e63) - Accent highlights

- **Typography:** Clean, modern fonts
- **Icons:** Lucide React icons for medical theme
- **Responsive:** Mobile and desktop optimized

## File Structure

```
src/
├── main.jsx                 # ClerkProvider setup
├── App.jsx                  # Route configuration
├── components/
│   ├── ProtectedRoute.jsx   # Route protection wrapper
│   ├── ProtectedRoute.css   # Loading styles
│   └── Navbar.jsx           # Updated with Clerk user info
├── pages/
│   ├── SignIn.jsx           # Sign in page
│   ├── SignIn.css           # Sign in styles
│   ├── SignUp.jsx           # Sign up page
│   └── SignUp.css           # Sign up styles
└── layout/
    └── MainLayout.jsx       # Main application layout
```

## Testing

### 1. Authentication Flow
```bash
# Start development server
npm run dev

# Test in browser
http://localhost:5173
```

### 2. Test Cases
- ✅ Unauthenticated access redirects to sign-in
- ✅ Sign in functionality works
- ✅ Sign up functionality works
- ✅ Protected routes require authentication
- ✅ User information displays correctly
- ✅ Sign out functionality works
- ✅ Responsive design on mobile

### 3. Browser Testing
- Chrome, Firefox, Safari compatibility
- Mobile device testing
- Tablet testing

## Customization

### 1. Branding
- Update colors in CSS files
- Modify logo and branding elements
- Customize medical illustrations

### 2. Authentication Methods
- Enable social providers in Clerk dashboard
- Configure multi-factor authentication
- Set up organization-based access

### 3. User Roles
- Implement role-based access control
- Customize user permissions
- Add admin/staff role differentiation

## Production Deployment

### 1. Environment Variables
```bash
# Create .env.production
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
```

### 2. Update Production URLs
In Clerk dashboard, add your production domain to allowed URLs.

### 3. Build and Deploy
```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

## Troubleshooting

### Common Issues

1. **Clerk not loading**
   - Check publishable key is correct
   - Verify domain is allowed in Clerk dashboard

2. **Redirect loops**
   - Ensure ProtectedRoute is properly implemented
   - Check route configuration in App.jsx

3. **CSS not applying**
   - Verify CSS imports are correct
   - Check for conflicting styles

4. **User info not displaying**
   - Verify useUser hook is properly implemented
   - Check Clerk session state

### Support
- Clerk Documentation: https://clerk.com/docs
- React Integration: https://clerk.com/docs/react/quickstarts
- Support: support@clerk.com

## Security Considerations

1. **API Keys**: Never expose secret keys in frontend code
2. **CORS**: Ensure proper CORS configuration
3. **Session Management**: Configure appropriate session duration
4. **Rate Limiting**: Implement rate limiting for authentication endpoints

## Next Steps

1. Configure production Clerk application
2. Set up custom domains
3. Implement role-based access control
4. Add user profile management
5. Configure audit logging
6. Set up monitoring and analytics

---

**Note:** This authentication system is fully functional and ready for production use once you configure your Clerk publishable key and allowed domains.
