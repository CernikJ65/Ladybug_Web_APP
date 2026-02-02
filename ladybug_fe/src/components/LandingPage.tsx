import React from 'react';
import Navbar from './landing/Navbar';
import Hero from './landing/Hero';
import Features from './landing/Features';
import AboutProject from './landing/AboutProject';
import Footer from './landing/Footer';
import './styles/landing.css';

interface LandingPageProps {
  onFeatureClick: (featureId: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onFeatureClick }) => {
  return (
    <div className="landing-container">
      <Navbar />
      <Hero />
      <Features onFeatureClick={onFeatureClick} />
      <AboutProject />
      <Footer />
    </div>
  );
};

export default LandingPage;