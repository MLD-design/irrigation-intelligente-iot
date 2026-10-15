import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ComposedChart, Area, Line, AreaChart, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { getLatestMeasurement, getMeasurementHistory } from '../api/measurements';
import { getIrrigationHistory, getIrrigationStatus } from '../api/irrigation';
import { getSettings } from '../api/settings';
import { getAlerts } from '../api/alerts';
import PumpControl from '../components/PumpControl';
import ErrorMessage from '../components/ErrorMessage';

/* ---------- Constantes ---------- */
// Les couleurs néon restent identiques dans les deux thèmes ;
// les couleurs neutres lisent les variables CSS du thème actif.
const COLORS = {
  yellow: '#ffc933', orange: '#ff7a1a', teal: '#1de9b6',
  purple: '#9b5cff', red: '#ff4d6d',
  muted: 'var(--muted)', track: 'var(--track)', grid: 'var(--grid)',
};
const STALE_AFTER_MS = 10 * 60 * 1000; // mesure ancienne après 10 min

// Plage du cadran de température (°C) : à adapter à ton climat
const DIAL_MIN = 0;
const DIAL_MAX = 50;

const MODE_LABELS = { MANUAL: 'Manuel', AUTOMATIC: 'Automatique' };
const ACTION_LABELS = { START: 'Démarrage', STOP: 'Arrêt' };
const SOURCE_LABELS = { MANUAL: 'Manuelle', AUTOMATIC: 'Automatique' };
const SOURCE_COLORS = { MANUAL: COLORS.purple, AUTOMATIC: COLORS.teal };
const STATUS_LABELS = {
  PENDING: 'En attente', EXECUTED: 'Exécutée', REJECTED: 'Refusée',
  FAILED: 'Échec', EXPIRED: 'Expirée',
};
const STATUS_CLASS = {
  PENDING: 'tag warn', EXECUTED: 'tag ok', REJECTED: 'tag ko',
  FAILED: 'tag ko', EXPIRED: 'tag warn',
};
const STATUS_COLORS = {
  EXECUTED: COLORS.teal, PENDING: COLORS.yellow, REJECTED: COLORS.orange,
  FAILED: COLORS.red, EXPIRED: COLORS.purple,
};
const TYPE_LABELS = {
  LOW_MOISTURE: 'Humidité faible', HIGH_TEMPERATURE: 'Température élevée',
  SENSOR_FAILURE: 'Panne de capteur', DEVICE_OFFLINE: 'Dispositif hors ligne',
  PUMP_FAILURE: 'Panne de pompe',
};
const SEVERITY_LABELS = { INFO: 'Info', WARNING: 'Avertissement', CRITICAL: 'Critique' };
const SEVERITY_CLASS = { INFO: 'tag info', WARNING: 'tag warn', CRITICAL: 'tag ko' };
const PUMP_KPI = {
  ON: { text: 'EN MARCHE', accent: 'teal' },
  OFF: { text: 'ARRÊTÉE', accent: 'purple' },
  UNKNOWN: { text: 'INCONNU', accent: 'yellow' },
};

const tooltipStyle = {
  background: 'var(--tooltip-bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
};
const axisTick = { fill: COLORS.muted, fontSize: 12 };

const fmt = (value, digits = 1) => (typeof value === 'number' ? value.toFixed(digits) : '-');

function ago(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return { v: s, u: 's' };
  const m = Math.floor(s / 60);
  if (m < 60) return { v: m, u: 'min' };
  const h = Math.floor(m / 60);
  if (h < 48) return { v: h, u: 'h' };
  return { v: Math.floor(h / 24), u: 'j' };
}

/* ---------- Requêtes partagées (mêmes clés = mêmes données en cache) ---------- */
const useLatest = () =>
  useQuery({
    queryKey: ['measurement', 'latest'],
    queryFn: () => getLatestMeasurement(),
    refetchInterval: 10_000,
    retry: false,
  });

const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: getSettings, retry: false });

const useStatus = () =>
  useQuery({
    queryKey: ['irrigation', 'status'],
    queryFn: getIrrigationStatus,
    refetchInterval: 5000,
    retry: false,
  });

const useRecent = () =>
  useQuery({
    queryKey: ['measurements', 'recent'],
    queryFn: () =>
      getMeasurementHistory({
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        size: 100, // maximum autorisé par le contrat
      }),
    refetchInterval: 30_000,
    retry: false,
  });

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// Le contrat ne précise pas l'ordre de tri : on trie par date croissante
function toSeries(data) {
  if (!data) return [];
  return [...data.content]
    .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt))
    .map((m) => ({
      time: new Date(m.measuredAt).getTime(),
      soilMoisture: m.soilMoisture,
      temperature: m.temperature, // optionnelle dans le contrat
    }));
}

/* ---------- Briques visuelles ---------- */

// Carte 3D : suit la souris (inclinaison + reflet) et apparaît en cascade
function Tilt({ className = '', accent = 'teal', index = 0, children }) {
  const ref = useRef(null);

  function handleMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${((x - 0.5) * 12).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  return (
    <div
      ref={ref}
      className={`tilt acc-${accent} ${className}`}
      style={{ '--i': index }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}

function Card({ title, link, children, ...tiltProps }) {
  return (
    <Tilt {...tiltProps}>
      <header className="card-head">
        <h2>{title}</h2>
        {link && <Link to={link.to}>{link.label}</Link>}
      </header>
      {children}
    </Tilt>
  );
}

// Compteur animé de 0 jusqu'à la valeur
function CountUp({ value, digits = 1, suffix = '' }) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (typeof value !== 'number') return undefined;
    const from = fromRef.current;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (value - from) * eased;
      fromRef.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  if (typeof value !== 'number') return <>-</>;
  return <>{shown.toFixed(digits)}{suffix}</>;
}

function Clock() {
  const now = useNow(1000);
  const d = new Date(now);
  return (
    <div className="clock">
      <span className="digits yellow">{d.toLocaleTimeString()}</span>
      <small>{d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</small>
    </div>
  );
}

// Cadran analogique : arc dégradé, graduations et aiguille animée
const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};
const arcPath = (cx, cy, r, from, to) => {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

function Dial({ value, min = DIAL_MIN, max = DIAL_MAX, unit = '°C' }) {
  const target = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPct(target), 250);
    return () => clearTimeout(t);
  }, [target]);

  const angle = -135 + pct * 270;
  const ticks = Array.from({ length: 31 }, (_, i) => ({
    deg: -135 + (i * 270) / 30,
    major: i % 5 === 0,
  }));

  return (
    <svg viewBox="0 0 200 200" className="dial">
      <defs>
        <linearGradient id="dialGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1de9b6" />
          <stop offset="55%" stopColor="#ffc933" />
          <stop offset="100%" stopColor="#ff4d6d" />
        </linearGradient>
      </defs>

      <path d={arcPath(100, 100, 84, -135, 135)} fill="none" stroke="var(--track)" strokeWidth="10" strokeLinecap="round" />
      <path
        d={arcPath(100, 100, 84, -135, 135)}
        fill="none" stroke="url(#dialGrad)" strokeWidth="10" strokeLinecap="round"
        pathLength="100" strokeDasharray="100" strokeDashoffset={100 - pct * 100}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.9,.3,1)' }}
      />

      {ticks.map(({ deg, major }) => {
        const [x1, y1] = polar(100, 100, major ? 62 : 67, deg);
        const [x2, y2] = polar(100, 100, 72, deg);
        return (
          <line
            key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={major ? 'var(--tick-major)' : 'var(--tick-minor)'} strokeWidth={major ? 2 : 1}
          />
        );
      })}

      <g style={{
        transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px',
        transition: 'transform 1.2s cubic-bezier(.2,.9,.3,1.25)',
      }}>
        <line x1="100" y1="108" x2="100" y2="44" stroke="#ffc933" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="9" fill="var(--hub)" stroke="#ffc933" strokeWidth="3" />

      <text x="100" y="146" textAnchor="middle" className="dial-text">{fmt(value)}{unit}</text>
      <text x="48" y="182" textAnchor="middle" className="dial-scale">{min}</text>
      <text x="152" y="182" textAnchor="middle" className="dial-scale">{max}</text>
    </svg>
  );
}

/* ---------- Indicateurs en haut ---------- */
function Kpi({ label, accent, index, bar = 0, sub, children }) {
  return (
    <Tilt className="s3 kpi" accent={accent} index={index}>
      <span className="kpi-label">{label}</span>
      <div className="digits kpi-value">{children}</div>
      {sub && <small>{sub}</small>}
      <div className="kpi-bar"><i style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} /></div>
    </Tilt>
  );
}

function KpiRow() {
  const settings = useSettings();
  const latest = useLatest();
  const recent = useRecent();
  const status = useStatus();
  const now = useNow(1000);

  const threshold = settings.data?.moistureThreshold;
  const pump = status.data?.pumpState;
  const pk = PUMP_KPI[pump];

  const ts = latest.data ? new Date(latest.data.measuredAt).getTime() : null;
  const age = ts ? ago(now - ts) : null;
  const stale = ts ? now - ts > STALE_AFTER_MS : false;

  return (
    <>
      <Kpi index={0} accent="yellow" label="Seuil d'humidité" bar={threshold}>
        {threshold !== undefined ? <CountUp value={threshold} suffix="%" /> : '-'}
      </Kpi>

      <Kpi
        index={1} accent={pk?.accent ?? 'purple'} label="Pompe"
        sub={status.data ? `Mode ${MODE_LABELS[status.data.mode]}` : undefined}
        bar={pump === 'ON' ? 100 : pump === 'OFF' ? 8 : 40}
      >
        <span className="kpi-text">{pk?.text ?? '-'}</span>
      </Kpi>

      <Kpi
        index={2} accent="orange" label="Mesures (24 h)"
        bar={recent.data ? Math.min(100, recent.data.totalElements) : 0}
      >
        {recent.data ? <CountUp value={recent.data.totalElements} digits={0} /> : '-'}
      </Kpi>

      <Kpi
        index={3} accent={stale ? 'red' : 'teal'} label="Dernière mesure"
        sub={ts ? (stale ? 'Capteur peut-être hors ligne' : 'Capteur actif') : undefined}
        bar={ts ? Math.max(5, 100 - ((now - ts) / STALE_AFTER_MS) * 100) : 0}
      >
        {age ? `${age.v} ${age.u}` : '-'}
      </Kpi>
    </>
  );
}

/* ---------- Humidité : anneaux concentriques ---------- */
function MoistureCard() {
  const { data, error, isLoading } = useLatest();
  const settings = useSettings();

  if (isLoading) return <Card title="Humidité du sol" className="s3" index={4}><p className="muted">Chargement...</p></Card>;
  if (error?.status === 404) {
    return <Card title="Humidité du sol" className="s3" index={4}><p className="muted">Aucune mesure disponible.</p></Card>;
  }
  if (error) return <Card title="Humidité du sol" className="s3" index={4}><ErrorMessage error={error} /></Card>;

  const threshold = settings.data?.moistureThreshold;
  const below = threshold !== undefined && data.soilMoisture < threshold;
  const color = below ? COLORS.orange : COLORS.teal;

  // Le premier anneau est le plus proche du centre
  const rings = [
    ...(threshold !== undefined ? [{ name: 'Seuil', value: threshold, fill: COLORS.purple }] : []),
    { name: 'Humidité', value: data.soilMoisture, fill: color },
  ];

  return (
    <Card title="Humidité du sol" className="s3 glow" accent={below ? 'orange' : 'teal'} index={4}>
      <div className="gauge">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="48%" outerRadius="100%" barSize={14}
            data={rings} startAngle={90} endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={10} background={{ fill: COLORS.track }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="gauge-center">
          <span className="digits big" style={{ color }}>
            <CountUp value={data.soilMoisture} suffix="%" />
          </span>
          {below && <span className="tag ko">Sous le seuil</span>}
        </div>
      </div>

      <div className="legend">
        <span><i style={{ background: color }} />Humidité</span>
        {threshold !== undefined && <span><i style={{ background: COLORS.purple }} />Seuil ({fmt(threshold)} %)</span>}
      </div>
      <small>Mesuré le {new Date(data.measuredAt).toLocaleString()}</small>
    </Card>
  );
}

/* ---------- Température : cadran + courbe violette ---------- */
function TemperatureCard() {
  const latest = useLatest();
  const recent = useRecent();

  if (latest.isLoading) return <Card title="Température" className="s3" index={7}><p className="muted">Chargement...</p></Card>;
  if (latest.error?.status === 404) {
    return <Card title="Température" className="s3" index={7}><p className="muted">Aucune mesure disponible.</p></Card>;
  }
  if (latest.error) return <Card title="Température" className="s3" index={7}><ErrorMessage error={latest.error} /></Card>;

  const temp = latest.data.temperature; // optionnelle dans le contrat
  const series = toSeries(recent.data).filter((p) => p.temperature !== undefined);

  return (
    <Card title="Température" className="s3 glow" accent="yellow" index={7}>
      {temp !== undefined ? <Dial value={temp} /> : <p className="muted">Température non mesurée.</p>}

      <div className="spark">
        {series.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.purple} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={COLORS.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="temperature" stroke={COLORS.purple} strokeWidth={2} fill="url(#gradTemp)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <small>Évolution sur 24 h</small>
    </Card>
  );
}

/* ---------- Grand graphique central ---------- */
function HumidityChart() {
  const { data, error, isLoading } = useRecent();
  const settings = useSettings();
  const series = toSeries(data);
  const threshold = settings.data?.moistureThreshold;

  return (
    <Card
      title="Humidité et température sur 24 heures"
      className="s6 r2 flexcol glow" accent="yellow" index={5}
      link={{ to: '/mesures', label: 'Historique complet' }}
    >
      {isLoading && <p className="muted">Chargement...</p>}
      <ErrorMessage error={error} />
      {data && series.length === 0 && <p className="muted">Aucune mesure sur les dernières 24 heures.</p>}

      {series.length > 0 && (
        <>
          <div className="chart-grow">
            <div className="chart-fill">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMoisture" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.yellow} stopOpacity={0.95} />
                      <stop offset="50%" stopColor={COLORS.orange} stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#c2185b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']}
                    tick={axisTick} stroke={COLORS.grid}
                    tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  />
                  <YAxis yAxisId="h" domain={[0, 100]} unit="%" tick={axisTick} stroke={COLORS.grid} />
                  <YAxis yAxisId="t" orientation="right" hide domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(t) => new Date(t).toLocaleString()}
                    formatter={(v, name) => [name === 'Température' ? `${fmt(v)} °C` : `${fmt(v)} %`, name]}
                  />
                  {threshold !== undefined && (
                    <ReferenceLine
                      yAxisId="h" y={threshold} stroke={COLORS.teal} strokeDasharray="6 4"
                      label={{ value: 'Seuil', fill: COLORS.teal, fontSize: 12, position: 'insideTopRight' }}
                    />
                  )}
                  <Area
                    yAxisId="h" type="monotone" dataKey="soilMoisture" name="Humidité"
                    stroke={COLORS.yellow} strokeWidth={3} fill="url(#gradMoisture)"
                  />
                  <Line
                    yAxisId="t" type="monotone" dataKey="temperature" name="Température"
                    stroke={COLORS.purple} strokeWidth={2.5} dot={false} connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="legend">
            <span><i style={{ background: COLORS.yellow }} />Humidité (%)</span>
            <span><i style={{ background: COLORS.purple }} />Température (°C)</span>
            {threshold !== undefined && <span><i style={{ background: COLORS.teal }} />Seuil</span>}
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------- Donut à deux anneaux : statut et source des commandes ---------- */
function CommandsDonut() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['irrigation', 'history', 'donut'],
    queryFn: () => getIrrigationHistory(0, 50),
    refetchInterval: 15_000,
    retry: false,
  });

  const byStatus = {};
  const bySource = {};
  (data?.content ?? []).forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    bySource[c.source] = (bySource[c.source] ?? 0) + 1;
  });
  const statusSlices = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  const sourceSlices = Object.entries(bySource).map(([name, value]) => ({ name, value }));
  const total = statusSlices.reduce((sum, s) => sum + s.value, 0);

  return (
    <Card title="Commandes d'irrigation" className="s3 glow" accent="red" index={6}>
      {isLoading && <p className="muted">Chargement...</p>}
      <ErrorMessage error={error} />
      {data && total === 0 && <p className="muted">Aucune commande enregistrée.</p>}

      {total > 0 && (
        <>
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceSlices} dataKey="value" nameKey="name"
                     innerRadius="36%" outerRadius="52%" paddingAngle={4} stroke="none">
                  {sourceSlices.map((s) => <Cell key={s.name} fill={SOURCE_COLORS[s.name]} />)}
                </Pie>
                <Pie data={statusSlices} dataKey="value" nameKey="name"
                     innerRadius="60%" outerRadius="84%" paddingAngle={3} stroke="none">
                  {statusSlices.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name]} />)}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, n) => [v, STATUS_LABELS[n] ?? SOURCE_LABELS[n] ?? n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="gauge-center">
              <span className="digits big red"><CountUp value={total} digits={0} /></span>
              <small>commandes</small>
            </div>
          </div>

          <div className="legend">
            {statusSlices.map((s) => (
              <span key={s.name}><i style={{ background: STATUS_COLORS[s.name] }} />{STATUS_LABELS[s.name]} ({s.value})</span>
            ))}
          </div>
          <div className="legend">
            {sourceSlices.map((s) => (
              <span key={s.name}><i style={{ background: SOURCE_COLORS[s.name] }} />{SOURCE_LABELS[s.name]} ({s.value})</span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------- Histogramme : humidité moyenne par heure ---------- */
function HourlyBars() {
  const { data, error, isLoading } = useRecent();

  const buckets = new Map();
  toSeries(data).forEach((p) => {
    const d = new Date(p.time);
    const key = `${d.toDateString()}-${d.getHours()}`;
    const b = buckets.get(key) ?? { hour: `${d.getHours()}h`, sum: 0, n: 0 };
    b.sum += p.soilMoisture;
    b.n += 1;
    buckets.set(key, b);
  });
  const bars = [...buckets.values()]
    .map((b) => ({ hour: b.hour, avg: Number((b.sum / b.n).toFixed(1)) }))
    .slice(-12); // les 12 dernières heures

  return (
    <Card title="Humidité moyenne par heure" className="s4 glow" accent="orange" index={9}>
      {isLoading && <p className="muted">Chargement...</p>}
      <ErrorMessage error={error} />
      {data && bars.length === 0 && <p className="muted">Pas assez de mesures.</p>}

      {bars.length > 0 && (
        <div className="chart small">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.yellow} />
                  <stop offset="100%" stopColor={COLORS.orange} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={axisTick} stroke={COLORS.grid} />
              <YAxis domain={[0, 100]} tick={axisTick} stroke={COLORS.grid} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: COLORS.track }}
                       formatter={(v) => [`${v} %`, 'Moyenne']} />
              <Bar dataKey="avg" fill="url(#gradBar)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ---------- Alertes non traitées ---------- */
function AlertsCard() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['alerts', 'dashboard'],
    queryFn: () => getAlerts({ acknowledged: false, size: 5 }),
    refetchInterval: 15_000,
    retry: false,
  });

  return (
    <Card
      title="Alertes non traitées" className="s4" accent="red" index={10}
      link={{ to: '/alertes', label: 'Gérer' }}
    >
      {isLoading && <p className="muted">Chargement...</p>}
      <ErrorMessage error={error} />
      {data && (
        <>
          <div className="digits big" style={{ color: data.totalElements > 0 ? COLORS.red : COLORS.teal }}>
            <CountUp value={data.totalElements} digits={0} />
          </div>
          {data.content.length === 0 ? (
            <p className="muted">Aucune alerte en attente.</p>
          ) : (
            <ul className="plain-list">
              {data.content.map((a) => (
                <li key={a.id}>
                  <span className={SEVERITY_CLASS[a.severity]}>{SEVERITY_LABELS[a.severity]}</span>{' '}
                  <strong>{TYPE_LABELS[a.type] ?? a.type}</strong>
                  <br />
                  <small>{a.message}</small>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

/* ---------- Dernières commandes ---------- */
function CommandsCard() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['irrigation', 'history', 'dashboard'],
    queryFn: () => getIrrigationHistory(0, 5),
    refetchInterval: 10_000,
    retry: false,
  });

  return (
    <Card
      title="Dernières commandes" className="s4" accent="purple" index={11}
      link={{ to: '/irrigation', label: 'Tout voir' }}
    >
      {isLoading && <p className="muted">Chargement...</p>}
      <ErrorMessage error={error} />
      {data && data.content.length === 0 && <p className="muted">Aucune commande enregistrée.</p>}
      {data && data.content.length > 0 && (
        <ul className="plain-list">
          {data.content.map((c) => (
            <li key={c.id}>
              {ACTION_LABELS[c.action]} ({SOURCE_LABELS[c.source]}){' '}
              <span className={STATUS_CLASS[c.status]}>{STATUS_LABELS[c.status]}</span>
              <br />
              <small>{new Date(c.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Page ---------- */
export default function Dashboard() {
  const [is3d, setIs3d] = useState(true);

  return (
    <div className="stage">
      <div className="dash-head">
        <h1>Tableau de bord</h1>
        <Clock />
        <button type="button" className="toggle3d" onClick={() => setIs3d((v) => !v)}>
          Vue 3D : {is3d ? 'activée' : 'désactivée'}
        </button>
      </div>

      <div className={`panel ${is3d ? 'is3d' : ''}`}>
        <div className="dash-grid">
          <KpiRow />

          <MoistureCard />
          <HumidityChart />
          <CommandsDonut />

          <TemperatureCard />
          <Tilt className="s3" accent="orange" index={8}>
            <PumpControl />
          </Tilt>

          <HourlyBars />
          <AlertsCard />
          <CommandsCard />
        </div>
      </div>
    </div>
  );
}