const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'storage', 'database.sqlite'));
  }

  init() {
    return new Promise((resolve, reject) => {
      // Create rooms table first
      this.db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          creator_ip TEXT
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create submissions table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            user_ip TEXT,
            yaml_files TEXT, -- JSON array of file paths
            apworld_files TEXT, -- JSON array of file paths
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms (id)
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Create indexes for better performance
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at)`, (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_room_id ON submissions(room_id)`, (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_user_ip ON submissions(user_ip)`, (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve();
              });
            });
          });
        });
      });
    });
  }

  // Room operations
  createRoom(roomId, creatorIp) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO rooms (id, expires_at, creator_ip) VALUES (?, ?, ?)',
        [roomId, expiresAt.toISOString(), creatorIp],
        function(err) {
          if (err) reject(err);
          else resolve({ id: roomId, expires_at: expiresAt });
        }
      );
    });
  }

  getRoom(roomId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM rooms WHERE id = ?',
        [roomId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  deleteRoom(roomId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM rooms WHERE id = ?',
        [roomId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // Submission operations
  getSubmission(roomId, userIp) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM submissions WHERE room_id = ? AND user_ip = ?',
        [roomId, userIp],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  createSubmission(roomId, userIp, yamlFiles = [], apworldFiles = []) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO submissions (room_id, user_ip, yaml_files, apworld_files) VALUES (?, ?, ?, ?)',
        [roomId, userIp, JSON.stringify(yamlFiles), JSON.stringify(apworldFiles)],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  updateSubmission(roomId, userIp, yamlFiles = [], apworldFiles = []) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE submissions SET yaml_files = ?, apworld_files = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_ip = ?',
        [JSON.stringify(yamlFiles), JSON.stringify(apworldFiles), roomId, userIp],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  getRoomSubmissions(roomId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM submissions WHERE room_id = ?',
        [roomId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  deleteRoomSubmissions(roomId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM submissions WHERE room_id = ?',
        [roomId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  deleteSubmission(roomId, userIp) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM submissions WHERE room_id = ? AND user_ip = ?',
        [roomId, userIp],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // Cleanup operations
  getExpiredRooms() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM rooms WHERE expires_at < CURRENT_TIMESTAMP',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;
