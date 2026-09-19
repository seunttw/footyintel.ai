// ============================================================
//  FootyIntel AI — planBadge.js
//  Reads plan from Firebase and updates the nav badge.
// ============================================================

(function () {
  function applyBadge(plan) {
    const badge = document.getElementById('nav-plan-badge');
    if (!badge) return;

    if (!plan) {
      badge.textContent = 'Sign In';
      badge.style.cursor = 'pointer';
      badge.onclick = () => { window.location.href = 'pages/login.html'; };
      badge.className = 'nav-plan-badge';
      return;
    }

    badge.textContent = plan;
    badge.setAttribute('data-plan', plan);
    badge.classList.remove('plan-free', 'plan-pro', 'plan-premium');
    if (plan === 'PRO')          badge.classList.add('plan-pro');
    else if (plan === 'PREMIUM') badge.classList.add('plan-premium');
    else                         badge.classList.add('plan-free');
  }

  function init() {
    if (typeof firebase === 'undefined') return;

    firebase.auth().onAuthStateChanged(async user => {
      if (!user) { applyBadge(null); return; }
      try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        const plan = doc.exists ? (doc.data().plan || 'FREE').toUpperCase() : 'FREE';
        applyBadge(plan);
      } catch {
        applyBadge('FREE');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
