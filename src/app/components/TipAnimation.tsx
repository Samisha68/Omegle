// components/TipAnimation.tsx
import { FC, useEffect, useState } from 'react';

interface TipAnimationProps {
  onComplete: () => void;
}

const TipAnimation: FC<TipAnimationProps> = ({ onComplete }) => {
  const [visible, setVisible] = useState<boolean>(true);
  
  useEffect(() => {
    // Animation lasts for 2.5 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 2500);
    
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  if (!visible) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="relative">
        {/* Coin shower animation */}
        <div className="absolute top-0 left-0 right-0 h-64 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}px`,
                animationDuration: `${1 + Math.random() * 1.5}s`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            >
              <div className="w-8 h-8 rounded-full bg-yellow-400 text-yellow-800 flex items-center justify-center text-xs font-bold animate-spin">
                SOL
              </div>
            </div>
          ))}
        </div>
        
        {/* Tip message */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-8 py-6 rounded-xl shadow-lg animate-bounce">
          <h3 className="text-2xl font-bold">Tip Sent! 🎉</h3>
          <p className="mt-2">You made someone's day!</p>
        </div>
      </div>
    </div>
  );
};

export default TipAnimation;