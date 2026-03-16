const POLL_MS = 5000;

const state = {
  config: null,
  metrics: null,
};

const elements = {
  overallStatus: document.getElementById('overall-status'),
  updatedAt: document.getElementById('updated-at'),
  overviewGrid: document.getElementById('overview-grid'),
  trafficCharts: document.getElementById('traffic-charts'),
  healthChecks: document.getElementById('health-checks'),
  appCounts: document.getElementById('app-counts'),
  voiceSummary: document.getElementById('voice-summary'),
  voiceTable: document.getElementById('voice-table'),
  hostSummary: document.getElementById('host-summary'),
  networkList: document.getElementById('network-list'),
  notesList: document.getElementById('notes-list'),
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatAgo(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function statusClass(status) {
  return `status-${status || 'ok'}`;
}

function sparkline(series, stroke) {
  const points = series.map((point) => point.count);
  const max = Math.max(1, ...points);
  const width = 320;
  const height = 90;
  const path = points.map((value, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = height - ((value / max) * (height - 8)) - 4;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-area" d="${area}"></path>
      <path class="spark-line" d="${path}" stroke="${stroke}"></path>
    </svg>
  `;
}

function renderOverview(metrics) {
  const { traffic, application, host, health } = metrics;
  const cards = [
    {
      label: 'Overall health',
      value: health.overall.toUpperCase(),
      tone: health.overall,
      detail: `${traffic.http.requestsLast1m} req/min, ${traffic.sockets.currentConnections} sockets`,
    },
    {
      label: 'Online users',
      value: formatNumber(application.onlineUsers),
      tone: 'ok',
      detail: `${application.db.counts.active_sessions} active sessions`,
    },
    {
      label: 'API latency',
      value: traffic.http.p95LatencyMsLast5m == null ? 'Idle' : `${traffic.http.p95LatencyMsLast5m.toFixed(0)} ms`,
      tone: health.checks.find((check) => check.id === 'api-latency')?.status || 'ok',
      detail: 'p95 over last 5 minutes',
    },
    {
      label: 'Voice activity',
      value: formatNumber(application.voice.activeParticipants),
      tone: application.voice.activeChannels > 0 ? 'ok' : 'warn',
      detail: `${application.voice.activeChannels} live channels`,
    },
    {
      label: 'Host memory',
      value: formatPct(host.memory.usedPct),
      tone: health.checks.find((check) => check.id === 'host-memory')?.status || 'ok',
      detail: `${formatBytes(host.memory.usedBytes)} used`,
    },
    {
      label: 'Disk',
      value: host.disk ? formatPct(host.disk.usedPct) : 'n/a',
      tone: health.checks.find((check) => check.id === 'disk')?.status || 'ok',
      detail: host.disk ? `${formatBytes(host.disk.freeBytes)} free` : 'statfs unavailable',
    },
    {
      label: 'Sockets',
      value: formatNumber(traffic.sockets.currentConnections),
      tone: 'ok',
      detail: `${traffic.sockets.connectionsLast5m} connects in last 5m`,
    },
    {
      label: 'Messages',
      value: formatNumber(traffic.chat.roomMessagesLast1h + traffic.chat.dmMessagesLast1h),
      tone: 'ok',
      detail: 'sent in the last hour',
    },
  ];

  elements.overviewGrid.innerHTML = cards.map((card) => `
    <div class="metric-card ${statusClass(card.tone)}">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <small>${card.detail}</small>
    </div>
  `).join('');
}

function renderCharts(metrics) {
  const charts = [
    {
      label: 'HTTP requests/min',
      value: `${metrics.traffic.http.requestsLast1m} now`,
      stroke: '#6bf178',
      series: metrics.traffic.http.series.requestsPerMinute,
    },
    {
      label: 'HTTP errors/min',
      value: `${metrics.traffic.http.errorsLast5m} in 5m`,
      stroke: '#ff6767',
      series: metrics.traffic.http.series.errorsPerMinute,
    },
    {
      label: 'Room messages/min',
      value: `${metrics.traffic.chat.roomMessagesLast1h} in 1h`,
      stroke: '#ffad5c',
      series: metrics.traffic.chat.series.roomMessagesPerMinute,
    },
    {
      label: 'DM messages/min',
      value: `${metrics.traffic.chat.dmMessagesLast1h} in 1h`,
      stroke: '#7cb7ff',
      series: metrics.traffic.chat.series.dmMessagesPerMinute,
    },
  ];

  elements.trafficCharts.innerHTML = charts.map((chart) => `
    <div class="chart-card">
      <div class="chart-meta">
        <span>${chart.label}</span>
        <strong>${chart.value}</strong>
      </div>
      ${sparkline(chart.series, chart.stroke)}
    </div>
  `).join('');
}

function renderHealthChecks(metrics) {
  elements.healthChecks.innerHTML = metrics.health.checks.map((check) => `
    <div class="health-item ${statusClass(check.status)}">
      <div>
        <strong>${check.label}</strong>
        <p>${check.note}</p>
      </div>
      <span>${check.value}</span>
    </div>
  `).join('');
}

function renderStatGrid(target, items) {
  target.innerHTML = items.map((item) => `
    <div class="stat-tile">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.detail || ''}</small>
    </div>
  `).join('');
}

function renderAppCounts(metrics) {
  const counts = metrics.application.db.counts;
  const recent = metrics.application.db.recent;
  renderStatGrid(elements.appCounts, [
    { label: 'Registered users', value: formatNumber(counts.users), detail: `${recent.new_users_24h} new in 24h` },
    { label: 'Active sessions', value: formatNumber(counts.active_sessions), detail: 'not expired' },
    { label: 'Guilds', value: formatNumber(counts.guilds), detail: `${formatNumber(counts.guild_memberships)} memberships` },
    { label: 'Text rooms', value: formatNumber(counts.rooms), detail: `${formatNumber(counts.voice_channels)} voice channels` },
    { label: 'Messages', value: formatNumber(counts.messages), detail: `${recent.messages_1h} in last hour` },
    { label: 'Uploads', value: formatNumber(counts.uploaded_files), detail: `${recent.uploads_24h} in last 24h` },
    { label: 'Attachments', value: formatNumber(counts.attachments), detail: `${formatNumber(counts.dm_conversations)} DM threads` },
    { label: 'Assets + addons', value: `${formatNumber(counts.asset_dumps)} / ${formatNumber(counts.addons)}`, detail: `${recent.asset_dumps_24h} asset dumps, ${recent.addons_24h} addons in 24h` },
  ]);
}

function renderVoice(metrics) {
  const { voice, mediasoup } = metrics.application;
  renderStatGrid(elements.voiceSummary, [
    { label: 'Live channels', value: formatNumber(voice.activeChannels), detail: `${formatNumber(voice.activeParticipants)} people connected` },
    { label: 'Active speakers', value: formatNumber(voice.activeSpeakers), detail: `${formatNumber(voice.activeScreenShares)} screen shares` },
    { label: 'Mediasoup workers', value: formatNumber(mediasoup.workerCount), detail: `${formatNumber(mediasoup.roomCount)} active rooms` },
    { label: 'Transports / producers', value: `${formatNumber(mediasoup.transportCount)} / ${formatNumber(mediasoup.producerCount)}`, detail: `${formatNumber(mediasoup.consumerCount)} consumers` },
  ]);

  elements.voiceTable.innerHTML = voice.channels.length
    ? voice.channels.map((channel) => `
      <tr>
        <td>${channel.name}</td>
        <td>${formatNumber(channel.participants)}</td>
        <td>${formatNumber(channel.speakers)}</td>
        <td>${formatNumber(channel.screenShares)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="empty">No active voice channels right now.</td></tr>';
}

function renderHost(metrics) {
  const { host, process } = metrics;
  renderStatGrid(elements.hostSummary, [
    { label: 'Load average', value: host.loadAverage.map((value) => value.toFixed(2)).join(' / '), detail: `${host.cpus} CPU cores` },
    { label: 'Host memory', value: formatPct(host.memory.usedPct), detail: `${formatBytes(host.memory.usedBytes)} used` },
    { label: 'Process RSS', value: formatBytes(process.memory.rssBytes), detail: `${formatPct(process.memory.rssPctOfHost)} of host RAM` },
    { label: 'Event loop p95', value: `${process.eventLoopDelayMs.p95.toFixed(1)} ms`, detail: `${process.eventLoopDelayMs.max.toFixed(1)} ms max` },
    { label: 'Disk free', value: host.disk ? formatBytes(host.disk.freeBytes) : 'n/a', detail: host.disk ? formatPct(host.disk.usedPct) : 'statfs unavailable' },
    { label: 'Server uptime', value: `${Math.floor(process.uptimeSec / 3600)}h ${Math.floor((process.uptimeSec % 3600) / 60)}m`, detail: `${host.hostname} · ${host.platform}/${host.arch}` },
  ]);

  const externalInterfaces = host.networkInterfaces.filter((entry) => !entry.internal);
  elements.networkList.innerHTML = externalInterfaces.length
    ? externalInterfaces.map((entry) => `
      <div class="network-item">
        <strong>${entry.name}</strong>
        <span>${entry.family}</span>
        <code>${entry.address}</code>
      </div>
    `).join('')
    : '<div class="empty-note">No external network interfaces detected.</div>';
}

function renderNotes(metrics) {
  elements.notesList.innerHTML = metrics.recentNotes.length
    ? metrics.recentNotes.map((note) => `
      <div class="note ${statusClass(note.level)}">
        <div class="note-head">
          <span>${note.level.toUpperCase()}</span>
          <strong>${note.message}</strong>
          <time>${formatAgo(note.at)}</time>
        </div>
        ${note.details ? `<pre>${JSON.stringify(note.details, null, 2)}</pre>` : ''}
      </div>
    `).join('')
    : '<div class="empty-note">No recent warnings or runtime errors.</div>';
}

function render(metrics) {
  state.metrics = metrics;
  elements.overallStatus.className = `pill ${statusClass(metrics.health.overall)}`;
  elements.overallStatus.textContent = metrics.health.overall.toUpperCase();
  elements.updatedAt.textContent = new Date(metrics.generatedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  renderOverview(metrics);
  renderCharts(metrics);
  renderHealthChecks(metrics);
  renderAppCounts(metrics);
  renderVoice(metrics);
  renderHost(metrics);
  renderNotes(metrics);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  return response.json();
}

async function loadConfig() {
  state.config = await fetchJson('/api/config');
}

async function poll() {
  try {
    const metrics = await fetchJson('/api/metrics');
    render(metrics);
  } catch (error) {
    elements.overallStatus.className = 'pill status-error';
    elements.overallStatus.textContent = 'ERROR';
    elements.updatedAt.textContent = error.message;
  }
}

async function start() {
  await loadConfig();
  await poll();
  setInterval(poll, state.config?.pollingMs || POLL_MS);
}

start().catch((error) => {
  elements.overallStatus.className = 'pill status-error';
  elements.overallStatus.textContent = 'ERROR';
  elements.updatedAt.textContent = error.message;
});
