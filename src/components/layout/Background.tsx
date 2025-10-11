import React from 'react';
import { getGradientOverlay } from '../../config/themeConfig';

/**
 * Background Component
 * 
 * Reusable background component with image slideshow and gradient overlay.
 * Features smooth transitions between images with opacity and blur effects.
 * 
 * Gradient overlay color is controlled by themeConfig.ts - change ACTIVE_GRADIENT_OVERLAY
 * to test different color schemes.
 * 
 * Location: src/components/layout/Background.tsx
 * Purpose: Reusable background for pages
 */

interface BackgroundProps {
  images?: string[];
  interval?: number;
  singleImage?: string;
  className?: string;
}

const Background: React.FC<BackgroundProps> = ({ 
  images = [
    '/images/image_1.png',
    '/images/image_2.png', 
    '/images/image_3.jpeg',
    '/images/image_4.jpeg',
    '/images/image_5.jpg'
  ], 
  interval = 5000,
  singleImage,
  className = "fixed inset-0 -z-10"
}) => {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  
  const backgroundImages = singleImage ? [singleImage] : images;

  // Auto-advance slideshow (only if multiple images)
  React.useEffect(() => {
    if (backgroundImages.length <= 1) return;
    
    const slideInterval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % backgroundImages.length
      );
    }, interval);

    return () => clearInterval(slideInterval);
  }, [backgroundImages.length, interval]);

  return (
    <div className={className}>
      {/* Background Images */}
      {backgroundImages.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
            index === currentImageIndex
              ? 'opacity-100 blur-0'
              : 'opacity-0 blur-sm'
          }`}
          style={{
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'brightness(0.7) contrast(1.1)'
          }}
        />
      ))}

      {/* Gradient Overlay - Color controlled by themeConfig.ts */}
      <div className={`absolute inset-0 ${getGradientOverlay()}`} />
    </div>
  );
};

export default Background;

