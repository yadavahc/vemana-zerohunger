import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QuerySnapshot,
} from "firebase/firestore";
import { db } from "./config";
import type {
  AppUser,
  FoodListing,
  FoodRequest,
  Match,
  Delivery,
  Escalation,
  Notification,
} from "../types";

// ── Collections ──────────────────────────────────────────────────────────────
export const COLLECTIONS = {
  USERS: "users",
  LISTINGS: "listings",
  REQUESTS: "requests",
  MATCHES: "matches",
  DELIVERIES: "deliveries",
  ESCALATIONS: "escalations",
  NOTIFICATIONS: "notifications",
  AGENT_LOGS: "agent_logs",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function snap<T>(snapshot: QuerySnapshot<DocumentData>): T[] {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

// Sort by createdAt descending — avoids composite index requirement
function byCreatedAtDesc<T extends { createdAt?: Timestamp }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const at = a.createdAt?.toMillis?.() ?? 0;
    const bt = b.createdAt?.toMillis?.() ?? 0;
    return bt - at;
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────
export async function getUser(uid: string): Promise<AppUser | null> {
  const s = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return s.exists() ? ({ uid: s.id, ...s.data() } as AppUser) : null;
}

export async function createUser(uid: string, data: Omit<AppUser, "uid" | "createdAt">) {
  // Strip undefined fields — Firestore rejects them
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    uid,
    ...clean,
    createdAt: serverTimestamp(),
  });
}

// ── Food Listings ─────────────────────────────────────────────────────────────
export async function createListing(data: Omit<FoodListing, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.LISTINGS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateListing(id: string, data: Partial<FoodListing>) {
  await updateDoc(doc(db, COLLECTIONS.LISTINGS, id), data as DocumentData);
}

export async function getAvailableListings(): Promise<FoodListing[]> {
  const q = query(collection(db, COLLECTIONS.LISTINGS), where("status", "==", "available"));
  const snapshot = await getDocs(q);
  return byCreatedAtDesc(snap<FoodListing>(snapshot));
}

export function subscribeToListings(restaurantId: string, cb: (listings: FoodListing[]) => void) {
  const q = query(collection(db, COLLECTIONS.LISTINGS), where("restaurantId", "==", restaurantId));
  return onSnapshot(q, (s) => cb(byCreatedAtDesc(snap<FoodListing>(s))));
}

export async function getListingById(id: string): Promise<FoodListing | null> {
  const s = await getDoc(doc(db, COLLECTIONS.LISTINGS, id));
  return s.exists() ? ({ id: s.id, ...s.data() } as FoodListing) : null;
}

// ── Food Requests ─────────────────────────────────────────────────────────────
export async function createRequest(data: Omit<FoodRequest, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.REQUESTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRequest(id: string, data: Partial<FoodRequest>) {
  await updateDoc(doc(db, COLLECTIONS.REQUESTS, id), data as DocumentData);
}

export async function getRequestById(id: string): Promise<FoodRequest | null> {
  const s = await getDoc(doc(db, COLLECTIONS.REQUESTS, id));
  return s.exists() ? ({ id: s.id, ...s.data() } as FoodRequest) : null;
}

export async function getPendingRequests(): Promise<FoodRequest[]> {
  const q = query(collection(db, COLLECTIONS.REQUESTS), where("status", "==", "pending"));
  const snapshot = await getDocs(q);
  // Sort by priority desc client-side
  return snap<FoodRequest>(snapshot).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function subscribeToRequests(ngoId: string, cb: (requests: FoodRequest[]) => void) {
  const q = query(collection(db, COLLECTIONS.REQUESTS), where("ngoId", "==", ngoId));
  return onSnapshot(q, (s) => cb(byCreatedAtDesc(snap<FoodRequest>(s))));
}

// ── Matches ───────────────────────────────────────────────────────────────────
export async function createMatch(data: Omit<Match, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.MATCHES), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMatch(id: string, data: Partial<Match>) {
  await updateDoc(doc(db, COLLECTIONS.MATCHES, id), data as DocumentData);
}

export async function getMatchById(id: string): Promise<Match | null> {
  const s = await getDoc(doc(db, COLLECTIONS.MATCHES, id));
  return s.exists() ? ({ id: s.id, ...s.data() } as Match) : null;
}

export function subscribeToRestaurantMatches(
  restaurantId: string,
  cb: (matches: Match[]) => void
) {
  // Two equality where clauses — no composite index needed (no orderBy)
  const q = query(
    collection(db, COLLECTIONS.MATCHES),
    where("restaurantId", "==", restaurantId),
    where("status", "==", "pending_approval")
  );
  return onSnapshot(q, (s) => cb(snap<Match>(s)));
}

// ── Deliveries ────────────────────────────────────────────────────────────────
export async function createDelivery(data: Omit<Delivery, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.DELIVERIES), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDelivery(id: string, data: Partial<Delivery>) {
  await updateDoc(doc(db, COLLECTIONS.DELIVERIES, id), data as DocumentData);
}

export async function getOpenDeliveries(): Promise<Delivery[]> {
  const q = query(
    collection(db, COLLECTIONS.DELIVERIES),
    where("status", "==", "finding_volunteer"),
    limit(20)
  );
  const snapshot = await getDocs(q);
  return snap<Delivery>(snapshot);
}

export function subscribeToVolunteerDeliveries(
  volunteerId: string,
  cb: (deliveries: Delivery[]) => void
) {
  const q = query(collection(db, COLLECTIONS.DELIVERIES), where("volunteerId", "==", volunteerId));
  return onSnapshot(q, (s) => cb(byCreatedAtDesc(snap<Delivery>(s))));
}

export function subscribeToOpenDeliveries(cb: (deliveries: Delivery[]) => void) {
  const q = query(
    collection(db, COLLECTIONS.DELIVERIES),
    where("status", "==", "finding_volunteer"),
    limit(10)
  );
  return onSnapshot(q, (s) => cb(snap<Delivery>(s)));
}

// ── Escalations ───────────────────────────────────────────────────────────────
export async function createEscalation(
  data: Omit<Escalation, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.ESCALATIONS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEscalation(id: string, data: Partial<Escalation>) {
  await updateDoc(doc(db, COLLECTIONS.ESCALATIONS, id), data as DocumentData);
}

export async function getOpenEscalations(): Promise<Escalation[]> {
  const q = query(
    collection(db, COLLECTIONS.ESCALATIONS),
    where("status", "in", ["open", "escalated_to_admin"])
  );
  const snapshot = await getDocs(q);
  return byCreatedAtDesc(snap<Escalation>(snapshot));
}

export function subscribeToEscalations(
  cb: (escalations: Escalation[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, COLLECTIONS.ESCALATIONS),
    where("status", "in", ["open", "escalated_to_admin"])
  );
  return onSnapshot(q, (s) => cb(byCreatedAtDesc(snap<Escalation>(s))), onError ?? (() => {}));
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function createNotification(
  data: Omit<Notification, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id), { read: true });
}

export function subscribeToNotifications(userId: string, cb: (n: Notification[]) => void) {
  // Single where clause — no composite index needed
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where("userId", "==", userId),
    limit(30)
  );
  return onSnapshot(q, (s) => cb(byCreatedAtDesc(snap<Notification>(s))));
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export async function getAllRequests(): Promise<FoodRequest[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.REQUESTS));
  return snap<FoodRequest>(snapshot);
}

export async function getAllListings(): Promise<FoodListing[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.LISTINGS));
  return snap<FoodListing>(snapshot);
}

export async function getAllDeliveries(): Promise<Delivery[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.DELIVERIES));
  return snap<Delivery>(snapshot);
}

export async function getAllMatches(): Promise<Match[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.MATCHES));
  return snap<Match>(snapshot);
}

// ── Agent Logging ─────────────────────────────────────────────────────────────
export interface AgentLog {
  id: string;
  agent: string;
  action: string;
  context: Record<string, unknown>;
  timestamp: Timestamp;
}

export async function logAgentDecision(
  agent: string,
  action: string,
  context: Record<string, unknown>
) {
  await addDoc(collection(db, COLLECTIONS.AGENT_LOGS), {
    agent,
    action,
    context,
    timestamp: serverTimestamp(),
  });
}

export function subscribeToAgentLogs(
  cb: (logs: AgentLog[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, COLLECTIONS.AGENT_LOGS), limit(50));
  return onSnapshot(
    q,
    (s) => {
      const logs = s.docs
        .map((d) => ({ id: d.id, ...d.data() } as AgentLog))
        .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
      cb(logs);
    },
    onError ?? (() => {})
  );
}
