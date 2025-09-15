'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';

export default function Home() {
  const [isCreating, setIsCreating] = useState(false);
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const { roomId: newRoomId } = await apiClient.createRoom();
      toast.success('Room created successfully!');
      router.push(`/room/${newRoomId}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      toast.error('Please enter a room ID');
      return;
    }
    router.push(`/room/${roomId.trim()}`);
  };

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
        top: '20%',
        left: '10%',
        fontSize: '3rem',
        opacity: 0.6,
        animation: 'float 6s ease-in-out infinite'
      }}>
        🏔️
      </div>
      <div style={{
        position: 'absolute',
        top: '60%',
        right: '15%',
        fontSize: '2.5rem',
        opacity: 0.5,
        animation: 'float 8s ease-in-out infinite reverse'
      }}>
        ☁️
      </div>
      <div style={{
        position: 'absolute',
        top: '40%',
        left: '5%',
        fontSize: '2rem',
        opacity: 0.4,
        animation: 'float 7s ease-in-out infinite'
      }}>
        🌊
      </div>
      <div style={{
        position: 'absolute',
        top: '70%',
        right: '5%',
        fontSize: '2.5rem',
        opacity: 0.6,
        animation: 'float 9s ease-in-out infinite reverse'
      }}>
        🏔️
      </div>
      
      {/* CSS Animation for floating elements */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
      `}</style>
      
      <div className="container" style={{ position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div className="text-center mb-8" style={{ paddingTop: '2rem' }}>
          <h1 style={{ 
            fontSize: '4rem', 
            fontWeight: 'bold', 
            color: 'white', 
            marginBottom: '1rem',
            fontFamily: 'monospace',
            textShadow: '3px 3px 0px #2A70C2, 6px 6px 0px #1A60B2',
            letterSpacing: '2px'
          }}>
            APCOLLECTOR
          </h1>
          <p style={{ 
            fontSize: '1.5rem', 
            color: 'white', 
            maxWidth: '700px', 
            margin: '0 auto',
            fontFamily: 'monospace',
            textShadow: '2px 2px 0px #2A70C2',
            letterSpacing: '1px'
          }}>
            temporary file sharing for lazy people
          </p>
        </div>

        {/* Main Actions - Pixel Art Islands */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '3rem', 
          margin: '3rem auto',
          flexWrap: 'wrap'
        }}>
          {/* Create Room Island */}
          <div style={{
            background: '#4CAF50',
            border: '4px solid #2E7D32',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            minWidth: '300px',
            position: 'relative',
            boxShadow: '0 8px 0 #1B5E20, 0 12px 20px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            transform: 'translateY(0)',
            fontFamily: 'monospace'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 0 #1B5E20, 0 16px 24px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 0 #1B5E20, 0 12px 20px rgba(0,0,0,0.3)';
          }}
          onClick={handleCreateRoom}
          >
            <div style={{ 
              fontSize: '3rem', 
              marginBottom: '1rem',
              textShadow: '2px 2px 0px #2E7D32'
            }}>
              🏝️
            </div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: 'white', 
              marginBottom: '0.5rem',
              textShadow: '2px 2px 0px #2E7D32',
              letterSpacing: '1px'
            }}>
              CREATE ROOM
            </h2>
            <p style={{ 
              color: 'white', 
              fontSize: '1rem',
              textShadow: '1px 1px 0px #2E7D32',
              marginBottom: '1rem'
            }}>
              Start collecting files
            </p>
            <div style={{
              background: '#2E7D32',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              textShadow: '1px 1px 0px #1B5E20',
              letterSpacing: '1px'
            }}>
              {isCreating ? 'CREATING...' : 'START'}
            </div>
          </div>

          {/* Join Room Island */}
          <div style={{
            background: '#FF9800',
            border: '4px solid #F57C00',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            minWidth: '300px',
            position: 'relative',
            boxShadow: '0 8px 0 #E65100, 0 12px 20px rgba(0,0,0,0.3)',
            fontFamily: 'monospace'
          }}>
            <div style={{ 
              fontSize: '3rem', 
              marginBottom: '1rem',
              textShadow: '2px 2px 0px #F57C00'
            }}>
              🚢
            </div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: 'white', 
              marginBottom: '0.5rem',
              textShadow: '2px 2px 0px #F57C00',
              letterSpacing: '1px'
            }}>
              JOIN ROOM
            </h2>
            <p style={{ 
              color: 'white', 
              fontSize: '1rem',
              textShadow: '1px 1px 0px #F57C00',
              marginBottom: '1rem'
            }}>
              Enter room ID below
            </p>
            <input
              placeholder="ROOM ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                border: '3px solid #E65100',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'monospace',
                textAlign: 'center',
                fontWeight: 'bold',
                letterSpacing: '1px',
                background: '#FFF3E0',
                color: '#E65100'
              }}
            />
            <div 
              style={{
                background: '#F57C00',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                textShadow: '1px 1px 0px #E65100',
                letterSpacing: '1px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={handleJoinRoom}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FF9800';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F57C00';
              }}
            >
              JOIN
            </div>
          </div>
        </div>

        {/* Features - Pixel Art Islands */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
          <h3 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            textAlign: 'center', 
            color: 'white', 
            marginBottom: '3rem',
            fontFamily: 'monospace',
            textShadow: '3px 3px 0px #2A70C2, 6px 6px 0px #1A60B2',
            letterSpacing: '2px'
          }}>
            HOW IT WORKS
          </h3>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '2rem', 
            flexWrap: 'wrap',
            marginBottom: '2rem'
          }}>
            {/* Share & Collect Island */}
            <div style={{
              background: '#9C27B0',
              border: '4px solid #7B1FA2',
              borderRadius: '16px',
              padding: '1.5rem',
              textAlign: 'center',
              minWidth: '250px',
              maxWidth: '300px',
              boxShadow: '0 6px 0 #4A148C, 0 8px 16px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}>
              <div style={{ 
                fontSize: '2.5rem', 
                marginBottom: '1rem',
                textShadow: '2px 2px 0px #7B1FA2'
              }}>
                👥
              </div>
              <h4 style={{ 
                fontSize: '1.2rem', 
                fontWeight: 'bold', 
                color: 'white', 
                marginBottom: '0.5rem',
                textShadow: '2px 2px 0px #7B1FA2',
                letterSpacing: '1px'
              }}>
                SHARE & COLLECT
              </h4>
              <p style={{ 
                color: 'white', 
                fontSize: '0.9rem',
                textShadow: '1px 1px 0px #7B1FA2',
                lineHeight: '1.4'
              }}>
                Create a room and share the URL. Multiple users can upload their files.
              </p>
            </div>

            {/* One-Time Upload Island */}
            <div style={{
              background: '#FF5722',
              border: '4px solid #D84315',
              borderRadius: '16px',
              padding: '1.5rem',
              textAlign: 'center',
              minWidth: '250px',
              maxWidth: '300px',
              boxShadow: '0 6px 0 #BF360C, 0 8px 16px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}>
              <div style={{ 
                fontSize: '2.5rem', 
                marginBottom: '1rem',
                textShadow: '2px 2px 0px #D84315'
              }}>
                📤
              </div>
              <h4 style={{ 
                fontSize: '1.2rem', 
                fontWeight: 'bold', 
                color: 'white', 
                marginBottom: '0.5rem',
                textShadow: '2px 2px 0px #D84315',
                letterSpacing: '1px'
              }}>
                ONE-TIME UPLOAD
              </h4>
              <p style={{ 
                color: 'white', 
                fontSize: '0.9rem',
                textShadow: '1px 1px 0px #D84315',
                lineHeight: '1.4'
              }}>
                Each user can only upload once, but they can edit their submission.
              </p>
            </div>
          </div>

          {/* Auto-Cleanup Island - Centered */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            marginTop: '1rem'
          }}>
            <div style={{
              background: '#F44336',
              border: '4px solid #C62828',
              borderRadius: '16px',
              padding: '1.5rem',
              textAlign: 'center',
              minWidth: '300px',
              maxWidth: '400px',
              boxShadow: '0 6px 0 #B71C1C, 0 8px 16px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}>
              <div style={{ 
                fontSize: '2.5rem', 
                marginBottom: '1rem',
                textShadow: '2px 2px 0px #C62828'
              }}>
                ⏰
              </div>
              <h4 style={{ 
                fontSize: '1.2rem', 
                fontWeight: 'bold', 
                color: 'white', 
                marginBottom: '0.5rem',
                textShadow: '2px 2px 0px #C62828',
                letterSpacing: '1px'
              }}>
                AUTO-CLEANUP
              </h4>
              <p style={{ 
                color: 'white', 
                fontSize: '0.9rem',
                textShadow: '1px 1px 0px #C62828',
                lineHeight: '1.4'
              }}>
                Rooms and all files are automatically deleted after 24 hours for privacy.
              </p>
            </div>
          </div>
        </div>

        {/* Footer - Pixel Art Landmass */}
        <div style={{ 
          marginTop: '4rem', 
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            background: '#4CAF50',
            border: '4px solid #2E7D32',
            borderRadius: '20px 20px 0 0',
            padding: '2rem',
            margin: '0 auto',
            maxWidth: '600px',
            boxShadow: '0 -8px 0 #1B5E20, 0 -12px 20px rgba(0,0,0,0.3)',
            fontFamily: 'monospace'
          }}>
            <p style={{ 
              color: 'white', 
              fontSize: '1.2rem',
              fontWeight: 'bold',
              textShadow: '2px 2px 0px #2E7D32',
              letterSpacing: '1px',
              marginBottom: '1rem'
            }}>
              APCOLLECTOR - BECAUSE IM LAZY TO DOWNLOAD FROM DISCORD
            </p>
            <a 
              href="https://github.com/MuratDev41/apcollector" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: 'white', 
                textDecoration: 'none',
                background: '#2E7D32',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                textShadow: '1px 1px 0px #1B5E20',
                letterSpacing: '1px',
                display: 'inline-block',
                transition: 'all 0.2s ease',
                border: '2px solid #1B5E20'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#1B5E20';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#2E7D32';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              🔗 VIEW ON GITHUB
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
