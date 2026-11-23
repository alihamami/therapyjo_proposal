// Session status names and colours, shared by the schedule cards and the
// dashboards' day summary (TJ-071). The colours are light, for text and dots
// on the dark staff background.

export const STATUS_ORDER = [
    "SCHEDULED",
    "WAITING",
    "CHECKED_IN",
    "WITH_DOCTOR",
    "CHECKED_OUT",
    "CANCELLED",
    "NO_SHOW",
];

export const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: "Scheduled",
    WAITING: "Waiting",
    CHECKED_IN: "Checked In",
    WITH_DOCTOR: "With Doctor",
    CHECKED_OUT: "Checked Out",
    CANCELLED: "Cancelled",
    NO_SHOW: "No Show",
};

export const STATUS_COLORS: Record<string, string> = {
    SCHEDULED: "#60a5fa",
    WAITING: "#fbbf24",
    CHECKED_IN: "#34d399",
    WITH_DOCTOR: "#a78bfa",
    CHECKED_OUT: "#cbd5e1",
    CANCELLED: "#f87171",
    NO_SHOW: "#f87171",
};
