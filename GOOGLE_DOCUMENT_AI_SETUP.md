# Google Document AI Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your **Project ID** (e.g., `kdl-lms-project`)

## Step 2: Enable Document AI API

1. Go to [Document AI API](https://console.cloud.google.com/apis/library/documentai.googleapis.com)
2. Click **Enable**
3. Wait for activation (30 seconds)

## Step 3: Create Service Account & Download Key

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **Create Service Account**
   - Name: `kdl-document-ai`
   - Description: `For OCR processing`
3. Click **Create and Continue**
4. Grant role: **Document AI API User**
5. Click **Done**
6. Click on the service account you just created
7. Go to **Keys** tab
8. Click **Add Key** → **Create new key**
9. Choose **JSON**
10. Save file as: `c:\Users\Saw\Desktop\kdl-lms\kdl-backend\google-credentials.json`

## Step 4: Create Document AI Processor

1. Go to [Document AI Processors](https://console.cloud.google.com/ai/document-ai/processors)
2. Click **Create Processor**
3. Choose **Form Parser** (best for registration forms)
4. Name: `kdl-registration-parser`
5. Region: Choose closest (e.g., `us` or `eu`)
6. Click **Create**
7. Copy the **Processor ID** (looks like: `abc123def456`)
8. Copy the **Location** (e.g., `us` or `eu`)

## Step 5: Configure Environment

Add to `kdl-backend/backend.env`:

```env
# Google Document AI Configuration
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PROCESSOR_ID=abc123def456
GOOGLE_LOCATION=us
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

## Step 6: Install Dependencies

```powershell
cd kdl-backend
npm install @google-cloud/documentai heic-convert csv-writer csv-parse
```

## Pricing (Free Tier Available!)

- **Free**: 1,000 pages/month
- **After free tier**: $1.50 per 1,000 pages
- **Your estimated cost**: ~300 images = $0.45/year folder (very cheap!)

## Security

⚠️ **IMPORTANT**: Add to `.gitignore`:
```
google-credentials.json
backend.env
```

Never commit your credentials to Git!

## Testing

After setup, run:
```powershell
npx ts-node scripts/test-document-ai.ts
```

This will process one test image to verify setup.
