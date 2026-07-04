'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/actions/auth';

export default function SessionTimeoutWarning() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 minutes countdown
  
  const lastActivity = useRef<number>(Date.now());
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  // Inactivity threshold parameters (28 minutes warning, 30 minutes logout)
  const WARNING_LIMIT = 28 * 60 * 1000; 

  const handleLogout = async () => {
    cleanupTimers();
    await logout();
    router.push('/');
    router.refresh();
  };

  const handleStayLoggedIn = async () => {
    try {
      const res = await fetch('/api/auth/ping');
      if (res.ok) {
        lastActivity.current = Date.now();
        setShowModal(false);
        setCountdown(120);
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
      } else {
        // Session expired on server side
        handleLogout();
      }
    } catch {
      handleLogout();
    }
  };

  const cleanupTimers = () => {
    if (checkInterval.current) clearInterval(checkInterval.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  useEffect(() => {
    // Record activity timestamp on user events
    const updateActivity = () => {
      if (!showModal) {
        lastActivity.current = Date.now();
      }
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    // Periodically inspect inactivity gap
    checkInterval.current = setInterval(() => {
      const inactiveDuration = Date.now() - lastActivity.current;
      if (inactiveDuration >= WARNING_LIMIT && !showModal) {
        setShowModal(true);
      }
    }, 15000); // Check every 15 seconds

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      cleanupTimers();
    };
  }, [showModal]);

  // Handle warning countdown ticking down to auto-logout
  useEffect(() => {
    if (showModal) {
      setCountdown(120);
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    }

    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [showModal]);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
        <div className="text-orange-500 text-5xl font-bold">⏳</div>
        <h3 className="text-lg font-bold text-white">ਨਿਸ਼ਕਿਰਿਆ ਚੇਤਾਵਨੀ (Inactivity Warning)</h3>
        <p className="text-xs text-gray-400">
          ਤੁਹਾਡਾ ਸੈਸ਼ਨ ਨਿਸ਼ਕਿਰਿਆ ਕਾਰਨ {countdown} ਸਕਿੰਟਾਂ ਵਿੱਚ ਸਮਾਪਤ ਹੋ ਜਾਵੇਗਾ। ਕੀ ਤੁਸੀਂ ਲੌਗਇਨ ਰਹਿਣਾ ਚਾਹੁੰਦੇ ਹੋ?
        </p>
        <p className="text-[10px] text-gray-500 italic">
          (Your session will expire in {countdown} seconds due to inactivity. Do you wish to stay logged in?)
        </p>

        <div className="flex space-x-3 pt-3">
          <button
            onClick={handleLogout}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-xs transition duration-150 border border-gray-700"
          >
            Logout Now / ਬਾਹਰ ਜਾਓ
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl text-xs hover:bg-opacity-90 transition duration-150"
            style={{ backgroundColor: '#FF6B6B' }}
          >
            Stay Logged In / ਲੌਗਇਨ ਰਹੋ
          </button>
        </div>
      </div>
    </div>
  );
}
