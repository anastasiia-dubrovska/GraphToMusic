document.addEventListener('DOMContentLoaded', () => {
  const pages = {
    'nav-generator': 'generator-page',
    'nav-examples': 'examples-page',
    'nav-info': 'info-page',
    'nav-instructions': 'instructions-page',
    'nav-login': 'signin-page',
    'nav-signup': 'signup-page',
    'nav-dashboard': 'dashboard-page',
  };

  const navLogin = document.getElementById('nav-login');
  const navSignup = document.getElementById('nav-signup');
  const navLogout = document.getElementById('nav-logout');

  let isLoggedIn = false;

  function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
      page.style.display = 'none';
    });
    if (pageId) {
      const page = document.getElementById(pageId);
      if (page) page.style.display = 'block';
    }
  }

  function updateAuthLinks() {
    if (isLoggedIn) {
      navLogin.style.display = 'none';
      navSignup.style.display = 'none';
      navLogout.style.display = 'inline-block';
      showPage('dashboard-page');
      setActiveNav(null);
    } else {
      navLogin.style.display = 'inline-block';
      navSignup.style.display = 'inline-block';
      navLogout.style.display = 'none';
      showPage('generator-page');
      setActiveNav('nav-generator');
    }
  }

  function setActiveNav(activeId) {
    document.querySelectorAll('nav a').forEach(a => {
      a.classList.remove('active');
    });
    if (activeId) {
      const activeElem = document.getElementById(activeId);
      if (activeElem) activeElem.classList.add('active');
    }
  }

  Object.keys(pages).forEach(navId => {
    const navElem = document.getElementById(navId);
    if (navElem) {
      navElem.addEventListener('click', e => {
        e.preventDefault();

        if (navId === 'nav-dashboard' && !isLoggedIn) {
          alert('Будь ласка, увійдіть, щоб переглянути дашборд');
          return;
        }

        if (navId === 'nav-login' || navId === 'nav-signup') {
          showPage(pages[navId]);
          setActiveNav(navId);
          return;
        }

        showPage(pages[navId]);
        setActiveNav(navId);
      });
    }
  });

  navLogout.addEventListener('click', e => {
    e.preventDefault();
    isLoggedIn = false;
    updateAuthLinks();
    alert('Ви вийшли з системи');
  });

  const signinForm = document.getElementById('signin-form');
  signinForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value.trim();


    if (email && password) {
      isLoggedIn = true;
      alert('Ви успішно увійшли');
      updateAuthLinks();
    } else {
      alert('Будь ласка, введіть email і пароль');
    }
  });

  const signupForm = document.getElementById('signup-form');
  signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const confirm = document.getElementById('signup-confirm').value.trim();

    if (!email || !password || !confirm) {
      alert('Будь ласка, заповніть всі поля');
      return;
    }

    if (password !== confirm) {
      alert('Паролі не співпадають');
      return;
    }

    isLoggedIn = true;
    alert('Реєстрація пройшла успішно. Ви увійшли.');
    updateAuthLinks();
  });
  const toSignup = document.getElementById('to-signup');
  if (toSignup) {
    toSignup.addEventListener('click', e => {
      e.preventDefault();
      showPage('signup-page');
      setActiveNav('nav-signup');
    });
  }

  const toSignin = document.getElementById('to-signin');
  if (toSignin) {
    toSignin.addEventListener('click', e => {
      e.preventDefault();
      showPage('signin-page');
      setActiveNav('nav-login');
    });
  }

  updateAuthLinks();
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.example-card').forEach(card => {
                card.classList.toggle('hidden',
                    filter !== 'all' && card.dataset.category !== filter
                );
            });
        });
    });


    document.querySelectorAll('.try-example').forEach(btn => {
        btn.addEventListener('click', () => {
            const fn = btn.dataset.function;
            const genre = document.getElementById('exampleGenre')?.value || 'original';
            const instrument = document.getElementById('exampleInstrument')?.value || 'piano';


            document.getElementById('generator-page').style.display = 'block';
            document.getElementById('examples-page').style.display = 'none';
            document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
            document.getElementById('nav-generator').classList.add('active');


            document.querySelector('.function-input').value = fn;
            const genreSelect = document.getElementById('genreSelect');
            const instrSelect = document.getElementById('instrumentSelect');
            if (genreSelect) genreSelect.value = genre;
            if (instrSelect) instrSelect.value = instrument;

            document.querySelector('.btn-generate')?.click();
        });
    });
});