(function () {
  const config = window.conversationSearchConfig || { title: '对话搜索', providers: ['claude'] };
  const providerNames = { claude: 'Claude Code', codex: 'Codex', kimi: 'Kimi Code' };
  const keyword = document.getElementById('keyword');
  const mode = document.getElementById('mode');
  const source = document.getElementById('source');
  const project = document.getElementById('project');
  const searchButton = document.getElementById('search');
  const stats = document.getElementById('stats');
  const results = document.getElementById('results');
  let projects = [];

  document.title = config.title;
  const windowTitle = document.querySelector('.window-title');
  if (windowTitle) windowTitle.textContent = config.title;
  if (config.providers.length === 1) {
    document.body.classList.add('single-provider');
    source.hidden = true;
  } else {
    for (const provider of config.providers) {
      const option = document.createElement('option');
      option.value = provider;
      option.textContent = providerNames[provider] || provider;
      source.appendChild(option);
    }
  }

  function errorText(error) {
    return error && error.message ? error.message.replace(/^Error:\s*/, '') : String(error);
  }

  function appendHighlighted(host, text, keywords) {
    if (!keywords.length) { host.textContent = text; return; }
    const escaped = keywords.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    let offset = 0;
    for (const match of text.matchAll(regex)) {
      if (match.index > offset) host.appendChild(document.createTextNode(text.slice(offset, match.index)));
      const mark = document.createElement('mark');
      mark.textContent = match[0];
      host.appendChild(mark);
      offset = match.index + match[0].length;
    }
    if (offset < text.length) host.appendChild(document.createTextNode(text.slice(offset)));
  }

  function renderResponse(response) {
    results.replaceChildren();
    const sourceText = response.providers?.map((provider) => providerNames[provider] || provider).join(' + ');
    stats.textContent = `${sourceText ? `${sourceText} · ` : ''}关键词：${response.keywords.join('、')} · ${response.mode} · 扫描 ${response.filesScanned} 个文件 · ${response.total} 个对话 · ${response.elapsedMs}ms${response.truncated ? ' · 已截断' : ''}`;
    if (!response.results.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '未找到匹配结果';
      results.appendChild(empty);
      return;
    }
    for (const item of response.results) {
      const row = document.createElement('article');
      row.className = 'search-result';
      const head = document.createElement('div');
      head.className = 'result-head';
      const title = document.createElement('div');
      title.className = 'result-title';
      title.textContent = item.sessionName || item.sessionId;
      title.title = `${item.projectName}\n${item.sessionId}`;
      const role = document.createElement('span');
      role.className = `result-role ${item.role}`;
      role.textContent = item.role === 'user' ? 'USER' : 'ASSISTANT';
      const cli = document.createElement('span');
      cli.className = 'result-cli';
      cli.textContent = item.cliName || providerNames[item.cli] || '';
      const meta = document.createElement('span');
      meta.className = 'result-meta';
      const time = item.timestamp ? new Date(item.timestamp).toLocaleString() : '';
      const matches = item.matchedMessages ? `匹配 ${item.matchedMessages} 条消息` : '标题匹配';
      meta.textContent = [matches, item.model, time].filter(Boolean).join(' · ');
      const resume = document.createElement('button');
      resume.className = 'resume-button';
      resume.type = 'button';
      resume.textContent = '⧉';
      resume.title = `复制 ${item.cliName || ''} 恢复命令`.trim();
      resume.setAttribute('aria-label', resume.title);
      resume.addEventListener('click', async () => {
        if (resume.disabled) return;
        resume.disabled = true;
        try {
          const copied = await window.conversationSearch.copyResume(item.cli, item.sessionId);
          if (copied) {
            resume.textContent = '✓';
            resume.classList.add('copied');
            setTimeout(() => {
              if (!resume.isConnected) return;
              resume.textContent = '⧉';
              resume.classList.remove('copied');
              resume.disabled = false;
            }, 1200);
            return;
          }
        } catch (error) {
          stats.textContent = `复制失败：${errorText(error)}`;
        }
        resume.disabled = false;
      });
      head.append(title, cli, role, meta, resume);
      const file = document.createElement('div');
      file.className = 'result-path';
      file.textContent = [
        item.cliName || '',
        item.projectName,
        item.file,
        item.line ? `行 ${item.line}` : '',
      ].filter(Boolean).join(' · ');
      const text = document.createElement('div');
      text.className = 'result-text';
      appendHighlighted(text, item.text, response.keywords);
      row.append(head, file, text);
      results.appendChild(row);
    }
  }

  async function runSearch() {
    const query = keyword.value.trim();
    if (!query || searchButton.disabled) return;
    const providers = source.value ? [source.value] : config.providers;
    const providerText = providers.map((provider) => providerNames[provider] || provider).join(' + ');
    searchButton.disabled = true;
    stats.textContent = '搜索中…';
    results.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'empty-state';
    loading.textContent = `正在扫描 ${providerText} 对话…`;
    results.appendChild(loading);
    try {
      renderResponse(await window.conversationSearch.search({
        query,
        mode: mode.value,
        providers,
        projectKey: project.value,
      }));
    } catch (error) {
      stats.textContent = '';
      results.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = `搜索失败：${errorText(error)}`;
      results.appendChild(empty);
    } finally {
      searchButton.disabled = false;
    }
  }

  searchButton.addEventListener('click', runSearch);
  keyword.addEventListener('keydown', (event) => { if (event.key === 'Enter') runSearch(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.conversationSearch.close();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      keyword.focus();
      keyword.select();
    }
  });
  document.getElementById('window-close')?.addEventListener('click', () => window.conversationSearch.close());
  document.getElementById('window-minimize')?.addEventListener('click', () => window.conversationSearch.minimize());
  document.getElementById('window-maximize')?.addEventListener('click', () => window.conversationSearch.toggleMaximize());

  function renderProjects() {
    project.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = '全部项目';
    project.appendChild(all);
    const selectedSource = source.value;
    for (const item of projects.filter((candidate) => !selectedSource || candidate.cli === selectedSource)) {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = `${config.providers.length > 1 ? `${item.cliName} · ` : ''}${item.name} (${item.files})`;
      project.appendChild(option);
    }
  }

  source.addEventListener('change', renderProjects);
  window.conversationSearch.projects(config.providers).then((items) => {
    projects = items;
    renderProjects();
  }).catch((error) => { stats.textContent = `项目列表读取失败：${errorText(error)}`; });
  window.conversationSearchUiReady = true;
})();
