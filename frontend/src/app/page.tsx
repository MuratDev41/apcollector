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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="container">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
            APCollector
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)', maxWidth: '600px', margin: '0 auto' }}>
            Create temporary rooms to collect YAML and APWorld files from multiple users. 
            Files are automatically deleted after 24 hours.
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-2" style={{ maxWidth: '800px', margin: '0 auto 4rem auto' }}>
          {/* Create Room */}
          <div className="card">
            <div className="text-center mb-4">
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: '#3b82f6', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1rem auto',
                color: 'white',
                fontSize: '24px'
              }}>
                +
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                Create New Room
              </h2>
              <p style={{ color: '#6b7280' }}>
                Start a new collection room and share the link with others
              </p>
            </div>
            <button
              className="button"
              onClick={handleCreateRoom}
              disabled={isCreating}
              style={{ width: '100%' }}
            >
              {isCreating ? 'Creating Room...' : 'Create Room'}
            </button>
          </div>

          {/* Join Room */}
          <div className="card">
            <div className="text-center mb-4">
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: '#10b981', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1rem auto',
                color: 'white',
                fontSize: '24px'
              }}>
                ↗
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                Join Existing Room
              </h2>
              <p style={{ color: '#6b7280' }}>
                Enter a room ID to upload your files
              </p>
            </div>
            <input
              className="input"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <button
              className="button"
              onClick={handleJoinRoom}
              style={{ width: '100%', background: '#10b981' }}
            >
              Join Room
            </button>
          </div>
        </div>

        {/* Features */}
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', color: 'white', marginBottom: '3rem' }}>
            How It Works
          </h3>
          <div className="grid grid-cols-2" style={{ gap: '2rem' }}>
            <div className="card text-center">
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: '#8b5cf6', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1rem auto',
                color: 'white',
                fontSize: '24px'
              }}>
                👥
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                Share & Collect
              </h4>
              <p style={{ color: '#6b7280' }}>
                Create a room and share the URL. Multiple users can upload their YAML and APWorld files.
              </p>
            </div>

            <div className="card text-center">
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: '#f59e0b', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1rem auto',
                color: 'white',
                fontSize: '24px'
              }}>
                📤
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                One-Time Upload
              </h4>
              <p style={{ color: '#6b7280' }}>
                Each user can only upload once, but they can edit their submission if needed.
              </p>
            </div>

            <div className="card text-center" style={{ gridColumn: '1 / -1', maxWidth: '400px', margin: '0 auto' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: '#ef4444', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1rem auto',
                color: 'white',
                fontSize: '24px'
              }}>
                ⏰
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                Auto-Cleanup
              </h4>
              <p style={{ color: '#6b7280' }}>
                Rooms and all files are automatically deleted after 24 hours for privacy.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center" style={{ marginTop: '4rem', color: 'rgba(255,255,255,0.6)' }}>
          <p>APCollector - Secure temporary file sharing</p>
        </div>
      </div>
    </div>
  );
}
