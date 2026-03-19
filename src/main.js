// SeaweedFS Command Documentation Browser

let docs = null;
let currentFilter = '';
let currentCmd = null;
let currentCmdType = null;
let currentCategory = null;

// Flag values from input
const flagValues = {};

// Load documentation
async function loadDocs() {
  try {
    const response = await fetch('/docs/commands.json');
    if (!response.ok) {
      throw new Error('Failed to load documentation');
    }
    docs = await response.json();
    renderCommandList();
    renderShellCategories();
  } catch (error) {
    console.error('Error loading docs:', error);
    document.getElementById('command-detail').innerHTML = `
      <p class="placeholder">Error loading documentation. Run 'npm run extract-docs' first.</p>
    `;
  }
}

// Render main commands list
function renderCommandList() {
  const list = document.getElementById('command-list');
  const filtered = docs.commands.filter(cmd =>
    cmd.name.toLowerCase().includes(currentFilter.toLowerCase()) ||
    (cmd.short && cmd.short.toLowerCase().includes(currentFilter.toLowerCase()))
  );

  list.innerHTML = filtered.map(cmd => `
    <li>
      <button class="cmd-btn" data-cmd="${cmd.name}" data-type="main">${highlightText(cmd.short || cmd.name, currentFilter)}</button>
    </li>
  `).join('');
}

// Render shell command categories
function renderShellCategories() {
  const container = document.getElementById('shell-categories');
  const categories = docs.shellCommands;

  container.innerHTML = Object.entries(categories).map(([category, commands]) => {
    const filteredCommands = commands.filter(cmd =>
      cmd.name.toLowerCase().includes(currentFilter.toLowerCase()) ||
      (cmd.help && cmd.help.toLowerCase().includes(currentFilter.toLowerCase()))
    );

    if (filteredCommands.length === 0) return '';

    return `
      <div class="category">
        <div class="category-header" data-cat="${category}">
          <span>${category}</span>
          <span class="toggle">▶</span>
        </div>
        <div class="category-commands" id="cat-${category}">
          ${filteredCommands.map(cmd => `
            <button class="cmd-btn shell-cmd-btn" data-cat="${category}" data-cmd="${cmd.name}" data-type="shell">${highlightText(cmd.name, currentFilter)}</button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Highlight search text
function highlightText(text, filter) {
  if (!filter) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

// Generate command string
function generateCommand() {
  if (!currentCmd) {
    return '';
  }

  // Main commands get 'weed' prefix, shell subcommands don't
  let baseCmd = currentCmdType === 'shell' ? currentCmd.name : 'weed ' + currentCmd.name;

  const flags = [];
  const cmdFlags = currentCmd.flags || [];

  // Add flag values from inputs
  cmdFlags.forEach(flag => {
    const value = flagValues[flag.name];
    if (value !== undefined && value !== '' && value !== null) {
      const isBool = flag.type === 'Bool' || flag.type === 'bool';
      if (isBool) {
        // For bool flags, just add the flag name if true
        if (value === 'true') {
          flags.push(`-${flag.name}`);
        }
      } else {
        flags.push(`-${flag.name}=${value}`);
      }
    }
  });

  return baseCmd + (flags.length > 0 ? ' ' + flags.join(' ') : '');
}

// Update command output
function updateCommandOutput() {
  const cmd = generateCommand();
  document.getElementById('command-output-bar').textContent = cmd;

  const bar = document.getElementById('command-bar');
  if (cmd) {
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
}

// Render flag inputs in builder
function renderFlagInputs() {
  const container = document.getElementById('flag-inputs');
  const cmdFlags = currentCmd?.flags || [];

  if (cmdFlags.length === 0) {
    container.innerHTML = '<p class="placeholder">此命令无额外参数</p>';
    return;
  }

  container.innerHTML = cmdFlags.map(flag => {
    const isBool = flag.type === 'Bool' || flag.type === 'bool';
    const placeholder = isBool ? 'true/false' : flag.defaultValue?.replace(/"/g, '') || '';
    const inputType = isBool ? 'text' : 'text';
    const helpText = flag.description;

    return `
      <div class="flag-input-row">
        <label>
          <span>-${escapeHtml(flag.name)} <small>(${escapeHtml(flag.type)})</small> ${helpText ? ' - ' + escapeHtml(helpText) : ''}</span>
          ${isBool ? `
            <select class="flag-select" data-flag="${flag.name}">
              <option value="">--</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ` : `
            <input type="text" data-flag="${flag.name}" placeholder="${placeholder}" value="${flagValues[flag.name] || ''}">
          `}
        </label>
      </div>
    `;
  }).join('');

  // Add event listeners for flag inputs
  container.querySelectorAll('input[data-flag], select[data-flag]').forEach(input => {
    input.addEventListener('input', (e) => {
      flagValues[e.target.dataset.flag] = e.target.value;
      updateCommandOutput();
    });
  });
}

// Show main command details
function showCommand(name) {
  const cmd = docs.commands.find(c => c.name === name);
  if (!cmd) return;

  currentCmd = cmd;
  currentCmdType = 'main';
  currentCategory = null;

  document.getElementById('command-detail').innerHTML = `
    <div class="command-header">
      <h2>${escapeHtml(cmd.name)}</h2>
      <div class="usage">weed ${escapeHtml(cmd.usageLine)}</div>
    </div>

    ${cmd.short ? `
      <div class="command-section">
        <h3>描述</h3>
        <p>${escapeHtml(cmd.short)}</p>
      </div>
    ` : ''}

    ${cmd.long ? `
      <div class="command-section">
        <h3>详情</h3>
        <pre class="description-pre">${escapeHtml(cmd.long)}</pre>
      </div>
    ` : ''}

    ${cmd.flags && cmd.flags.length > 0 ? `
      <div class="command-section">
        <h3>参数</h3>
        <table class="flags-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>默认值</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            ${cmd.flags.map(flag => `
              <tr>
                <td>-${escapeHtml(flag.name)}</td>
                <td><span class="flag-type">${escapeHtml(flag.type)}</span></td>
                <td><span class="flag-default">${escapeHtml(flag.defaultValue)}</span></td>
                <td>${escapeHtml(flag.description)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;

  updateActiveButton(name);
  renderFlagInputs();
  updateCommandOutput();
}

// Show shell command details
function showShellCommand(category, name) {
  const commands = docs.shellCommands[category];
  const cmd = commands.find(c => c.name === name);
  if (!cmd) return;

  currentCmd = cmd;
  currentCmdType = 'shell';
  currentCategory = category;

  document.getElementById('command-detail').innerHTML = `
    <div class="command-header">
      <h2>${escapeHtml(cmd.name)}</h2>
      <div class="usage">weed shell ${escapeHtml(cmd.name)} [flags]</div>
    </div>

    ${cmd.help ? `
      <div class="command-section">
        <h3>描述</h3>
        <pre class="description-pre">${escapeHtml(cmd.help)}</pre>
      </div>
    ` : ''}

    ${cmd.flags && cmd.flags.length > 0 ? `
      <div class="command-section">
        <h3>参数</h3>
        <table class="flags-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>默认值</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            ${cmd.flags.map(flag => `
              <tr>
                <td>-${escapeHtml(flag.name)}</td>
                <td><span class="flag-type">${escapeHtml(flag.type)}</span></td>
                <td><span class="flag-default">${escapeHtml(flag.defaultValue)}</span></td>
                <td>${escapeHtml(flag.description)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;

  updateActiveButton(name, category);
  renderFlagInputs();
  updateCommandOutput();
}

// Update active button
function updateActiveButton(name, category = null) {
  document.querySelectorAll('.sidebar button').forEach(btn => {
    btn.classList.remove('active');
  });

  if (category) {
    document.querySelector(`.shell-cmd-btn[data-cat="${category}"][data-cmd="${name}"]`)?.classList.add('active');
  } else {
    document.querySelector(`.cmd-btn[data-type="main"][data-cmd="${name}"]`)?.classList.add('active');
  }
}

// Toggle category
function toggleCategory(category) {
  const el = document.getElementById(`cat-${category}`);
  const header = el.previousElementSibling;
  const toggle = header.querySelector('.toggle');

  if (el.classList.contains('open')) {
    el.classList.remove('open');
    toggle.textContent = '▶';
  } else {
    el.classList.add('open');
    toggle.textContent = '▼';
  }
}

// Search handler
function handleSearch(e) {
  currentFilter = e.target.value;
  renderCommandList();
  renderShellCategories();

  // Auto-expand categories when searching
  if (currentFilter) {
    document.querySelectorAll('.category-commands').forEach(el => {
      el.classList.add('open');
    });
    document.querySelectorAll('.category-header .toggle').forEach(el => {
      el.textContent = '▼';
    });
  }
}

// Copy command
function copyCommand() {
  const cmd = document.getElementById('command-output-bar').textContent;
  navigator.clipboard.writeText(cmd).then(() => {
    const btn = document.getElementById('copy-btn-bar');
    btn.textContent = '已复制!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = '复制';
      btn.classList.remove('copied');
    }, 2000);
  });
}

// Event delegation handler
function handleDelegatedClick(e) {
  const target = e.target;

  if (target.classList.contains('cmd-btn')) {
    const cmdName = target.dataset.cmd;
    const cmdType = target.dataset.type;
    if (cmdType === 'shell') {
      const cat = target.dataset.cat;
      showShellCommand(cat, cmdName);
    } else {
      showCommand(cmdName);
    }
    return;
  }

  if (target.id === 'main-commands-header' || target.closest('#main-commands-header')) {
    const list = document.getElementById('command-list');
    const header = document.getElementById('main-commands-header');
    const toggle = header.querySelector('.toggle');
    if (list.style.display === 'none') {
      list.style.display = 'block';
      toggle.textContent = '▼';
    } else {
      list.style.display = 'none';
      toggle.textContent = '▶';
    }
    return;
  }

  if (target.classList.contains('category-header') || target.closest('.category-header')) {
    const header = target.classList.contains('category-header') ? target : target.closest('.category-header');
    const category = header.dataset.cat;
    if (category) {
      toggleCategory(category);
    }
    return;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search').addEventListener('input', handleSearch);
  document.addEventListener('click', handleDelegatedClick);

  document.getElementById('copy-btn-bar').addEventListener('click', copyCommand);
  
  loadDocs();
});
