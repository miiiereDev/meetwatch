/** The three app views + the README banner, as satori element trees. */
import type { ReactNode } from 'react';
import type { Palette } from './theme.js';
import {
  Btn,
  Card,
  Chrome,
  Input,
  SessionBar,
  StudentTable,
  SummaryCards,
  UnknownCard,
  ActivityFeed,
} from './ui.js';
import { DASHBOARD_FIXTURE, HISTORY_FIXTURE } from './fixture.js';

export function DashboardView({ p }: { p: Palette }): ReactNode {
  const f = DASHBOARD_FIXTURE;
  return (
    <Chrome p={p} url="localhost:5173/ — MeetWatch dashboard">
      <SessionBar
        p={p}
        fixture={f}
        actions={
          <div style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <span style={{ display: 'flex', fontSize: 11, color: p.faint }}>
              starts 9:00 AM · ends 9:45 AM
            </span>
            <Btn p={p} kind="ghost">
              End session
            </Btn>
          </div>
        }
      />
      <SummaryCards p={p} fixture={f} />
      <UnknownCard p={p} fixture={f} />
      <div style={{ display: 'flex', flexDirection: 'row', gap: 14, alignItems: 'stretch' }}>
        <Card p={p} title="Students" style={{ width: 830 }}>
          <StudentTable p={p} fixture={f} rows={f.students} />
        </Card>
        <Card p={p} title="Live activity" style={{ flex: 1 }}>
          <ActivityFeed p={p} items={f.activity} />
        </Card>
      </div>
    </Chrome>
  );
}

export function HistoryView({ p }: { p: Palette }): ReactNode {
  const f = HISTORY_FIXTURE;
  return (
    <Chrome p={p} url="localhost:5173/history — MeetWatch" active="history">
      <SessionBar p={p} fixture={f} actions={<Btn p={p}>Export CSV</Btn>} />
      <SummaryCards p={p} fixture={f} />
      <Card p={p} title="Attendance record">
        <StudentTable p={p} fixture={f} rows={f.students} wide />
        <div style={{ display: 'flex', marginTop: 12 }}>
          <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
            <span style={{ display: 'flex', fontWeight: 600, color: p.text, marginRight: 4 }}>
              {f.passCount} of {f.summary.total}
            </span>
            students met the {f.passMark}% pass mark.
          </span>
        </div>
      </Card>
    </Chrome>
  );
}

export function SettingsView({ p }: { p: Palette }): ReactNode {
  return (
    <Chrome p={p} url="localhost:5173/settings — MeetWatch" active="settings">
      <Card p={p} title="Data source">
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Input p={p} w={250}>
            Simulator (demo data)
          </Input>
          <Btn p={p}>Switch provider</Btn>
          <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
            Generates realistic joins and leaves for demo sessions.
          </span>
        </div>
        <div style={{ display: 'flex', marginTop: 8 }}>
          <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
            Active:{' '}
            <span style={{ display: 'flex', fontWeight: 600, color: p.text, marginLeft: 3 }}>
              simulator
            </span>
            <span style={{ display: 'flex', marginLeft: 3 }}>(running)</span>
          </span>
        </div>
      </Card>

      <Card p={p} title="Simulator">
        <span
          style={{ display: 'flex', fontSize: 13, fontWeight: 500, color: p.text, marginBottom: 8 }}
        >
          Simulation speed: 20× (one sim-hour plays in 3 wall-minutes)
        </span>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', position: 'relative', width: 260, height: 14 }}>
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                left: 0,
                top: 5,
                width: 260,
                height: 4,
                borderRadius: 2,
                backgroundColor: p.track,
              }}
            />
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                left: 0,
                top: 5,
                width: 43,
                height: 4,
                borderRadius: 2,
                backgroundColor: p.knob,
              }}
            />
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                left: 36,
                top: 0,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: p.knob,
              }}
            />
          </div>
          <span style={{ display: 'flex', fontSize: 11, color: p.faint }}>1× – 120×</span>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
            <Btn p={p} kind="ghost">
              Apply speed
            </Btn>
            <Btn p={p}>Start demo session</Btn>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 8 }}>
          <span style={{ display: 'flex', fontSize: 11, color: p.sub }}>
            A demo session runs 45 sim-minutes (about 2 wall-minutes at 20×), then ends and appears
            in History.
          </span>
        </div>
      </Card>

      <Card p={p} title="Thresholds">
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', fontSize: 12, fontWeight: 500, color: p.text }}>
              Late threshold (minutes)
            </span>
            <Input p={p} w={110}>
              10
            </Input>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', fontSize: 12, fontWeight: 500, color: p.text }}>
              Minimum attendance (%)
            </span>
            <Input p={p} w={110}>
              75
            </Input>
          </div>
          <div style={{ display: 'flex', marginBottom: 1 }}>
            <Btn p={p}>Save thresholds</Btn>
          </div>
          <span
            style={{ display: 'flex', fontSize: 11, color: p.sub, marginBottom: 8, marginLeft: 4 }}
          >
            Applied to sessions created from now on; existing sessions keep their own values.
          </span>
        </div>
      </Card>

      <Card p={p} title="Roster (25 students)">
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Input p={p} w={170}>
            Full name
          </Input>
          <Input p={p} w={200}>
            school email
          </Input>
          <Input p={p} w={140}>
            Section (optional)
          </Input>
          <Btn p={p}>Add student</Btn>
          <Btn p={p} kind="ghost">
            Import CSV…
          </Btn>
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
          {[
            ['Ava Thompson', 'ava.thompson@student.myschool.edu', '10-A'],
            ['Liam Rivera', 'liam.rivera@student.myschool.edu', '10-A'],
            ['Sofia Nguyen', 'sofia.nguyen@student.myschool.edu', '10-A'],
            ['Noah Patel', 'noah.patel@student.myschool.edu', '10-A'],
          ].map(([name, email, section], i) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderTop: i > 0 ? `1px solid ${p.divider}` : 'none',
                padding: '8px 12px',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  width: 220,
                  fontSize: 13,
                  fontWeight: 600,
                  color: p.strong,
                }}
              >
                {name}
              </span>
              <span style={{ display: 'flex', width: 320, fontSize: 12, color: p.text }}>
                {email}
              </span>
              <span style={{ display: 'flex', width: 120, fontSize: 12, color: p.text }}>
                {section}
              </span>
              <span
                style={{
                  display: 'flex',
                  marginLeft: 'auto',
                  fontSize: 12,
                  fontWeight: 600,
                  color: p.danger,
                }}
              >
                Remove
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card p={p} title="Google Meet integration">
        <span style={{ display: 'flex', fontSize: 13, color: p.sub }}>
          Not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the API environment to
          enable Google sign-in. See docs/GOOGLE_SETUP.md.
        </span>
      </Card>
    </Chrome>
  );
}

export function BannerView({ p, dark }: { p: Palette; dark: boolean }): ReactNode {
  const chips = [
    'Live SSE updates',
    'Attendance %',
    'Late & unstable flags',
    'Unknown-participant mapping',
  ];
  const chipBorder = dark ? '#334155' : '#cbd5e1';
  const chipBg = dark ? '#1e293b' : '#ffffff';
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? '#0f172a' : '#f8fafc',
        backgroundImage: dark
          ? 'radial-gradient(circle at 25% 20%, rgba(14, 165, 233, 0.18), transparent 55%)'
          : 'radial-gradient(circle at 25% 20%, rgba(14, 165, 233, 0.10), transparent 55%)',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: -2,
            color: p.strong,
          }}
        >
          MeetWatch
        </span>
        <div
          style={{
            display: 'flex',
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#22c55e',
          }}
        />
      </div>
      <span style={{ display: 'flex', fontSize: 20, color: p.sub }}>
        Live student monitoring for Google Meet — online, late, unstable, absent
      </span>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 10, marginTop: 4 }}>
        {chips.map((chip) => (
          <div
            key={chip}
            style={{
              display: 'flex',
              padding: '6px 14px',
              borderRadius: 999,
              border: `1px solid ${chipBorder}`,
              backgroundColor: chipBg,
            }}
          >
            <span style={{ display: 'flex', fontSize: 13, fontWeight: 500, color: p.text }}>
              {chip}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
