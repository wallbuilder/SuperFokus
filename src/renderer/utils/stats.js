import { store } from './storage.js';

let totalFocusTime = 0; // in minutes
let completedRounds = 0;
let dailyStats = {}; // { "YYYY-MM-DD": minutes }
let sessionHistory = []; // [{ time, mode, duration }]

export async function initStats() {
    totalFocusTime = await store.get('totalFocusTime', 0);
    completedRounds = await store.get('completedRounds', 0);
    dailyStats = await store.get('dailyStats', {});
    sessionHistory = await store.get('sessionHistory', []);
    await updateStatsUI();
}

export async function updateStatsUI() {
    const statTotalTimeEl = document.getElementById('stat-total-time');
    const statRoundsEl = document.getElementById('stat-rounds');
    if (statTotalTimeEl) statTotalTimeEl.innerText = `${totalFocusTime}m`;
    if (statRoundsEl) statRoundsEl.innerText = completedRounds;
    renderHistory();
}

export function renderHistory() {
    const sessionHistoryLog = document.getElementById('session-history-log');
    if (!sessionHistoryLog) return;

    if (sessionHistory.length === 0) {
        sessionHistoryLog.innerHTML = '<div style="color: var(--timer-subtext); text-align: center;">No history yet.</div>';
        return;
    }
    
    sessionHistoryLog.innerHTML = sessionHistory.slice().reverse().map(session => `
        <div style="border-bottom: 1px solid var(--border-color); padding: 8px 0;">
            <div style="font-weight: bold; color: var(--timer-text);">${session.mode}</div>
            <div style="display: flex; justify-content: space-between; color: var(--timer-subtext); font-size: 0.8rem;">
                <span>${new Date(session.time).toLocaleString()}</span>
                <span>${session.duration}m focused</span>
            </div>
        </div>
    `).join('');
}

export function recordFocusSession(minutes, mode = 'Focus Session') {
    totalFocusTime += minutes;
    completedRounds += 1;
    
    const now = new Date();
    sessionHistory.push({
        time: now.toISOString(),
        mode: mode,
        duration: minutes
    });
    
    if (sessionHistory.length > 50) sessionHistory.shift();
    
    const today = now.toISOString().split('T')[0];
    dailyStats[today] = (dailyStats[today] || 0) + minutes;
    
    setTimeout(() => {
        store.set('totalFocusTime', totalFocusTime);
        store.set('completedRounds', completedRounds);
        store.set('sessionHistory', sessionHistory);
        store.set('dailyStats', dailyStats);
    }, 0);
    
    updateStatsUI();
    renderChart();
}

let statsChartInstance = null;
export function renderChart() {
    const canvas = document.getElementById('statsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        data.push(dailyStats[dateStr] || 0);
    }

    if (statsChartInstance) {
        statsChartInstance.data.labels = labels;
        statsChartInstance.data.datasets[0].data = data;
        statsChartInstance.update();
        return;
    }

    if (typeof Chart === 'undefined') return;

    statsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Focus Minutes',
                data: data,
                backgroundColor: 'rgba(106, 17, 203, 0.6)',
                borderColor: 'rgba(106, 17, 203, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
