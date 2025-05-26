const API_BASE_URL = 'http://localhost:3000/api';

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Помилка входу');
        }
        return data;
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Помилка зєднання з сервером' };
    }
}

async function register(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Помилка реєстрації');
        }
        return data;
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'Помилка зєднання з сервером' };
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');


    if (typeof updateUIForLoggedOutUser === 'function') {
        updateUIForLoggedOutUser();
    }

    const navGenerator = document.getElementById('nav-generator');
    if (navGenerator) navGenerator.click();
}

async function checkAuthStatus() {
    const token = localStorage.getItem('token');

    if (!token) {
        if (typeof updateUIForLoggedOutUser === 'function') {
            updateUIForLoggedOutUser();
        }
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            if (typeof updateUIForLoggedInUser === 'function') {
                updateUIForLoggedInUser();
            }
            return true;
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (typeof updateUIForLoggedOutUser === 'function') {
                updateUIForLoggedOutUser();
            }
            return false;
        }
    } catch (error) {
        console.error('Auth check error:', error);

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof updateUIForLoggedOutUser === 'function') {
            updateUIForLoggedOutUser();
        }
        return false;
    }
}
async function saveComposition(title, func, token) {
  const response = await fetch('http://localhost:3000/api/music/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ title, function: func })
  });

  const data = await response.json();
  if (data.success) {
    alert('Композиція збережена!');
  } else {
    alert('Помилка при збереженні: ' + data.message);
  }
}
async function saveAudioToServer(title = 'My Composition') {
    if (!audioData) {
        alert("Немає аудіо для збереження.");
        return;
    }

    const sampleRate = 44100;
    const wavBlob = encodeWAV(audioData.notes, sampleRate);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('audio', wavBlob, 'composition.wav');

    try {
        const token = localStorage.getItem('token');

        const response = await fetch('http://localhost:3000/api/music/save-audio', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
            },
            body: formData,
        });

        const result = await response.json();
        if (result.success) {
            alert('Композиція успішно збережена на сервері!');
        } else {
            alert('Помилка збереження: ' + result.message);
        }
    } catch (error) {
        alert('Помилка мережі: ' + error.message);
    }
}

async function fetchUserCompositions(token) {
  const response = await fetch('http://localhost:3000/api/music/user', {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  const data = await response.json();
  if (data.success) {
    return data.compositions; 
  } else {
    alert('Помилка при завантаженні: ' + data.message);
    return [];
  }
}
async function deleteComposition(id) {
  const token = getUserToken(); 
  const response = await fetch(`http://localhost:3000/api/music/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  const data = await response.json();
  if (!data.success) {
    alert('Помилка при видаленні: ' + data.message);
  }
}


async function saveCompositionToServer(compositionData) {
    const token = localStorage.getItem('token');

    if (!token) {
        return { success: false, message: 'Необхідно увійти в систему' };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/music/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(compositionData)
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Помилка збереження');
        }
        return data;
    } catch (error) {
        console.error('Save composition error:', error);
        return { success: false, message: 'Помилка зєднання з сервером' };
    }
}

async function loadUserCompositions() {
    const token = localStorage.getItem('token');

    if (!token) {
        return { success: false, message: 'Необхідно увійти в систему' };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/music/user`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Помилка завантаження');
        }

        if (data.success) {
            renderUserCompositions(data.compositions);
        } else {
            renderUserCompositions([]);
            console.warn('No compositions loaded:', data.message);
        }
        return data;
    } catch (error) {
        console.error('Load compositions error:', error);
        renderUserCompositions([]);
        return { success: false, message: 'Помилка зєднання з сервером' };
    }
}

async function deleteComposition(compositionId) {
    const token = localStorage.getItem('token');

    if (!token) {
        return { success: false, message: 'Необхідно увійти в систему' };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/music/${compositionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Помилка видалення');
        }

        if (data.success) {
            loadUserCompositions();
        }
        return data;
    } catch (error) {
        console.error('Delete composition error:', error);
        return { success: false, message: 'Помилка зєднання з сервером' };
    }
}
function renderCompositions(compositions) {
  const container = document.getElementById('saved-compositions');
  container.innerHTML = '';

  if (compositions.length === 0) {
    container.innerHTML = '<p>Немає збережених композицій.</p>';
    return;
  }

  compositions.forEach(comp => {
    const div = document.createElement('div');
    div.classList.add('composition-item');
    div.innerHTML = `
      <h3>${comp.title}</h3>
      <p>Функція: ${comp.function}</p>
      <p>Дата створення: ${new Date(comp.created_at).toLocaleString()}</p>
      <button class="play-btn" data-func="${comp.function}">Прослухати</button>
      <button class="delete-btn" data-id="${comp.id}">Видалити</button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const func = btn.getAttribute('data-func');
      playFunctionAsAudio(func);
    });
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Видалити цю композицію?')) {
        await deleteComposition(id);
        btn.parentElement.remove(); 
      }
    });
  });
}

function renderUserCompositions(compositions) {
    const container = document.querySelector('.user-compositions');

    if (!container) {
        console.error('Composition container not found');
        return;
    }

    if (!compositions || compositions.length === 0) {
        container.innerHTML = `
            <p class="no-compositions">У вас поки немає збережених композицій</p>
        `;
        return;
    }

    let html = '';

    compositions.forEach(comp => {
        const date = new Date(comp.created_at).toLocaleDateString('uk-UA');
        html += `
            <div class="composition-card">
                <div class="composition-title">${comp.title || 'Без назви'}</div>
                <div class="composition-function">${comp.function}</div>
                <div class="composition-date">Створено: ${date}</div>
                <div class="composition-actions">
                    <button class="btn-play-composition" data-id="${comp.id}" data-function="${comp.function}">Відтворити</button>
                    <button class="btn-delete-composition" data-id="${comp.id}">Видалити</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    document.querySelectorAll('.btn-play-composition').forEach(button => {
        button.addEventListener('click', function() {
            const functionStr = this.getAttribute('data-function');
            if (functionStr) {
                document.querySelector('.function-input').value = functionStr;
                document.getElementById('nav-generator').click();
                document.querySelector('.btn-generate').click();
            }
        });
    });

    document.querySelectorAll('.btn-delete-composition').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            if (id && confirm('Ви впевнені, що хочете видалити цю композицію?')) {
                deleteComposition(id);
            }
        });
    });
}

async function generateMusic(functionExpression, options = {}) {
    const loading = document.querySelector('.loading');
    if (!loading) {
        console.error('Loading indicator not found');
        return { success: false, error: 'Loading indicator missing' };
    }

    loading.style.display = 'block';

    try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const graphData = await window.visualization.renderFunctionGraph(functionExpression, 'function-graph');
        if (!graphData.success) {
            throw new Error(graphData.error || 'Помилка рендерингу графіка');
        }

        if (window.audioPlayer && window.audioPlayer.processAudioFromFunction) {
            window.audioPlayer.processAudioFromFunction({ functionString: functionExpression, ...graphData }, options);
        } else {
            console.warn('audioPlayer.processAudioFromFunction is not available');
        }

        loading.style.display = 'none';
        return { success: true, data: graphData };
    } catch (error) {
        console.error('Error generating music:', error);
        loading.style.display = 'none';
        alert('Помилка генерації музики: ' + error.message);
        return { success: false, error: error.message };
    }
}

window.api = {
    login,
    register,
    logout,
    checkAuthStatus,
    saveCompositionToServer,
    loadUserCompositions,
    deleteComposition,
    generateMusic
};