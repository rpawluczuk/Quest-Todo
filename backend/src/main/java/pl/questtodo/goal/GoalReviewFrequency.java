package pl.questtodo.goal;

import java.time.LocalDate;

public enum GoalReviewFrequency {
    WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY;

    @com.fasterxml.jackson.annotation.JsonCreator
    public static GoalReviewFrequency fromJson(String value) {
        return value == null ? null : valueOf(value);
    }

    public LocalDate nextDate(LocalDate from) {
        return switch (this) {
            case WEEKLY -> from.plusWeeks(1);
            case BIWEEKLY -> from.plusWeeks(2);
            case MONTHLY -> from.plusMonths(1);
            case QUARTERLY -> from.plusMonths(3);
        };
    }
}
