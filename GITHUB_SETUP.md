# GitHub Repository Setup Instructions

## Step 1: Create a New GitHub Repository

1. Go to https://github.com and sign in to your account
2. Click the **+** icon in the top-right corner
3. Select **"New repository"**
4. Fill in the repository details:
   - **Repository name**: `pharmacy-management-system` (or your preferred name)
   - **Description**: `Complete Pharmacy Management System with React frontend and Spring Boot backend`
   - **Visibility**: Choose **Public** or **Private** based on your preference
   - **Important**: Do NOT initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

## Step 2: Add Remote Repository and Push

After creating the repository, GitHub will show you commands to push an existing repository. Use the following commands in your terminal:

```bash
cd "c:/Users/Admin/OneDrive/Desktop/Medbilling Support System"
git remote add origin https://github.com/YOUR_USERNAME/pharmacy-management-system.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username and `pharmacy-management-system` with your actual repository name.**

## Step 3: Verify the Upload

1. Go to your GitHub repository page
2. Refresh the page
3. You should see all your project files uploaded

## Project Structure

The repository contains:
- **frontend/**: React 18+ frontend with Vite
- **pharma-backend/**: Spring Boot 4.0 backend with Maven
- **.gitignore**: Configured to exclude node_modules, build artifacts, and sensitive files

## Features Implemented

✅ Expiry & Batch Tracking Module
✅ Purchase Orders functionality
✅ Tax & Financial Accounting Module
✅ Enhanced Dashboard with Profit & Loss analytics
✅ Prescription storage and dosage instructions
✅ Stock Alerts & Notifications Module
✅ Report Generation Module
✅ Pricing calculations to Product Master
✅ Razorpay Payment Processing Module (backend ready)
✅ Quick product search with company filter
✅ Dosage table to bills
✅ Customer lookup by first name with full details
✅ Payment history tracking for customers

## Running the Project

### Backend (Spring Boot)
```bash
cd pharma-backend
mvn spring-boot:run
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## Notes

- The project uses PostgreSQL database (configurable in `pharma-backend/src/main/resources/application.properties`)
- Frontend runs on port 5173
- Backend runs on port 8081
- Authentication is handled via Clerk (frontend)
