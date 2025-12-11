# Top 2000 to Spotify Playlist Converter

Convert your NPO Radio 2 Top 2000 voting list to a Spotify playlist with just one click!

## Features

- 🎵 Parse NPO Radio 2 Top 2000 submission links
- 🔍 Automatically search for songs on Spotify
- 📝 Create a playlist directly in your Spotify account
- 🚀 Fully static React application hosted on GitHub Pages

## How to Use

1. Visit the live application: [https://hiddes03.github.io/top2000-to-spotify/](https://hiddes03.github.io/top2000-to-spotify/)
2. Go to [NPO Radio 2 Top 2000 voting site](https://npo.nl/luister/stem/npo-radio-2-top-2000-2025) and create your list
3. Copy your submission URL (looks like: `https://npo.nl/luister/stem/npo-radio-2-top-2000-2025/inzending/019ae423-5404-729d-818e-b85e011a546f`)
4. Paste the URL into the input field on the website
5. Click "Fetch Songs" to retrieve your list
6. Click "Connect to Spotify" to authorize the app
7. Your playlist will be created and opened automatically!

## Setup for Developers

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Spotify API Configuration

To use this application, you need to set up a Spotify Developer application:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `https://hiddes03.github.io/top2000-to-spotify/` to the Redirect URIs
4. Copy your Client ID
5. Replace `YOUR_CLIENT_ID` in `src/App.jsx` with your actual Client ID

## Deployment

The application is automatically deployed to GitHub Pages using GitHub Actions when changes are pushed to the main branch.

### GitHub Pages Setup

1. Go to your repository settings
2. Navigate to Pages section
3. Set Source to "GitHub Actions"
4. The workflow will automatically build and deploy the site

## Technologies Used

- React 19
- Vite
- Spotify Web API
- NPO API
- GitHub Actions
- GitHub Pages

## License

MIT
