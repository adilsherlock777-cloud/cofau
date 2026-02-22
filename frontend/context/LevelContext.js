import React, { createContext, useContext, useState } from 'react';

const LevelContext = createContext();

export const LevelProvider = ({ children }) => {
  const [showAnimation, setShowAnimation] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(null);

  const showLevelUpAnimation = (levelNumber) => {
    setCurrentLevel(levelNumber);
    setShowAnimation(true);
  };

  const hideLevelUpAnimation = () => {
    setShowAnimation(false);
    setCurrentLevel(null);
  };

  return (
    <LevelContext.Provider
      value={{
        showAnimation,
        currentLevel,
        showLevelUpAnimation,
        hideLevelUpAnimation,
      }}
    >
      {children}
    </LevelContext.Provider>
  );
};

export const useLevelAnimation = () => {
  const context = useContext(LevelContext);
  if (!context) {
    throw new Error('useLevelAnimation must be used within LevelProvider');
  }
  return context;
};
