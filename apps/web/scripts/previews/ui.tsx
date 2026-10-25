/**
 * Satori-styled building blocks that mirror the real app's components
 * (StudentTable, SummaryCards, ActivityFeed, ...) closely enough to be an
 * honest preview. Satori speaks a flexbox-only CSS subset, so everything is
 * inline styles with fixed pixel layout.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Palette } from './theme.js';
import type { FixtureStudent, Fixture, FixtureActivity } from './fixture.js';

type Style = CSSProperties;

const INTER = 'Inter';

/* ---------- frame: browser chrome + app shell ---------- */

export function Chrome({
  p,
  url,
  active,
  children,
}: {
  p: Palette;
  url: string;
  active?: 'dashboard' | 'history' | 'settings';
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        backgroundColor: p.bg,
        fontFamily: INTER,
      }}
    >
      <div
        style={{
          display: 'flex',
          height: 38,
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 14px',
          gap: 7,
          backgroundColor: p.chromeBar,
          borderBottom: `1px solid ${p.chromeBorder}`,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: '#f87171',
          }}
        />
        <div
          style={{
            display: 'flex',
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: '#fbbf24',
          }}
        />
        <div
          style={{
            display: 'flex',
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: '#34d399',
          }}
        />
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 319,
            width: 560,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.urlPill,
            border: `1px solid ${p.chromeBorder}`,
          }}
        >
          <span style={{ display: 'flex', fontSize: 12, color: p.sub }}>{url}</span>
        </div>
      </div>
      <AppHeader p={p} active={active} />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: 20, gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function AppHeader({
  p,
  active = 'dashboard',
}: {
  p: Palette;
  active?: 'dashboard' | 'history' | 'settings';
}) {
  const items: { key: string; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'history', label: 'History' },
    { key: 'settings', label: 'Settings' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: p.card,
        borderBottom: `1px solid ${p.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '12px 20px 8px',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              display: 'flex',
              fontSize: 19,
              fontWeight: 700,
              color: p.strong,
              letterSpacing: -0.3,
            }}
          >
            MeetWatch
          </span>
          <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
            Online-student monitoring for Google Meet sessions
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: isActive ? p.accent : 'transparent',
                  color: isActive ? '#ffffff' : p.sub,
                }}
              >
                <span style={{ display: 'flex' }}>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', padding: '0 20px 10px' }}>
        <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
          Provider:{' '}
          <span style={{ display: 'flex', fontWeight: 600, color: p.text, marginLeft: 4 }}>
            simulator
          </span>
          <span style={{ display: 'flex', marginLeft: 4 }}>— running</span>
        </span>
      </div>
    </div>
  );
}

/* ---------- primitives ---------- */

export function Card({
  p,
  title,
  children,
  style,
}: {
  p: Palette;
  title?: string;
  children: ReactNode;
  style?: Style;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: p.card,
        border: `1px solid ${p.border}`,
        borderRadius: 12,
        padding: 16,
        boxShadow: p.shadow,
        ...style,
      }}
    >
      {title ? <CardTitle p={p}>{title}</CardTitle> : null}
      {children}
    </div>
  );
}

export function CardTitle({
  p,
  children,
  style,
}: {
  p: Palette;
  children: ReactNode;
  style?: Style;
}) {
  return (
    <div style={{ display: 'flex', marginBottom: 10, ...style }}>
      <span
        style={{
          display: 'flex',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: p.sub,
        }}
      >
        {children}
      </span>
    </div>
  );
}

export function Btn({
  p,
  kind = 'primary',
  children,
}: {
  p: Palette;
  kind?: 'primary' | 'ghost';
  children: ReactNode;
}) {
  const primary = kind === 'primary';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '7px 13px',
        borderRadius: 6,
        backgroundColor: primary ? p.accent : 'transparent',
        border: primary ? 'none' : `1px solid ${p.inputBorder}`,
      }}
    >
      <span
        style={{
          display: 'flex',
          fontSize: 13,
          fontWeight: 600,
          color: primary ? '#ffffff' : p.text,
        }}
      >
        {children}
      </span>
    </div>
  );
}

export function Input({ p, w, children }: { p: Palette; w: number; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        // content-box: visual width = declared + 22px padding + 2px border
        width: w - 24,
        flexShrink: 0,
        padding: '7px 11px',
        borderRadius: 6,
        backgroundColor: p.inputBg,
        border: `1px solid ${p.inputBorder}`,
      }}
    >
      <span style={{ display: 'flex', fontSize: 13, color: p.sub, whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </div>
  );
}

function Badge({
  p,
  kind,
  label,
}: {
  p: Palette;
  kind: 'online' | 'left' | 'absent' | 'late' | 'unstable';
  label: string;
}) {
  const c = p.badge[kind];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        border: `1px solid ${c.fg}33`,
        backgroundColor: c.bg,
      }}
    >
      {kind === 'online' || kind === 'left' || kind === 'absent' ? (
        <div
          style={{
            display: 'flex',
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: p.dot[kind],
          }}
        />
      ) : null}
      <span style={{ display: 'flex', fontSize: 11, fontWeight: 600, color: c.fg }}>{label}</span>
    </div>
  );
}

function FlagBadge({ p, kind }: { p: Palette; kind: 'late' | 'unstable' }) {
  const c = p.badge[kind];
  return (
    <div
      style={{
        display: 'flex',
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${c.fg}33`,
        backgroundColor: c.bg,
      }}
    >
      <span
        style={{ display: 'flex', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: c.fg }}
      >
        {kind === 'late' ? 'LATE' : 'UNSTABLE'}
      </span>
    </div>
  );
}

function Bar({ p, pct, passMark }: { p: Palette; pct: number; passMark: number }) {
  const width = Math.round((Math.min(100, pct) / 100) * 64);
  const color = pct >= passMark ? p.barGood : pct >= passMark / 2 ? p.barMid : p.barBad;
  const passing = pct >= passMark;
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          width: 64,
          height: 6,
          borderRadius: 3,
          backgroundColor: p.track,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ display: 'flex', width, height: 6, borderRadius: 3, backgroundColor: color }}
        />
      </div>
      <span
        style={{
          display: 'flex',
          fontSize: 12,
          fontWeight: passing ? 400 : 700,
          color: passing ? p.text : p.danger,
        }}
      >
        {pct}%{passing ? '' : ' !'}
      </span>
    </div>
  );
}

/* ---------- composed app sections ---------- */

export function SummaryCards({ p, fixture }: { p: Palette; fixture: Fixture }) {
  const cards = [
    { label: 'Online', value: fixture.summary.online, color: p.onlineValue },
    { label: 'Left', value: fixture.summary.left, color: p.leftValue },
    { label: 'Absent', value: fixture.summary.absent, color: p.absentValue },
    { label: 'Late', value: fixture.summary.late, color: p.lateValue },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12 }}>
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              backgroundColor: p.card,
              border: `1px solid ${p.border}`,
              borderRadius: 12,
              padding: 16,
              boxShadow: p.shadow,
            }}
          >
            <span
              style={{
                display: 'flex',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: p.sub,
              }}
            >
              {c.label}
            </span>
            <span
              style={{
                display: 'flex',
                fontSize: 30,
                fontWeight: 700,
                color: c.color,
                marginTop: 4,
              }}
            >
              {c.value}
            </span>
          </div>
        ))}
      </div>
      <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
        {fixture.summary.total} students · {fixture.summary.attendanceAvgPct}% average attendance
      </span>
    </div>
  );
}

/**
 * Column widths. Satori uses content-box sizing (declared width EXCLUDES
 * padding), so each declared value here is the visual column width minus the
 * cell's 24px horizontal padding. Visual totals: narrow 830px, wide 1126px.
 */
const NARROW_COLS = { student: 240, status: 76, joined: 74, call: 100, attendance: 112, flags: 84 };
const WIDE_COLS = { student: 396, status: 86, joined: 96, call: 136, attendance: 156, flags: 112 };

export function StudentTable({
  p,
  fixture,
  rows,
  wide = false,
}: {
  p: Palette;
  fixture: Fixture;
  rows: FixtureStudent[];
  /** Full-width variant (history page): wider columns to fill the card. */
  wide?: boolean;
}) {
  const COLS = wide ? WIDE_COLS : NARROW_COLS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Input p={p} w={240}>
          Search name, email, section…
        </Input>
        <Input p={p} w={130}>
          All students
        </Input>
        <div style={{ display: 'flex', marginLeft: 'auto' }}>
          <span style={{ display: 'flex', fontSize: 11, color: p.faint }}>
            {rows.length} of {fixture.summary.total} shown
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 8,
          border: `1px solid ${p.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: p.theadBg,
            padding: '8px 0',
          }}
        >
          <Th p={p} w={COLS.student}>
            Student
          </Th>
          <Th p={p} w={COLS.status}>
            Status
          </Th>
          <Th p={p} w={COLS.joined}>
            Joined
          </Th>
          <Th p={p} w={COLS.call}>
            In call
          </Th>
          <Th p={p} w={COLS.attendance}>
            Attendance
          </Th>
          <Th p={p} w={COLS.flags}>
            Flags
          </Th>
        </div>
        {rows.map((s, i) => (
          <Row
            key={s.name}
            p={p}
            s={s}
            cols={COLS}
            tinted={s.status === 'online'}
            divider={i > 0}
          />
        ))}
      </div>
    </div>
  );
}

function Th({ p, w, children }: { p: Palette; w: number; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', width: w, flexShrink: 0, padding: '0 12px' }}>
      <span
        style={{
          display: 'flex',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: p.theadText,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function Row({
  p,
  s,
  cols,
  tinted,
  divider,
}: {
  p: Palette;
  s: FixtureStudent;
  cols: {
    student: number;
    status: number;
    joined: number;
    call: number;
    attendance: number;
    flags: number;
  };
  tinted: boolean;
  divider: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tinted ? p.rowTint : 'transparent',
        borderTop: divider ? `1px solid ${p.divider}` : 'none',
        padding: '9px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: cols.student,
          flexShrink: 0,
          flexDirection: 'column',
          padding: '0 12px',
        }}
      >
        <span style={{ display: 'flex', fontSize: 13, fontWeight: 600, color: p.strong }}>
          {s.name}
        </span>
        <span style={{ display: 'flex', fontSize: 11, color: p.faint, whiteSpace: 'nowrap' }}>
          {s.email} · {s.section}
        </span>
      </div>
      <div style={{ display: 'flex', width: cols.status, flexShrink: 0, padding: '0 12px' }}>
        <Badge
          p={p}
          kind={s.status}
          label={s.status === 'online' ? 'Online' : s.status === 'left' ? 'Left' : 'Absent'}
        />
      </div>
      <div style={{ display: 'flex', width: cols.joined, flexShrink: 0, padding: '0 12px' }}>
        <span style={{ display: 'flex', fontSize: 12, color: p.text, whiteSpace: 'nowrap' }}>
          {s.joinedAt ?? '—'}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          width: cols.call,
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          padding: '0 12px',
        }}
      >
        <span style={{ display: 'flex', fontSize: 12, color: p.text, whiteSpace: 'nowrap' }}>
          {s.status === 'absent' ? '—' : s.inCall}
        </span>
        {s.rejoinCount > 0 ? (
          <span style={{ display: 'flex', fontSize: 11, color: p.faint, whiteSpace: 'nowrap' }}>
            ({s.rejoinCount} rejoins)
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', width: cols.attendance, flexShrink: 0, padding: '0 12px' }}>
        <Bar p={p} pct={s.attendancePct} passMark={75} />
      </div>
      <div
        style={{
          display: 'flex',
          width: cols.flags,
          flexShrink: 0,
          flexDirection: 'row',
          gap: 4,
          padding: '0 12px',
        }}
      >
        {s.late ? <FlagBadge p={p} kind="late" /> : null}
        {s.unstable ? <FlagBadge p={p} kind="unstable" /> : null}
        {!s.late && !s.unstable ? (
          <span style={{ display: 'flex', fontSize: 12, color: p.faint }}>—</span>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityFeed({ p, items }: { p: Palette; items: FixtureActivity[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((item, i) => {
        const join = item.kind === 'join';
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: '5px 8px',
              borderRadius: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: join ? p.activity.joinBg : p.activity.leaveBg,
              }}
            >
              <span
                style={{
                  display: 'flex',
                  fontSize: 11,
                  fontWeight: 700,
                  color: join ? p.activity.joinFg : p.activity.leaveFg,
                }}
              >
                {join ? '↑' : '↓'}
              </span>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'row', gap: 4, flex: 1, overflow: 'hidden' }}
            >
              <span
                style={{
                  display: 'flex',
                  fontSize: 13,
                  fontWeight: 600,
                  color: p.strong,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
              </span>
              <span
                style={{
                  display: 'flex',
                  fontSize: 13,
                  color: join ? p.activity.joinFg : p.activity.leaveFg,
                  whiteSpace: 'nowrap',
                }}
              >
                {join ? 'joined' : 'left'}
              </span>
            </div>
            <span style={{ display: 'flex', fontSize: 11, color: p.faint }}>{item.at}</span>
          </div>
        );
      })}
    </div>
  );
}

export function UnknownCard({ p, fixture }: { p: Palette; fixture: Fixture }) {
  return (
    <Card p={p} title={`Unknown participants (${fixture.unknown.length})`}>
      <span style={{ display: 'flex', fontSize: 11, color: p.sub, marginBottom: 10 }}>
        These Meet participants did not match the roster by email or name. Map them to a student —
        the mapping is remembered for future sessions.
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fixture.unknown.map((u) => (
          <div
            key={u.displayName}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              border: `1px solid ${p.border}`,
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <span style={{ display: 'flex', fontSize: 13, fontWeight: 600, color: p.strong }}>
                  {u.displayName}
                </span>
                {u.isOnline ? (
                  <span
                    style={{ display: 'flex', fontSize: 11, fontWeight: 700, color: p.onlineValue }}
                  >
                    in call
                  </span>
                ) : null}
              </div>
              <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>{u.meta}</span>
            </div>
            <Input p={p} w={170}>
              Choose student…
            </Input>
            <Btn p={p}>Map</Btn>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SessionBar({
  p,
  fixture,
  actions,
}: {
  p: Palette;
  fixture: Fixture;
  actions?: ReactNode;
}) {
  const dot = fixture.sessionStatus === 'active' ? p.dot.online : p.dot.ended;
  const statusLabel = fixture.sessionStatus === 'active' ? 'active' : 'ended';
  return (
    <Card p={p}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', fontSize: 13, fontWeight: 600, color: p.text }}>
            Session
          </span>
          <Input p={p} w={330}>
            {`9:00 AM · ${fixture.sessionTitle} (${statusLabel})`}
          </Input>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: dot,
              }}
            />
            <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
              {fixture.meetingCode}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
          {actions}
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
          {fixture.window} · late after {fixture.lateThreshold} min · sim speed {fixture.timeScale}×
          · pass mark {fixture.passMark}%
        </span>
      </div>
    </Card>
  );
}
