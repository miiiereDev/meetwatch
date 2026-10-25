/**
 * Deterministic preview data, shaped exactly like the API's SessionReport and
 * session records (see apps/web/src/api/types.ts). Values mirror a real
 * simulator run mid-session so the previews stay truthful to the product.
 */

export type ParticipantStatus = 'online' | 'left' | 'absent';

export interface FixtureStudent {
  name: string;
  email: string;
  section: string;
  status: ParticipantStatus;
  late: boolean;
  unstable: boolean;
  rejoinCount: number;
  joinedAt: string | null;
  inCall: string | null;
  attendancePct: number;
}

export interface FixtureActivity {
  kind: 'join' | 'leave';
  at: string;
  name: string;
}

export interface FixtureUnknown {
  displayName: string;
  email: string | null;
  meta: string;
  isOnline: boolean;
}

export interface FixtureSummary {
  online: number;
  left: number;
  absent: number;
  late: number;
  unstable: number;
  total: number;
  attendanceAvgPct: number;
}

export interface Fixture {
  sessionTitle: string;
  meetingCode: string;
  sessionStatus: 'active' | 'ended';
  window: string;
  passMark: number;
  lateThreshold: number;
  timeScale: number;
  summary: FixtureSummary;
  students: FixtureStudent[];
  activity: FixtureActivity[];
  unknown: FixtureUnknown[];
  passCount: number;
  endedCount: number;
}

const shared: FixtureStudent[] = [
  {
    name: 'Chloe Bautista',
    email: 'chloe.bautista@student.myschool.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:00:00 AM',
    inCall: '41:28',
    attendancePct: 100,
  },
  {
    name: 'Ava Thompson',
    email: 'ava.thompson@student.myschool.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:00:12 AM',
    inCall: '41:16',
    attendancePct: 92,
  },
  {
    name: 'Sofia Nguyen',
    email: 'sofia.nguyen@student.myschool.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: true,
    rejoinCount: 2,
    joinedAt: '9:00:48 AM',
    inCall: '38:04',
    attendancePct: 85,
  },
  {
    name: 'Harper Lee',
    email: 'harper.lee@student.myschool.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:01:03 AM',
    inCall: '40:11',
    attendancePct: 91,
  },
  {
    name: 'Mia Santos',
    email: 'mia.santos@student.myschool.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:02:20 AM',
    inCall: '39:44',
    attendancePct: 96,
  },
  {
    name: 'Lucas Mendez',
    email: 'lucas.mendez@student.myschool.edu',
    section: '10-B',
    status: 'online',
    late: true,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:14:37 AM',
    inCall: '35:58',
    attendancePct: 78,
  },
  {
    name: 'Liam Rivera',
    email: 'liam.rivera@student.myschool.edu',
    section: '10-A',
    status: 'left',
    late: true,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:12:05 AM',
    inCall: '19:22',
    attendancePct: 58,
  },
  {
    name: 'Noah Patel',
    email: 'noah.patel@student.myschool.edu',
    section: '10-A',
    status: 'left',
    late: false,
    unstable: true,
    rejoinCount: 3,
    joinedAt: '9:05:41 AM',
    inCall: '27:53',
    attendancePct: 64,
  },
  {
    name: 'James Okafor',
    email: 'james.okafor@student.myschool.edu',
    section: '10-B',
    status: 'left',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:04:10 AM',
    inCall: '18:12',
    attendancePct: 44,
  },
  {
    name: 'Ethan Cruz',
    email: 'ethan.cruz@student.myschool.edu',
    section: '10-B',
    status: 'absent',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: null,
    inCall: null,
    attendancePct: 0,
  },
];

const endedRows: FixtureStudent[] = [
  {
    name: 'Chloe Bautista',
    email: 'chloe.bautista@student.myschool.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:00:00 AM',
    inCall: '45:00',
    attendancePct: 100,
  },
  {
    name: 'Ava Thompson',
    email: 'ava.thompson@student.myschool.edu',
    section: '10-A',
    status: 'online',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:00:12 AM',
    inCall: '44:39',
    attendancePct: 96,
  },
  {
    name: 'Lucas Mendez',
    email: 'lucas.mendez@student.myschool.edu',
    section: '10-B',
    status: 'online',
    late: true,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:14:37 AM',
    inCall: '30:23',
    attendancePct: 67,
  },
  {
    name: 'Liam Rivera',
    email: 'liam.rivera@student.myschool.edu',
    section: '10-A',
    status: 'left',
    late: true,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:12:05 AM',
    inCall: '19:22',
    attendancePct: 43,
  },
  {
    name: 'James Okafor',
    email: 'james.okafor@student.myschool.edu',
    section: '10-B',
    status: 'left',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: '9:04:10 AM',
    inCall: '18:12',
    attendancePct: 40,
  },
  {
    name: 'Ethan Cruz',
    email: 'ethan.cruz@student.myschool.edu',
    section: '10-B',
    status: 'absent',
    late: false,
    unstable: false,
    rejoinCount: 0,
    joinedAt: null,
    inCall: null,
    attendancePct: 0,
  },
];

const liveActivity: FixtureActivity[] = [
  { kind: 'join', at: '9:41:02 AM', name: 'Priya Sharma' },
  { kind: 'leave', at: '9:39:55 AM', name: 'Noah Patel' },
  { kind: 'join', at: '9:39:12 AM', name: 'Noah Patel' },
  { kind: 'leave', at: '9:31:47 AM', name: 'Liam Rivera' },
  { kind: 'join', at: '9:24:18 AM', name: 'Noah Patel' },
  { kind: 'join', at: '9:14:37 AM', name: 'Lucas Mendez' },
  { kind: 'join', at: '9:05:41 AM', name: 'Noah Patel' },
  { kind: 'join', at: '9:02:20 AM', name: 'Mia Santos' },
  { kind: 'join', at: '9:00:12 AM', name: 'Ava Thompson' },
];

export const DASHBOARD_FIXTURE: Fixture = {
  sessionTitle: 'Science — lab briefing',
  meetingCode: 'bhf-wndj-cra',
  sessionStatus: 'active',
  window: '9:00 – 9:45',
  passMark: 75,
  lateThreshold: 10,
  timeScale: 20,
  summary: {
    online: 17,
    left: 5,
    absent: 3,
    late: 4,
    unstable: 2,
    total: 25,
    attendanceAvgPct: 71,
  },
  students: shared,
  activity: liveActivity,
  unknown: [
    {
      displayName: 'Guest 8347',
      email: null,
      meta: 'no email · 2 joins · last seen 9:31:47 AM',
      isOnline: true,
    },
    {
      displayName: 'Grace Lim (parent)',
      email: 'grace.lim.parent@gmail.com',
      meta: 'grace.lim.parent@gmail.com · 1 join',
      isOnline: false,
    },
  ],
  passCount: 17,
  endedCount: 2,
};

export const HISTORY_FIXTURE: Fixture = {
  sessionTitle: 'History — unit review',
  meetingCode: 'kmq-zxpl-tsv',
  sessionStatus: 'ended',
  window: '9:00:00 – 9:45:00',
  passMark: 75,
  lateThreshold: 10,
  timeScale: 20,
  summary: {
    online: 11,
    left: 10,
    absent: 4,
    late: 3,
    unstable: 1,
    total: 25,
    attendanceAvgPct: 68,
  },
  students: endedRows,
  activity: [],
  unknown: [],
  passCount: 17,
  endedCount: 2,
};
