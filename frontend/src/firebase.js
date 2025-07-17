// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD0D1Fud1ULNnarzqpChjoO5SUme9GkL3g",
  authDomain: "cloudchat-823c8.firebaseapp.com",
  databaseURL: "https://cloudchat-823c8-default-rtdb.firebaseio.com", // <-- Add this
  projectId: "cloudchat-823c8",
  storageBucket: "cloudchat-823c8.firebasestorage.app",
  messagingSenderId: "217776892374",
  appId: "1:217776892374:web:0ad487af52bcebc8b8dc77",
  measurementId: "G-T6DE7P3YNB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
