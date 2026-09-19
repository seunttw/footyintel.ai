// ============================================================
//  FootyIntel AI — auth.js  (Firebase edition)
//  Wraps Firebase Auth + Firestore for session & plan gating
// ============================================================

// Firebase is loaded via CDN scripts in each HTML page.
// This file exposes the same Auth.* API the rest of the app uses
// so nothing else needs to change.

const Auth = (() => {

  const PLAN_LEVELS = { FREE: 1, BASIC: 1, PRO: 2, PREMIUM: 3 };

  // ── Internal state ──────────────────────────────────────
  let _user     = null;   // Firebase user object
  let _profile  = null;   // Firestore profile doc { name, plan, country, joined… }
  let _ready    = false;
  const _listeners = [];

  // ── Called once Firebase loads (see _initFirebase below) ─
  function _onAuthStateChange(firebaseUser) {
    _user = firebaseUser;
    if (firebaseUser) {
      // Load Firestore profile
      const db = firebase.firestore();
      db.collection('users').doc(firebaseUser.uid).get()
        .then(doc => {
          _profile = doc.exists ? doc.data() : { plan: 'FREE', name: firebaseUser.displayName || '' };
          _ready   = true;
          _listeners.forEach(fn => fn());
        })
        .catch(() => {
          _profile = { plan: 'FREE' };
          _ready   = true;
          _listeners.forEach(fn => fn());
        });
    } else {
      _profile = null;
      _ready   = true;
      _listeners.forEach(fn => fn());
    }
  }

  function onReady(fn) {
    if (_ready) fn();
    else _listeners.push(fn);
  }

  // ── Session helpers ─────────────────────────────────────
  function isLoggedIn()  { return !!_user; }
  function getUser()     { return _user; }
  function getProfile()  { return _profile || {}; }

  function getPlan() {
    const p = (_profile?.plan || 'FREE').toUpperCase();
    return PLAN_LEVELS[p] ? p : 'FREE';
  }

  // ── Signup ──────────────────────────────────────────────
  async function signup(name, email, password, plan = 'FREE', country = '') {
    const auth = firebase.auth();
    const db   = firebase.firestore();

    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    const profile = {
      name,
      email,
      country,
      plan: plan.toUpperCase(),
      joined: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
      joinedTs: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(cred.user.uid).set(profile);
    _profile = profile;
    return { success: true, user: cred.user };
  }

  // ── Login ───────────────────────────────────────────────
  async function login(email, password) {
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    return { success: true, user: cred.user };
  }

  // ── Logout ──────────────────────────────────────────────
  async function logout() {
    await firebase.auth().signOut();
    window.location.href = 'login.html';
  }

  // ── Update plan (called from pricing page) ──────────────
  async function updatePlan(plan) {
    if (!_user) return;
    const db = firebase.firestore();
    await db.collection('users').doc(_user.uid).update({ plan: plan.toUpperCase() });
    if (_profile) _profile.plan = plan.toUpperCase();
  }

  // ── Plan gating ─────────────────────────────────────────
  function hasAccess(requiredPlan) {
    const userLevel     = PLAN_LEVELS[getPlan()]                          || 1;
    const requiredLevel = PLAN_LEVELS[(requiredPlan||'FREE').toUpperCase()] || 1;
    return userLevel >= requiredLevel;
  }

  function requirePlan(requiredPlan, onDeny) {
    if (!hasAccess(requiredPlan)) {
      if (typeof onDeny === 'function') onDeny();
      return false;
    }
    return true;
  }

  // ── Init Firebase auth listener ─────────────────────────
  function _initFirebase() {
    if (typeof firebase === 'undefined') {
      console.error('FootyIntel: Firebase not loaded');
      return;
    }
    firebase.auth().onAuthStateChanged(_onAuthStateChange);
  }

  // Run when DOM is ready (Firebase SDKs load before this via <script> tags)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initFirebase);
  } else {
    _initFirebase();
  }

  return {
    onReady,
    isLoggedIn,
    getUser,
    getProfile,
    getPlan,
    login,
    signup,
    logout,
    updatePlan,
    hasAccess,
    requirePlan,
  };

})();
