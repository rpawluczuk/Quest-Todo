package pl.questtodo.goal;

public enum GoalEntryType {
    NOTE, SUCCESS, DIFFICULTY, INSIGHT;

    @com.fasterxml.jackson.annotation.JsonCreator
    public static GoalEntryType fromJson(String value) {
        return value == null ? null : valueOf(value);
    }
}
