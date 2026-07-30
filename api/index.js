// api/index.js - CORS Proxy для GitHub API (Vercel Serverless)

export default async function handler(req, res) {
    // ✅ РАЗРЕШАЕМ CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // ✅ ОТВЕТ НА PREFLIGHT
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // ✅ БОЛЕЕ НАДЁЖНОЕ ИЗВЛЕЧЕНИЕ ТОКЕНА
    const authHeader = req.headers.authorization || '';
    let token = null;
    
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    } else if (authHeader.startsWith('token ')) {
        token = authHeader.slice(6);
    } else {
        token = authHeader;
    }
    
    console.log(`📥 ${req.method} ${req.url}`);
    console.log('🔑 Token present:', !!token);
    
    try {
        // ============================================================
        // 1. ПОЛУЧЕНИЕ РЕЛИЗА: /api/release/:owner/:repo/:tag
        // ============================================================
        if (req.method === 'GET' && req.url?.startsWith('/api/release/')) {
            const parts = req.url.replace('/api/release/', '').split('/');
            const [owner, repo, tag] = parts;
            
            console.log(`📥 Получение релиза: ${owner}/${repo}/${tag}`);
            
            const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
            const response = await fetch(url, {
                headers: token ? { 'Authorization': `token ${token}` } : {}
            });
            
            if (!response.ok) {
                console.error(`❌ GitHub API ошибка: ${response.status}`);
                return res.status(response.status).json({ 
                    error: `GitHub API error: ${response.status}` 
                });
            }
            
            const data = await response.json();
            console.log(`✅ Релиз найден: ${data.tag_name}, ID: ${data.id}`);
            
            return res.status(200).json(data);
        }
        
        // ============================================================
        // 2. УДАЛЕНИЕ ASSET: /api/asset/:owner/:repo/:assetId
        // ============================================================
        if (req.method === 'DELETE' && req.url?.startsWith('/api/asset/')) {
            if (!token) {
                return res.status(401).json({ error: 'Token required' });
            }
            
            const parts = req.url.replace('/api/asset/', '').split('/');
            const [owner, repo, assetId] = parts;
            
            console.log(`🗑️ Удаление asset: ${assetId}`);
            
            const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `token ${token}` }
            });
            
            if (!response.ok && response.status !== 204) {
                console.error(`❌ Ошибка удаления: ${response.status}`);
                return res.status(response.status).json({ error: `Delete failed: ${response.status}` });
            }
            
            return res.status(200).json({ success: true });
        }
        
        // ============================================================
        // 3. ЗАГРУЗКА ASSET: /api/upload/:owner/:repo/:releaseId
        // ============================================================
        if (req.method === 'POST' && req.url?.startsWith('/api/upload/')) {
            if (!token) {
                return res.status(401).json({ error: 'Token required' });
            }
            
            const parts = req.url.replace('/api/upload/', '').split('/');
            const [owner, repo, releaseId] = parts;
            
            const fileName = req.query?.name || 'deals_clean.csv';
            const content = req.body;
            
            console.log(`📤 Загрузка файла: ${fileName}, размер: ${content?.length || 0} байт`);
            
            if (!content || content.length === 0) {
                return res.status(400).json({ error: 'Empty content' });
            }
            
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
                console.error(`❌ Ошибка загрузки: ${response.status} - ${errorText}`);
                return res.status(response.status).json({ 
                    error: `Upload failed: ${response.status}`,
                    details: errorText
                });
            }
            
            const data = await response.json();
            console.log(`✅ Файл загружен: ${data.browser_download_url}`);
            
            return res.status(200).json(data);
        }
        
        // ============================================================
        // 4. ПРОВЕРКА ТОКЕНА: /api/check-token
        // ============================================================
        if (req.method === 'GET' && req.url?.startsWith('/api/check-token')) {
            if (!token) {
                return res.status(401).json({ valid: false, error: 'Token required' });
            }
            
            const response = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            
            if (response.ok) {
                const user = await response.json();
                return res.json({ valid: true, user: user.login });
            } else {
                return res.json({ valid: false, error: 'Invalid token' });
            }
        }
        
        // ============================================================
        // 5. НЕИЗВЕСТНЫЙ ЭНДПОИНТ
        // ============================================================
        return res.status(404).json({ error: 'Endpoint not found' });
        
    } catch (error) {
        console.error('❌ Ошибка API:', error);
        return res.status(500).json({ error: error.message });
    }
}
