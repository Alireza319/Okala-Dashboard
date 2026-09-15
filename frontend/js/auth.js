const API_BASE = '/api';

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.message || 'Login failed.';
      return;
    }
    if (data.user.mustChangePassword) {
      window.location.href = 'change-password.html';
    } else {
      window.location.href = 'index.html';
    }
  } catch (err) {
    errorEl.textContent = 'Could not reach the server. Please try again.';
  }
});
