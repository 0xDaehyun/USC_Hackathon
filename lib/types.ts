export type PriorityLevel = "very-high" | "high" | "medium" | "low";

export type PriorityZone = {
  zoneId: string;
  displayName: string;
  evacuationStatus:
    | "Evacuation Order"
    | "Evacuation Warning"
    | "Advisory"
    | "None"
    | "Unknown";
  priorityScore: number;
  priorityLevel: PriorityLevel;
  components: {
    dynamicThreat: number;
    evacuationFriction: number;
    supportNeed: number;
  };
  confidence: {
    level: "high" | "medium" | "low";
    notes: string[];
  };
  reasons: string[];
  actions: Array<{
    category: "transport" | "language" | "shelter" | "health" | "outreach";
    label: string;
    verificationRequired: true;
  }>;
  sourceIds: string[];
};

export type PriorityDataset = {
  schemaVersion: "1.0";
  mode: "live" | "historical-reconstruction" | "what-if";
  calculationStatus: "illustrative" | "unvalidated" | "validated";
  statusBasis:
    | "current-authoritative"
    | "selected-official-checkpoint"
    | "maximum-observed-during-incident"
    | "hypothetical-input";
  incident: {
    id: string;
    name: string;
    jurisdiction: string;
  };
  dataAsOf: string;
  scoringModel: {
    version: string;
    weights: {
      dynamicThreat: number;
      evacuationFriction: number;
      supportNeed: number;
    };
  };
  zones: PriorityZone[];
  sourceRefs: Array<{
    id: string;
    label: string;
    url: string | null;
  }>;
};
