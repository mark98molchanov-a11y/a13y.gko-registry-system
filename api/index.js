// api/index.js - CORS Proxy сервер для GitHub Releases
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// ✅ РАЗРЕШАЕМ CORS ДЛЯ ВСЕХ
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb', type: 'application/octet-stream' }));

// ✅ ПРОВЕРКА ТОКЕНА
app.get('/api/check-token', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('token ', '');
    
    if (!token) {
        return res.status(401).json({ valid: false, error: 'Token required' });
    }
    
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });
        
        if (response.ok) {
            const user = await response.json();
            res.json({ valid: true, user: user.login });
        } else {
            res.json({ valid: false, error: 'Invalid token' });
        }
    } catch (error) {
        res.json({ valid: false, error: error.message });
    }
});

// ✅ ПОЛУЧЕНИЕ ИНФОРМАЦИИ О РЕЛИЗЕ
app.get('/api/release/:owner/:repo/:tag', async (req, res) => {
    const { owner, repo, tag } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('token ', '');
    
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
        const response = await fetch(url, {
            headers: token ? { 'Authorization': `token ${token}` } : {}
        });
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ УДАЛЕНИЕ ASSET
app.delete('/api/asset/:owner/:repo/:assetId', async (req, res) => {
    const { owner, repo, assetId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('token ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Token required' });
    }
    
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `token ${token}` }
        });
        
        res.status(response.status).json({ success: response.ok });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ ЗАГРУЗКА ASSET (ОСНОВНАЯ ФУНКЦИЯ)
app.post('/api/upload/:owner/:repo/:releaseId', async (req, res) => {
    const { owner, repo, releaseId } = req.params;
    const fileName = req.query.name || 'deals_clean.csv';
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('token ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Token required' });
    }
    
    const content = req.body;
    
    try {
        const url = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${fileName}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': Buffer.byteLength(content)
            },
            body: content
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ 
                error: `GitHub API error: ${response.status}`,
                details: errorText
            });
        }
        
        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ОБРАБОТКА OPTIONS (CORS preflight)
app.options('*', cors());

// Экспортируем для Vercel
module.exports = app;