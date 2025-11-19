import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAOV-ykmgk8kl8QvRLXjvg8k4rRg8efTSE",
  authDomain: "unibrilink-app.firebaseapp.com",
  projectId: "unibrilink-app",
  storageBucket: "unibrilink-app.firebasestorage.app",
  messagingSenderId: "114284669090",
  appId: "1:114284669090:web:b8a871fbf3afd26295cffb",
  measurementId: "G-9NQE0SL234"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);