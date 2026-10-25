import type { meet_v2 } from 'googleapis';

/** One join stint of a participant inside a conference record. */
export interface ParticipantSessionRecord {
  /** ISO-8601; null while the participant is still in the call. */
  startTime: string | null;
  endTime: string | null;
  displayName: string;
  email: string | null;
}

/**
 * The slice of the Google Meet REST API v2 that MeetWatch needs. Isolated
 * behind an interface so the provider can be tested against a mock and so a
 * future provider (Workspace admin SDK, etc.) can swap in.
 */
export interface MeetApiClient {
  /** Latest conference record for a meeting code, or null before it starts. */
  findConferenceRecordByMeetingCode(meetingCode: string): Promise<string | null>;
  listParticipantSessions(conferenceRecordName: string): Promise<ParticipantSessionRecord[]>;
}

/**
 * googleapis-backed client. OAuth is handled externally: the caller supplies
 * a fresh access token getter, applied before each API round trip.
 */
export class GoogleMeetApiClient implements MeetApiClient {
  private constructor(
    private readonly meet: meet_v2.Meet,
    private readonly getAccessToken: () => Promise<string>,
    private readonly authClient: { setCredentials(credentials: { access_token: string }): void },
  ) {}

  /** Lazily imports googleapis so the simulator path never pays for it. */
  static async create(getAccessToken: () => Promise<string>): Promise<GoogleMeetApiClient> {
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2();
    const meet = google.meet({ version: 'v2', auth });
    return new GoogleMeetApiClient(meet, getAccessToken, auth);
  }

  private async freshAuth(): Promise<void> {
    this.authClient.setCredentials({ access_token: await this.getAccessToken() });
  }

  async findConferenceRecordByMeetingCode(meetingCode: string): Promise<string | null> {
    await this.freshAuth();
    const res = await this.meet.conferenceRecords.list({
      filter: `meeting_code = '${meetingCode}'`,
      pageSize: 20,
    });
    const records = res.data.conferenceRecords ?? [];
    // Recurring meetings accumulate records; the newest one is the live one.
    const newest = [...records]
      .filter((r) => r.name)
      .sort((a, b) => Date.parse(b.startTime ?? '') - Date.parse(a.startTime ?? ''));
    return newest[0]?.name ?? null;
  }

  async listParticipantSessions(conferenceRecordName: string): Promise<ParticipantSessionRecord[]> {
    await this.freshAuth();
    const participants: meet_v2.Schema$Participant[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.meet.conferenceRecords.participants.list({
        parent: conferenceRecordName,
        pageSize: 100,
        pageToken,
      });
      participants.push(...(res.data.participants ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    const records: ParticipantSessionRecord[] = [];
    for (const participant of participants) {
      const identity = participantIdentity(participant);
      const stints = await this.listStints(participant.name ?? '');
      for (const stint of stints) {
        records.push({
          startTime: stint.startTime ?? null,
          endTime: stint.endTime ?? null,
          displayName: identity.displayName,
          email: identity.email,
        });
      }
    }
    return records;
  }

  private async listStints(
    participantName: string,
  ): Promise<meet_v2.Schema$ParticipantSession[]> {
    if (!participantName) return [];
    const stints: meet_v2.Schema$ParticipantSession[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.meet.conferenceRecords.participants.participantSessions.list({
        parent: participantName,
        pageSize: 100,
        pageToken,
      });
      stints.push(...(res.data.participantSessions ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return stints;
  }
}

/** Extracts a displayable name and email from a Meet participant resource. */
function participantIdentity(participant: meet_v2.Schema$Participant): {
  displayName: string;
  email: string | null;
} {
  const signedIn = participant.signedinUser;
  if (signedIn?.user) {
    // Workspace-internal users resolve as "users/{id}"; some deployments
    // return an email-shaped identifier, which we can match directly.
    const email = signedIn.user.includes('@') ? signedIn.user.toLowerCase() : null;
    return {
      displayName: signedIn.displayName ?? signedIn.user,
      email,
    };
  }
  if (participant.anonymousUser?.displayName) {
    return { displayName: participant.anonymousUser.displayName, email: null };
  }
  if (participant.phoneUser?.displayName) {
    return { displayName: participant.phoneUser.displayName, email: null };
  }
  return { displayName: 'Unknown participant', email: null };
}
