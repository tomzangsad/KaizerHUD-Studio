/* ========================================
   Authentication & Project Management UI
   ======================================== */

function getProjectSignature() {
    return JSON.stringify((App.elements || []).map(e => ({ id: e.id, type: e.type })));
}

function initAuth() {
    // Desktop app: no login, projects are stored on this computer
    showUserSection();
}

function showUserSection() {
    const userSection = document.getElementById('user-section');
    if (userSection) {
        userSection.style.display = 'flex';
    }
}

// Open the local projects folder
const openFolderBtn = document.getElementById('btn-open-projects-folder');
if (openFolderBtn) {
    openFolderBtn.addEventListener('click', () => {
        API.openProjectsFolder().catch(err => alert('Could not open folder: ' + err.message));
    });
}

// Save Project
document.getElementById('btn-save').addEventListener('click', () => {
    const currentName = localStorage.getItem('current_project_name') || 'My Project';
    document.getElementById('save-project-name').value = currentName;
    document.getElementById('save-modal').style.display = 'flex';
});

document.getElementById('save-submit').addEventListener('click', async () => {
    const name = document.getElementById('save-project-name').value.trim();
    if (!name) {
        alert('Please enter a project name');
        return;
    }

    try {
        const projectData = {
            elements: App.elements,
            namespace: App.getNamespace(),
            selectedIds: App.selectedIds,
            groups: App.groups,
            currentGroup: App.currentGroup,
            widgetsImageData: window.Widgets ? window.Widgets.getWidgetsImageData() : null,
            codeOverrides: App.codeOverrides || {},
            packUuids: App.packUuids || null,
            syncFolder: App.syncFolder || null,
            nameplatePosition: getNameplateSettings().position,
            nameplateMobileOffset: getNameplateSettings().mobileOffset,
            hudChannel: getHudChannel()
        };

        const currentProjectName = localStorage.getItem('current_project_name');
        const shouldUpdateExisting = currentProjectName === name;
        const result = await API.saveProject(name, projectData, {
            updateExisting: shouldUpdateExisting
        });
        if (result.projectId) {
            localStorage.setItem('current_project_id', result.projectId);
        }
        localStorage.setItem('current_project_name', name);
        localStorage.setItem('project_saved_signature', getProjectSignature());
        document.getElementById('save-modal').style.display = 'none';
        App.showToast(`Saved “${name}”`, 'success');
    } catch (error) {
        alert('Save failed: ' + error.message);
    }
});

document.getElementById('save-cancel').addEventListener('click', () => {
    document.getElementById('save-modal').style.display = 'none';
});

// Auto-save
async function autoSaveProject() {
    return;
}

// Load Project
document.getElementById('btn-load').addEventListener('click', async () => {
    try {
        const projects = await API.getProjects();
        renderProjectList(projects, false);
        document.getElementById('load-modal').style.display = 'flex';
    } catch (error) {
        alert('Failed to load projects: ' + error.message);
    }
});

document.getElementById('load-cancel').addEventListener('click', () => {
    document.getElementById('load-modal').style.display = 'none';
});

function renderProjectList(projects, isAdmin) {
    const container = document.getElementById('project-list');
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No projects found</p>';
        return;
    }

    let html = '';

    // Admin search filter
    if (isAdmin) {
        html += '<input type="text" id="admin-project-search" placeholder="Search by project name or owner..." style="width:100%;padding:8px 12px;margin-bottom:8px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;outline:none;" />';
    }

    html += '<div id="project-items-list" style="display: flex; flex-direction: column; gap: 8px;">';
    projects.forEach(project => {
        const date = new Date(project.updatedAt).toLocaleString();
        const ownerLabel = isAdmin && project.owner ? `<span style="font-size: 0.75rem; color: #a78bfa; font-weight: 600;">[${escapeHtml(project.owner)}]</span> ` : '';
        html += `
            <div class="project-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-secondary); border-radius: 4px; cursor: pointer;" data-id="${project._id}" data-search="${escapeHtml((project.owner || '') + ' ' + project.name).toLowerCase()}">
                <div>
                    <div style="font-weight: bold;">${ownerLabel}${escapeHtml(project.name)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Updated: ${date}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-load-project" data-id="${project._id}">Load</button>
                    <button class="btn btn-danger btn-delete-project" data-id="${project._id}">Delete</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;

    // Admin search filtering
    if (isAdmin) {
        document.getElementById('admin-project-search').addEventListener('input', function() {
            const q = this.value.toLowerCase().trim();
            container.querySelectorAll('.project-item').forEach(item => {
                const searchText = item.getAttribute('data-search') || '';
                item.style.display = !q || searchText.includes(q) ? '' : 'none';
            });
        });
    }

    // Attach event listeners
    container.querySelectorAll('.btn-load-project').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadProject(btn.dataset.id);
        });
    });

    container.querySelectorAll('.btn-delete-project').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await kzConfirm('Are you sure you want to delete this project?')) {
                try {
                    await API.deleteProject(btn.dataset.id);
                    if (localStorage.getItem('current_project_id') === btn.dataset.id) {
                        localStorage.removeItem('current_project_id');
                        localStorage.removeItem('current_project_name');
                    }
                    const updatedProjects = await API.getProjects();
                    renderProjectList(updatedProjects, false);
                } catch (error) {
                    alert('Delete failed: ' + error.message);
                }
            }
        });
    });
}

function normalizeLoadedProjectData(projectData) {
    const rawElements = Array.isArray(projectData.elements) ? projectData.elements : [];
    const idMap = new Map();
    let nextGeneratedId = 1;

    const normalizedElements = rawElements.map((element) => {
        const oldId = Number(element.id) || nextGeneratedId;
        const newId = nextGeneratedId++;
        idMap.set(oldId, newId);
        return {
            ...element,
            id: newId
        };
    }).map((element) => ({
        ...element,
        // nameplates are always locked (placed by the project's nameplate position)
        ...(element.type === 'nameplate' ? { lockPosition: true } : {}),
        linkedBarId: element.linkedBarId != null ? (idMap.get(Number(element.linkedBarId)) || null) : null,
        linkedPositionId: element.linkedPositionId != null ? (idMap.get(Number(element.linkedPositionId)) || null) : null
    }));

    const normalizedSelectedIds = Array.isArray(projectData.selectedIds)
        ? [...new Set(projectData.selectedIds.map(id => idMap.get(Number(id))).filter(Boolean))]
        : [];

    return {
        ...projectData,
        elements: normalizedElements,
        selectedIds: normalizedSelectedIds,
        nextId: nextGeneratedId
    };
}

async function loadProject(projectId) {
    try {
        const project = await API.getProject(projectId);
        const normalizedProjectData = normalizeLoadedProjectData(project.data || {});
        
        // Clear current state
        App.elements = [];
        App.selectedIds = [];
        
        // Load project data
        if (normalizedProjectData.elements) {
            App.elements = normalizedProjectData.elements;
        }
        App.selectedIds = normalizedProjectData.selectedIds || [];
        App.nextId = normalizedProjectData.nextId || 1;
        if (project.data.namespace) {
            App.namespace = project.data.namespace;
            document.getElementById('namespace-input').value = project.data.namespace;
        }
        
        // Restore widgets image data if available
        if (normalizedProjectData.widgetsImageData && window.Widgets && typeof Widgets.setWidgetsImageData === 'function') {
            Widgets.setWidgetsImageData(normalizedProjectData.widgetsImageData);
        } else if (window.Widgets && typeof Widgets.clearWidgetsImageData === 'function') {
            Widgets.clearWidgetsImageData();
        }
        // Restore groups
        if (normalizedProjectData.groups && Array.isArray(normalizedProjectData.groups)) {
            App.groups = normalizedProjectData.groups;
        } else {
            App.groups = ['Main'];
            // If any loaded elements have a group that doesn't exist, we should add it
            App.elements.forEach(el => {
                if (el.group && !App.groups.includes(el.group)) {
                    App.groups.push(el.group);
                }
            });
        }
        App.currentGroup = normalizedProjectData.currentGroup || 'Main';

        // Code overrides, pack UUIDs and live-sync folder (desktop features)
        App.codeOverrides = normalizedProjectData.codeOverrides && typeof normalizedProjectData.codeOverrides === 'object'
            ? normalizedProjectData.codeOverrides : {};
        App.packUuids = Array.isArray(normalizedProjectData.packUuids) ? normalizedProjectData.packUuids : null;
        // nameplate position (old projects: top_right, 26 px phone push-down)
        App.nameplatePosition = normalizedProjectData.nameplatePosition;
        App.nameplateMobileOffset = normalizedProjectData.nameplateMobileOffset;
        const np = getNameplateSettings();
        App.nameplatePosition = np.position;
        App.nameplateMobileOffset = np.mobileOffset;
        // Bedrock data channel (old projects: bossbar)
        App.hudChannel = normalizedProjectData.hudChannel;
        App.hudChannel = getHudChannel();
        App.syncFolder = normalizedProjectData.syncFolder || null;
        if (window.KZCode) { KZCode.ensureProjectFields(); KZCode.renderSyncPane(); }
        
        // Store current project info
        localStorage.setItem('current_project_id', projectId);
        localStorage.setItem('current_project_name', project.name);
        
        // Render
        App.render();
        localStorage.setItem('project_saved_signature', getProjectSignature());
        
        document.getElementById('load-modal').style.display = 'none';
        App.showToast(`Opened “${project.name}”`, 'success');
    } catch (error) {
        alert('Load failed: ' + error.message);
    }
}

// LocalStorage fallback (auto-save to localStorage)
function saveToLocalStorage() {
    return;
}

function loadFromLocalStorage() {
    return;
}

// Auto-save to localStorage every 5 seconds
setInterval(() => {}, 5000);

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on load
window.addEventListener('DOMContentLoaded', initAuth);
