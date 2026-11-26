/* ========================================
   Local API (desktop app)
   Replaces the HTTP client: every call goes to the Rust backend via Tauri.
   ======================================== */

function tauriInvoke(cmd, args) {
    if (!window.__TAURI__ || !window.__TAURI__.core) {
        return Promise.reject(new Error('Desktop backend is not available'));
    }
    return window.__TAURI__.core.invoke(cmd, args || {}).catch(err => {
        throw new Error(typeof err === 'string' ? err : (err && err.message) || 'Unknown error');
    });
}

class APIClient {
    constructor() {
        this.username = 'Local';
    }

    isLoggedIn() {
        return true;
    }

    logout() {}

    async saveProject(name, projectData, options = {}) {
        const shouldUpdateExisting = options.updateExisting !== false;
        const currentProjectId = shouldUpdateExisting ? localStorage.getItem('current_project_id') : null;

        const data = {
            elements: projectData.elements,
            namespace: projectData.namespace,
            selectedIds: projectData.selectedIds || [],
            groups: projectData.groups,
            currentGroup: projectData.currentGroup,
            widgetsImageData: projectData.widgetsImageData || null,
            codeOverrides: projectData.codeOverrides || {},
            packUuids: projectData.packUuids || null,
            nameplatePosition: projectData.nameplatePosition || 'top_right',
            nameplateMobileOffset: projectData.nameplateMobileOffset != null ? projectData.nameplateMobileOffset : 26,
            hudChannel: 'title',
            syncFolder: projectData.syncFolder || null
        };

        if (currentProjectId) {
            try {
                const result = await tauriInvoke('update_project', { id: currentProjectId, name, data });
                return { projectId: currentProjectId, ...result };
            } catch (err) {
                if (err.message !== 'Project not found') throw err;
                localStorage.removeItem('current_project_id');
            }
        }

        const created = await tauriInvoke('create_project', { name, data });
        localStorage.setItem('current_project_id', created.projectId);
        return created;
    }

    getProjects() {
        return tauriInvoke('list_projects');
    }

    getProject(projectId) {
        return tauriInvoke('get_project', { id: projectId });
    }

    deleteProject(projectId) {
        return tauriInvoke('delete_project', { id: projectId });
    }

    openProjectsFolder() {
        return tauriInvoke('open_projects_folder');
    }

    // javaFiles (optional): Java HUD files written into the same output.zip under plugins/
    exportProject(data, javaFiles) {
        return tauriInvoke('export_project', { data, javaFiles: javaFiles || null });
    }
}

// Global API instance
window.API = new APIClient();
