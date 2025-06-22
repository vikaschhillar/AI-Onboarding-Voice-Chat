import React from "react";
import { VoiceAgent } from './components/VoiceAgent';

const App: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-center">AI Voice Chat App</h1>
      <VoiceAgent />
    </div>
  );
};

export default App;
