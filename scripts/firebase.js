/**
 * firebase.js
 * Firebase 앱 초기화 및 Firestore 인스턴스를 export
 * 다른 모든 스크립트는 이 파일에서 db를 import해서 사용
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCwE_Yc9IjqfDXdTSff1D8yazBgotqP0_Y",
  authDomain: "skyhope-mileage.firebaseapp.com",
  projectId: "skyhope-mileage",
  storageBucket: "skyhope-mileage.firebasestorage.app",
  messagingSenderId: "372872658446",
  appId: "1:372872658446:web:947e893aea83082a18065f",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
