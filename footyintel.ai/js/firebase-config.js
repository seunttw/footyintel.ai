// ============================================================
//  FootyIntel AI — Firebase Config
//  Replace the values below with your Firebase project config.
//  Get them from: Firebase Console → Project Settings → Your Apps
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCzhakcCg-NbLJZjOvLSzIuGFPUWzKL2cQ",
  authDomain: "footyintel-bb98a.firebaseapp.com",
  projectId: "footyintel-bb98a",
  storageBucket: "footyintel-bb98a.firebasestorage.app",
  messagingSenderId: "413115523888",
  appId: "1:413115523888:web:fc87af321cbefbae26def5"
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
