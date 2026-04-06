// Firebase configuration — replace with your Firebase project config
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDHJQHC2tQrUVsSURpD-HvRv_y5jz_pcXE",
  authDomain: "meetscribe-45727.firebaseapp.com",
  projectId: "meetscribe-45727",
  storageBucket: "meetscribe-45727.firebasestorage.app",
  messagingSenderId: "1031636948357",
  appId: "1:1031636948357:web:dbb9b97860eff6c986e0ec",
  measurementId: "G-8RCFDMWXV2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
