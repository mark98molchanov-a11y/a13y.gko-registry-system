// js/org-data-manager.js
class OrgDataManager {
    constructor() {
        this.orgStructure = null;
        this.isLoading = false;
        console.log('✅ OrgDataManager инициализирован');
    }

    async loadFromGitHub() {
        this.isLoading = true;
        console.log('📥 Загрузка организационной структуры из GitHub...');
        
        try {
            const githubUrl = 'https://raw.githubusercontent.com/mark98molchanov-ally/org-structure/main/structure.json';
            
            const response = await fetch(githubUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.orgStructure = data;
            console.log('✅ Организационная структура загружена');
            
            localStorage.setItem('orgStructure', JSON.stringify(data));
            return data;
        } catch (error) {
            console.error('❌ Ошибка:', error);
            const cached = localStorage.getItem('orgStructure');
            if (cached) {
                this.orgStructure = JSON.parse(cached);
                return this.orgStructure;
            }
            this.orgStructure = this.getTestStructure();
            return this.orgStructure;
        } finally {
            this.isLoading = false;
        }
    }

    getTestStructure() {
        return {
            name: "Департамент имущественных отношений ЯНАО",
            type: "department",
            children: [
                {
                    name: "Отдел правового обеспечения",
                    type: "division",
                    children: [
                        { name: "Ведущий юрисконсульт", type: "position", children: [] },
                        { name: "Главный специалист", type: "position", children: [] }
                    ]
                },
                {
                    name: "Отдел земельных отношений",
                    type: "division",
                    children: [
                        { name: "Начальник отдела", type: "position", children: [] }
                    ]
                }
            ]
        };
    }

    getStructure() {
        return this.orgStructure;
    }
}

window.OrgDataManager = OrgDataManager;
window.orgDataManager = new OrgDataManager();

// Автозагрузка
(async () => {
    await window.orgDataManager.loadFromGitHub();
    if (window.orgChartRenderer) {
        window.orgChartRenderer.render(window.orgDataManager.getStructure());
    }
})();
