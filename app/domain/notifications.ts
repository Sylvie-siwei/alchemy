import type { Person } from "./model";

export type NotificationChannel = "preview" | "email";
export type NotificationScope = "owner" | "global";

export interface NotificationTarget {
  id: string;
  name: string;
  channel: NotificationChannel;
  address?: string;
  scope: NotificationScope;
}

export interface NotificationDelivery {
  send(target: NotificationTarget, content: string): Promise<{ messageId: string }>;
}

export interface DailyBriefSchedule {
  feedbackSyncAt: "06:00";
  generateAt: "09:20";
  deliverAt: string;
}

export const dailyBriefSchedule = (deliverAt = "09:30"): DailyBriefSchedule => ({ feedbackSyncAt: "06:00", generateAt: "09:20", deliverAt });

export function ownerNotificationTarget(member: Person, channel: NotificationChannel): NotificationTarget {
  return { id: member.id, name: member.name, channel, address: channel === "preview" ? member.notificationId : member.email, scope: "owner" };
}
