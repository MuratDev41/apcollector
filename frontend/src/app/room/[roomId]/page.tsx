'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import apiClient, { Room, Submission, RoomStats, AllFilesResponse } from '@/lib/api';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/themes/prism-tomorrow.css';

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
  const [isCancelling, setIsCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isCreator, setIsCreator] = useState(false);
  const [allFiles, setAllFiles] = useState<AllFilesResponse | null>(null);
  const [editorFile, setEditorFile] = useState<{ name: string; content: string } | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load room data
  const loadRoomData = useCallback(async () => {
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
      
      // Load all files if creator
      try {
        const filesData = await apiClient.getAllFiles(roomId);
        setAllFiles(filesData);
      } catch (e) {
        console.error('Failed to load all files', e);
      }
      
    } catch (error: unknown) {
      console.error('Error loading room:', error);
      const errorResponse = error as { response?: { status: number; data?: { error: string } } };
      if (errorResponse.response?.status === 404) {
        toast.error('Room not found');
        router.push('/');
      } else if (errorResponse.response?.status === 410) {
        toast.error('Room has expired');
        router.push('/');
      } else if (errorResponse.response?.status === 403) {
        // User is not the creator, load as participant
        setIsCreator(false);
        try {
          const roomData = await apiClient.getRoom(roomId);
          setRoom(roomData);
          
          const submissionData = await apiClient.getSubmission(roomId);
          setHasSubmission(submissionData.hasSubmission);
          setSubmission(submissionData.submission);
        } catch {
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
  }, [roomId, router]);

  useEffect(() => {
    loadRoomData();
  }, [roomId, loadRoomData]);

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
      
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const errorResponse = error as { response?: { data?: { error: string } } };
      toast.error(errorResponse.response?.data?.error || 'Failed to upload files');
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
    try {
      await apiClient.downloadFiles(roomId, fileType);
      toast.success(`${fileType.toUpperCase()} files downloaded successfully!`);
    } catch (error: unknown) {
      console.error('Download error:', error);
      toast.error('Failed to download files');
    }
  };

  const handleIndividualDownload = async (fileName: string) => {
    try {
      await apiClient.downloadIndividualFile(roomId, fileName);
      toast.success(`${fileName} downloaded!`);
    } catch (error: unknown) {
      console.error('Download individual file error:', error);
      toast.error(`Failed to download ${fileName}`);
    }
  };

  const handleViewFile = async (fileName: string) => {
    try {
      const content = await apiClient.getFileContent(roomId, fileName);
      setEditorFile({ name: fileName, content });
      setEditorContent(content);
      setIsEditorOpen(true);
    } catch (error: unknown) {
      console.error('View file error:', error);
      toast.error(`Failed to view ${fileName}`);
    }
  };

  const handleSaveFile = async () => {
    if (!editorFile) return;
    try {
      setIsSaving(true);
      await apiClient.updateFileContent(roomId, editorFile.name, editorContent);
      toast.success('File saved successfully!');
      setEditorFile({ ...editorFile, content: editorContent });
    } catch (error: unknown) {
      console.error('Save file error:', error);
      toast.error('Failed to save file changes');
    } finally {
      setIsSaving(false);
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
    } catch (error: unknown) {
      console.error('Cancel submission error:', error);
      const errorResponse = error as { response?: { data?: { error: string } } };
      toast.error(errorResponse.response?.data?.error || 'Failed to cancel submission');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#4A90E2',
        backgroundImage: `
          radial-gradient(circle at 20% 80%, #5BA0F2 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, #3A80D2 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, #6BA0F2 0%, transparent 50%)
        `,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Pixel Art Ocean Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.1) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.1) 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          opacity: 0.3
        }} />
        
        <div className="text-center" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{
            background: '#4CAF50',
            border: '4px solid #2E7D32',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 8px 0 #1B5E20, 0 12px 20px rgba(0,0,0,0.3)',
            fontFamily: 'monospace'
          }}>
            <div style={{ 
              fontSize: '3rem', 
              marginBottom: '1rem',
              textShadow: '2px 2px 0px #2E7D32'
            }}>
              ⏳
            </div>
            <p style={{ 
              color: 'white', 
              fontSize: '1.2rem',
              fontWeight: 'bold',
              textShadow: '2px 2px 0px #2E7D32',
              letterSpacing: '1px'
            }}>
              LOADING ROOM...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#4A90E2',
        backgroundImage: `
          radial-gradient(circle at 20% 80%, #5BA0F2 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, #3A80D2 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, #6BA0F2 0%, transparent 50%)
        `,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Pixel Art Ocean Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.1) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.1) 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          opacity: 0.3
        }} />
        
        <div style={{ 
          maxWidth: '400px', 
          textAlign: 'center',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            background: '#F44336',
            border: '4px solid #C62828',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 8px 0 #B71C1C, 0 12px 20px rgba(0,0,0,0.3)',
            fontFamily: 'monospace'
          }}>
            <div style={{ 
              fontSize: '4rem', 
              marginBottom: '1rem',
              textShadow: '2px 2px 0px #C62828'
            }}>
              ⚠️
            </div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: 'white', 
              marginBottom: '0.5rem',
              textShadow: '2px 2px 0px #C62828',
              letterSpacing: '1px'
            }}>
              ROOM NOT FOUND
            </h2>
            <p style={{ 
              color: 'white', 
              marginBottom: '1.5rem',
              textShadow: '1px 1px 0px #C62828'
            }}>
              The room you&apos;re looking for doesn&apos;t exist or has expired.
            </p>
            <div 
              style={{
                background: '#C62828',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                textShadow: '1px 1px 0px #B71C1C',
                letterSpacing: '1px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '2px solid #B71C1C',
                display: 'inline-block'
              }}
              onClick={() => router.push('/')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#B71C1C';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#C62828';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              🏠 GO HOME
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#4A90E2',
      backgroundImage: `
        radial-gradient(circle at 20% 80%, #5BA0F2 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, #3A80D2 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, #6BA0F2 0%, transparent 50%)
      `,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Pixel Art Ocean Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
          linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.1) 75%),
          linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.1) 75%)
        `,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        opacity: 0.3
      }} />
      
      {/* Floating Pixel Art Elements */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '5%',
        fontSize: '2rem',
        opacity: 0.4,
        animation: 'float 6s ease-in-out infinite'
      }}>
        🏔️
      </div>
      <div style={{
        position: 'absolute',
        top: '20%',
        right: '10%',
        fontSize: '1.5rem',
        opacity: 0.3,
        animation: 'float 8s ease-in-out infinite reverse'
      }}>
        ☁️
      </div>
      <div style={{
        position: 'absolute',
        top: '60%',
        left: '3%',
        fontSize: '1.5rem',
        opacity: 0.4,
        animation: 'float 7s ease-in-out infinite'
      }}>
        🌊
      </div>
      
      {/* CSS Animation for floating elements */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
      `}</style>
      
      <div className="container" style={{ position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div className="text-center mb-8" style={{ paddingTop: '2rem' }}>
          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: 'bold', 
            color: 'white', 
            marginBottom: '1rem',
            fontFamily: 'monospace',
            textShadow: '3px 3px 0px #2A70C2, 6px 6px 0px #1A60B2',
            letterSpacing: '2px'
          }}>
            ROOM: {roomId}
          </h1>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '2rem', 
            flexWrap: 'wrap',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: '#FF9800',
              border: '4px solid #F57C00',
              borderRadius: '16px',
              padding: '1rem 1.5rem',
              textAlign: 'center',
              boxShadow: '0 6px 0 #E65100, 0 8px 16px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}>
              <div style={{ 
                fontSize: '1.5rem', 
                marginBottom: '0.5rem',
                textShadow: '2px 2px 0px #F57C00'
              }}>
                ⏰
              </div>
              <div style={{ 
                color: 'white', 
                fontSize: '1rem',
                fontWeight: 'bold',
                textShadow: '1px 1px 0px #F57C00',
                letterSpacing: '1px'
              }}>
                EXPIRES: {timeLeft}
              </div>
            </div>
            {isCreator && stats && (
              <div style={{
                background: '#9C27B0',
                border: '4px solid #7B1FA2',
                borderRadius: '16px',
                padding: '1rem 1.5rem',
                textAlign: 'center',
                boxShadow: '0 6px 0 #4A148C, 0 8px 16px rgba(0,0,0,0.3)',
                fontFamily: 'monospace'
              }}>
                <div style={{ 
                  fontSize: '1.5rem', 
                  marginBottom: '0.5rem',
                  textShadow: '2px 2px 0px #7B1FA2'
                }}>
                  👥
                </div>
                <div style={{ 
                  color: 'white', 
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  textShadow: '1px 1px 0px #7B1FA2',
                  letterSpacing: '1px'
                }}>
                  {stats.totalSubmissions} SUBMISSIONS
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '3rem', 
          margin: '2rem auto',
          flexWrap: 'wrap',
          maxWidth: '1200px'
        }}>
          {/* File Upload Section - Pixel Art Island */}
          <div style={{
            background: '#4CAF50',
            border: '4px solid #2E7D32',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 8px 0 #1B5E20, 0 12px 20px rgba(0,0,0,0.3)',
            fontFamily: 'monospace'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: 'white', 
              marginBottom: '1.5rem',
              textShadow: '2px 2px 0px #2E7D32',
              letterSpacing: '1px'
            }}>
              {hasSubmission ? 'UPDATE YOUR FILES' : 'UPLOAD FILES'}
            </h2>
            
            {hasSubmission && (
              <div style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem', 
                background: '#2E7D32', 
                borderRadius: '12px', 
                border: '3px solid #1B5E20',
                textAlign: 'center'
              }}>
                <div style={{ 
                  color: 'white', 
                  marginBottom: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  textShadow: '1px 1px 0px #1B5E20'
                }}>
                  ✅ YOU HAVE ALREADY SUBMITTED FILES
                </div>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: 'white', 
                  marginBottom: '1rem',
                  textShadow: '1px 1px 0px #1B5E20'
                }}>
                  Uploading new files will add to your previous submission.
                </p>
                
                {/* Participant File List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                  {submission.yamlFiles.map((file, idx) => (
                    <div key={idx} style={{ background: '#1B5E20', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'white', wordBreak: 'break-all', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {file.split('_').slice(1).join('_')}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleViewFile(file)} title="View/Edit" style={{ background: '#10b981', color: 'white', padding: '0.4rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 0 #059669' }}>👁️ / ✏️</button>
                        <button onClick={() => handleIndividualDownload(file)} title="Download" style={{ background: '#3b82f6', color: 'white', padding: '0.4rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 0 #1d4ed8' }}>⬇️</button>
                      </div>
                    </div>
                  ))}
                  {submission.apworldFiles.map((file, idx) => (
                    <div key={idx} style={{ background: '#4A148C', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'white', wordBreak: 'break-all', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {file.split('_').slice(1).join('_')}
                      </span>
                      <button onClick={() => handleIndividualDownload(file)} title="Download" style={{ background: '#8b5cf6', color: 'white', padding: '0.4rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 0 #6d28d9' }}>⬇️</button>
                    </div>
                  ))}
                </div>

                <div 
                  onClick={handleCancelSubmission}
                  style={{
                    background: '#F44336',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: isCancelling ? 'not-allowed' : 'pointer',
                    opacity: isCancelling ? 0.6 : 1,
                    transition: 'all 0.2s',
                    textShadow: '1px 1px 0px #C62828',
                    letterSpacing: '1px',
                    border: '2px solid #C62828',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => {
                    if (!isCancelling) {
                      e.currentTarget.style.background = '#C62828';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isCancelling) {
                      e.currentTarget.style.background = '#F44336';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {isCancelling ? 'CANCELLING...' : '🗑️ CANCEL SUBMISSION'}
                </div>
              </div>
            )}

            <div
              {...getRootProps()}
              style={{
                border: isDragActive ? '4px solid #1B5E20' : '3px dashed #2E7D32',
                background: isDragActive ? '#1B5E20' : '#2E7D32',
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.6 : 1,
                transition: 'all 0.2s ease',
                marginBottom: '1.5rem'
              }}
            >
              <input {...getInputProps()} />
              <div style={{ 
                fontSize: '3rem', 
                marginBottom: '1rem',
                textShadow: '2px 2px 0px #1B5E20'
              }}>
                📤
              </div>
              {isUploading ? (
                <div>
                  <p style={{ 
                    fontSize: '1.2rem', 
                    fontWeight: 'bold', 
                    color: 'white', 
                    marginBottom: '1rem',
                    textShadow: '2px 2px 0px #1B5E20',
                    letterSpacing: '1px'
                  }}>
                    UPLOADING FILES...
                  </p>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    background: '#1B5E20', 
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: '2px solid #0D4F1A'
                  }}>
                    <div style={{ 
                      width: '100%', 
                      height: '100%', 
                      background: '#4CAF50',
                      animation: 'loading 1.5s ease-in-out infinite'
                    }}></div>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 'bold', 
                    color: 'white', 
                    marginBottom: '0.5rem',
                    textShadow: '2px 2px 0px #1B5E20',
                    letterSpacing: '1px'
                  }}>
                    {isDragActive ? 'DROP FILES HERE' : 'DRAG & DROP FILES HERE, OR CLICK TO SELECT'}
                  </p>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: 'white',
                    textShadow: '1px 1px 0px #1B5E20'
                  }}>
                    All file types accepted - .apworld files are treated as APWorld, everything else as YAML
                  </p>
                </div>
              )}
            </div>

            {submission && (
              <div style={{ 
                marginTop: '1.5rem',
                background: '#1B5E20',
                borderRadius: '12px',
                padding: '1rem',
                border: '2px solid #0D4F1A'
              }}>
                <h3 style={{ 
                  fontWeight: 'bold', 
                  color: 'white', 
                  marginBottom: '1rem',
                  textShadow: '1px 1px 0px #0D4F1A',
                  letterSpacing: '1px',
                  fontSize: '1rem'
                }}>
                  CURRENT SUBMISSION:
                </h3>
                {submission.yamlFiles.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: 'white', 
                      marginBottom: '0.5rem',
                      textShadow: '1px 1px 0px #0D4F1A',
                      fontWeight: 'bold'
                    }}>
                      YAML FILES ({submission.yamlFiles.length}):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {submission.yamlFiles.map((file, index) => (
                        <span key={index} style={{
                          background: '#2E7D32',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          textShadow: '1px 1px 0px #1B5E20',
                          border: '1px solid #1B5E20'
                        }}>
                          {file.split('_').slice(1).join('_')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {submission.apworldFiles.length > 0 && (
                  <div>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: 'white', 
                      marginBottom: '0.5rem',
                      textShadow: '1px 1px 0px #0D4F1A',
                      fontWeight: 'bold'
                    }}>
                      APWORLD FILES ({submission.apworldFiles.length}):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {submission.apworldFiles.map((file, index) => (
                        <span key={index} style={{
                          background: '#7B1FA2',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          textShadow: '1px 1px 0px #4A148C',
                          border: '1px solid #4A148C'
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
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2rem',
            minWidth: '300px',
            maxWidth: '400px'
          }}>
            {/* Share Room Island */}
            <div style={{
              background: '#FF9800',
              border: '4px solid #F57C00',
              borderRadius: '20px',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 8px 0 #E65100, 0 12px 20px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                color: 'white', 
                marginBottom: '1rem',
                textShadow: '2px 2px 0px #F57C00',
                letterSpacing: '1px'
              }}>
                SHARE ROOM
              </h3>
              <div 
                onClick={copyRoomLink}
                style={{
                  background: '#F57C00',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  textShadow: '1px 1px 0px #E65100',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '2px solid #E65100',
                  marginBottom: '1rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#E65100';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#F57C00';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                📋 COPY ROOM LINK
              </div>
              <p style={{ 
                fontSize: '0.9rem', 
                color: 'white', 
                textAlign: 'center',
                textShadow: '1px 1px 0px #F57C00'
              }}>
                Share this link with others to let them upload files
              </p>
            </div>

            {/* Creator Controls Island */}
            {isCreator && stats && (
              <div style={{
                background: '#9C27B0',
                border: '4px solid #7B1FA2',
                borderRadius: '20px',
                padding: '1.5rem',
                textAlign: 'center',
                boxShadow: '0 8px 0 #4A148C, 0 12px 20px rgba(0,0,0,0.3)',
                fontFamily: 'monospace'
              }}>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  color: 'white', 
                  marginBottom: '1rem',
                  textShadow: '2px 2px 0px #7B1FA2',
                  letterSpacing: '1px'
                }}>
                  ROOM STATISTICS
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '1rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '0.75rem', 
                    background: '#7B1FA2', 
                    borderRadius: '12px',
                    border: '2px solid #4A148C'
                  }}>
                    <div style={{ 
                      fontSize: '2rem', 
                      marginBottom: '0.5rem',
                      textShadow: '2px 2px 0px #4A148C'
                    }}>👥</div>
                    <p style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      color: 'white',
                      textShadow: '1px 1px 0px #4A148C',
                      marginBottom: '0.25rem'
                    }}>
                      {stats.totalSubmissions}
                    </p>
                    <p style={{ 
                      fontSize: '0.8rem', 
                      color: 'white',
                      textShadow: '1px 1px 0px #4A148C',
                      fontWeight: 'bold'
                    }}>
                      SUBMISSIONS
                    </p>
                  </div>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '0.75rem', 
                    background: '#7B1FA2', 
                    borderRadius: '12px',
                    border: '2px solid #4A148C'
                  }}>
                    <div style={{ 
                      fontSize: '2rem', 
                      marginBottom: '0.5rem',
                      textShadow: '2px 2px 0px #4A148C'
                    }}>📄</div>
                    <p style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      color: 'white',
                      textShadow: '1px 1px 0px #4A148C',
                      marginBottom: '0.25rem'
                    }}>
                      {stats.totalYamlFiles + stats.totalApworldFiles}
                    </p>
                    <p style={{ 
                      fontSize: '0.8rem', 
                      color: 'white',
                      textShadow: '1px 1px 0px #4A148C',
                      fontWeight: 'bold'
                    }}>
                      TOTAL FILES
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div 
                    onClick={() => handleDownload('yaml')}
                    style={{
                      background: stats.totalYamlFiles === 0 ? '#666' : '#3b82f6',
                      color: 'white',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      textShadow: '1px 1px 0px #1e40af',
                      letterSpacing: '1px',
                      cursor: stats.totalYamlFiles === 0 ? 'not-allowed' : 'pointer',
                      opacity: stats.totalYamlFiles === 0 ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      border: '2px solid #1e40af',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (stats.totalYamlFiles > 0) {
                        e.currentTarget.style.background = '#1e40af';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (stats.totalYamlFiles > 0) {
                        e.currentTarget.style.background = '#3b82f6';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    📥 DOWNLOAD YAML FILES ({stats.totalYamlFiles})
                  </div>
                  <div 
                    onClick={() => handleDownload('apworld')}
                    style={{
                      background: stats.totalApworldFiles === 0 ? '#666' : '#8b5cf6',
                      color: 'white',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      textShadow: '1px 1px 0px #6d28d9',
                      letterSpacing: '1px',
                      cursor: stats.totalApworldFiles === 0 ? 'not-allowed' : 'pointer',
                      opacity: stats.totalApworldFiles === 0 ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      border: '2px solid #6d28d9',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (stats.totalApworldFiles > 0) {
                        e.currentTarget.style.background = '#6d28d9';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (stats.totalApworldFiles > 0) {
                        e.currentTarget.style.background = '#8b5cf6';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    📦 DOWNLOAD APWORLD FILES ({stats.totalApworldFiles})
                  </div>
                </div>
              </div>
            )}

            {/* Non-creator message Island */}
            {!isCreator && (
              <div style={{
                background: '#FF5722',
                border: '4px solid #D84315',
                borderRadius: '20px',
                padding: '1.5rem',
                textAlign: 'center',
                boxShadow: '0 8px 0 #BF360C, 0 12px 20px rgba(0,0,0,0.3)',
                fontFamily: 'monospace'
              }}>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  color: 'white', 
                  marginBottom: '1rem',
                  textShadow: '2px 2px 0px #D84315',
                  letterSpacing: '1px'
                }}>
                  ROOM ACCESS
                </h3>
                <div style={{ 
                  padding: '1rem', 
                  background: '#D84315', 
                  borderRadius: '12px', 
                  border: '2px solid #BF360C',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    fontSize: '2.5rem', 
                    marginBottom: '0.5rem',
                    textShadow: '2px 2px 0px #BF360C'
                  }}>👤</div>
                  <p style={{ 
                    color: 'white', 
                    fontWeight: 'bold', 
                    marginBottom: '0.5rem',
                    textShadow: '1px 1px 0px #BF360C',
                    fontSize: '1rem'
                  }}>
                    YOU ARE A PARTICIPANT
                  </p>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: 'white',
                    textShadow: '1px 1px 0px #BF360C'
                  }}>
                    Only the room creator can download files. You can upload your files and edit your submission.
                  </p>
                </div>
              </div>
            )}

            {/* Room Info Island */}
            <div style={{
              background: '#607D8B',
              border: '4px solid #455A64',
              borderRadius: '20px',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 8px 0 #263238, 0 12px 20px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                color: 'white', 
                marginBottom: '1rem',
                textShadow: '2px 2px 0px #455A64',
                letterSpacing: '1px'
              }}>
                ROOM INFORMATION
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  background: '#455A64',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #263238'
                }}>
                  <span style={{ 
                    color: 'white', 
                    fontWeight: 'bold',
                    textShadow: '1px 1px 0px #263238'
                  }}>CREATED:</span>
                  <span style={{ 
                    color: 'white',
                    textShadow: '1px 1px 0px #263238'
                  }}>
                    {new Date(room.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  background: '#455A64',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #263238'
                }}>
                  <span style={{ 
                    color: 'white', 
                    fontWeight: 'bold',
                    textShadow: '1px 1px 0px #263238'
                  }}>EXPIRES:</span>
                  <span style={{ 
                    color: 'white',
                    textShadow: '1px 1px 0px #263238'
                  }}>
                    {new Date(room.expiresAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  background: '#455A64',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #263238'
                }}>
                  <span style={{ 
                    color: 'white', 
                    fontWeight: 'bold',
                    textShadow: '1px 1px 0px #263238'
                  }}>STATUS:</span>
                  <span style={{
                    background: timeLeft === 'Expired' ? '#F44336' : '#4CAF50',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 0px #000',
                    border: '1px solid #000'
                  }}>
                    {timeLeft === 'Expired' ? 'EXPIRED' : 'ACTIVE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Creator Dashboard Section */}
        {isCreator && allFiles && (
          <div style={{ 
            marginTop: '3rem', 
            maxWidth: '1200px', 
            margin: '3rem auto 0', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '2rem' 
          }}>
            <h2 style={{ 
              fontSize: '2rem', 
              color: 'white', 
              textShadow: '2px 2px 0 #1e40af', 
              textAlign: 'center', 
              fontFamily: 'monospace' 
            }}>
              👑 CREATOR DASHBOARD
            </h2>
            <div style={{ 
              background: '#1e3a8a', 
              padding: '2rem', 
              borderRadius: '20px', 
              border: '4px solid #1e40af', 
              boxShadow: '0 8px 0 #172554' 
            }}>
              <h3 style={{ color: 'white', marginBottom: '1rem', borderBottom: '2px solid #3b82f6', paddingBottom: '0.5rem', fontFamily: 'monospace' }}>
                YAML Files ({allFiles.yamlFiles.length})
              </h3>
              {allFiles.yamlFiles.length === 0 ? (
                <p style={{ color: '#93c5fd' }}>No YAML files uploaded yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {allFiles.yamlFiles.map((file, idx) => (
                    <div key={idx} style={{ 
                      background: '#2563eb', 
                      padding: '1rem', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      border: '2px solid #1d4ed8'
                    }}>
                      <span style={{ color: 'white', wordBreak: 'break-all', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {file.split('_').slice(1).join('_')}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleViewFile(file)} 
                          title="View File"
                          style={{ background: '#10b981', color: 'white', padding: '0.5rem', borderRadius: '5px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 0 #059669' }}>
                          👁️
                        </button>
                        <button 
                          onClick={() => handleIndividualDownload(file)} 
                          title="Download File"
                          style={{ background: '#3b82f6', color: 'white', padding: '0.5rem', borderRadius: '5px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 0 #1d4ed8' }}>
                          ⬇️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <h3 style={{ color: 'white', marginBottom: '1rem', marginTop: '2rem', borderBottom: '2px solid #8b5cf6', paddingBottom: '0.5rem', fontFamily: 'monospace' }}>
                APWorld Files ({allFiles.apworldFiles.length})
              </h3>
              {allFiles.apworldFiles.length === 0 ? (
                <p style={{ color: '#c4b5fd' }}>No APWorld files uploaded yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {allFiles.apworldFiles.map((file, idx) => (
                    <div key={idx} style={{ 
                      background: '#8b5cf6', 
                      padding: '1rem', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      border: '2px solid #6d28d9'
                    }}>
                      <span style={{ color: 'white', wordBreak: 'break-all', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {file.split('_').slice(1).join('_')}
                      </span>
                      <button 
                        onClick={() => handleIndividualDownload(file)} 
                        title="Download File"
                        style={{ background: '#6d28d9', color: 'white', padding: '0.5rem', borderRadius: '5px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 0 #4c1d95' }}>
                        ⬇️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Text Editor Modal */}
      {isEditorOpen && editorFile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex',
          justifyContent: 'center', alignItems: 'center', padding: '2rem'
        }}>
          <div style={{ 
            background: '#1e1e1e', 
            borderRadius: '12px', 
            width: '100%', 
            maxWidth: '900px', 
            height: '85%', 
            display: 'flex', 
            flexDirection: 'column', 
            border: '2px solid #333',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2d2d2d', borderTopLeftRadius: '10px', borderTopRightRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📄</span>
                <h3 style={{ color: 'white', margin: 0, fontFamily: 'monospace' }}>
                  {editorFile.name.split('_').slice(1).join('_')}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={handleSaveFile}
                  disabled={isSaving}
                  style={{ 
                    background: isSaving ? '#666' : '#10b981', 
                    color: 'white', 
                    border: 'none', 
                    padding: '0.5rem 1.5rem', 
                    borderRadius: '6px', 
                    cursor: isSaving ? 'not-allowed' : 'pointer', 
                    fontWeight: 'bold', 
                    fontFamily: 'monospace', 
                    boxShadow: isSaving ? 'none' : '0 2px 0 #059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseOver={(e) => { if (!isSaving) e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseOut={(e) => { if (!isSaving) e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  {isSaving ? '⏳ SAVING...' : '💾 SAVE CHANGES'}
                </button>
                <button 
                  onClick={() => setIsEditorOpen(false)} 
                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'monospace', boxShadow: '0 2px 0 #b91c1c' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  CLOSE
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem', backgroundColor: '#1e1e1e' }}>
              <div style={{ minHeight: '100%', border: '1px solid #333', borderRadius: '4px' }}>
                <Editor
                  value={editorContent}
                  onValueChange={setEditorContent}
                  highlight={code => Prism.highlight(code, Prism.languages.yaml, 'yaml')}
                  padding={15}
                  style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 14,
                    backgroundColor: '#1e1e1e',
                    color: '#e5e5e5',
                    minHeight: '100%',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
