// Theme management
function getPreferredTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeIcon(theme);
    if (window.app && window.app.network) {
        window.app.updateVisTheme(theme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

setTheme(getPreferredTheme());

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
    }
});

// Help panel dismissal
const HELP_DISMISS_KEY = 'helpDismissedUntil';

function dismissHelp() {
    const oneDay = 24 * 60 * 60 * 1000;
    const dismissUntil = Date.now() + oneDay;
    localStorage.setItem(HELP_DISMISS_KEY, dismissUntil.toString());
    const helpPanel = document.getElementById('help-panel');
    if (helpPanel) {
        helpPanel.classList.add('hidden');
    }
}

function checkHelpDismissal() {
    const dismissUntil = localStorage.getItem(HELP_DISMISS_KEY);
    if (dismissUntil) {
        if (Date.now() < parseInt(dismissUntil)) {
            const helpPanel = document.getElementById('help-panel');
            if (helpPanel) {
                helpPanel.classList.add('hidden');
            }
        } else {
            localStorage.removeItem(HELP_DISMISS_KEY);
        }
    }
}

// Check on page load
document.addEventListener('DOMContentLoaded', checkHelpDismissal);

class MindMap {
    constructor() {
        this.container = document.getElementById('canvas');
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();
        this.network = null;
        this.nextId = 1;
        this.selectedId = null;
        this.selectedIds = new Set();

        
        this.init();
    }

    getVisOptions(theme) {
        const isDark = theme === 'dark';
        return {
            layout: {
                randomSeed: 2
            },
            nodes: {
                shape: 'box',
                margin: 10,
                widthConstraint: { minimum: 80 },
                font: {
                    size: 14,
                    face: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
                    color: isDark ? '#e0e0e0' : '#333333'
                },
                borderWidth: 2,
                borderWidthSelected: 3,
                color: {
                    background: isDark ? '#2d2d44' : '#ffffff',
                    border: isDark ? '#4a4a6a' : '#333333',
                    highlight: {
                        background: isDark ? '#3d3d5c' : '#f0f0f0',
                        border: isDark ? '#5a9fd4' : '#4a90d9'
                    },
                    hover: {
                        background: isDark ? '#3d3d5c' : '#f0f0f0',
                        border: isDark ? '#5a9fd4' : '#4a90d9'
                    }
                },
                shadow: {
                    enabled: true,
                    color: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
                    size: 10,
                    x: 0,
                    y: 2
                }
            },
            edges: {
                width: 2,
                color: {
                    color: isDark ? '#5a5a7a' : '#999999',
                    highlight: isDark ? '#5a9fd4' : '#4a90d9',
                    hover: isDark ? '#5a9fd4' : '#4a90d9'
                },
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'vertical',
                    roundness: 0.4
                },
                arrows: {
                    to: { enabled: false }
                }
            },
            interaction: {
                hover: true,
                multiselect: true,
                navigationButtons: false,
                keyboard: false
            },
            physics: {
                enabled: false
            }
        };
    }

    init() {
        const isFileProtocol = window.location.protocol === 'file:';
        
        const data = { nodes: this.nodes, edges: this.edges };
        const theme = getPreferredTheme();
        const options = this.getVisOptions(theme);
        this.network = new vis.Network(this.container, data, options);
        
        this.setupNetworkEvents();
        
        if (!isFileProtocol) {
            const saved = localStorage.getItem('mindmap');
            if (saved) {
                this.loadFromStorageSilent();
                return;
            }
        }
        
        // Create root node at center if no saved data
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        this.createNode(null, 'Central Topic', true, centerX, centerY);
    }

    updateVisTheme(theme) {
        const options = this.getVisOptions(theme);
        this.network.setOptions(options);
    }

    setupNetworkEvents() {
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                this.selectedId = params.nodes[0];
                this.selectedIds = new Set(params.nodes);
            } else {
                this.selectedId = null;
                this.selectedIds.clear();
            }
            this.hideContextMenu();
        });

        this.network.on('doubleClick', (params) => {
            if (params.nodes.length === 1) {
                this.editNode(params.nodes[0]);
            }
        });

        // Allow free dragging of nodes
        this.network.on('dragEnd', (params) => {
            if (params.nodes.length > 0) {
                // Node positions are automatically updated by vis.js
                // We just need to store them in our data for save/load
                for (const nodeId of params.nodes) {
                    const position = this.network.getPosition(nodeId);
                    const node = this.nodes.get(nodeId);
                    if (node) {
                        node.x = position.x;
                        node.y = position.y;
                        this.nodes.update(node);
                    }
                }
            }
        });

        // Right-click context menu
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const nodeId = this.network.getNodeAt({
                x: e.pointer?.x || e.offsetX,
                y: e.pointer?.y || e.offsetY
            });
            if (nodeId !== undefined) {
                this.showContextMenu(e.clientX, e.clientY, nodeId);
            } else {
                this.hideContextMenu();
            }
        });

        // Hide context menu on click elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });
    }

    showContextMenu(x, y, nodeId) {
        this.hideContextMenu();
        
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // Check if multiple nodes are selected
        const hasMultipleSelection = this.selectedIds.size > 1;

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Build menu items
        const items = [];

        // Add Child option (disabled if multiple items selected)
        items.push({
            label: 'Add Child',
            action: () => this.createNode(nodeId, ''),
            disabled: hasMultipleSelection
        });

        // Add Sibling option (disabled for root node or if multiple items selected)
        items.push({
            label: 'Add Sibling',
            action: () => {
                const node = this.nodes.get(nodeId);
                if (node.parentId !== null) {
                    this.createNode(node.parentId, '');
                }
            },
            disabled: node.isRoot || hasMultipleSelection
        });

        // Divider
        items.push({ divider: true });

        // Move under... option (disabled for root, if only one node, or if multiple items selected)
        const allNodes = this.nodes.get();
        const canMove = !node.isRoot && allNodes.length > 1 && !hasMultipleSelection;
        items.push({
            label: 'Move under...',
            action: () => this.showMoveUnderDialog(nodeId),
            disabled: !canMove
        });

        // Divider
        items.push({ divider: true });

        // Change Color submenu option
        items.push({
            label: 'Change Color ▶',
            action: () => {},
            disabled: false,
            hasSubmenu: true,
            submenuItems: [
                { name: 'Default', color: '' },
                { name: 'Red', color: '#ff6b6b' },
                { name: 'Teal', color: '#4ecdc4' },
                { name: 'Blue', color: '#45b7d1' },
                { name: 'Green', color: '#96ceb4' },
                { name: 'Yellow', color: '#feca57' },
                { name: 'Pink', color: '#ff9ff3' },
                { name: 'Light Blue', color: '#54a0ff' }
            ]
        });

        items.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'context-menu-divider';
                menu.appendChild(divider);
            } else {
                const div = document.createElement('div');
                div.className = 'context-menu-item' + (item.disabled ? ' disabled' : '');
                div.textContent = item.label;
                
                if (!item.disabled) {
                    if (item.hasSubmenu) {
                        div.addEventListener('mouseenter', (e) => {
                            this.showSubmenu(e.target, nodeId, item.submenuItems);
                        });
                    } else {
                        div.addEventListener('click', () => {
                            item.action();
                            this.hideContextMenu();
                        });
                    }
                }
                menu.appendChild(div);
            }
        });

        document.body.appendChild(menu);
        this.contextMenu = menu;

        // Adjust position if menu goes off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }
    }

    hideContextMenu() {
        if (this.contextMenu) {
            document.body.removeChild(this.contextMenu);
            this.contextMenu = null;
        }
        this.hideSubmenu();
    }

    showSubmenu(parentElement, nodeId, submenuItems) {
        this.hideSubmenu();

        const submenu = document.createElement('div');
        submenu.className = 'context-submenu';
        
        submenuItems.forEach(({ name, color }) => {
            const div = document.createElement('div');
            div.className = 'context-menu-item';
            
            // Color indicator
            const colorDot = document.createElement('span');
            colorDot.style.display = 'inline-block';
            colorDot.style.width = '12px';
            colorDot.style.height = '12px';
            colorDot.style.borderRadius = '50%';
            colorDot.style.marginRight = '8px';
            colorDot.style.border = '1px solid var(--node-border)';
            if (color) {
                colorDot.style.backgroundColor = color;
            } else {
                colorDot.style.background = 'var(--node-bg)';
            }
            div.appendChild(colorDot);
            
            const textSpan = document.createElement('span');
            textSpan.textContent = name === 'Default' ? 'Reset' : name;
            div.appendChild(textSpan);
            
            div.addEventListener('click', () => {
                this.setNodeColor(nodeId, color);
                this.hideContextMenu();
            });
            
            submenu.appendChild(div);
        });

        document.body.appendChild(submenu);
        this.contextSubmenu = submenu;

        // Position submenu to the right of the parent menu item
        const parentRect = parentElement.getBoundingClientRect();
        submenu.style.left = parentRect.right + 'px';
        submenu.style.top = parentRect.top + 'px';

        // Adjust if submenu goes off screen
        const submenuRect = submenu.getBoundingClientRect();
        if (submenuRect.right > window.innerWidth) {
            submenu.style.left = (parentRect.left - submenuRect.width) + 'px';
        }
        if (submenuRect.bottom > window.innerHeight) {
            submenu.style.top = (window.innerHeight - submenuRect.height - 10) + 'px';
        }
    }

    hideSubmenu() {
        if (this.contextSubmenu) {
            document.body.removeChild(this.contextSubmenu);
            this.contextSubmenu = null;
        }
    }

    showMoveUnderDialog(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node || node.isRoot) return;

        const allNodes = this.nodes.get();
        // Filter out the node itself and its descendants (can't move under itself or its children)
        const descendants = this.getDescendants(nodeId);
        const invalidTargets = new Set([nodeId, ...descendants]);
        
        const validTargets = allNodes.filter(n => !invalidTargets.has(n.id));

        if (validTargets.length === 0) {
            this.showToast('No valid target nodes');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'move-under-modal';
        
        modal.innerHTML = `
            <div class="move-under-modal-content">
                <h3>Move "${node.label}" under:</h3>
                <div class="move-under-node-list">
                    ${validTargets.map(target => `
                        <div class="move-under-node-item" data-node-id="${target.id}">
                            <span>${target.isRoot ? '👑' : '📄'}</span>
                            <span>${target.label}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="move-under-modal-buttons">
                    <button id="move-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedTargetId = null;

        // Handle node selection
        modal.querySelectorAll('.move-under-node-item').forEach(item => {
            item.addEventListener('click', () => {
                modal.querySelectorAll('.move-under-node-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                selectedTargetId = parseInt(item.dataset.nodeId);
                // Auto-move on selection
                this.moveNodeUnder(nodeId, selectedTargetId);
                document.body.removeChild(modal);
            });
        });

        // Cancel button
        modal.querySelector('#move-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    getDescendants(nodeId) {
        const descendants = [];
        const children = this.nodes.get({ filter: n => n.parentId === nodeId });
        for (const child of children) {
            descendants.push(child.id);
            descendants.push(...this.getDescendants(child.id));
        }
        return descendants;
    }

    moveNodeUnder(nodeId, newParentId) {
        const node = this.nodes.get(nodeId);
        const newParent = this.nodes.get(newParentId);
        
        if (!node || !newParent) return;
        if (node.parentId === newParentId) {
            this.showToast('Node is already under this parent');
            return;
        }

        // Update the node's parent
        node.parentId = newParentId;
        node.isRoot = false;
        this.nodes.update(node);

        // Remove old edge
        const oldEdges = this.edges.get({
            filter: e => e.to === nodeId
        });
        oldEdges.forEach(edge => this.edges.remove(edge.id));

        // Add new edge
        this.edges.add({
            from: newParentId,
            to: nodeId
        });

        // Reposition node relative to new parent
        const parentPos = this.network.getPosition(newParentId);
        const siblings = this.nodes.get({
            filter: n => n.parentId === newParentId && n.id !== nodeId
        });
        
        const angleStep = Math.PI / 4;
        const baseDistance = 150;
        const index = siblings.length;
        const direction = index % 2 === 0 ? 1 : -1;
        const step = Math.ceil(index / 2);
        const angle = -Math.PI / 2 + (direction * step * angleStep);
        
        node.x = parentPos.x + Math.cos(angle) * baseDistance;
        node.y = parentPos.y + Math.sin(angle) * baseDistance;
        this.nodes.update(node);

        this.showToast(`Moved under "${newParent.label}"`);
    }

    createNode(parentId, text = 'New Node', isRoot = false, x, y) {
        const id = this.nextId++;
        
        const node = {
            id,
            label: text,
            parentId,
            isRoot
        };
        
        // Set position if provided
        if (x !== undefined && y !== undefined) {
            node.x = x;
            node.y = y;
        } else if (parentId !== null) {
            // Calculate position for child node based on parent and siblings
            const parentPos = this.network.getPosition(parentId);
            const siblings = this.nodes.get({
                filter: (n) => n.parentId === parentId
            });
            
            // Calculate position in a radial pattern around parent
            const angleStep = Math.PI / 4; // 45 degrees between siblings
            const baseDistance = 150;
            
            // Determine angle based on number of siblings
            let angle;
            if (siblings.length === 0) {
                angle = -Math.PI / 2; // First child goes up (top)
            } else {
                // Distribute subsequent children in a fan pattern
                const index = siblings.length;
                const direction = index % 2 === 1 ? 1 : -1;
                const step = Math.ceil(index / 2);
                angle = -Math.PI / 2 + (direction * step * angleStep);
            }
            
            node.x = parentPos.x + Math.cos(angle) * baseDistance;
            node.y = parentPos.y + Math.sin(angle) * baseDistance;
        }

        this.nodes.add(node);
        
        if (parentId !== null) {
            this.edges.add({
                from: parentId,
                to: id
            });
        }
        
        this.selectNode(id);
        
        if (!text) {
            setTimeout(() => this.editNode(id, true), 0);
        }
        
        return id;
    }

    selectNode(id, multiSelect = false) {
        if (!multiSelect) {
            this.selectedId = id;
            this.selectedIds.clear();
            if (id !== null) {
                this.selectedIds.add(id);
            }
            this.network.selectNodes([id]);
        } else {
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
            } else {
                this.selectedIds.add(id);
                this.selectedId = id;
            }
            this.network.selectNodes(Array.from(this.selectedIds));
        }
    }

    editNode(id, isNew = false) {
        const node = this.nodes.get(id);
        if (!node) return;
        
        // Create a custom modal for editing
        const modal = document.createElement('div');
        modal.className = 'edit-modal';
        
        const currentColor = node.color?.background || '';
        
        modal.innerHTML = `
            <div class="edit-modal-content">
                <h3>Edit Node</h3>
                <input type="text" id="edit-label" value="${node.label}" placeholder="Node text">
                <div class="color-picker">
                    <label>Background Color:</label>
                    <div class="color-options">
                        <button class="color-btn" data-color="" style="background: var(--node-bg); border: 2px solid var(--selected-border);">Default</button>
                        <button class="color-btn" data-color="#ff6b6b" style="background: #ff6b6b;"></button>
                        <button class="color-btn" data-color="#4ecdc4" style="background: #4ecdc4;"></button>
                        <button class="color-btn" data-color="#45b7d1" style="background: #45b7d1;"></button>
                        <button class="color-btn" data-color="#96ceb4" style="background: #96ceb4;"></button>
                        <button class="color-btn" data-color="#feca57" style="background: #feca57;"></button>
                        <button class="color-btn" data-color="#ff9ff3" style="background: #ff9ff3;"></button>
                        <button class="color-btn" data-color="#54a0ff" style="background: #54a0ff;"></button>
                    </div>
                    <input type="color" id="edit-color-custom" value="${currentColor || '#4a90d9'}">
                </div>
                <div class="edit-modal-buttons">
                    <button id="edit-save">Save</button>
                    <button id="edit-cancel">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const labelInput = modal.querySelector('#edit-label');
        labelInput.focus();
        labelInput.select();
        
        let selectedColor = currentColor;
        
        // Handle color button clicks
        modal.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedColor = btn.dataset.color;
                modal.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
            if (btn.dataset.color === currentColor) {
                btn.classList.add('selected');
            }
        });
        
        // Handle custom color picker
        const customColorInput = modal.querySelector('#edit-color-custom');
        customColorInput.addEventListener('input', (e) => {
            selectedColor = e.target.value;
            modal.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        });
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        const saveChanges = () => {
            const newText = labelInput.value.trim();
            
            if (newText === '') {
                if (isNew) {
                    closeModal();
                    this.selectedId = id;
                    this.selectedIds.clear();
                    this.selectedIds.add(id);
                    this.deleteNode(true);
                } else {
                    closeModal();
                }
                return;
            }
            
            node.label = newText;
            
            if (selectedColor && selectedColor !== '') {
                // Determine text color based on background brightness
                const textColor = this.getContrastColor(selectedColor);
                
                // Apply custom color
                this.nodes.update({
                    id: node.id,
                    label: node.label,
                    color: { 
                        background: selectedColor, 
                        border: selectedColor,
                        highlight: { background: selectedColor, border: selectedColor },
                        hover: { background: selectedColor, border: selectedColor }
                    },
                    font: { color: textColor }
                });
            } else {
                // Revert to default theme colors
                this.nodes.update({
                    id: node.id,
                    label: node.label,
                    color: null,
                    font: null
                });
            }
            closeModal();
        };
        
        modal.querySelector('#edit-save').addEventListener('click', saveChanges);
        modal.querySelector('#edit-cancel').addEventListener('click', () => {
            if (isNew) {
                this.selectedId = id;
                this.selectedIds.clear();
                this.selectedIds.add(id);
                this.deleteNode(true);
            }
            closeModal();
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (isNew) {
                    this.selectedId = id;
                    this.selectedIds.clear();
                    this.selectedIds.add(id);
                    this.deleteNode(true);
                }
                closeModal();
            }
        });
        
        // Handle Enter key
        labelInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveChanges();
            } else if (e.key === 'Escape') {
                if (isNew) {
                    this.selectedId = id;
                    this.selectedIds.clear();
                    this.selectedIds.add(id);
                    this.deleteNode(true);
                }
                closeModal();
            }
        });
    }

    getContrastColor(hexColor) {
        // Convert hex to RGB
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Calculate relative luminance (brightness)
        // Using the formula: 0.299*R + 0.587*G + 0.114*B
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return black for bright backgrounds, white for dark backgrounds
        return brightness > 0.6 ? '#000000' : '#ffffff';
    }

    setNodeColor(nodeId, color) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        if (color && color !== '') {
            // Determine text color based on background brightness
            const textColor = this.getContrastColor(color);
            
            // Apply custom color
            this.nodes.update({
                id: node.id,
                color: { 
                    background: color, 
                    border: color,
                    highlight: { background: color, border: color },
                    hover: { background: color, border: color }
                },
                font: { color: textColor }
            });
        } else {
            // Revert to default theme colors
            this.nodes.update({
                id: node.id,
                color: null,
                font: null
            });
        }
    }

    addChild() {
        if (this.selectedId === null) return;
        return this.createNode(this.selectedId, '');
    }

    addSibling() {
        if (this.selectedId === null) return;
        const node = this.nodes.get(this.selectedId);
        if (node.parentId === null) {
            this.addChild();
        } else {
            this.createNode(node.parentId, '');
        }
    }

    deleteNode(skipConfirmation = false) {
        const idsToDelete = this.selectedIds.size > 0 ? Array.from(this.selectedIds) : 
                           (this.selectedId !== null ? [this.selectedId] : []);
        
        if (idsToDelete.length === 0) return;
        
        const deletableNodes = [];
        for (const id of idsToDelete) {
            const node = this.nodes.get(id);
            if (node && !node.isRoot) {
                deletableNodes.push(node);
            }
        }
        
        if (deletableNodes.length === 0) return;
        
        if (!skipConfirmation) {
            const nodeNames = deletableNodes.map(n => `"${n.label}"`).join(', ');
            const confirmMsg = deletableNodes.length === 1 
                ? `Delete node ${nodeNames}?`
                : `Delete ${deletableNodes.length} nodes: ${nodeNames}?`;
            
            if (!confirm(confirmMsg)) return;
        }
        
        for (const id of idsToDelete) {
            const node = this.nodes.get(id);
            if (!node || node.isRoot) continue;
            
            this.deleteChildren(id);
            this.nodes.remove(id);
            
            const connectedEdges = this.edges.get({
                filter: (e) => e.from === id || e.to === id
            });
            for (const edge of connectedEdges) {
                this.edges.remove(edge.id);
            }
        }
        
        this.selectedIds.clear();
        this.selectedId = null;
        this.network.unselectAll();
    }

    deleteChildren(parentId) {
        const children = this.nodes.get({
            filter: (n) => n.parentId === parentId
        });
        
        for (const child of children) {
            this.deleteChildren(child.id);
            this.nodes.remove(child.id);
            
            const connectedEdges = this.edges.get({
                filter: (e) => e.from === child.id || e.to === child.id
            });
            for (const edge of connectedEdges) {
                this.edges.remove(edge.id);
            }
        }
    }

    clearAll() {
        if (!confirm('Clear all nodes?')) return;
        
        const nodeIds = this.nodes.getIds();
        const edgeIds = this.edges.getIds();
        
        this.nodes.remove(nodeIds);
        this.edges.remove(edgeIds);
        
        this.selectedIds.clear();
        this.nextId = 1;
        this.selectedId = null;
        
        // Get the center of the currently viewed canvas area
        const viewPosition = this.network.getViewPosition();
        this.createNode(null, 'Central Topic', true, viewPosition.x, viewPosition.y);
    }

    saveToStorage() {
        const data = {
            nodes: this.nodes.get(),
            edges: this.edges.get(),
            nextId: this.nextId
        };
        localStorage.setItem('mindmap', JSON.stringify(data));
        this.showToast('Content saved');
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Remove after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }

    loadFromStorageSilent() {
        const saved = localStorage.getItem('mindmap');
        if (!saved) return;
        
        const data = JSON.parse(saved);
        
        const nodeIds = this.nodes.getIds();
        const edgeIds = this.edges.getIds();
        
        this.nodes.remove(nodeIds);
        this.edges.remove(edgeIds);
        
        this.nextId = data.nextId || 1;
        
        if (data.nodes && data.nodes.length > 0) {
            this.nodes.add(data.nodes);
        }
        if (data.edges && data.edges.length > 0) {
            this.edges.add(data.edges);
        }
        
        const rootNode = this.nodes.get({
            filter: (n) => n.isRoot
        })[0];
        if (rootNode) {
            this.selectNode(rootNode.id);
        }
    }

    loadFromStorage() {
        this.loadFromStorageSilent();
    }

    exportJSON() {
        const data = {
            nodes: this.nodes.get(),
            edges: this.edges.get(),
            nextId: this.nextId,
            exportedAt: new Date().toISOString()
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindmap_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

window.app = new MindMap();

const isFileProtocol = window.location.protocol === 'file:';
if (isFileProtocol) {
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    if (btnSave) btnSave.style.display = 'none';
    if (btnLoad) btnLoad.style.display = 'none';
}

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch (e.key) {
        case 'Tab':
            e.preventDefault();
            window.app.addChild();
            break;
        case 'Insert':
            e.preventDefault();
            window.app.addSibling();
            break;
        case 'Delete':
            window.app.deleteNode();
            break;
    }
});


