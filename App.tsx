// App.tsx
import React from 'react';
import { HomeScreen } from './app/screens/HomeScreen';
import { initializeAllSchemas } from './app/core/services/storage/schema';

// Initialize database tables before the app renders
//sprint 2 database intialize all schema
initializeAllSchemas(); //function located in services storage index.ts

export default function App() {
  return <HomeScreen />;
}
