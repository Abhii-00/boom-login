import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';

const SuccessContent = ({ memeFaceImage }) => {
  const videoToReplaceRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const setupCanvas = async () => {
      const video = videoToReplaceRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!video || !canvas || !ctx) return;

      try {
        const memeFaceImg = new Image();
        memeFaceImg.src = memeFaceImage;
        await new Promise(resolve => memeFaceImg.onload = resolve);

        const response = await fetch('/video-head-data.json');
        if (!response.ok) {
            throw new Error('Failed to load video-head-data.json');
        }
        const headData = await response.json();

        const renderFrame = () => {
          const frameIndex = Math.floor(video.currentTime * 30);
          const headInfo = headData[frameIndex];

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (headInfo) {
            const faceWidth = headInfo.width * 1.2;
            const faceHeight = headInfo.height * 1.2;
            ctx.drawImage(
              memeFaceImg,
              headInfo.x - (faceWidth - headInfo.width) / 2,
              headInfo.y - (faceHeight - headInfo.height) / 2,
              faceWidth,
              faceHeight
            );
          }
          
          if (!video.paused && !video.ended) {
            requestAnimationFrame(renderFrame);
          }
        };

        const handleVideoReady = () => {
          console.log("Video is ready, starting canvas drawing...");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          renderFrame();
        };
        
        if (video.readyState >= 2) {
          handleVideoReady();
        } else {
          video.addEventListener('loadeddata', handleVideoReady);
        }

        video.play().catch(error => {
            console.error("Video autoplay was prevented:", error);
        });

        return () => {
            video.removeEventListener('loadeddata', handleVideoReady);
        };

      } catch (error) {
        console.error("Error setting up success content:", error);
      }
    };
    
    setupCanvas();

  }, [memeFaceImage]);

  return (
    <div className="success-content">
      <video ref={videoToReplaceRef} src="/thoppi.mp4" autoPlay loop playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} className="ai-edited-video"></canvas>
    </div>
  );
};

function App() {
  const videoRef = useRef(null);
  const [isCameraGranted, setIsCameraGranted] = useState(false);
  const [appState, setAppState] = useState('login');
  
  const CORRECT_USERNAME = 'admin';
  const CORRECT_PASSWORD = 'password123';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isErrorState, setIsErrorState] = useState(false);

  const [memeFaceImage, setMemeFaceImage] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        console.log('Face-API models loaded successfully!');
      } catch (error) {
        console.error('Failed to load Face-API models:', error);
      }
    };
    loadModels();
  }, []);

  const requestCamera = async () => {
    try {
      setAppState('camera_granted');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setTimeout(() => {
          captureAndMemeifyPhoto();
        }, 2000);
      }
      setIsCameraGranted(true);
    } catch (e) {
      setAppState('login');
      setIsCameraGranted(false);
      alert('Camera permission is required to log in. Please enable it.');
    }
  };

  const captureAndMemeifyPhoto = async () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    const memeifiedDataURL = await memeifyFace(canvas.toDataURL('image/jpeg'));

    setMemeFaceImage(memeifiedDataURL);
    
    if (videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    
    setAppState('success');
  };

  const memeifyFace = async (imageDataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const detections = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (detections) {
          const landmarks = detections.landmarks;
          
          const mouth = landmarks.getMouth();
          
          const mustacheY = (mouth[0]._y + mouth[6]._y) / 2 - 10;
          
          ctx.fillStyle = '#333333';
          ctx.beginPath();
          ctx.ellipse(mouth[0]._x - 5, mustacheY, 25, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.ellipse(mouth[6]._x + 5, mustacheY, 25, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          const leftEyeCenter = { x: (leftEye[0]._x + leftEye[3]._x) / 2, y: (leftEye[0]._y + leftEye[3]._y) / 2 };
          const rightEyeCenter = { x: (rightEye[0]._x + rightEye[3]._x) / 2, y: (rightEye[0]._y + rightEye[3]._y) / 2 };

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(leftEyeCenter.x, leftEyeCenter.y, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(rightEyeCenter.x, rightEyeCenter.y, 15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(leftEyeCenter.x, leftEyeCenter.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(rightEyeCenter.x, rightEyeCenter.y, 5, 0, Math.PI * 2);
          ctx.fill();
          
        } else {
          console.log("No face detected for memeification.");
        }
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.src = imageDataUrl;
    });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === CORRECT_USERNAME && password === CORRECT_PASSWORD) {
      requestCamera();
    } else {
      alert('Incorrect username or password. Please try again.');
    }
  };
  
  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    if (newUsername !== CORRECT_USERNAME) {
      setIsErrorState(true);
      setPassword(newUsername);
    } else {
      setIsErrorState(false);
    }
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (isErrorState) {
      setUsername(newPassword);
    }
  };
  
  // New function to play the "Forgot Password?" audio
  const playForgotPasswordAudio = () => {
    const audio = new Audio('/forgetpassword.mp3');
    audio.play().catch(e => console.error("Audio playback failed:", e));
  };

  // New function to play the "Sign Up" audio
  const playRegisterAudio = () => {
    const audio = new Audio('/signup.mp3');
    audio.play().catch(e => console.error("Audio playback failed:", e));
  };


  const renderLoginContent = () => (
    <>
      <div className="login-header">
        <h2>Boom Login</h2>
        <p className="subtitle">സുരക്ഷിതമായ ആക്‌സസ്. പരിഹാസപരമായ UX. 100% അസംബന്ധം.</p>
        <img
          src="/explosion-fire-ai-generated-png.webp"
          alt="Blast logo"
          className="logo"
        />
      </div>

      <form className="login-form" onSubmit={handleLogin}>
        <input
          className="input"
          placeholder="Username"
          value={username}
          onChange={handleUsernameChange}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
        />
        <button className="main-btn" type="submit" disabled={!isCameraGranted}>
          Login
        </button>

        <div className="options">
          <button 
            type="button" 
            className="opt-btn"
            onClick={playRegisterAudio} // Calling the new function on click
          >
            Sign Up
          </button>
          <button 
            type="button" 
            className="opt-btn"
            onClick={playForgotPasswordAudio} // Calling the new function on click
          >
            Forgot Password?
          </button>
        </div>

        <div className="check-row">
          <label>
            <center><input type="checkbox" /> I agree Privacy Terms</center>
          </label>
        </div>
        
        <button
          className="camera-btn"
          type="button"
          onClick={requestCamera}
          disabled={isCameraGranted}
        >
          {isCameraGranted ? 'Camera Access Granted' : 'Access Camera'}
        </button>
        
        {appState === 'camera_granted' && (
          <div className="camera-modal">
            <video
              ref={videoRef}
              autoPlay
              muted
              width={320}
              height={240}
              className="camera-video"
            />
          </div>
        )}
      </form>
    </>
  );

  return (
    <>
      <div className="video-background">
        <video autoPlay loop muted playsInline>
          <source src="./public/background-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="login-page-container">
        <div className="login-box">
          {appState === 'success' ? <SuccessContent memeFaceImage={memeFaceImage} /> : renderLoginContent()}
        </div>
      </div>
    </>
  );
}

export default App;