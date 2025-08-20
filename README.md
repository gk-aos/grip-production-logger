# Grip Production Logger

A production logging application that captures data from Engel injection molding screens and steel coil labels using AI image processing.

## Features

- **Production Logging**: Capture production data from Engel injection molding screens
- **Blade Logging**: Track steel coil usage and blade cutting operations
- **AI-Powered**: Uses Claude AI to extract data from images
- **SQLite Database**: Local data storage with automatic table creation
- **REST API**: JSON endpoints for data capture and retrieval

## Railway Deployment

### Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Claude API Key**: Get your API key from [Anthropic](https://console.anthropic.com/)

### Deployment Steps

1. **Connect Repository**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Link your project
   railway link
   ```

2. **Set Environment Variables**
   ```bash
   # Set your Claude API key
   railway variables set CLAUDE_API_KEY=your_api_key_here
   ```

3. **Deploy**
   ```bash
   # Deploy to Railway
   railway up
   ```

4. **Get Your URL**
   ```bash
   # View deployment info
   railway status
   ```

### Environment Variables

- `CLAUDE_API_KEY`: Your Anthropic Claude API key (required)
- `PORT`: Port number (Railway sets this automatically)
- `RAILWAY_ENVIRONMENT`: Set to 'true' on Railway (automatic)

### Important Notes

- **Database**: Uses SQLite in `/tmp` directory on Railway (ephemeral storage)
- **Uploads**: Temporary files are stored in `/tmp` directory
- **Data Persistence**: Data will be reset on each deployment due to Railway's ephemeral storage

## Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   cp env.example .env
   # Edit .env with your CLAUDE_API_KEY
   ```

3. **Run Locally**
   ```bash
   npm start
   ```

4. **Access Application**
   - Frontend: http://localhost:3000
   - API: http://localhost:3000/api

## API Endpoints

### Production Logging
- `POST /api/engel/capture` - Capture Engel screen data
- `POST /api/blade/capture` - Capture coil label data

### Data Retrieval
- `GET /api/summary/today` - Get today's production summary

## File Structure

```
├── server.js          # Main server file
├── package.json       # Dependencies
├── Procfile          # Railway deployment config
├── railway.json      # Railway configuration
├── env.example       # Environment variables template
├── public/           # Static frontend files
├── uploads/          # Local upload directory (gitignored)
└── production.db     # Local SQLite database (gitignored)
```

## Troubleshooting

### Common Issues

1. **Missing API Key**: Ensure `CLAUDE_API_KEY` is set in Railway variables
2. **Database Errors**: The app automatically creates tables on startup
3. **Upload Failures**: Check that the uploads directory exists and is writable

### Railway-Specific

- **Ephemeral Storage**: Data is not persistent between deployments
- **Port Binding**: App binds to `0.0.0.0` to work with Railway's proxy
- **Environment Detection**: Automatically detects Railway environment

## Support

For Railway deployment issues, check the [Railway documentation](https://docs.railway.app/).
