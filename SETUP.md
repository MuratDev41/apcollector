# APCollector Setup Guide

## Quick Start

### Windows
1. Double-click `start-dev.bat` to start both servers automatically
2. Open your browser to `http://localhost:3000`

### Linux/Mac
1. Make the script executable: `chmod +x start-dev.sh`
2. Run: `./start-dev.sh`
3. Open your browser to `http://localhost:3000`

## Manual Setup

### Backend Setup
```bash
cd backend
npm install
npm run dev
```
Backend will run on `http://localhost:3001`

### Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Frontend will run on `http://localhost:3000`

## Environment Configuration

Create `frontend/.env.local` with:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## First Time Usage

1. Visit `http://localhost:3000`
2. Click "Create Room" to create a new room
3. Share the room URL with others
4. Participants can upload YAML and APWorld files
5. Room creator can download all files as ZIP archives
6. All data is automatically deleted after 24 hours

## File Types Supported

- **YAML Files**: `.yaml`, `.yml`, `.txt`, `.json`, `.xml`
- **APWorld Files**: `.apworld`

## Troubleshooting

### Port Already in Use
- Backend: Change port in `backend/index.js` (line 7)
- Frontend: Change port in `frontend/package.json` scripts

### Dependencies Issues
- Backend: Run `npm install` in backend directory
- Frontend: Run `npm install --legacy-peer-deps` in frontend directory

### Database Issues
- Delete `backend/storage/database.sqlite` to reset the database
- The database will be recreated automatically on next startup
