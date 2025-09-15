'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import apiClient, { Room, Submission, RoomStats } from '@/lib/api';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [room, setRoom] = useState<Room | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isCreator, setIsCreator] = useState(false);

  // Load room data
  useEffect(() => {
    loadRoomData();
  }, [roomId]);

  // Update countdown timer
  useEffect(() => {
    if (!room) return;

    const updateTimer = () => {
      const now = new Date();
      const expiresAt = new Date(room.expiresAt);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room]);

  const loadRoomData = async () => {
    try {
      setIsLoading(true);
      
      // Load room info
      const roomData = await apiClient.getRoom(roomId);
      setRoom(roomData);
      
      // Check if current user is the creator
      const roomStats = await apiClient.getRoomStats(roomId);
      setStats(roomStats);
      setIsCreator(true);
      
      // Load submission status
      const submissionData = await apiClient.getSubmission(roomId);
      setHasSubmission(submissionData.hasSubmission);
      setSubmission(submissionData.submission);
      
    } catch (error: any) {
      console.error('Error loading room:', error);
      if (error.response?.status === 404) {
        toast.error('Room not found');
        router.push('/');
      } else if (error.response?.status === 410) {
        toast.error('Room has expired');
        router.push('/');
      } else if (error.response?.status === 403) {
        // User is not the creator, load as participant
        setIsCreator(false);
        try {
          const roomData = await apiClient.getRoom(roomId);
          setRoom(roomData);
          
          const submissionData = await apiClient.getSubmission(roomId);
          setHasSubmission(submissionData.hasSubmission);
          setSubmission(submissionData.submission);
        } catch (participantError) {
          toast.error('Failed to load room');
          router.push('/');
        }
      } else {
        toast.error('Failed to load room');
        router.push('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    try {
      // Categorize files: .apworld files go to APWorld, everything else goes to YAML
      const yamlFiles = acceptedFiles.filter(file => 
        !file.name.toLowerCase().endsWith('.apworld')
      );
      
      const apworldFiles = acceptedFiles.filter(file => 
        file.name.toLowerCase().endsWith('.apworld')
      );

      await apiClient.uploadFiles(roomId, yamlFiles, apworldFiles);
      
      toast.success('Files uploaded successfully!');
      await loadRoomData(); // Reload data
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: isUploading
  });

  const handleDownload = async (fileType: 'yaml' | 'apworld') => {
    setIsDownloading(true);
    try {
      await apiClient.downloadFiles(roomId, fileType);
      toast.success(`${fileType.toUpperCase()} files downloaded successfully!`);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download files');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyRoomLink = () => {
    const roomUrl = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(roomUrl);
    toast.success('Room link copied to clipboard!');
  };

  const handleCancelSubmission = async () => {
    if (!window.confirm('Are you sure you want to cancel your submission? This will delete all your uploaded files and cannot be undone.')) {
      return;
    }

    setIsCancelling(true);
    try {
      await apiClient.cancelSubmission(roomId);
      toast.success('Submission cancelled successfully!');
      await loadRoomData(); // Reload data to update UI
    } catch (error: any) {
      console.error('Cancel submission error:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel submission');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '4px solid #3b82f6', 
            borderTop: '4px solid transparent', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }}></div>
          <p style={{ color: 'white' }}>Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
            Room Not Found
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            The room you're looking for doesn't exist or has expired.
          </p>
          <button className="button" onClick={() => router.push('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="container">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
            Room: {roomId}
          </h1>
          <div className="flex items-center justify-center gap-4" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <div className="flex items-center gap-2">
              <span>⏰</span>
              <span>Expires in: {timeLeft}</span>
            </div>
            {isCreator && stats && (
              <div className="flex items-center gap-2">
                <span>👥</span>
                <span>{stats.totalSubmissions} submissions</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ maxWidth: '1000px', margin: '0 auto', gap: '2rem' }}>
          {/* File Upload Section */}
          <div className="card">
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
              {hasSubmission ? 'Update Your Files' : 'Upload Files'}
            </h2>
            
            {hasSubmission && (
              <div style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem', 
                background: '#f0fdf4', 
                borderRadius: '8px', 
                border: '1px solid #bbf7d0' 
              }}>
                <div className="flex items-center gap-2" style={{ color: '#166534', marginBottom: '0.25rem' }}>
                  <span>✅</span>
                  <span style={{ fontWeight: '500' }}>You have already submitted files</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#15803d', marginBottom: '0.75rem' }}>
                  Uploading new files will replace your previous submission.
                </p>
                <button
                  onClick={handleCancelSubmission}
                  disabled={isCancelling}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: isCancelling ? 'not-allowed' : 'pointer',
                    opacity: isCancelling ? 0.6 : 1,
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (!isCancelling) {
                      e.currentTarget.style.background = '#dc2626';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isCancelling) {
                      e.currentTarget.style.background = '#ef4444';
                    }
                  }}
                >
                  {isCancelling ? 'Cancelling...' : '🗑️ Cancel Submission'}
                </button>
              </div>
            )}

            <div
              {...getRootProps()}
              className={`upload-area ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                borderColor: isDragActive ? '#3b82f6' : '#d1d5db',
                background: isDragActive ? '#eff6ff' : 'transparent'
              }}
            >
              <input {...getInputProps()} />
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📤</div>
              {isUploading ? (
                <div>
                  <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#111827', marginBottom: '0.5rem' }}>
                    Uploading files...
                  </p>
                  <div style={{ 
                    width: '100%', 
                    height: '4px', 
                    background: '#e5e7eb', 
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: '100%', 
                      height: '100%', 
                      background: '#3b82f6',
                      animation: 'loading 1.5s ease-in-out infinite'
                    }}></div>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#111827', marginBottom: '0.5rem' }}>
                    {isDragActive ? 'Drop files here' : 'Drag & drop files here, or click to select'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    All file types accepted - .apworld files are treated as APWorld, everything else as YAML
                  </p>
                </div>
              )}
            </div>

            {submission && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontWeight: '500', color: '#111827', marginBottom: '0.75rem' }}>
                  Current Submission:
                </h3>
                {submission.yamlFiles.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      YAML Files ({submission.yamlFiles.length}):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {submission.yamlFiles.map((file, index) => (
                        <span key={index} style={{
                          background: '#3b82f6',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem'
                        }}>
                          {file.split('_').slice(1).join('_')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {submission.apworldFiles.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      APWorld Files ({submission.apworldFiles.length}):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {submission.apworldFiles.map((file, index) => (
                        <span key={index} style={{
                          background: '#8b5cf6',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem'
                        }}>
                          {file.split('_').slice(1).join('_')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Room Management Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Share Room */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                Share Room
              </h3>
              <button
                className="button"
                onClick={copyRoomLink}
                style={{ width: '100%', marginBottom: '0.5rem' }}
              >
                📋 Copy Room Link
              </button>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                Share this link with others to let them upload files
              </p>
            </div>

            {/* Creator Controls */}
            {isCreator && stats && (
              <div className="card">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                  Room Statistics
                </h3>
                <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: '#eff6ff', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', marginBottom: '0.25rem' }}>👥</div>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                      {stats.totalSubmissions}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Submissions
                    </p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', marginBottom: '0.25rem' }}>📄</div>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                      {stats.totalYamlFiles + stats.totalApworldFiles}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Total Files
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    className="button"
                    onClick={() => handleDownload('yaml')}
                    disabled={isDownloading || stats.totalYamlFiles === 0}
                    style={{ 
                      width: '100%',
                      opacity: stats.totalYamlFiles === 0 ? 0.5 : 1,
                      cursor: stats.totalYamlFiles === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    📥 Download YAML Files ({stats.totalYamlFiles})
                  </button>
                  <button
                    className="button"
                    onClick={() => handleDownload('apworld')}
                    disabled={isDownloading || stats.totalApworldFiles === 0}
                    style={{ 
                      width: '100%', 
                      background: '#8b5cf6',
                      opacity: stats.totalApworldFiles === 0 ? 0.5 : 1,
                      cursor: stats.totalApworldFiles === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    📦 Download APWorld Files ({stats.totalApworldFiles})
                  </button>
                </div>
              </div>
            )}

            {/* Non-creator message */}
            {!isCreator && (
              <div className="card">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                  Room Access
                </h3>
                <div style={{ 
                  padding: '1rem', 
                  background: '#fef3c7', 
                  borderRadius: '8px', 
                  border: '1px solid #f59e0b',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '0.5rem' }}>👤</div>
                  <p style={{ color: '#92400e', fontWeight: '500', marginBottom: '0.25rem' }}>
                    You are a participant
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#a16207' }}>
                    Only the room creator can download files. You can upload your files and edit your submission.
                  </p>
                </div>
              </div>
            )}

            {/* Room Info */}
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                Room Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Created:</span>
                  <span style={{ color: '#111827' }}>
                    {new Date(room.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Expires:</span>
                  <span style={{ color: '#111827' }}>
                    {new Date(room.expiresAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Status:</span>
                  <span style={{
                    background: timeLeft === 'Expired' ? '#fef2f2' : '#f0fdf4',
                    color: timeLeft === 'Expired' ? '#dc2626' : '#16a34a',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {timeLeft === 'Expired' ? 'Expired' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
