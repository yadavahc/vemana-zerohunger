import { Timestamp, GeoPoint } from "firebase/firestore";

export type UserRole = "ngo" | "restaurant" | "volunteer" | "admin" | "beneficiary" | "donor";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type ListingStatus = "available" | "pending" | "matched" | "collected" | "expired";

export type RequestStatus =
  | "pending"
  | "matched"
  | "approved"
  | "dispatched"
  | "delivered"
  | "failed";

export type MatchStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "dispatched"
  | "completed";

export type DeliveryStatus =
  | "finding_volunteer"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "delivered";

export type EscalationType =
  | "no_restaurant_response"
  | "volunteer_no_show"
  | "food_expiring"
  | "quality_fail";

export interface AppUser {
  uid: string;
  phone: string;
  email?: string;
  role: UserRole;
  name: string;
  orgName?: string;
  location?: GeoPoint;
  address?: string;
  verified: boolean;
  autoApprove?: boolean;  // restaurants: auto-approve incoming matches without manual tap
  createdAt: Timestamp;
}

export interface FoodItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface FoodListing {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantPhone: string;
  foodItems: FoodItem[];
  totalServings: number;
  expiryTime: Timestamp;
  location?: GeoPoint;
  address: string;
  status: ListingStatus;
  imageUrl?: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface FoodRequest {
  id: string;
  ngoId: string;
  ngoName: string;
  ngoPhone: string;
  beneficiaryCount: number;
  servingsNeeded: number;
  urgency: UrgencyLevel;
  location?: GeoPoint;
  address: string;
  status: RequestStatus;
  priority: number;
  notes?: string;
  neededBy: Timestamp;
  approvedByRestaurant?: string;
  createdAt: Timestamp;
}

export interface Match {
  id: string;
  requestId: string;
  listingId: string;
  ngoId: string;
  ngoName: string;
  restaurantId: string;
  restaurantName: string;
  status: MatchStatus;
  restaurantApprovalTime?: Timestamp;
  slaDeadline: Timestamp;
  rejectionReason?: string;
  createdAt: Timestamp;
}

export interface Delivery {
  id: string;
  matchId: string;
  requestId: string;
  listingId: string;
  volunteerId?: string;
  volunteerName?: string;
  volunteerPhone?: string;
  pickupAddress: string;
  dropAddress: string;
  status: DeliveryStatus;
  estimatedETA?: number;
  foodPhotoUrl?: string;
  qualityCheckStatus?: "pending" | "passed" | "failed";
  qualityCheckNotes?: string;
  createdAt: Timestamp;
  pickedUpAt?: Timestamp;
  completedAt?: Timestamp;
}

export interface Escalation {
  id: string;
  matchId?: string;
  deliveryId?: string;
  type: EscalationType;
  status: "open" | "resolved" | "escalated_to_admin";
  attempts: number;
  context: Record<string, unknown>;
  resolvedBy?: string;
  adminNote?: string;
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: "match" | "approval" | "dispatch" | "delivery" | "escalation" | "alert";
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}
