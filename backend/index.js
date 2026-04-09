const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const cron = require('node-cron');
const Database = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Global set to keep track of ZIP files currently being generated to prevent race conditions
const activeZipGenerations = new Set();

// Initialize database
let db;
const initDatabase = async () => {
  db = new Database();
  await db.init();
  console.log('Database initialized successfully');
};

// Middleware
app.use(cors({
  origin: [
    'https://apcollector.xyz',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://31.42.127.143:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Participant-ID'],
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const roomId = req.params.roomId;
    const roomDir = path.join(__dirname, 'storage', 'rooms', roomId);
    
    // Create room directory if it doesn't exist
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }
    
    cb(null, roomDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    // Sanitize original name to prevent directory traversal
    const safeName = path.basename(file.originalname);
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Helper function to get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

// Helper function to get participant ID
function getParticipantID(req) {
  return req.headers['x-participant-id'];
}

// Helper function to clean up room files
async function cleanupRoomFiles(roomId) {
  const roomDir = path.join(__dirname, 'storage', 'rooms', roomId);
  if (fs.existsSync(roomDir)) {
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
  
  // Delete zip files
  const yamlZipPath = path.join(__dirname, 'storage', 'temp', `${roomId}_yaml.zip`);
  const apworldZipPath = path.join(__dirname, 'storage', 'temp', `${roomId}_apworld.zip`);
  
  if (fs.existsSync(yamlZipPath)) {
    fs.unlinkSync(yamlZipPath);
  }
  if (fs.existsSync(apworldZipPath)) {
    fs.unlinkSync(apworldZipPath);
  }
}

// Helper function to delete existing ZIP files for a room
async function deleteExistingZipFiles(roomId) {
  const yamlZipPath = path.join(__dirname, 'storage', 'temp', `${roomId}_yaml.zip`);
  const apworldZipPath = path.join(__dirname, 'storage', 'temp', `${roomId}_apworld.zip`);
  
  if (fs.existsSync(yamlZipPath)) {
    try {
      fs.unlinkSync(yamlZipPath);
      console.log(`Deleted existing YAML ZIP: ${roomId}_yaml.zip`);
    } catch (error) {
      console.error(`Error deleting YAML ZIP ${roomId}_yaml.zip:`, error);
    }
  }
  
  if (fs.existsSync(apworldZipPath)) {
    try {
      fs.unlinkSync(apworldZipPath);
      console.log(`Deleted existing APWorld ZIP: ${roomId}_apworld.zip`);
    } catch (error) {
      console.error(`Error deleting APWorld ZIP ${roomId}_apworld.zip:`, error);
    }
  }
}

// Helper function to delete old files from a user's submission
async function deleteOldFiles(roomId, oldYamlFiles, oldApworldFiles) {
  const roomDir = path.join(__dirname, 'storage', 'rooms', roomId);
  
  // Delete old YAML files
  for (const fileName of oldYamlFiles) {
    const filePath = path.join(roomDir, fileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted old YAML file: ${fileName}`);
      } catch (error) {
        console.error(`Error deleting old YAML file ${fileName}:`, error);
      }
    }
  }
  
  // Delete old APWorld files
  for (const fileName of oldApworldFiles) {
    const filePath = path.join(roomDir, fileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted old APWorld file: ${fileName}`);
      } catch (error) {
        console.error(`Error deleting old APWorld file ${fileName}:`, error);
      }
    }
  }
}

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Routes

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const roomId = uuidv4();
    const creatorIp = getClientIP(req);
    
    const room = await db.createRoom(roomId, creatorIp);
    
    res.json({
      success: true,
      roomId: roomId,
      expiresAt: room.expires_at
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ success: false, error: 'Failed to create room' });
  }
});

// Get room info
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await db.getRoom(roomId);
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if room is expired
    if (new Date(room.expires_at) < new Date()) {
      await cleanupRoomFiles(roomId);
      await db.deleteRoom(roomId);
      return res.status(410).json({ success: false, error: 'Room has expired' });
    }
    
    res.json({
      success: true,
      room: {
        id: room.id,
        createdAt: room.created_at,
        expiresAt: room.expires_at,
        isCreator: room.creator_ip === getClientIP(req)
      }
    });
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({ success: false, error: 'Failed to get room' });
  }
});

// Get all uploaded files in the room (Restricted to Creator)
app.get('/api/rooms/:roomId/files', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Verify room exists
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // SECURITY: Verify requester is the room creator
    const userIp = getClientIP(req);
    if (room.creator_ip !== userIp) {
      return res.status(403).json({ success: false, error: 'Access denied: Only the room creator can view all files' });
    }
    
    // Get all submissions for the room
    const submissions = await db.getRoomSubmissions(roomId);
    
    let allYamlFiles = [];
    let allApworldFiles = [];
    
    submissions.forEach(sub => {
      const yamlFiles = JSON.parse(sub.yaml_files || '[]');
      const apworldFiles = JSON.parse(sub.apworld_files || '[]');
      
      allYamlFiles = [...allYamlFiles, ...yamlFiles];
      allApworldFiles = [...allApworldFiles, ...apworldFiles];
    });
    
    res.json({
      success: true,
      yamlFiles: allYamlFiles,
      apworldFiles: allApworldFiles
    });
  } catch (error) {
    console.error('Error getting all files:', error);
    res.status(500).json({ success: false, error: 'Failed to get all files' });
  }
});

// Get or download a specific file (Restricted to Creator)
app.get('/api/rooms/:roomId/file/:fileName', async (req, res) => {
  try {
    const { roomId, fileName } = req.params;
    const { download } = req.query;
    
    // Verify room exists
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if requester is creator or file owner
    const userIp = getClientIP(req);
    const participantId = req.headers['x-participant-id'];
    let isOwner = false;
    
    if (participantId) {
      const submission = await db.getSubmission(roomId, participantId);
      if (submission) {
        const yamlFiles = JSON.parse(submission.yaml_files || '[]');
        const apworldFiles = JSON.parse(submission.apworld_files || '[]');
        if (yamlFiles.includes(fileName) || apworldFiles.includes(fileName)) {
          isOwner = true;
        }
      }
    }
    
    // SECURITY: Verify requester is the room creator or file owner
    if (room.creator_ip !== userIp && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only access your own files' });
    }
    
    const filePath = path.join(__dirname, 'storage', 'rooms', roomId, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    
    if (download === 'true') {
      return res.download(filePath, fileName);
    } else {
      return res.sendFile(filePath);
    }
    
  } catch (error) {
    console.error('Error getting file:', error);
    res.status(500).json({ success: false, error: 'Failed to access file' });
  }
});

// Update a specific file content (Restricted to Creator or file owner)
app.put('/api/rooms/:roomId/file/:fileName', async (req, res) => {
  try {
    const { roomId, fileName } = req.params;
    const { content } = req.body;
    
    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'File content must be provided' });
    }
    
    // Verify room exists
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if requester is creator or file owner
    const userIp = getClientIP(req);
    const participantId = req.headers['x-participant-id'];
    let isOwner = false;
    
    if (participantId) {
      const submission = await db.getSubmission(roomId, participantId);
      if (submission) {
        const yamlFiles = JSON.parse(submission.yaml_files || '[]');
        // We only allow editing YAML files as APWorlds are binaries
        if (yamlFiles.includes(fileName)) {
          isOwner = true;
        }
      }
    }
    
    // SECURITY: Verify requester is the room creator or file owner
    if (room.creator_ip !== userIp && !isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only edit your own yaml files' });
    }
    
    const filePath = path.join(__dirname, 'storage', 'rooms', roomId, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    
    res.json({ success: true, message: 'File updated successfully' });
    
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ success: false, error: 'Failed to update file' });
  }
});

// Get user's submission status
app.get('/api/rooms/:roomId/submission', async (req, res) => {
  try {
    const { roomId } = req.params;
    const participantId = getParticipantID(req);
    
    if (!participantId) {
      return res.status(400).json({ success: false, error: 'Participant ID missing' });
    }
    
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    const submission = await db.getSubmission(roomId, participantId);
    
    res.json({
      success: true,
      hasSubmission: !!submission,
      submission: submission ? {
        yamlFiles: JSON.parse(submission.yaml_files || '[]'),
        apworldFiles: JSON.parse(submission.apworld_files || '[]'),
        createdAt: submission.created_at,
        updatedAt: submission.updated_at
      } : null
    });
  } catch (error) {
    console.error('Error getting submission:', error);
    res.status(500).json({ success: false, error: 'Failed to get submission' });
  }
});

// Remove specific files from user's submission
app.delete('/api/rooms/:roomId/submission/files', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { fileNames } = req.body; // Array of file names to remove
    const participantId = getParticipantID(req);
    
    if (!participantId) {
      return res.status(400).json({ success: false, error: 'Participant ID missing' });
    }
    
    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return res.status(400).json({ success: false, error: 'No file names provided' });
    }
    
    // Verify room exists and is not expired
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    if (new Date(room.expires_at) < new Date()) {
      await cleanupRoomFiles(roomId);
      await db.deleteRoom(roomId);
      return res.status(410).json({ success: false, error: 'Room has expired' });
    }
    
    // Get user's current submission
    const submission = await db.getSubmission(roomId, participantId);
    if (!submission) {
      return res.status(404).json({ success: false, error: 'No submission found' });
    }
    
    // Get current files
    const currentYamlFiles = JSON.parse(submission.yaml_files || '[]');
    const currentApworldFiles = JSON.parse(submission.apworld_files || '[]');
    
    // Filter out the files to remove
    const updatedYamlFiles = currentYamlFiles.filter(fileName => !fileNames.includes(fileName));
    const updatedApworldFiles = currentApworldFiles.filter(fileName => !fileNames.includes(fileName));
    
    // Delete the actual files from filesystem
    const roomDir = path.join(__dirname, 'storage', 'rooms', roomId);
    for (const fileName of fileNames) {
      const filePath = path.join(roomDir, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${fileName}`);
        } catch (error) {
          console.error(`Error deleting file ${fileName}:`, error);
        }
      }
    }
    
    // Update the submission with remaining files
    await db.updateSubmission(roomId, participantId, updatedYamlFiles, updatedApworldFiles);
    
    // Delete existing ZIP files since files were removed
    await deleteExistingZipFiles(roomId);
    
    res.json({
      success: true,
      message: 'Files removed successfully',
      yamlFiles: updatedYamlFiles,
      apworldFiles: updatedApworldFiles
    });
  } catch (error) {
    console.error('Error removing files:', error);
    res.status(500).json({ success: false, error: 'Failed to remove files' });
  }
});

// Cancel/delete user's submission
app.delete('/api/rooms/:roomId/submission', async (req, res) => {
  try {
    const { roomId } = req.params;
    const participantId = getParticipantID(req);
    
    if (!participantId) {
      return res.status(400).json({ success: false, error: "Participant ID missing" });
    }
    
    // Verify room exists and is not expired
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    if (new Date(room.expires_at) < new Date()) {
      await cleanupRoomFiles(roomId);
      await db.deleteRoom(roomId);
      return res.status(410).json({ success: false, error: 'Room has expired' });
    }
    
    // Get user's current submission
    const submission = await db.getSubmission(roomId, participantId);
    if (!submission) {
      return res.status(404).json({ success: false, error: 'No submission found' });
    }
    
    // Delete the files from filesystem
    const yamlFiles = JSON.parse(submission.yaml_files || '[]');
    const apworldFiles = JSON.parse(submission.apworld_files || '[]');
    await deleteOldFiles(roomId, yamlFiles, apworldFiles);
    
    // Delete the submission from database
    await db.deleteSubmission(roomId, participantId);
    
    // Delete existing ZIP files since submission was cancelled
    await deleteExistingZipFiles(roomId);
    
    res.json({
      success: true,
      message: 'Submission cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling submission:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel submission' });
  }
});

// Upload files
app.post('/api/rooms/:roomId/upload', upload.fields([
  { name: 'yamlFiles', maxCount: 50 },
  { name: 'apworldFiles', maxCount: 50 }
]), async (req, res) => {
  // Add CORS headers explicitly for this endpoint
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://apcollector.xyz');
  res.header('Access-Control-Allow-Credentials', 'true');
  try {
    const { roomId } = req.params;
    const userIp = getClientIP(req);
    const participantId = getParticipantID(req);
    
    if (!participantId) {
      return res.status(400).json({ success: false, error: 'Participant ID missing' });
    }
    
    console.log(`Upload request received for room ${roomId} from IP ${userIp}, Participant ${participantId}`);
    console.log('Request headers:', req.headers);
    console.log('Files received:', req.files);
    
    // Verify room exists and is not expired
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    if (new Date(room.expires_at) < new Date()) {
      await cleanupRoomFiles(roomId);
      await db.deleteRoom(roomId);
      return res.status(410).json({ success: false, error: 'Room has expired' });
    }
    
    const allFiles = [...(req.files?.yamlFiles || []), ...(req.files?.apworldFiles || [])];
    
    if (allFiles.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No files provided' 
      });
    }
    
    // Categorize files: .apworld files go to APWorld, everything else goes to YAML
    const yamlFiles = [];
    const apworldFiles = [];
    
    for (const file of allFiles) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.apworld') {
        apworldFiles.push(file);
      } else {
        yamlFiles.push(file);
      }
    }
    
    // Prepare file paths
    const yamlFilePaths = yamlFiles.map(file => file.filename);
    const apworldFilePaths = apworldFiles.map(file => file.filename);
    
    // Delete existing ZIP files since new files are being added
    await deleteExistingZipFiles(roomId);
    
    // Check if user already has a submission
    const existingSubmission = await db.getSubmission(roomId, participantId);
    
    if (existingSubmission) {
      // Get existing file paths and combine with new ones (APPEND logic)
      const existingYamlFiles = JSON.parse(existingSubmission.yaml_files || '[]');
      const existingApworldFiles = JSON.parse(existingSubmission.apworld_files || '[]');
      
      const combinedYamlFiles = [...existingYamlFiles, ...yamlFilePaths];
      const combinedApworldFiles = [...existingApworldFiles, ...apworldFilePaths];
      
      await db.updateSubmission(roomId, participantId, combinedYamlFiles, combinedApworldFiles);
      
      // Update response to show all files
      yamlFilePaths.splice(0, yamlFilePaths.length, ...combinedYamlFiles);
      apworldFilePaths.splice(0, apworldFilePaths.length, ...combinedApworldFiles);
    } else {
      // Create new submission
      await db.createSubmission(roomId, participantId, userIp, yamlFilePaths, apworldFilePaths);
    }
    
    res.json({
      success: true,
      message: existingSubmission ? 'Files added to submission successfully' : 'Files uploaded successfully',
      yamlFiles: yamlFilePaths,
      apworldFiles: apworldFilePaths
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ success: false, error: 'Failed to upload files' });
  }
});

// Download files as ZIP
app.get('/api/rooms/:roomId/download/:fileType', async (req, res) => {
  try {
    const { roomId, fileType } = req.params;
    
    if (!['yaml', 'apworld'].includes(fileType)) {
      return res.status(400).json({ success: false, error: 'Invalid file type' });
    }
    
    // Verify room exists
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // SECURITY: Verify requester is the room creator
    const userIp = getClientIP(req);
    if (room.creator_ip !== userIp) {
      return res.status(403).json({ success: false, error: 'Access denied: Only the room creator can download files' });
    }
    
    // Get all submissions for the room
    const submissions = await db.getRoomSubmissions(roomId);
    
    if (submissions.length === 0) {
      return res.status(404).json({ success: false, error: 'No files found' });
    }
    
    // Create ZIP file
    const zipFileName = `${roomId}_${fileType}.zip`;
    const zipPath = path.join(__dirname, 'storage', 'temp', zipFileName);
    
    // Check if ZIP already exists
    if (fs.existsSync(zipPath)) {
      return res.download(zipPath, zipFileName);
    }
    
    // Concurrency Protection: Avoid generating the same ZIP multiple times simultaneously
    if (activeZipGenerations.has(zipPath)) {
      return res.status(202).json({ success: true, message: 'Archive is being generated, please try again in a moment' });
    }
    
    activeZipGenerations.add(zipPath);
    
    // Create ZIP in a temporary location first
    const tempZipPath = `${zipPath}.tmp_${Date.now()}`;
    const output = fs.createWriteStream(tempZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      // Atomic rename to original path
      fs.renameSync(tempZipPath, zipPath);
      activeZipGenerations.delete(zipPath);
      res.download(zipPath, zipFileName);
    });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
      activeZipGenerations.delete(zipPath);
      res.status(500).json({ success: false, error: 'Failed to create archive' });
    });
    
    archive.pipe(output);
    
    // Add files to archive
    const roomDir = path.join(__dirname, 'storage', 'rooms', roomId);
    
    for (const submission of submissions) {
      const files = fileType === 'yaml' 
        ? JSON.parse(submission.yaml_files || '[]')
        : JSON.parse(submission.apworld_files || '[]');
      
      for (const fileName of files) {
        const filePath = path.join(roomDir, fileName);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: fileName });
        }
      }
    }
    
    await archive.finalize();
  } catch (error) {
    console.error('Error downloading files:', error);
    res.status(500).json({ success: false, error: 'Failed to download files' });
  }
});

// Get room statistics (for room creator)
app.get('/api/rooms/:roomId/stats', async (req, res) => {
  try {
    const { roomId } = req.params;
    const creatorIp = getClientIP(req);
    
    const room = await db.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if requester is the creator
    if (room.creator_ip !== creatorIp) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const submissions = await db.getRoomSubmissions(roomId);
    
    let totalYamlFiles = 0;
    let totalApworldFiles = 0;
    
    for (const submission of submissions) {
      totalYamlFiles += JSON.parse(submission.yaml_files || '[]').length;
      totalApworldFiles += JSON.parse(submission.apworld_files || '[]').length;
    }
    
    res.json({
      success: true,
      stats: {
        totalSubmissions: submissions.length,
        totalYamlFiles,
        totalApworldFiles,
        roomCreatedAt: room.created_at,
        roomExpiresAt: room.expires_at
      }
    });
  } catch (error) {
    console.error('Error getting room stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get room statistics' });
  }
});

// Cleanup expired rooms (runs every hour)
cron.schedule('0 * * * *', async () => {
  try {
    const expiredRooms = await db.getExpiredRooms();
    
    for (const room of expiredRooms) {
      console.log(`Cleaning up expired room: ${room.id}`);
      await cleanupRoomFiles(room.id);
      await db.deleteRoomSubmissions(room.id);
      await db.deleteRoom(room.id);
    }
    
    if (expiredRooms.length > 0) {
      console.log(`Cleaned up ${expiredRooms.length} expired rooms`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Start server
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down server...');
  if (db) {
    db.close();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
