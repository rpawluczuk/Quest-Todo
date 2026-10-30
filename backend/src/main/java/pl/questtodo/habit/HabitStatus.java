package pl.questtodo.habit;

public enum HabitStatus {
    ACTIVE, PLANNED, PAUSED;

    public boolean canChangeTo(HabitStatus next) {
        return this == next || (this == ACTIVE && next == PAUSED)
                || ((this == PLANNED || this == PAUSED) && next == ACTIVE);
    }
}
