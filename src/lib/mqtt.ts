import mqtt from "mqtt";

export interface PatrolData {
  id: string;
  code: string;
  ptlName: string;
  comd: string;
  str: string;
  wpn: string;
  ammo: string;
  purpose: string;
  location: { lat: number; lng: number } | null;
  status: "active" | "offline" | "pending";
  lastSeen: Date;
  startTime: Date;
  lastUpdate: number;
}

export interface MQTTMessage {
  type: "auth_request" | "auth_response" | "patrol_start" | "location_update" | "patrol_end" | "heartbeat";
  payload: any;
  timestamp: number;
}

class MQTTService {
  private client: mqtt.MqttClient | null = null;
  private isConnected: boolean = false;
  private messageHandlers: Map<string, (message: MQTTMessage) => void> = new Map();
  private connectionAttempted: boolean = false;
  private isConnecting: boolean = false;

  // Using HiveMQ public broker (free for testing)
  private brokerUrl: string = "wss://broker.hivemq.com:8884/mqtt";
  private options: mqtt.IClientOptions = {
    clientId: `patrol_hq_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 10000, // 10 seconds
    reconnectPeriod: 0, // Disable auto-reconnect
    keepalive: 60,
  };

  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting || (this.client && this.isConnected)) {
      return;
    }

    this.isConnecting = true;
    this.connectionAttempted = true;

    return new Promise((resolve) => {
      try {
        console.log("🔌 Attempting MQTT connection...");
        
        this.client = mqtt.connect(this.brokerUrl, this.options);

        // Set a hard timeout - always resolve after 8 seconds regardless of outcome
        const hardTimeout = setTimeout(() => {
          if (!this.isConnected) {
            console.warn("⚠️ MQTT connection timeout - continuing in offline mode");
            this.cleanupFailedConnection();
            this.isConnecting = false;
            resolve();
          }
        }, 8000);

        this.client.on("connect", () => {
          clearTimeout(hardTimeout);
          console.log("✅ MQTT Connected successfully");
          this.isConnected = true;
          this.isConnecting = false;
          resolve();
        });

        this.client.on("error", (error) => {
          clearTimeout(hardTimeout);
          console.warn("⚠️ MQTT error:", error.message);
          this.cleanupFailedConnection();
          this.isConnecting = false;
          resolve(); // Always resolve to let app continue
        });

        this.client.on("offline", () => {
          console.log("📴 MQTT offline");
          this.isConnected = false;
        });

        this.client.on("message", (topic, message) => {
          try {
            const parsedMessage: MQTTMessage = JSON.parse(message.toString());
            const handler = this.messageHandlers.get(topic);
            if (handler) {
              handler(parsedMessage);
            }
          } catch (error) {
            console.error("Error parsing MQTT message:", error);
          }
        });

      } catch (error) {
        console.warn("⚠️ MQTT connection failed:", error);
        this.cleanupFailedConnection();
        this.isConnecting = false;
        resolve(); // Always resolve to let app continue
      }
    });
  }

  private cleanupFailedConnection(): void {
    try {
      if (this.client) {
        this.client.removeAllListeners();
        this.client.end(true);
        this.client = null;
      }
      this.isConnected = false;
    } catch (error) {
      console.error("Error cleaning up MQTT connection:", error);
    }
  }

  disconnect(): void {
    try {
      if (this.client) {
        this.client.removeAllListeners();
        this.client.end(true);
        this.client = null;
      }
      this.isConnected = false;
      this.isConnecting = false;
    } catch (error) {
      console.error("Error disconnecting MQTT:", error);
    }
  }

  async subscribe(topic: string, handler: (message: MQTTMessage) => void): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client || !this.isConnected) {
        console.warn(`⚠️ Cannot subscribe to ${topic} - MQTT not connected`);
        resolve(); // Resolve anyway to not block execution
        return;
      }

      try {
        this.client.subscribe(topic, (error) => {
          if (error) {
            console.error(`❌ Failed to subscribe to ${topic}:`, error);
          } else {
            console.log(`✅ Subscribed to ${topic}`);
            this.messageHandlers.set(topic, handler);
          }
          resolve(); // Always resolve
        });
      } catch (error) {
        console.error(`❌ Subscribe error for ${topic}:`, error);
        resolve(); // Always resolve
      }
    });
  }

  async unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve) => {
      this.messageHandlers.delete(topic);
      
      if (!this.client || !this.isConnected) {
        resolve();
        return;
      }

      try {
        this.client.unsubscribe(topic, () => {
          resolve();
        });
      } catch (error) {
        console.error(`Error unsubscribing from ${topic}:`, error);
        resolve();
      }
    });
  }

  async publish(topic: string, message: MQTTMessage): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client || !this.isConnected) {
        console.log(`📦 MQTT offline - queueing message for ${topic}`);
        this.queueOfflineMessage(topic, message);
        resolve();
        return;
      }

      try {
        this.client.publish(
          topic,
          JSON.stringify(message),
          { qos: 1, retain: false },
          (error) => {
            if (error) {
              console.error(`❌ Failed to publish to ${topic}:`, error);
              this.queueOfflineMessage(topic, message);
            } else {
              console.log(`✅ Published to ${topic}`);
            }
            resolve(); // Always resolve
          }
        );
      } catch (error) {
        console.error(`❌ Publish error for ${topic}:`, error);
        this.queueOfflineMessage(topic, message);
        resolve();
      }
    });
  }

  private queueOfflineMessage(topic: string, message: MQTTMessage): void {
    try {
      const queue = this.getOfflineQueue();
      queue.push({ topic, message, timestamp: Date.now() });
      localStorage.setItem("mqtt_offline_queue", JSON.stringify(queue));
      console.log(`📦 Message queued for ${topic} (${queue.length} total)`);
    } catch (error) {
      console.error("Failed to queue offline message:", error);
    }
  }

  private getOfflineQueue(): Array<{ topic: string; message: MQTTMessage; timestamp: number }> {
    try {
      const queue = localStorage.getItem("mqtt_offline_queue");
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }

  async syncOfflineQueue(): Promise<void> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return;

    console.log(`🔄 Syncing ${queue.length} queued messages...`);
    
    for (const item of queue) {
      try {
        await this.publish(item.topic, item.message);
      } catch (error) {
        console.error("Failed to sync message:", error);
      }
    }

    localStorage.removeItem("mqtt_offline_queue");
    console.log("✅ Offline queue synced");
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  hasAttemptedConnection(): boolean {
    return this.connectionAttempted;
  }
}

// Singleton instance
export const mqttService = new MQTTService();

// Topic structure
export const MQTT_TOPICS = {
  // HQ publishes authorization codes here
  AUTH_RESPONSE: "patrol/auth/response",
  
  // Patrol apps request authorization here
  AUTH_REQUEST: "patrol/auth/request",
  
  // Patrol apps publish patrol start info
  PATROL_START: "patrol/start",
  
  // Patrol apps publish location updates
  LOCATION_UPDATE: "patrol/location",
  
  // Patrol apps publish when ending patrol
  PATROL_END: "patrol/end",
  
  // Heartbeat to check connection
  HEARTBEAT: "patrol/heartbeat",
};