# APCollector

A temporary file sharing application that allows users to create rooms for collecting YAML and APWorld files from multiple participants. Files are automatically deleted after 24 hours for privacy.

## Features

- **Room Creation**: Create temporary rooms with unique URLs
- **File Upload**: Support for YAML, YML, TXT, JSON, XML, and APWorld files
- **One-Time Upload**: Each user can only upload once but can edit their submission
- **Bulk Download**: Room creators can download all files as ZIP archives
- **Auto-Cleanup**: Automatic deletion of rooms and files after 24 hours
- **Modern UI**: Built with Next.js and NextUI for a beautiful user experience

## Tech Stack

### Backend
- Node.js with Express
- SQLite database
- Multer for file uploads
- Archiver for ZIP creation
- Node-cron for cleanup scheduling

### Frontend
- Next.js 15 with App Router
- NextUI for components
- React Dropzone for file uploads
- Axios for API calls
- React Hot Toast for notifications

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Usage

1. **Create a Room**: Visit the homepage and click "Create Room" to generate a new room with a unique URL
2. **Share the Room**: Copy the room link and share it with others
3. **Upload Files**: Participants can visit the room URL and upload their YAML and APWorld files
4. **Download Files**: Room creators can download all submitted files as separate ZIP archives
5. **Auto-Cleanup**: All rooms and files are automatically deleted after 24 hours

## File Types Supported

- **YAML Files**: `.yaml`, `.yml`, `.txt`, `.json`, `.xml`
- **APWorld Files**: `.apworld`

## API Endpoints

### Rooms
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/:roomId` - Get room information
- `GET /api/rooms/:roomId/stats` - Get room statistics (creator only)

### Submissions
- `GET /api/rooms/:roomId/submission` - Get user's submission status
- `POST /api/rooms/:roomId/upload` - Upload files

### Downloads
- `GET /api/rooms/:roomId/download/yaml` - Download all YAML files as ZIP
- `GET /api/rooms/:roomId/download/apworld` - Download all APWorld files as ZIP

## Database Schema

### Rooms Table
- `id` (TEXT PRIMARY KEY) - Unique room identifier
- `created_at` (DATETIME) - Room creation timestamp
- `expires_at` (DATETIME) - Room expiration timestamp
- `creator_ip` (TEXT) - IP address of room creator

### Submissions Table
- `id` (INTEGER PRIMARY KEY) - Submission ID
- `room_id` (TEXT) - Foreign key to rooms table
- `user_ip` (TEXT) - IP address of submitting user
- `yaml_files` (TEXT) - JSON array of YAML file paths
- `apworld_files` (TEXT) - JSON array of APWorld file paths
- `created_at` (DATETIME) - Submission creation timestamp
- `updated_at` (DATETIME) - Last update timestamp

## File Storage

Files are stored in the `backend/storage/` directory:
- `storage/rooms/[roomId]/` - Individual room files
- `storage/temp/` - Temporary ZIP files
- `storage/database.sqlite` - SQLite database

## Security Features

- IP-based user identification
- File type validation
- File size limits (50MB per file)
- Automatic cleanup after 24 hours
- Room creator verification for downloads

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm run dev  # Uses Next.js dev server with Turbopack
```

### Building for Production

Backend:
```bash
cd backend
npm start
```

Frontend:
```bash
cd frontend
npm run build
npm start
```

## License

MIT License
