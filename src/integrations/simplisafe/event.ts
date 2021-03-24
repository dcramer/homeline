export enum EventType {
  alarm_canceled,
  alarm_triggered,
  armed_away,
  armed_away_by_keypad,
  armed_away_by_remote,
  armed_home,
  automatic_test,
  away_exit_delay_by_keypad,
  away_exit_delay_by_remote,
  camera_motion_detected,
  connection_lost,
  connection_restored,
  disarmed_by_master_pin,
  disarmed_by_remote,
  doorbell_detected,
  entity_test,
  entry_delay,
  home_exit_delay,
  lock_error,
  lock_locked,
  lock_unlocked,
  power_outage,
  power_restored,
  secret_alert_triggered,
  sensor_not_responding,
  sensor_paired_and_named,
  sensor_restored,
  user_initiated_test,
}

const EVENT_MAPPING: {
  [cid: number]: EventType;
} = {
  1110: EventType.alarm_triggered,
  1120: EventType.alarm_triggered,
  1132: EventType.alarm_triggered,
  1134: EventType.alarm_triggered,
  1154: EventType.alarm_triggered,
  1159: EventType.alarm_triggered,
  1162: EventType.alarm_triggered,
  1170: EventType.camera_motion_detected,
  1301: EventType.power_outage,
  1350: EventType.connection_lost,
  1381: EventType.sensor_not_responding,
  1400: EventType.disarmed_by_master_pin,
  1406: EventType.alarm_canceled,
  1407: EventType.disarmed_by_remote,
  1409: EventType.secret_alert_triggered,
  1429: EventType.entry_delay,
  1458: EventType.doorbell_detected,
  1531: EventType.sensor_paired_and_named,
  1601: EventType.user_initiated_test,
  1602: EventType.automatic_test,
  1604: EventType.entity_test,
  3301: EventType.power_restored,
  3350: EventType.connection_restored,
  3381: EventType.sensor_restored,
  3401: EventType.armed_away_by_keypad,
  3407: EventType.armed_away_by_remote,
  3441: EventType.armed_home,
  3481: EventType.armed_away,
  3487: EventType.armed_away,
  3491: EventType.armed_home,
  9401: EventType.away_exit_delay_by_keypad,
  9407: EventType.away_exit_delay_by_remote,
  9441: EventType.home_exit_delay,
  9700: EventType.lock_unlocked,
  9701: EventType.lock_locked,
  9703: EventType.lock_error,
};

type RawEvent = {
  eventTimestamp: number;
  eventCid: number;
  zoneCid: string;
  sensorType: number;
  sensorSerial: string;
  account: string;
  userId: number;
  sid: number;
  info: string;
  pinName: string;
  sensorName: string;
  messageSubject: string;
  messageBody: string;
  eventType: string;
  timezone: number;
  locationOffset: number;
  senderId: string;
  openCount: number;
  eventId: number;
};

type TypedEvent = RawEvent & {
  type: EventType;
};

export default (eventData: RawEvent): TypedEvent => {
  const type: EventType | undefined = EVENT_MAPPING[eventData.eventCid];
  if (!type) {
    throw new Error(`Unknown eventCid: ${eventData.eventCid}`);
  }

  return {
    ...eventData,
    type,
  };
};
