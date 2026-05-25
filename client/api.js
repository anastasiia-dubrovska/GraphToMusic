const API_BASE_URL = 'http://localhost:3000/api';

let isSaving = false;

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

async function saveComposition() {
    console.count('saveComposition CALL');

    if (isSaving) return;
    isSaving = true;

    try {
        if (!audioData?.notes?.length) {
            alert('Немає даних для збереження.');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Необхідно увійти в систему');
            return;
        }

        const title = prompt('Введіть назву композиції:', 'Моя композиція');
        if (title === null) return; 

        const compositionData = {
            title: title || 'Без назви',
            function: audioData.sourceFunction,
            settings: {
                xRange: currentSettings.xRange,
                pointCount: currentSettings.pointCount,
                noteDuration: currentSettings.noteDuration,
                useAmplitudeModulation: currentSettings.useAmplitudeModulation,
                useVibrato: currentSettings.useVibrato,
                genre: currentSettings.genre,
                instrument: currentSettings.instrument
            }
        };

        const result = await window.api.saveCompositionToServer(compositionData);

        if (result.success) {
            alert('Композицію успішно збережено!');
        } else {
            alert('Помилка збереження: ' + result.message);
        }

    } catch (err) {
        console.error(err);
    } finally {
        isSaving = false;
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

        return data;

    } catch (error) {
        console.error('Delete composition error:', error);

        return {
            success: false,
            message: 'Помилка зєднання з сервером'
        };
    }
}

function renderUserCompositions(compositions) {
    const container = document.querySelector('.user-compositions');

    if (!container) return;

    if (!compositions?.length) {
        container.innerHTML = `<p class="no-compositions">Немає композицій</p>`;
        return;
    }

    container.innerHTML = compositions.map(comp => `
        <div class="composition-card">
            <div class="composition-title">${comp.title || 'Без назви'}</div>
            <div class="composition-function">${comp.function}</div>
            <div class="composition-date">
                Створено: ${new Date(comp.created_at).toLocaleDateString('uk-UA')}
            </div>

            <div class="composition-actions">
                <button class="btn-play-composition"
                    data-id="${comp.id}"
                    data-function="${comp.function}"
                    data-settings='${JSON.stringify(comp.settings || {})}'>
                    Відтворити
                </button>

                <button class="btn-delete-composition"
                    data-id="${comp.id}">
                    Видалити
                </button>
            </div>
        </div>
    `).join('');

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
        } 
    catch (error) {
        console.error('Save composition error:', error);
        return { success: false, message: 'Помилка зєднання з сервером' };}
}
document.querySelector('.user-compositions').addEventListener('click', async (e) => {

    const playBtn = e.target.closest('.btn-play-composition');
    const deleteBtn = e.target.closest('.btn-delete-composition');

    // PLAY
    if (playBtn) {
        const functionStr = playBtn.dataset.function;
        const settingsStr = playBtn.dataset.settings;

        document.querySelector('.function-input').value = functionStr;

        if (settingsStr) {
            try {
                const settings = JSON.parse(settingsStr);

                if (settings.xRange) {
                    document.getElementById('xMin').value = settings.xRange[0];
                    document.getElementById('xMax').value = settings.xRange[1];
                }

                if (settings.pointCount)
                    document.getElementById('pointCount').value = settings.pointCount;

                if (settings.noteDuration)
                    document.getElementById('noteDuration').value = settings.noteDuration;

                if (settings.genre)
                    document.getElementById('genreSelect').value = settings.genre;

                if (settings.instrument)
                    document.getElementById('instrumentSelect').value = settings.instrument;

                if (settings.useAmplitudeModulation !== undefined)
                    document.getElementById('amplitudeModulation').checked = settings.useAmplitudeModulation;

                if (settings.useVibrato !== undefined)
                    document.getElementById('vibratoEffect').checked = settings.useVibrato;

            } catch (e) {
                console.warn('Settings parse error:', e);
            }
        }

        document.getElementById('nav-generator').click();
        document.querySelector('.btn-generate').click();
    }

    // DELETE
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;

        if (!confirm('Видалити композицію?')) return;

        const result = await window.api.deleteComposition(id);

        if (result?.success) {
            deleteBtn.closest('.composition-card').remove();
        } else {
            alert(result?.message || 'Помилка видалення');
        }
    }
});


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