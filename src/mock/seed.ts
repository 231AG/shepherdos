/**
 * Demo seed generator.
 *
 * Everything is generated relative to "today" at runtime so the demo never
 * looks stale: "last 12 Sundays" are always the most recent 12 Sundays.
 * Randomness is seeded, so the data is identical on every load and reset.
 * Ids come from `uuidFrom(key)`, so a member or task keeps the same id from
 * one day to the next, and the visitor's saved changes stay attached.
 *
 * Only the repository (src/data/repo.ts) imports this file.
 */
import { addDays, addMinutes, format, getDay, parseISO, setHours, setMinutes, subDays } from "date-fns";
import type {
  AttendanceRecord,
  AuditEvent,
  Church,
  ChurchEvent,
  Currency,
  Department,
  FollowUpEvent,
  FollowUpTask,
  GivingDayClose,
  GivingDraft,
  GivingEntry,
  GivingType,
  Member,
  MemberDepartment,
  Message,
  Prospect,
  ProspectStage,
  Service,
  SmsWalletEntry,
  StaffUser,
  SupportGrant,
} from "@/data/types";
import { lastSunday, toISODate, upcomingSunday } from "@/lib/dates";
import { FEMALE_FIRST, MALE_FIRST, SURNAMES_COMMON, SURNAMES_OTHER } from "./names";
import { Rng, uuidFrom } from "./prng";

export interface Tables {
  churches: Church[];
  staff: StaffUser[];
  departments: Department[];
  members: Member[];
  member_departments: MemberDepartment[];
  services: Service[];
  attendance: AttendanceRecord[];
  giving_entries: GivingEntry[];
  giving_drafts: GivingDraft[];
  day_closes: GivingDayClose[];
  prospects: Prospect[];
  follow_up_events: FollowUpEvent[];
  tasks: FollowUpTask[];
  events: ChurchEvent[];
  messages: Message[];
  sms_wallet: SmsWalletEntry[];
  support_grants: SupportGrant[];
  audit_events: AuditEvent[];
}

export type TableName = keyof Tables;

export const OPERATOR_NAME = "Aaron Sumo";
const HISTORY_WEEKS = 26;
const DEFAULT_SETTINGS = { new_days: 28, inactive_weeks: 6, pastor_giving_visibility: "totals" as const };

/* ------------------------------------------------------------------ */
/* Church configuration                                                */
/* ------------------------------------------------------------------ */

type DeptKey =
  | "choir" | "ushers" | "youth" | "womens" | "mens" | "sunday_school" | "deacons" | "evangelism" | "media";

const DEPARTMENTS: Record<DeptKey, { name: string; short: string; p: number; gender?: "female" | "male" }> = {
  choir: { name: "Choir", short: "Choir", p: 0.1 },
  ushers: { name: "Ushers", short: "Ushers", p: 0.07 },
  youth: { name: "Youth", short: "Youth", p: 0.18 },
  womens: { name: "Women's Fellowship", short: "Women's Fell.", p: 0.5, gender: "female" },
  mens: { name: "Men's Fellowship", short: "Men's Fell.", p: 0.45, gender: "male" },
  sunday_school: { name: "Sunday School", short: "Sunday School", p: 0.09 },
  deacons: { name: "Deacons", short: "Deacons", p: 0.03 },
  evangelism: { name: "Evangelism", short: "Evangelism", p: 0.07 },
  media: { name: "Media", short: "Media", p: 0.025 },
};

type Profile = "regular" | "steady" | "occasional" | "lapsed" | "new" | "excused";

interface Featured {
  first: string;
  last: string;
  gender: "female" | "male";
  phone: string;
  depts: DeptKey[];
  profile: Profile;
  joinedDaysAgo: number;
  /** For lapsed/excused: days since last attendance. */
  lastSeenDaysAgo?: number;
  exception?: Member["exception"];
}

interface ChurchConfig {
  key: "grace" | "living";
  slug: string;
  name: string;
  short: string;
  initials: string;
  city: string;
  county: string;
  memberCount: number;
  excused: number;
  newMembers: number;
  lapsed: number;
  depts: DeptKey[];
  guests: [number, number];
  /** Multiplier on giving amounts (Gbarnga is a smaller congregation). */
  givingScale: number;
  renewalInDays: number;
  smsCredits: number;
  service: { name: string; location: string; hour: number };
  midweek: { name: string; location: string; hour: number };
  staff: { name: string; display: string; role: StaffUser["role"]; dept?: DeptKey; mfa: boolean }[];
  featured: Featured[];
}

const GRACE: ChurchConfig = {
  key: "grace",
  slug: "grace-fellowship",
  name: "Grace Fellowship Church",
  short: "Grace Fellowship",
  initials: "GF",
  city: "Paynesville",
  county: "Montserrado",
  memberCount: 486,
  excused: 6,
  newMembers: 14,
  lapsed: 58,
  depts: ["choir", "ushers", "youth", "womens", "mens", "sunday_school", "deacons", "evangelism", "media"],
  guests: [16, 26],
  givingScale: 1,
  renewalInDays: 91,
  smsCredits: 2340,
  service: { name: "Sunday Worship", location: "Main sanctuary", hour: 9 },
  midweek: { name: "Midweek Bible Study", location: "Fellowship hall", hour: 18 },
  staff: [
    { name: "James Kollie", display: "Rev. James Kollie", role: "pastor", mfa: true },
    { name: "Patience Toe", display: "Patience Toe", role: "secretary", mfa: false },
    { name: "Martha Doe", display: "Martha Doe", role: "treasurer", mfa: true },
    { name: "Emmanuel Flomo", display: "Bro. Emmanuel Flomo", role: "dept_head", dept: "youth", mfa: false },
    { name: "Peter Flomo", display: "Deacon Peter Flomo", role: "secretary", mfa: false },
    { name: "Mary Doe", display: "Sis. Mary Doe", role: "dept_head", dept: "womens", mfa: false },
  ],
  featured: [
    { first: "James", last: "Kollie", gender: "male", phone: "+231770112233", depts: ["deacons", "mens"], profile: "regular", joinedDaysAgo: 5800 },
    { first: "Patience", last: "Toe", gender: "female", phone: "+231886120944", depts: ["womens", "media"], profile: "regular", joinedDaysAgo: 3100 },
    { first: "Martha", last: "Doe", gender: "female", phone: "+231775530918", depts: ["womens", "deacons"], profile: "regular", joinedDaysAgo: 4200 },
    { first: "Emmanuel", last: "Flomo", gender: "male", phone: "+231777304412", depts: ["youth", "evangelism"], profile: "regular", joinedDaysAgo: 2600 },
    { first: "Abraham", last: "Sumo", gender: "male", phone: "+231774524521", depts: ["youth", "choir"], profile: "regular", joinedDaysAgo: 2770 },
    { first: "Beatrice", last: "Flomo", gender: "female", phone: "+231880910917", depts: ["choir"], profile: "regular", joinedDaysAgo: 1950 },
    { first: "Daniel", last: "Toe", gender: "male", phone: "+231773363360", depts: ["ushers"], profile: "steady", joinedDaysAgo: 1720 },
    { first: "Esther", last: "Kollie", gender: "female", phone: "+231886777724", depts: ["womens", "ushers"], profile: "regular", joinedDaysAgo: 4260 },
    { first: "Joseph", last: "Kpoto", gender: "male", phone: "+231776631102", depts: [], profile: "new", joinedDaysAgo: 18 },
    { first: "Samuel", last: "Wesseh", gender: "male", phone: "+231779051187", depts: ["youth"], profile: "new", joinedDaysAgo: 23 },
    { first: "Moses", last: "Tarr", gender: "male", phone: "+231882145530", depts: ["mens"], profile: "lapsed", joinedDaysAgo: 3350, lastSeenDaysAgo: 53 },
    { first: "Hawa", last: "Kamara", gender: "female", phone: "+231772262268", depts: ["womens"], profile: "lapsed", joinedDaysAgo: 2160, lastSeenDaysAgo: 46 },
    {
      first: "Rebecca", last: "Gono", gender: "female", phone: "+231887731040", depts: ["womens"], profile: "excused", joinedDaysAgo: 6300, lastSeenDaysAgo: 74,
      exception: { kind: "homebound", reason: "Homebound after hip surgery; visited monthly by Women's Fellowship", until: null },
    },
    { first: "Felix", last: "Massaquoi", gender: "male", phone: "+231771181189", depts: ["mens"], profile: "steady", joinedDaysAgo: 1400 },
    { first: "Isaac", last: "Kpoto", gender: "male", phone: "+231778842210", depts: ["mens", "ushers"], profile: "regular", joinedDaysAgo: 2900 },
    { first: "Lawrence", last: "Gono", gender: "male", phone: "+231885573301", depts: ["mens", "deacons"], profile: "regular", joinedDaysAgo: 5100 },
    { first: "Grace", last: "Doe", gender: "female", phone: "+231559012284", depts: ["womens", "choir"], profile: "regular", joinedDaysAgo: 2300 },
    { first: "Princess", last: "Zinnah", gender: "female", phone: "+231776004519", depts: ["youth", "media"], profile: "regular", joinedDaysAgo: 900 },
    { first: "Prince", last: "Togba", gender: "male", phone: "+231884410276", depts: ["youth"], profile: "lapsed", joinedDaysAgo: 1100, lastSeenDaysAgo: 60 },
  ],
};

const LIVING: ChurchConfig = {
  key: "living",
  slug: "living-waters",
  name: "Living Waters Assembly",
  short: "Living Waters",
  initials: "LW",
  city: "Gbarnga",
  county: "Bong",
  memberCount: 212,
  excused: 3,
  newMembers: 6,
  lapsed: 24,
  depts: ["choir", "ushers", "youth", "womens", "mens", "sunday_school", "evangelism"],
  guests: [6, 13],
  givingScale: 0.45,
  renewalInDays: 110,
  smsCredits: 800,
  service: { name: "Sunday Service", location: "Main hall", hour: 10 },
  midweek: { name: "Wednesday Prayer Meeting", location: "Main hall", hour: 18 },
  staff: [
    { name: "Samuel Barclay", display: "Rev. Samuel Barclay", role: "pastor", mfa: true },
    { name: "Josephine Pewee", display: "Josephine Pewee", role: "secretary", mfa: false },
    { name: "Moses Kesselly", display: "Moses Kesselly", role: "treasurer", mfa: true },
    { name: "Gabriel Sackie", display: "Bro. Gabriel Sackie", role: "dept_head", dept: "youth", mfa: false },
  ],
  featured: [
    { first: "Samuel", last: "Barclay", gender: "male", phone: "+231770987654", depts: ["mens"], profile: "regular", joinedDaysAgo: 4100 },
    { first: "Josephine", last: "Pewee", gender: "female", phone: "+231886443120", depts: ["womens", "choir"], profile: "regular", joinedDaysAgo: 2500 },
    { first: "Moses", last: "Kesselly", gender: "male", phone: "+231775018832", depts: ["mens", "ushers"], profile: "regular", joinedDaysAgo: 3000 },
    { first: "Gabriel", last: "Sackie", gender: "male", phone: "+231778219046", depts: ["youth", "evangelism"], profile: "regular", joinedDaysAgo: 1300 },
    { first: "Korto", last: "Wleh", gender: "female", phone: "+231881276650", depts: ["youth", "choir"], profile: "regular", joinedDaysAgo: 700 },
    { first: "Varney", last: "Gbessay", gender: "male", phone: "+231552301874", depts: ["mens"], profile: "lapsed", joinedDaysAgo: 1900, lastSeenDaysAgo: 50 },
  ],
};

export const DEMO_CHURCH_CONFIGS = [GRACE, LIVING] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const iso = (d: Date) => d.toISOString();

function at(day: Date, hour: number, minute = 0): Date {
  return setMinutes(setHours(day, hour), minute);
}

/** Next given weekday (0=Sun) strictly after `from`, plus extra weeks. */
function nextWeekday(from: Date, dow: number, extraWeeks = 0): Date {
  let d = addDays(from, 1);
  while (getDay(d) !== dow) d = addDays(d, 1);
  return addDays(d, extraWeeks * 7);
}

function randomPhone(rng: Rng, used: Set<string>): string {
  for (;;) {
    const prefix = rng.weighted([["77", 5], ["88", 4], ["55", 1]] as const);
    const rest = String(rng.int(0, 9_999_999)).padStart(7, "0");
    const e164 = `+231${prefix}${rest}`;
    if (!used.has(e164)) {
      used.add(e164);
      return e164;
    }
  }
}

function pickSurname(rng: Rng): string {
  return rng.chance(0.62) ? rng.pick(SURNAMES_COMMON) : rng.pick(SURNAMES_OTHER);
}

const PROFILE_RATE: Record<Profile, number> = {
  regular: 0.92,
  steady: 0.72,
  occasional: 0.45,
  lapsed: 0.6,
  new: 0.85,
  excused: 0.7,
};

/** Attendance grows slightly over the last six months. */
const trend = (weeksAgo: number) => Math.max(0.78, 1 - 0.011 * weeksAgo);

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

interface GeneratedMember {
  member: Member;
  profile: Profile;
  rate: number;
  lastSeenDaysAgo: number | null;
  joinedAt: Date;
}

function generateChurch(cfg: ChurchConfig, now: Date, epoch: Date, t: Tables) {
  const churchId = uuidFrom(`church:${cfg.key}`);
  const createdAt = iso(subDays(now, 210));
  const rng = new Rng(`members:${cfg.key}`);

  /* Church */
  t.churches.push({
    id: churchId,
    slug: cfg.slug,
    name: cfg.name,
    short_name: cfg.short,
    initials: cfg.initials,
    city: cfg.city,
    county: cfg.county,
    plan: "Pilot · annual",
    renewal_on: toISODate(addDays(now, cfg.renewalInDays)),
    subscription_status: "active",
    hosting_fee_minor: 85_000,
    sms_credits: cfg.smsCredits,
    staff_count: cfg.staff.length,
    has_content: true,
    member_count_hint: null,
    settings: { ...DEFAULT_SETTINGS },
    created_at: createdAt,
  });

  /* Departments */
  const deptId = (k: DeptKey) => uuidFrom(`dept:${cfg.key}:${k}`);
  for (const k of cfg.depts) {
    t.departments.push({
      id: deptId(k),
      church_id: churchId,
      name: DEPARTMENTS[k].name,
      short_name: DEPARTMENTS[k].short,
      leader_member_id: null,
      created_at: createdAt,
    });
  }

  /* Staff */
  cfg.staff.forEach((s, i) => {
    t.staff.push({
      id: uuidFrom(`staff:${cfg.key}:${i}`),
      church_id: churchId,
      name: s.name,
      display_name: s.display,
      role: s.role,
      department_id: s.dept ? deptId(s.dept) : null,
      mfa: s.mfa,
      created_at: createdAt,
    });
  });

  /* Members */
  const usedPhones = new Set<string>(cfg.featured.map((f) => f.phone));
  const members: GeneratedMember[] = [];
  const usedNames = new Set<string>(cfg.featured.map((f) => `${f.first} ${f.last}`));

  const addMember = (i: number, f: Featured) => {
    const id = uuidFrom(`member:${cfg.key}:${i}`);
    const joined = subDays(now, f.joinedDaysAgo);
    const member: Member = {
      id,
      church_id: churchId,
      first_name: f.first,
      last_name: f.last,
      phone: f.phone,
      gender: f.gender,
      joined_on: toISODate(joined),
      exception: f.exception ?? null,
      sms_opt_out: false,
      household: null,
      converted_from_prospect_id: null,
      created_at: iso(joined < subDays(now, 210) ? subDays(now, 210) : joined),
    };
    members.push({ member, profile: f.profile, rate: PROFILE_RATE[f.profile], lastSeenDaysAgo: f.lastSeenDaysAgo ?? null, joinedAt: joined });
    for (const k of f.depts) {
      if (!cfg.depts.includes(k)) continue;
      t.member_departments.push({
        id: uuidFrom(`md:${id}:${k}`),
        church_id: churchId,
        member_id: id,
        department_id: deptId(k),
        created_at: member.created_at,
      });
    }
  };

  cfg.featured.forEach((f, i) => addMember(i, f));

  const remaining = cfg.memberCount - cfg.featured.length;
  const featuredCount = (p: Profile) => cfg.featured.filter((f) => f.profile === p).length;
  const quota: Record<Profile, number> = {
    excused: Math.max(0, cfg.excused - featuredCount("excused")),
    new: Math.max(0, cfg.newMembers - featuredCount("new")),
    lapsed: Math.max(0, cfg.lapsed - featuredCount("lapsed")),
    regular: 0,
    steady: 0,
    occasional: 0,
  };
  const fixed = quota.excused + quota.new + quota.lapsed;
  const active = remaining - fixed;
  quota.regular = Math.round(active * 0.3);
  quota.steady = Math.round(active * 0.45);
  quota.occasional = active - quota.regular - quota.steady;
  const profiles: Profile[] = rng.shuffle(
    (Object.keys(quota) as Profile[]).flatMap((p) => Array<Profile>(quota[p]).fill(p)),
  );

  const exceptions: NonNullable<Member["exception"]>[] = [
    { kind: "homebound", reason: "Homebound; receives communion at home", until: null },
    { kind: "leave", reason: "Studying in Monrovia until December", until: toISODate(addDays(now, 60)) },
    { kind: "pastoral", reason: "Pastoral exception: caring for a sick parent", until: null },
    { kind: "leave", reason: "Working upcountry in Grand Gedeh", until: toISODate(addDays(now, 45)) },
    { kind: "homebound", reason: "Elderly; visited by Deacons", until: null },
  ];
  let exceptionIdx = 0;

  profiles.forEach((profile, n) => {
    const i = cfg.featured.length + n;
    const gender = rng.chance(0.56) ? "female" : "male";
    let first: string, last: string;
    do {
      first = gender === "female" ? rng.pick(FEMALE_FIRST) : rng.pick(MALE_FIRST);
      last = pickSurname(rng);
    } while (usedNames.has(`${first} ${last}`) && usedNames.size < 2000);
    usedNames.add(`${first} ${last}`);

    const joinedDaysAgo =
      profile === "new" ? rng.int(1, 27) : profile === "lapsed" ? rng.int(400, 4000) : rng.int(60, 6500);
    const depts = cfg.depts.filter((k) => {
      const d = DEPARTMENTS[k];
      if (d.gender && d.gender !== gender) return false;
      return rng.chance(d.p);
    });
    const exception = profile === "excused" ? exceptions[exceptionIdx++ % exceptions.length] : undefined;
    addMember(i, {
      first,
      last,
      gender,
      phone: rng.chance(0.96) ? randomPhone(rng, usedPhones) : "",
      depts: profile === "new" && rng.chance(0.5) ? [] : depts,
      profile,
      joinedDaysAgo,
      lastSeenDaysAgo:
        profile === "lapsed" ? rng.int(44, 150) : profile === "excused" ? rng.int(50, 120) : undefined,
      exception,
    });
    if (!members[members.length - 1].member.phone) members[members.length - 1].member.phone = null;
    if (rng.chance(0.03)) members[members.length - 1].member.sms_opt_out = true;
  });

  t.members.push(...members.map((g) => g.member));

  // Department leaders: first member of each department with a "regular" profile.
  for (const d of t.departments.filter((x) => x.church_id === churchId)) {
    const head = t.staff.find((s) => s.church_id === churchId && s.department_id === d.id);
    if (head) {
      const m = members.find((g) => `${g.member.first_name} ${g.member.last_name}` === head.name);
      if (m) {
        d.leader_member_id = m.member.id;
        continue;
      }
    }
    const mdIds = new Set(t.member_departments.filter((md) => md.department_id === d.id).map((md) => md.member_id));
    const leader = members.find((g) => mdIds.has(g.member.id) && g.profile === "regular");
    d.leader_member_id = leader?.member.id ?? null;
  }

  /* Services and attendance */
  const prevSunday = lastSunday(subDays(now, 1));
  const sundays = Array.from({ length: HISTORY_WEEKS }, (_, w) => subDays(prevSunday, w * 7));
  const wednesdays = sundays
    .map((s) => addDays(s, 3))
    .filter((d) => d < now)
    .concat(addDays(sundays[sundays.length - 1], -4));

  const attendedOn = new Map<string, Date[]>(); // member id -> dates

  const pushService = (day: Date, kind: Service["kind"], weeksAgo: number) => {
    const isSun = kind === "sunday";
    const svcCfg = isSun ? cfg.service : cfg.midweek;
    const id = uuidFrom(`svc:${cfg.key}:${kind}:${toISODate(day)}`);
    const starts = at(day, svcCfg.hour);
    const srng = new Rng(`svc:${cfg.key}:${kind}:${toISODate(day)}`);
    const guests = isSun
      ? Math.round(srng.int(cfg.guests[0], cfg.guests[1]) * (0.85 + 0.15 * trend(weeksAgo)))
      : srng.int(1, 5);
    t.services.push({
      id,
      church_id: churchId,
      kind,
      name: svcCfg.name,
      starts_at: iso(starts),
      location: svcCfg.location,
      guest_count: guests,
      closed: true,
      created_at: iso(subDays(starts, 3)),
    });
    const daysAgo = Math.round((now.getTime() - day.getTime()) / 86_400_000);
    for (const g of members) {
      if (day < g.joinedAt) continue;
      if (g.lastSeenDaysAgo !== null && daysAgo < g.lastSeenDaysAgo) continue;
      let p = g.rate * trend(weeksAgo);
      if (!isSun) p = g.profile === "regular" ? 0.32 : g.profile === "steady" ? 0.12 : 0.03;
      if (!srng.chance(p)) continue;
      const checkedIn = addMinutes(starts, srng.int(-25, 40));
      t.attendance.push({
        id: uuidFrom(`att:${id}:${g.member.id}`),
        church_id: churchId,
        service_id: id,
        member_id: g.member.id,
        checked_in_at: iso(checkedIn),
        sync_state: "synced",
        sync_error: null,
        device: srng.chance(0.6) ? "Usher tablet 1" : "Usher tablet 2",
        created_at: iso(checkedIn),
      });
      const list = attendedOn.get(g.member.id) ?? [];
      list.push(day);
      attendedOn.set(g.member.id, list);
    }
    return id;
  };

  const sundayServiceIds = sundays.map((d, w) => pushService(d, "sunday", w));
  wednesdays.forEach((d) => pushService(d, "midweek", Math.floor((now.getTime() - d.getTime()) / (7 * 86_400_000))));

  // Guarantee the derived statuses: lapsed/excused members were last seen on
  // the Sunday closest to `lastSeenDaysAgo`; active members attended recently.
  const sundayIdx = (daysAgo: number) =>
    sundays.findIndex((d) => Math.round((now.getTime() - d.getTime()) / 86_400_000) >= daysAgo);
  for (const g of members) {
    const dates = attendedOn.get(g.member.id) ?? [];
    let forceIdx: number | null = null;
    if (g.lastSeenDaysAgo !== null) {
      const idx = sundayIdx(g.lastSeenDaysAgo);
      const target = sundays[idx];
      if (target && !dates.some((d) => d.getTime() === target.getTime())) forceIdx = idx;
    } else if (g.profile !== "new" || dates.length === 0) {
      const recent = dates.some((d) => now.getTime() - d.getTime() < 28 * 86_400_000);
      if (!recent) forceIdx = Math.floor(new Rng(`force:${g.member.id}`).next() * 3);
    }
    // Featured regulars attended last Sunday so the mockup rows read right.
    if (g.profile === "regular" && cfg.featured.some((f) => f.first === g.member.first_name && f.last === g.member.last_name)) {
      if (!dates.some((d) => d.getTime() === sundays[0].getTime())) forceIdx = 0;
    }
    if (forceIdx === null || forceIdx < 0) continue;
    const day = sundays[forceIdx];
    if (day < g.joinedAt) continue;
    const svcId = sundayServiceIds[forceIdx];
    const checkedIn = addMinutes(at(day, cfg.service.hour), 5);
    t.attendance.push({
      id: uuidFrom(`att:${svcId}:${g.member.id}`),
      church_id: churchId,
      service_id: svcId,
      member_id: g.member.id,
      checked_in_at: iso(checkedIn),
      sync_state: "synced",
      sync_error: null,
      device: "Usher tablet 1",
      created_at: iso(checkedIn),
    });
    dates.push(day);
    attendedOn.set(g.member.id, dates);
  }

  // Upcoming services (open for check-in).
  const nextSun = upcomingSunday(now);
  const nextSunId = uuidFrom(`svc:${cfg.key}:sunday:${toISODate(nextSun)}`);
  t.services.push({
    id: nextSunId,
    church_id: churchId,
    kind: "sunday",
    name: cfg.service.name,
    starts_at: iso(at(nextSun, cfg.service.hour)),
    location: cfg.service.location,
    guest_count: 0,
    closed: false,
    created_at: iso(subDays(now, 2)),
  });
  const nextWed = getDay(now) === 3 ? now : nextWeekday(now, 3);
  t.services.push({
    id: uuidFrom(`svc:${cfg.key}:midweek:${toISODate(nextWed)}`),
    church_id: churchId,
    kind: "midweek",
    name: cfg.midweek.name,
    starts_at: iso(at(nextWed, cfg.midweek.hour)),
    location: cfg.midweek.location,
    guest_count: 0,
    closed: false,
    created_at: iso(subDays(now, 2)),
  });

  /* Giving */
  generateGiving(cfg, churchId, now, sundays, sundayServiceIds, wednesdays, members, t);

  /* Soul-winning, tasks, events, messaging */
  generatePastoral(cfg, churchId, now, members, deptId, t);
  generateEvents(cfg, churchId, now, deptId, nextSunId, t);
  generateMessaging(cfg, churchId, now, t);

  if (cfg.key === "grace") {
    t.support_grants.push(
      {
        id: uuidFrom("grant:grace:active"),
        church_id: churchId,
        operator_name: OPERATOR_NAME,
        reason: "Import troubleshooting",
        status: "approved",
        approved_by: "Rev. J. Kollie (Pastor)",
        expires_at: iso(addMinutes(epoch, 102)),
        created_at: iso(addMinutes(epoch, -18)),
      },
      {
        id: uuidFrom("grant:grace:past"),
        church_id: churchId,
        operator_name: OPERATOR_NAME,
        reason: "Onboarding: first member import",
        status: "ended",
        approved_by: "Rev. J. Kollie (Pastor)",
        expires_at: iso(subDays(now, 40)),
        created_at: iso(subDays(now, 40)),
      },
    );
  }
}

const GIVING_AMOUNTS_LRD = [500, 1000, 1000, 1500, 2000, 2000, 2500, 3000, 3000, 4000, 5000, 5000, 7500, 10000, 15000];
const GIVING_AMOUNTS_USD = [10, 20, 20, 25, 50, 50, 100];

function generateGiving(
  cfg: ChurchConfig,
  churchId: string,
  now: Date,
  sundays: Date[],
  sundayServiceIds: string[],
  wednesdays: Date[],
  members: GeneratedMember[],
  t: Tables,
) {
  interface Draft {
    day: Date;
    service_id: string | null;
    minute: number;
    member_id: string | null;
    giver_label: string | null;
    type: GivingType;
    currency: Currency;
    major: number;
    tag?: string;
  }
  const raw: Draft[] = [];
  const scale = (n: number) => Math.max(100, Math.round((n * cfg.givingScale) / 100) * 100);
  const attendeesBySvc = new Map<string, string[]>();
  for (const a of t.attendance) {
    if (a.church_id !== churchId) continue;
    const list = attendeesBySvc.get(a.service_id) ?? [];
    list.push(a.member_id);
    attendeesBySvc.set(a.service_id, list);
  }
  const byName = (first: string, last: string) =>
    members.find((g) => g.member.first_name === first && g.member.last_name === last)?.member.id ?? null;

  sundays.forEach((day, w) => {
    const svcId = sundayServiceIds[w];
    const rng = new Rng(`giving:${cfg.key}:${toISODate(day)}`);
    const attendees = rng.shuffle([...(attendeesBySvc.get(svcId) ?? [])]);
    const tithers = attendees.slice(0, Math.round(attendees.length * 0.1));
    let minute = 40;
    const tick = () => (minute += rng.int(1, 4));
    for (const m of tithers) {
      const usd = rng.chance(0.12);
      raw.push({
        day, service_id: svcId, minute: tick(), member_id: m, giver_label: null, type: "tithe",
        currency: usd ? "USD" : "LRD", major: usd ? rng.pick(GIVING_AMOUNTS_USD) : scale(rng.pick(GIVING_AMOUNTS_LRD)),
      });
    }
    const named = attendees.slice(tithers.length, tithers.length + rng.int(3, 6));
    for (const m of named) {
      raw.push({ day, service_id: svcId, minute: tick(), member_id: m, giver_label: null, type: "offering", currency: "LRD", major: scale(rng.pick([500, 1000, 1500, 2000])) });
    }
    for (let i = 0; i < rng.int(1, 3); i++) {
      const usd = rng.chance(0.3);
      raw.push({ day, service_id: svcId, minute: tick(), member_id: null, giver_label: "Anonymous", type: "offering", currency: usd ? "USD" : "LRD", major: usd ? rng.pick([5, 10, 20]) : scale(rng.pick([750, 1250, 2000])) });
    }
    for (let i = 0; i < rng.int(0, 3); i++) {
      const usd = rng.chance(0.25);
      raw.push({ day, service_id: svcId, minute: tick(), member_id: rng.pick(attendees), giver_label: null, type: "thanksgiving", currency: usd ? "USD" : "LRD", major: usd ? rng.pick([20, 50]) : scale(rng.pick([5000, 7500, 10000, 15000])) });
    }
    for (let i = 0; i < rng.int(2, 5); i++) {
      const usd = rng.chance(0.3);
      raw.push({ day, service_id: svcId, minute: tick(), member_id: rng.pick(attendees), giver_label: null, type: "building_fund", currency: usd ? "USD" : "LRD", major: usd ? rng.pick([50, 100, 200]) : scale(rng.pick([2000, 2500, 5000, 10000])) });
    }
    for (let i = 0; i < rng.int(1, 3); i++) {
      const usd = rng.chance(0.4);
      raw.push({ day, service_id: svcId, minute: tick(), member_id: rng.pick(attendees), giver_label: null, type: "pledge_payment", currency: usd ? "USD" : "LRD", major: usd ? rng.pick([50, 100]) : scale(rng.pick([5000, 10000, 20000])) });
    }
    raw.push({ day, service_id: svcId, minute: tick(), member_id: null, giver_label: "Loose offering count", type: "offering", currency: "LRD", major: scale(rng.int(300, 450) * 100) });
    raw.push({ day, service_id: svcId, minute: tick(), member_id: null, giver_label: "Loose offering count", type: "offering", currency: "USD", major: rng.int(4, 12) * 10 });
  });

  // Mockup rows on the most recent Sunday (Grace Fellowship only).
  if (cfg.key === "grace") {
    const day = sundays[0];
    const svc = sundayServiceIds[0];
    const fixed: Omit<Draft, "day" | "service_id">[] = [
      { minute: 42, member_id: byName("Abraham", "Sumo"), giver_label: null, type: "tithe", currency: "LRD", major: 5000 },
      { minute: 44, member_id: null, giver_label: "Anonymous", type: "offering", currency: "LRD", major: 1250 },
      { minute: 51, member_id: byName("Esther", "Kollie"), giver_label: null, type: "tithe", currency: "USD", major: 50 },
      { minute: 65, member_id: byName("Lawrence", "Gono"), giver_label: null, type: "building_fund", currency: "USD", major: 100 },
      { minute: 72, member_id: byName("Beatrice", "Flomo"), giver_label: null, type: "thanksgiving", currency: "LRD", major: 10000 },
      { minute: 91, member_id: byName("Isaac", "Kpoto"), giver_label: null, type: "tithe", currency: "LRD", major: 3000, tag: "wrong_amount" },
      { minute: 101, member_id: byName("Isaac", "Kpoto"), giver_label: null, type: "tithe", currency: "LRD", major: 300, tag: "corrected" },
    ];
    for (const f of fixed) raw.push({ ...f, day, service_id: svc });
  }

  wednesdays.forEach((day) => {
    const rng = new Rng(`giving-mid:${cfg.key}:${toISODate(day)}`);
    const svcId = uuidFrom(`svc:${cfg.key}:midweek:${toISODate(day)}`);
    raw.push({ day, service_id: svcId, minute: cfg.midweek.hour * 60 + rng.int(20, 40), member_id: null, giver_label: "Loose offering count", type: "offering", currency: "LRD", major: scale(rng.int(50, 90) * 100) });
  });

  raw.sort((a, b) => a.day.getTime() - b.day.getTime() || a.minute - b.minute);

  let gv = 0;
  let rev = 0;
  // Sunday minutes are relative to the service start; midweek minutes are from midnight.
  const hourFor = (d: Draft) => (d.minute >= 12 * 60 ? 0 : cfg.service.hour);
  const entries: GivingEntry[] = [];
  const reversalsToAdd: { original: GivingEntry; reason: string; minuteAfter: number }[] = [];
  const histRng = new Rng(`giving-reversals:${cfg.key}`);
  const reversalDays = new Set([toISODate(sundays[9]), toISODate(sundays[17])]);
  const reversedOnDay = new Set<string>();

  for (const d of raw) {
    gv++;
    const created = addMinutes(at(d.day, hourFor(d)), d.minute);
    const entry: GivingEntry = {
      id: uuidFrom(`gv:${cfg.key}:${toISODate(d.day)}:${gv}`),
      church_id: churchId,
      ref: `GV-${String(gv).padStart(4, "0")}`,
      kind: "posted",
      service_id: d.service_id,
      member_id: d.member_id,
      giver_label: d.giver_label,
      type: d.type,
      currency: d.currency,
      amount_minor: d.major * 100,
      reverses_id: null,
      reason: null,
      actor_name: cfg.staff.find((s) => s.role === "treasurer")!.display,
      created_at: iso(created),
    };
    entries.push(entry);
    if (d.tag === "wrong_amount") reversalsToAdd.push({ original: entry, reason: "Wrong amount", minuteAfter: 9 });
    const dayKey = toISODate(d.day);
    if (reversalDays.has(dayKey) && !reversedOnDay.has(dayKey) && d.member_id && d.type === "tithe" && histRng.chance(0.3)) {
      reversedOnDay.add(dayKey);
      reversalsToAdd.push({ original: entry, reason: histRng.pick(["Duplicate entry", "Entered under the wrong member"]), minuteAfter: 6 });
    }
  }

  for (const r of reversalsToAdd) {
    rev++;
    const created = addMinutes(new Date(r.original.created_at), r.minuteAfter);
    const corrected = entries.find(
      (e) => r.reason === "Wrong amount" && e.member_id === r.original.member_id && e.id !== r.original.id && e.created_at > r.original.created_at,
    );
    t.giving_entries.push({
      ...r.original,
      id: uuidFrom(`rev:${r.original.id}`),
      ref: `REV-${String(rev).padStart(4, "0")}`,
      kind: "reversal",
      reverses_id: r.original.id,
      reason: corrected ? `Wrong amount, re-entered as ${corrected.ref}` : r.reason,
      created_at: iso(created),
    });
  }
  t.giving_entries.push(...entries);

  // Day closes: every past giving day is closed except the most recent Sunday,
  // which still has offline drafts waiting for treasurer review.
  const days = new Set(raw.map((d) => toISODate(d.day)));
  const openDay = cfg.key === "grace" ? toISODate(sundays[0]) : null;
  for (const day of days) {
    if (day === openDay) continue;
    t.day_closes.push({
      id: uuidFrom(`close:${cfg.key}:${day}`),
      church_id: churchId,
      day,
      closed_by: cfg.staff.find((s) => s.role === "treasurer")!.display,
      created_at: iso(at(parseISO(day), 15)),
    });
  }

  if (cfg.key === "grace") {
    const day = sundays[0];
    const drafts: Pick<GivingDraft, "member_id" | "giver_label" | "type" | "currency" | "amount_minor">[] = [
      { member_id: byName("Grace", "Doe"), giver_label: null, type: "tithe", currency: "LRD", amount_minor: 250_000 },
      { member_id: null, giver_label: "Anonymous", type: "offering", currency: "USD", amount_minor: 1_200 },
    ];
    drafts.forEach((d, i) => {
      t.giving_drafts.push({
        id: uuidFrom(`draft:grace:${i}`),
        church_id: churchId,
        ref: `DR-${String(i + 1).padStart(4, "0")}`,
        service_id: sundayServiceIds[0],
        ...d,
        device: "Usher tablet 2",
        captured_by: "Usher tablet 2",
        status: "pending_review",
        sync_state: "synced",
        created_at: iso(addMinutes(at(day, 11), 58 + i * 5)),
      });
    });
  }
}

const ASSIGNEES: Record<ChurchConfig["key"], string[]> = {
  grace: ["Deacon P. Flomo", "Sis. M. Doe", "Rev. J. Kollie", "Bro. E. Flomo"],
  living: ["Rev. S. Barclay", "Sis. J. Pewee", "Bro. G. Sackie"],
};

const SOURCES = ["First-time guest", "Crusade contact", "Invited by a member", "Street evangelism", "Youth outreach", "Radio programme"];

const NOTES = [
  "Called; family is settling in the area and wants to visit again.",
  "Visited at home. Asked about Sunday School for the children.",
  "Prayed together. Will attend Wednesday Bible study.",
  "No answer on the phone; sent a text instead.",
  "Came to Sunday service with a friend.",
  "Asked about the membership class.",
  "Met after service. Interested in the Choir.",
];

function generatePastoral(
  cfg: ChurchConfig,
  churchId: string,
  now: Date,
  members: GeneratedMember[],
  deptId: (k: DeptKey) => string,
  t: Tables,
) {
  const rng = new Rng(`pastoral:${cfg.key}`);
  const assignees = ASSIGNEES[cfg.key];
  const count = cfg.key === "grace" ? 22 : 10;
  const stages: ProspectStage[] = ["new_contact", "contacted", "visiting", "ready_to_join", "converted"];
  const usedPhones = new Set<string>();
  const findMember = (first: string, last: string) =>
    members.find((g) => g.member.first_name === first && g.member.last_name === last)?.member;

  const prospects: Prospect[] = [];
  const featured =
    cfg.key === "grace"
      ? [
          { first: "Comfort", last: "Gbessay", stage: "contacted" as ProspectStage, assignee: "Deacon P. Flomo", source: "First-time guest", firstDaysAgo: (getDay(now) + 7) % 14 || 7, nextIn: 0 },
          { first: "Joseph", last: "Kpoto", stage: "converted" as ProspectStage, assignee: "Sis. M. Doe", source: "Crusade contact", firstDaysAgo: 75, nextIn: null },
          { first: "Samuel", last: "Wesseh", stage: "converted" as ProspectStage, assignee: "Bro. E. Flomo", source: "Youth outreach", firstDaysAgo: 60, nextIn: null },
        ]
      : [];

  for (let i = 0; i < count; i++) {
    const f = featured[i];
    const gender = rng.chance(0.55) ? "female" : "male";
    const first = f?.first ?? (gender === "female" ? rng.pick(FEMALE_FIRST) : rng.pick(MALE_FIRST));
    const last = f?.last ?? pickSurname(rng);
    const stage = f?.stage ?? rng.weighted([["new_contact", 4], ["contacted", 5], ["visiting", 4], ["ready_to_join", 3], ["converted", 2]] as const);
    const firstDaysAgo = f?.firstDaysAgo ?? rng.int(3, 80);
    const id = uuidFrom(`prospect:${cfg.key}:${i}`);
    const converted = stage === "converted" ? (f ? findMember(f.first, f.last) : undefined) : undefined;
    const nextIn = f ? f.nextIn : stage === "converted" ? null : rng.int(-3, 12);
    const p: Prospect = {
      id,
      church_id: churchId,
      first_name: first,
      last_name: last,
      phone: converted?.phone ?? (rng.chance(0.9) ? randomPhone(rng, usedPhones) : null),
      stage: stage === "converted" && !converted ? "ready_to_join" : stage,
      assignee_name: f?.assignee ?? rng.pick(assignees),
      source: f?.source ?? rng.pick(SOURCES),
      first_contact_on: toISODate(subDays(now, firstDaysAgo)),
      next_follow_up_on: nextIn === null ? null : toISODate(addDays(now, nextIn)),
      converted_member_id: converted?.id ?? null,
      created_at: iso(subDays(now, firstDaysAgo)),
    };
    if (converted) converted.converted_from_prospect_id = id;
    prospects.push(p);

    const stageIdx = stages.indexOf(p.stage);
    const notes = Math.min(4, stageIdx + 1);
    for (let n = 0; n < notes; n++) {
      const daysAgo = Math.max(0, Math.round(firstDaysAgo - (firstDaysAgo / (notes + 1)) * n));
      t.follow_up_events.push({
        id: uuidFrom(`fu:${id}:${n}`),
        church_id: churchId,
        prospect_id: id,
        member_id: null,
        note: n === 0 ? `${p.source}. Contact details taken.` : rng.pick(NOTES),
        author_name: p.assignee_name,
        created_at: iso(at(subDays(now, daysAgo), 14, rng.int(0, 59))),
      });
    }
  }
  t.prospects.push(...prospects);

  /* Follow-up tasks */
  const fmt = (d: string) => format(parseISO(d), "d MMM");
  const lastSeen = (m: Member) => {
    let latest: string | null = null;
    for (const a of t.attendance) {
      if (a.member_id === m.id && (!latest || a.checked_in_at > latest)) latest = a.checked_in_at;
    }
    return latest;
  };
  const tasks: Omit<FollowUpTask, "id" | "church_id" | "created_at" | "done_at">[] = [];
  if (cfg.key === "grace") {
    const comfort = prospects[0];
    const joseph = findMember("Joseph", "Kpoto")!;
    const moses = findMember("Moses", "Tarr")!;
    const hawa = findMember("Hawa", "Kamara")!;
    const samuel = findMember("Samuel", "Wesseh")!;
    const prince = findMember("Prince", "Togba")!;
    tasks.push(
      { subject: "prospect", prospect_id: comfort.id, member_id: null, context: `First-time guest, ${fmt(comfort.first_contact_on)}`, assignee_name: "Deacon P. Flomo", due_on: toISODate(now) },
      { subject: "member", prospect_id: null, member_id: joseph.id, context: `New convert, ${fmt(joseph.joined_on)}`, assignee_name: "Sis. M. Doe", due_on: toISODate(nextWeekday(now, 5)) },
      { subject: "member", prospect_id: null, member_id: moses.id, context: `Inactive · last attended ${fmt(lastSeen(moses) ?? moses.joined_on)}`, assignee_name: "Pastoral call", due_on: toISODate(subDays(now, 2)) },
      { subject: "member", prospect_id: null, member_id: hawa.id, context: `Inactive · last attended ${fmt(lastSeen(hawa) ?? hawa.joined_on)}`, assignee_name: "Women's Fellowship", due_on: toISODate(nextWeekday(now, 6)) },
      { subject: "member", prospect_id: null, member_id: samuel.id, context: `New member welcome · Youth`, assignee_name: "Bro. E. Flomo", due_on: toISODate(addDays(now, 1)) },
      { subject: "member", prospect_id: null, member_id: prince.id, context: `Inactive · last attended ${fmt(lastSeen(prince) ?? prince.joined_on)}`, assignee_name: "Bro. E. Flomo", due_on: toISODate(addDays(now, 3)) },
    );
  }
  for (const p of prospects) {
    if (cfg.key === "grace" && p === prospects[0]) continue;
    if (!p.next_follow_up_on || tasks.length >= 10) continue;
    tasks.push({
      subject: "prospect",
      prospect_id: p.id,
      member_id: null,
      context: `${p.source}, ${fmt(p.first_contact_on)}`,
      assignee_name: p.assignee_name,
      due_on: p.next_follow_up_on,
    });
  }
  if (cfg.key === "living") {
    const varney = findMember("Varney", "Gbessay")!;
    tasks.unshift({ subject: "member", prospect_id: null, member_id: varney.id, context: `Inactive · last attended ${fmt(lastSeen(varney) ?? varney.joined_on)}`, assignee_name: "Pastoral call", due_on: toISODate(subDays(now, 1)) });
    const youthMember = members.find((g) => g.profile === "lapsed" && t.member_departments.some((md) => md.member_id === g.member.id && md.department_id === deptId("youth")));
    if (youthMember) {
      tasks.push({ subject: "member", prospect_id: null, member_id: youthMember.member.id, context: `Inactive · last attended ${fmt(lastSeen(youthMember.member) ?? youthMember.member.joined_on)}`, assignee_name: "Bro. G. Sackie", due_on: toISODate(addDays(now, 2)) });
    }
  }
  tasks.forEach((task, i) =>
    t.tasks.push({ ...task, id: uuidFrom(`task:${cfg.key}:${i}`), church_id: churchId, done_at: null, created_at: iso(subDays(now, 3)) }),
  );
}

function generateEvents(
  cfg: ChurchConfig,
  churchId: string,
  now: Date,
  deptId: (k: DeptKey) => string,
  nextSundayServiceId: string,
  t: Tables,
) {
  const ev = (
    key: string,
    title: string,
    start: Date,
    location: string,
    description: string,
    opts: { dept?: DeptKey; service?: string | null; reminder?: boolean; hours?: number } = {},
  ) =>
    t.events.push({
      id: uuidFrom(`event:${cfg.key}:${key}`),
      church_id: churchId,
      title,
      starts_at: iso(start),
      ends_at: iso(addMinutes(start, (opts.hours ?? 2) * 60)),
      location,
      description,
      department_id: opts.dept && cfg.depts.includes(opts.dept) ? deptId(opts.dept) : null,
      service_id: opts.service ?? null,
      reminder_planned: opts.reminder ?? false,
      created_at: iso(subDays(now, 20)),
    });

  const sat = nextWeekday(now, 6);
  const fri2 = nextWeekday(now, 5, 1);
  const harvest = nextWeekday(now, 0, 3);
  if (cfg.key === "grace") {
    ev("leaders", "Leaders' meeting", at(sat, 10), "Fellowship hall", "Monthly meeting of department heads and deacons. Agenda: harvest preparations and the youth revival.");
    ev("revival", "Youth Revival Night", at(fri2, 18), "Main sanctuary", "An evening of worship, testimony and prayer led by the Youth department.", { dept: "youth", hours: 3 });
    ev("harvest", "Harvest Thanksgiving Service", at(harvest, 9), "Main sanctuary", "Annual harvest thanksgiving. Members bring produce and thanksgiving offerings.", { reminder: true, hours: 3 });
    ev("choir-rehearsal", "Choir rehearsal for Harvest", at(nextWeekday(now, 4), 17), "Main sanctuary", "Full choir rehearsal ahead of the Harvest service.", { dept: "choir" });
    ev("mens-retreat", "Men's Fellowship retreat", at(nextWeekday(now, 6, 5), 8), "Kpatawee, Bong County", "A one-day retreat for the Men's Fellowship.", { dept: "mens", hours: 9 });
    ev("baptism", "Baptism service", at(nextWeekday(now, 0, 6), 7), "Main sanctuary", "Baptism of new converts, followed by Sunday worship.", { hours: 2 });
    ev("prayer-breakfast", "Women's Fellowship prayer breakfast", at(subDays(sat, 14), 8), "Fellowship hall", "Prayer breakfast hosted by the Women's Fellowship.", { dept: "womens" });
    ev("youth-sports", "Youth sports day", at(subDays(sat, 28), 9), "SKD Sports Complex", "Football and kickball with the youth of neighbouring churches.", { dept: "youth", hours: 6 });
    ev("anniversary", "Choir anniversary", at(subDays(harvest, 49), 9), "Main sanctuary", "Celebrating 12 years of the Grace Fellowship choir.", { dept: "choir", service: null, hours: 3 });
    ev("sunday-next", "Sunday Worship", at(upcomingSunday(now), 9), "Main sanctuary", "Weekly Sunday worship service.", { service: nextSundayServiceId });
  } else {
    ev("leaders", "Leaders' meeting", at(sat, 15), "Main hall", "Planning for the end-of-year programme.");
    ev("youth-camp", "Youth Bible camp", at(fri2, 16), "Cuttington University grounds", "Weekend Bible camp for the youth.", { dept: "youth", hours: 6 });
    ev("harvest", "Harvest Thanksgiving Service", at(harvest, 10), "Main hall", "Annual harvest thanksgiving service.", { reminder: true, hours: 3 });
    ev("women-conf", "Women's conference", at(subDays(sat, 21), 9), "Main hall", "Day conference for the women of the church.", { dept: "womens", hours: 6 });
  }
}

function generateMessaging(cfg: ChurchConfig, churchId: string, now: Date, t: Tables) {
  const rng = new Rng(`messaging:${cfg.key}`);
  const sender = cfg.staff.find((s) => s.role === "secretary")!.display;
  const memberCount = t.members.filter((m) => m.church_id === churchId).length || cfg.memberCount;
  const msgs =
    cfg.key === "grace"
      ? [
          { days: 3, body: "Grace Fellowship: Youth Revival Night is on Friday 6PM in the main sanctuary. Bring a friend. God bless you.", audience: "Youth department", count: 84 },
          { days: 10, body: "Reminder: Leaders' meeting Saturday 10AM, Fellowship hall. Please be on time.", audience: "Deacons + department heads", count: 22 },
          { days: 17, body: "Dear member, we missed you at church. We are praying for you and your family. Call Rev. Kollie anytime.", audience: "Inactive members", count: 54 },
          { days: 24, body: "Grace Fellowship: Harvest Thanksgiving is coming. Start preparing your thanksgiving offering. God bless you.", audience: "All members", count: memberCount - 14 },
          { days: 38, body: "Women's Fellowship prayer breakfast this Saturday 8AM. Contribution LRD 500.", audience: "Women's Fellowship", count: 131 },
          { days: 52, body: "Midweek Bible Study continues Wednesday 6PM. Topic: The Book of Ruth.", audience: "All members", count: memberCount - 16 },
        ]
      : [
          { days: 5, body: "Living Waters: Youth Bible camp registration closes Sunday. See Bro. Sackie.", audience: "Youth department", count: 38 },
          { days: 19, body: "Wednesday prayer meeting moves to 5:30PM this week only.", audience: "All members", count: memberCount - 6 },
          { days: 33, body: "Thank you for a blessed Women's conference. God bless you.", audience: "Women's Fellowship", count: 61 },
        ];
  let spent = 0;
  msgs.forEach((m, i) => {
    const segments = m.body.length <= 160 ? 1 : Math.ceil(m.body.length / 153);
    const failed = Math.max(0, Math.round(m.count * rng.next() * 0.04));
    const credits = m.count * segments;
    spent += credits;
    const created = at(subDays(now, m.days), rng.int(9, 16), rng.int(0, 59));
    t.messages.push({
      id: uuidFrom(`msg:${cfg.key}:${i}`),
      church_id: churchId,
      body: m.body,
      audience_label: m.audience,
      recipient_count: m.count,
      excluded_opt_out: rng.int(2, 9),
      segments,
      credits,
      delivered: m.count - failed,
      failed,
      status: "delivered",
      sent_by: sender,
      created_at: iso(created),
    });
    t.sms_wallet.push({
      id: uuidFrom(`wallet:${cfg.key}:capture:${i}`),
      church_id: churchId,
      kind: "capture",
      credits: -credits,
      note: `Message to ${m.audience}`,
      created_at: iso(created),
    });
  });
  const topUps = [
    { days: 95, credits: 1000 },
    { days: 30, credits: 0 },
  ];
  topUps[1].credits = cfg.smsCredits + spent - topUps[0].credits;
  topUps.forEach((u, i) =>
    t.sms_wallet.push({
      id: uuidFrom(`wallet:${cfg.key}:credit:${i}`),
      church_id: churchId,
      kind: "credit",
      credits: u.credits,
      note: "Credits purchased from ComNet",
      created_at: iso(at(subDays(now, u.days), 11)),
    }),
  );
}

function generatePlatformOnly(now: Date, t: Tables) {
  const meta: Array<Pick<Church, "slug" | "name" | "short_name" | "initials" | "city" | "county" | "plan" | "subscription_status" | "sms_credits" | "staff_count" | "member_count_hint"> & { renewalDays: number | null }> = [
    { slug: "bethel-pentecostal", name: "Bethel Pentecostal Church", short_name: "Bethel Pentecostal", initials: "BP", city: "Ganta", county: "Nimba", plan: "Annual", subscription_status: "renewal_due", sms_credits: 120, staff_count: 5, member_count_hint: 340, renewalDays: 36 },
    { slug: "mount-zion-methodist", name: "Mount Zion Methodist", short_name: "Mount Zion", initials: "MZ", city: "Buchanan", county: "Grand Bassa", plan: "Annual", subscription_status: "overdue_read_only", sms_credits: 0, staff_count: 3, member_count_hint: 158, renewalDays: -15 },
    { slug: "new-hope-baptist", name: "New Hope Baptist Church", short_name: "New Hope Baptist", initials: "NH", city: "Kakata", county: "Margibi", plan: "Annual", subscription_status: "onboarding", sms_credits: 0, staff_count: 2, member_count_hint: null, renewalDays: null },
  ];
  for (const m of meta) {
    const { renewalDays, ...rest } = m;
    t.churches.push({
      ...rest,
      id: uuidFrom(`church:${m.slug}`),
      renewal_on: renewalDays === null ? null : toISODate(addDays(now, renewalDays)),
      hosting_fee_minor: 85_000,
      has_content: false,
      settings: { ...DEFAULT_SETTINGS },
      created_at: iso(subDays(now, m.subscription_status === "onboarding" ? 1 : 400)),
    });
  }
}

function generatePlatformAudit(now: Date, epoch: Date, t: Tables) {
  const grace = t.churches.find((c) => c.slug === "grace-fellowship")!;
  const living = t.churches.find((c) => c.slug === "living-waters")!;
  const hope = t.churches.find((c) => c.slug === "new-hope-baptist")!;
  t.audit_events.push(
    { id: uuidFrom("audit:1"), church_id: grace.id, actor_name: "Rev. J. Kollie", action: "Support grant approved for A. Sumo at Grace Fellowship (2 hours, read-only).", created_at: iso(addMinutes(epoch, -18)) },
    { id: uuidFrom("audit:2"), church_id: grace.id, actor_name: OPERATOR_NAME, action: "A. Sumo requested support access to Grace Fellowship: import troubleshooting.", created_at: iso(addMinutes(epoch, -33)) },
    { id: uuidFrom("audit:3"), church_id: hope.id, actor_name: OPERATOR_NAME, action: "Church provisioned: New Hope Baptist Church. Invite sent to the church admin.", created_at: iso(at(subDays(now, 1), 15, 12)) },
    { id: uuidFrom("audit:4"), church_id: living.id, actor_name: OPERATOR_NAME, action: "SMS credits added: Living Waters Assembly, 500 credits.", created_at: iso(at(subDays(now, 2), 10, 40)) },
  );
}

/** Build the full seed for "today". Pure and deterministic for a given date. */
export function generateSeed(now: Date, epoch: Date): Tables {
  const t: Tables = {
    churches: [], staff: [], departments: [], members: [], member_departments: [], services: [],
    attendance: [], giving_entries: [], giving_drafts: [], day_closes: [], prospects: [],
    follow_up_events: [], tasks: [], events: [], messages: [], sms_wallet: [], support_grants: [],
    audit_events: [],
  };
  for (const cfg of DEMO_CHURCH_CONFIGS) generateChurch(cfg, now, epoch, t);
  generatePlatformOnly(now, t);
  generatePlatformAudit(now, epoch, t);
  return t;
}
