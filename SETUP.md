# Setup Guide for Top 2000 to Spotify Converter

This guide will walk you through setting up the Top 2000 to Spotify converter application.

## Prerequisites

- A Spotify account
- Node.js 20 or higher installed (for local development)
- A GitHub account (for deployment)

## Step 1: Create a Spotify Application

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create app"
4. Fill in the application details:
   - **App name**: `Top 2000 to Spotify Converter` (or your preferred name)
   - **App description**: `Convert NPO Radio 2 Top 2000 voting lists to Spotify playlists`
   - **Redirect URI**: Add the following URIs:
     - For GitHub Pages: `https://YOUR_USERNAME.github.io/top2000-to-spotify/`
     - For local development: `http://localhost:5173/top2000-to-spotify/`
   - **Which API/SDKs are you planning to use?**: Select `Web API`
5. Accept the Terms of Service
6. Click "Save"
7. Copy your **Client ID** from the app settings page

## Step 2: Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/HiddeS03/top2000-to-spotify.git
   cd top2000-to-spotify
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your Spotify Client ID:
   ```
   VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5173/top2000-to-spotify/`

## Step 3: Deploy to GitHub Pages

1. Go to your GitHub repository settings
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select "GitHub Actions"
4. Navigate to **Settings** > **Secrets and variables** > **Actions**
5. Click "New repository secret"
6. Add a secret with:
   - **Name**: `VITE_SPOTIFY_CLIENT_ID`
   - **Secret**: Your Spotify Client ID
7. Click "Add secret"

8. Push your changes to the `main` branch:
   ```bash
   git checkout main
   git merge copilot/create-react-static-page
   git push origin main
   ```

9. The GitHub Actions workflow will automatically build and deploy your site
10. Your app will be available at `https://YOUR_USERNAME.github.io/top2000-to-spotify/`

## Step 4: Using the Application

1. Visit the [NPO Radio 2 Top 2000 voting site](https://npo.nl/luister/stem/npo-radio-2-top-2000-2025)
2. Create and submit your Top 2000 list
3. After submission, copy the URL from your browser (it should look like: `https://npo.nl/luister/stem/npo-radio-2-top-2000-2025/inzending/019ae423-5404-729d-818e-b85e011a546f`)
4. Go to your deployed application
5. Paste the URL in the input field
6. Click "Fetch Songs" to retrieve your list
7. Click "Connect to Spotify" to authenticate
8. The app will create a playlist with your Top 2000 songs!

## Troubleshooting

### "Spotify Client ID is not configured" error
- Make sure you've added the `VITE_SPOTIFY_CLIENT_ID` secret in GitHub repository settings
- For local development, ensure your `.env` file exists and contains the Client ID
- Rebuild the application after adding the environment variable

### "Invalid NPO Radio 2 Top 2000 link" error
- Ensure you're using the correct URL format from the NPO voting site
- The URL should contain `/inzending/` followed by a UUID

### Spotify authentication fails
- Verify that the redirect URI in your Spotify app settings matches your deployment URL exactly
- Make sure you've added both the production URL and local development URL if you're testing locally

### No tracks found on Spotify
- Some songs might not be available on Spotify
- The app searches for tracks using the song title and artist name
- Track availability may vary by region

## Support

For issues or questions, please open an issue on the [GitHub repository](https://github.com/HiddeS03/top2000-to-spotify/issues).
